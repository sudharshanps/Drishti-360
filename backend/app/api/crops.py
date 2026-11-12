from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user_optional
from app.database.session import get_db
from app.models.domain import CropBatch, User
from app.schemas.domain import CropBatchCreate
from app.services.trace_helper import record_traceability_event
from app.utils.ids import generate_code

router = APIRouter(prefix="/crops", tags=["Crops"])


@router.get("")
def list_crops(fpo_name: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(CropBatch).order_by(CropBatch.created_at.desc())
    if fpo_name:
        query = query.filter(CropBatch.fpo_name.ilike(f"%{fpo_name.strip()}%"))
    batches = query.all()
    return [
        {
            "id": b.id,
            "batch_id": b.batch_id,
            "client_offline_id": b.client_offline_id,
            "farmer_name": b.owner.full_name if b.owner else "Registered Farmer",
            "fpo_name": b.fpo_name,
            "crop_type": b.crop_type,
            "variety": b.variety,
            "quantity_kg": b.quantity_kg,
            "origin_location": b.origin_location,
            "harvest_date": b.harvest_date.isoformat(),
            "status": b.status,
            "is_demo": b.is_demo,
            "created_at": b.created_at.isoformat(),
            "inspection_id": b.inspections[-1].inspection_id if b.inspections else None,
            "grade": (b.inspections[-1].final_grade or b.inspections[-1].estimated_grade) if b.inspections else None,
            "ai_grade": b.inspections[-1].ai_grade if b.inspections else None,
            "reviewer_corrected": b.inspections[-1].reviewer_corrected if b.inspections else False,
            "quality_score": b.inspections[-1].quality_score if b.inspections else None,
            "observations": b.inspections[-1].observations if b.inspections else None,
            "crop_image_url": f"/uploads/crops/{b.inspections[-1].image_filename}" if (b.inspections and b.inspections[-1].image_filename) else None,
            "inspected_at": b.inspections[-1].inspected_at.isoformat() if b.inspections else None,
            "compliance_status": b.compliance_checks[-1].status if b.compliance_checks else None,
            "indicative_price": b.price_estimates[-1].indicative_avg_per_quintal if b.price_estimates else None,
            "estimated_total_value": b.price_estimates[-1].estimated_total_value if b.price_estimates else None,
            "mandi_location": b.price_estimates[-1].mandi_location if b.price_estimates else None,
            "passport_id": b.passport.passport_id if b.passport else None,
            "traceability_events_count": len(b.traceability_events),
        }
        for b in batches
    ]


@router.post("")
def create_crop_batch(
    payload: CropBatchCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if payload.client_offline_id:
        existing = db.query(CropBatch).filter(CropBatch.client_offline_id == payload.client_offline_id).first()
        if existing:
            return {
                "id": existing.id,
                "batch_id": existing.batch_id,
                "crop_type": existing.crop_type,
                "variety": existing.variety,
                "quantity_kg": existing.quantity_kg,
                "origin_location": existing.origin_location,
                "harvest_date": existing.harvest_date.isoformat(),
                "status": existing.status,
                "deduplicated": True,
            }

    owner = current_user or db.query(User).first()
    if not owner:
        raise HTTPException(status_code=400, detail="No user available to own crop batch.")

    batch = CropBatch(
        batch_id=generate_code("DR360-BCH"),
        client_offline_id=payload.client_offline_id,
        user_id=owner.id,
        fpo_name=(payload.fpo_name or "Kaveri Delta Sustainable FPO").strip(),
        crop_type=payload.crop_type.strip(),
        variety=payload.variety.strip(),
        quantity_kg=payload.quantity_kg,
        origin_location=payload.origin_location.strip(),
        harvest_date=payload.harvest_date or date.today(),
        status="registered",
        is_demo=False,
    )
    db.add(batch)
    db.flush()

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=1,
        stage_name="Harvest",
        actor=owner.full_name,
        location=batch.origin_location,
        supporting_record_id=batch.batch_id,
        notes=f"Created batch {batch.batch_id} ({batch.quantity_kg} kg {batch.crop_type}) under {batch.fpo_name}.",
    )
    db.commit()
    db.refresh(batch)
    return {
        "id": batch.id,
        "batch_id": batch.batch_id,
        "fpo_name": batch.fpo_name,
        "crop_type": batch.crop_type,
        "variety": batch.variety,
        "quantity_kg": batch.quantity_kg,
        "origin_location": batch.origin_location,
        "harvest_date": batch.harvest_date.isoformat(),
        "status": batch.status,
    }
