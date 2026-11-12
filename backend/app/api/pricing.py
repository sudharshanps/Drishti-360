from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.domain import CropBatch, MandiPrice, PriceEstimate
from app.schemas.domain import PricingEstimateRequest
from app.services.fair_price_service import (
    calculate_grade_linked_price,
    compute_grade_comparison,
    get_price_trend,
)
from app.services.trace_helper import record_traceability_event
from app.utils.ids import generate_code

router = APIRouter(prefix="/pricing", tags=["Grade-Linked Fair Price Engine"])


@router.get("/mandis")
def list_mandi_benchmarks(db: Session = Depends(get_db)):
    # Return the latest entry per crop/variety/mandi combination for clean dropdown & table display
    rows = db.query(MandiPrice).order_by(MandiPrice.price_date.desc(), MandiPrice.crop_type.asc()).all()
    seen = set()
    latest = []
    for r in rows:
        key = (r.crop_type, r.variety, r.mandi_name)
        if key in seen:
            continue
        seen.add(key)
        latest.append(
            {
                "id": r.id,
                "crop_type": r.crop_type,
                "variety": r.variety,
                "mandi_name": r.mandi_name,
                "state": r.state,
                "min_price_per_quintal": r.min_price_per_quintal,
                "modal_price_per_quintal": r.modal_price_per_quintal,
                "max_price_per_quintal": r.max_price_per_quintal,
                "data_source": r.data_source,
                "price_date": r.price_date.isoformat(),
                "is_demo": r.is_demo,
            }
        )
    return latest


@router.get("/trend")
def get_mandi_trend(
    crop_type: str = Query("Turmeric"),
    mandi_location: str = Query(""),
    grade: str = Query("A"),
    db: Session = Depends(get_db),
):
    return {
        "crop_type": crop_type,
        "mandi_location": mandi_location,
        "grade": grade,
        "series": get_price_trend(db=db, crop_type=crop_type, mandi_location=mandi_location, grade=grade),
    }


@router.get("")
def list_estimates(db: Session = Depends(get_db)):
    rows = db.query(PriceEstimate).order_by(PriceEstimate.created_at.desc()).all()
    return [
        {
            "estimate_id": r.estimate_id,
            "batch_id": r.batch_id,
            "batch_code": r.batch.batch_id if r.batch else None,
            "crop_type": r.crop_type,
            "variety": r.variety,
            "mandi_location": r.mandi_location,
            "estimate_date": r.estimate_date.isoformat(),
            "grade": r.grade,
            "quantity_kg": r.quantity_kg,
            "benchmark_price_per_quintal": r.benchmark_price_per_quintal,
            "grade_multiplier": r.grade_multiplier,
            "variety_factor": r.variety_factor,
            "location_factor": r.location_factor,
            "seasonal_factor": r.seasonal_factor,
            "indicative_min_per_quintal": r.indicative_min_per_quintal,
            "indicative_avg_per_quintal": r.indicative_avg_per_quintal,
            "indicative_max_per_quintal": r.indicative_max_per_quintal,
            "estimated_total_value": r.estimated_total_value,
            "data_source": r.data_source,
            "last_updated_date": r.last_updated_date,
            "calculation_explanation": r.calculation_explanation,
            "is_demo": r.is_demo,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/estimate")
def estimate_pricing(payload: PricingEstimateRequest, db: Session = Depends(get_db)):
    effective_grade = payload.grade
    grade_source = "manual_simulation"
    batch = None

    if payload.batch_id:
        batch = db.query(CropBatch).filter(CropBatch.id == payload.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Crop batch not found.")
        if batch.inspections:
            latest_insp = batch.inspections[-1]
            # Use AI / Inspector-calibrated grade automatically when bound to a batch
            effective_grade = (latest_insp.final_grade or latest_insp.estimated_grade).upper()
            grade_source = "inspector_calibrated_grade" if latest_insp.reviewer_corrected else "ai_visual_inspection_grade"

    calc = calculate_grade_linked_price(
        db=db,
        crop_type=payload.crop_type,
        variety=payload.variety,
        mandi_location=payload.mandi_location,
        grade=effective_grade,
        quantity_kg=payload.quantity_kg,
        estimate_date=payload.estimate_date,
    )
    grade_comparison = compute_grade_comparison(
        db=db,
        crop_type=payload.crop_type,
        variety=payload.variety,
        mandi_location=payload.mandi_location,
        quantity_kg=payload.quantity_kg,
        estimate_date=payload.estimate_date,
    )
    trend = get_price_trend(
        db=db,
        crop_type=payload.crop_type,
        mandi_location=payload.mandi_location,
        grade=effective_grade,
    )

    estimate_id = generate_code("PRC")
    batch_code = None
    if batch:
        batch_code = batch.batch_id
        est = PriceEstimate(
            estimate_id=estimate_id,
            batch_id=batch.id,
            crop_type=calc["crop_type"],
            variety=calc["variety"],
            mandi_location=calc["mandi_location"],
            estimate_date=calc["estimate_date"],
            grade=calc["grade"],
            quantity_kg=calc["quantity_kg"],
            benchmark_price_per_quintal=calc["benchmark_price_per_quintal"],
            grade_multiplier=calc["grade_multiplier"],
            variety_factor=calc["variety_factor"],
            location_factor=calc["location_factor"],
            seasonal_factor=calc["seasonal_factor"],
            indicative_min_per_quintal=calc["indicative_min_per_quintal"],
            indicative_avg_per_quintal=calc["indicative_avg_per_quintal"],
            indicative_max_per_quintal=calc["indicative_max_per_quintal"],
            estimated_total_value=calc["estimated_total_value"],
            data_source=calc["data_source"],
            last_updated_date=calc["last_updated_date"],
            calculation_explanation=calc["calculation_explanation"],
            is_demo=calc["is_demo"],
        )
        db.add(est)
        if batch.status in ("registered", "inspected"):
            batch.status = "priced"
        record_traceability_event(
            db=db,
            batch_id=batch.id,
            batch_code=batch.batch_id,
            stage_number=5,
            stage_name="Price Estimation",
            actor="DRISHTI Fair Price Engine",
            location=calc["matched_mandi"],
            supporting_record_id=estimate_id,
            notes=f"Grade {calc['grade']} ({grade_source}) valuation: INR {calc['indicative_avg_per_quintal']:,.2f}/qtl (Total INR {calc['estimated_total_value']:,.2f}).",
        )
        db.commit()

    return {
        "estimate_id": estimate_id,
        "batch_id": payload.batch_id,
        "batch_code": batch_code,
        "grade_source": grade_source,
        **calc,
        "estimate_date": calc["estimate_date"].isoformat(),
        "grade_comparison": grade_comparison,
        "historical_trend": trend,
    }
