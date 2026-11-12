from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.domain import (
    ComplianceInspection,
    CropBatch,
    CropInspection,
    DigitalPassport,
    InspectorFeedback,
    PriceEstimate,
    TraceabilityEvent,
)
from app.schemas.domain import DashboardStatsOut
from app.services.passport_service import verify_passport_integrity

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_batches = db.query(CropBatch).count()
    total_inspections = db.query(CropInspection).count()
    total_passports = db.query(DigitalPassport).count()
    total_events = db.query(TraceabilityEvent).count()

    all_batches = db.query(CropBatch).order_by(CropBatch.created_at.desc()).all()
    pending_inspections = sum(1 for b in all_batches if not b.inspections)

    grades = {"A": 0, "B": 0, "C": 0}
    for insp in db.query(CropInspection).all():
        g = (insp.final_grade or insp.estimated_grade or "").upper()
        if g in grades:
            grades[g] += 1

    compliance = {"PASS": 0, "REVIEW": 0, "FLAGGED": 0}
    for st, count in db.query(ComplianceInspection.status, func.count(ComplianceInspection.id)).group_by(ComplianceInspection.status).all():
        if st in compliance:
            compliance[st] = count

    avg_price = db.query(func.avg(PriceEstimate.indicative_avg_per_quintal)).scalar() or 0.0

    # FPO stats
    fpo_names = {b.fpo_name for b in all_batches if b.fpo_name}
    total_qty_kg = sum(float(b.quantity_kg or 0) for b in all_batches)
    fpo_stats = {
        "active_fpos": len(fpo_names),
        "total_quantity_kg": round(total_qty_kg, 2),
        "total_quantity_quintals": round(total_qty_kg / 100.0, 2),
        "certified_batches": total_passports,
    }

    # Inspector calibration stats
    feedbacks = db.query(InspectorFeedback).all()
    total_reviews = len(feedbacks)
    agreed = sum(1 for f in feedbacks if f.agreement_flag)
    inspector_stats = {
        "total_reviews": total_reviews,
        "corrections_count": total_reviews - agreed,
        "agreement_rate_percent": round((agreed / total_reviews) * 100.0, 1) if total_reviews else 100.0,
    }

    # Cryptographic integrity summary across passports
    intact_count = 0
    mismatch_count = 0
    for p in db.query(DigitalPassport).all():
        res = verify_passport_integrity(db, p)
        if res["is_intact"]:
            intact_count += 1
        else:
            mismatch_count += 1

    recent_batches = []
    for b in all_batches[:6]:
        latest_insp = b.inspections[-1] if b.inspections else None
        latest_cmp = b.compliance_checks[-1] if b.compliance_checks else None
        latest_prc = b.price_estimates[-1] if b.price_estimates else None
        recent_batches.append(
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "fpo_name": b.fpo_name,
                "crop_type": b.crop_type,
                "variety": b.variety,
                "quantity_kg": b.quantity_kg,
                "origin_location": b.origin_location,
                "status": b.status,
                "grade": (latest_insp.final_grade or latest_insp.estimated_grade) if latest_insp else None,
                "compliance": latest_cmp.status if latest_cmp else None,
                "indicative_price": latest_prc.indicative_avg_per_quintal if latest_prc else None,
                "passport_id": b.passport.passport_id if b.passport else None,
                "is_demo": b.is_demo,
            }
        )

    recent_events = [
        {
            "event_id": ev.event_id,
            "batch_id": ev.batch_id,
            "stage_number": ev.stage_number,
            "stage_name": ev.stage_name,
            "actor": ev.actor,
            "location": ev.location,
            "supporting_record_id": ev.supporting_record_id,
            "event_hash": ev.event_hash,
            "notes": ev.notes,
            "recorded_at": ev.recorded_at.isoformat(),
        }
        for ev in db.query(TraceabilityEvent).order_by(TraceabilityEvent.recorded_at.desc()).limit(10).all()
    ]

    return DashboardStatsOut(
        total_batches=total_batches,
        total_inspections=total_inspections,
        pending_inspections=pending_inspections,
        grade_distribution=grades,
        average_indicative_price=round(float(avg_price), 2),
        compliance_summary=compliance,
        total_passports=total_passports,
        total_traceability_events=total_events,
        fpo_stats=fpo_stats,
        inspector_stats=inspector_stats,
        integrity_summary={"intact": intact_count, "mismatch": mismatch_count},
        recent_batches=recent_batches,
        recent_events=recent_events,
    )
