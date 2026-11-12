from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.passports import _issue_passport_for_batch
from app.database.session import get_db
from app.models.domain import CropBatch
from app.schemas.domain import BuyerPurchaseRequest, FpoBulkCertifyRequest
from app.services.passport_service import verify_passport_integrity
from app.services.trace_helper import record_traceability_event
from app.utils.ids import generate_code

router = APIRouter(tags=["FPO & Buyer Stakeholders"])


@router.get("/fpo/overview")
def get_fpo_overview(db: Session = Depends(get_db)):
    batches = db.query(CropBatch).order_by(CropBatch.created_at.desc()).all()
    fpo_groups = {}
    batch_rows = []
    for b in batches:
        insp = b.inspections[-1] if b.inspections else None
        prc = b.price_estimates[-1] if b.price_estimates else None
        cmp_row = b.compliance_checks[-1] if b.compliance_checks else None
        grade = (insp.final_grade or insp.estimated_grade) if insp else "Pending"

        grp = fpo_groups.setdefault(
            b.fpo_name,
            {
                "fpo_name": b.fpo_name,
                "total_batches": 0,
                "total_quantity_kg": 0.0,
                "certified_count": 0,
                "estimated_value_inr": 0.0,
                "farmers": set(),
            },
        )
        grp["total_batches"] += 1
        grp["total_quantity_kg"] += float(b.quantity_kg or 0)
        if b.passport:
            grp["certified_count"] += 1
        if prc:
            grp["estimated_value_inr"] += float(prc.estimated_total_value or 0)
        if b.owner:
            grp["farmers"].add(b.owner.full_name)

        batch_rows.append(
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "fpo_name": b.fpo_name,
                "farmer_name": b.owner.full_name if b.owner else "Registered Farmer",
                "crop_type": b.crop_type,
                "variety": b.variety,
                "quantity_kg": b.quantity_kg,
                "origin_location": b.origin_location,
                "grade": grade,
                "quality_score": insp.quality_score if insp else None,
                "compliance_status": cmp_row.status if cmp_row else "PENDING",
                "indicative_price_per_quintal": prc.indicative_avg_per_quintal if prc else None,
                "estimated_total_value": prc.estimated_total_value if prc else None,
                "passport_id": b.passport.passport_id if b.passport else None,
                "status": b.status,
            }
        )

    fpo_summary = [
        {
            "fpo_name": g["fpo_name"],
            "total_batches": g["total_batches"],
            "total_quantity_kg": round(g["total_quantity_kg"], 2),
            "total_quantity_quintals": round(g["total_quantity_kg"] / 100.0, 2),
            "certified_count": g["certified_count"],
            "estimated_value_inr": round(g["estimated_value_inr"], 2),
            "farmer_count": len(g["farmers"]),
        }
        for g in fpo_groups.values()
    ]
    return {"fpos": fpo_summary, "batches": batch_rows}


@router.post("/fpo/bulk-certify")
def fpo_bulk_certify(payload: FpoBulkCertifyRequest, db: Session = Depends(get_db)):
    certified = []
    skipped = []
    for bid in payload.batch_ids:
        batch = db.query(CropBatch).filter(CropBatch.id == bid).first()
        if not batch:
            skipped.append({"batch_id": bid, "reason": "Batch not found"})
            continue
        if not batch.inspections:
            skipped.append({"batch_id": batch.batch_id, "reason": "Crop inspection required first"})
            continue
        psp = _issue_passport_for_batch(db, batch)
        certified.append({"batch_id": batch.batch_id, "passport_id": psp.passport_id})
    return {"certified_count": len(certified), "certified": certified, "skipped": skipped}


@router.get("/buyer/catalog")
def get_buyer_catalog(db: Session = Depends(get_db)):
    batches = db.query(CropBatch).order_by(CropBatch.created_at.desc()).all()
    items = []
    for b in batches:
        insp = b.inspections[-1] if b.inspections else None
        prc = b.price_estimates[-1] if b.price_estimates else None
        cmp_row = b.compliance_checks[-1] if b.compliance_checks else None
        psp = b.passport
        integrity = verify_passport_integrity(db, psp) if psp else None
        items.append(
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "farmer_name": b.owner.full_name if b.owner else "Registered Farmer",
                "fpo_name": b.fpo_name,
                "crop_type": b.crop_type,
                "variety": b.variety,
                "quantity_kg": b.quantity_kg,
                "origin_location": b.origin_location,
                "status": b.status,
                "grade": (insp.final_grade or insp.estimated_grade) if insp else None,
                "quality_score": insp.quality_score if insp else None,
                "compliance_status": cmp_row.status if cmp_row else "PENDING",
                "indicative_price_per_quintal": prc.indicative_avg_per_quintal if prc else None,
                "estimated_total_value": prc.estimated_total_value if prc else None,
                "passport_id": psp.passport_id if psp else None,
                "qr_image_url": f"/uploads/qrcodes/{psp.passport_id}.png" if psp else None,
                "integrity_status": integrity["integrity_status"] if integrity else "UNISSUED",
                "verification_count": psp.verification_count if psp else 0,
                "traceability_stages": sorted({ev.stage_number for ev in b.traceability_events}),
            }
        )
    return items


@router.post("/buyer/purchase")
def record_buyer_purchase(payload: BuyerPurchaseRequest, db: Session = Depends(get_db)):
    batch = db.query(CropBatch).filter(CropBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    total_val = round((batch.quantity_kg / 100.0) * payload.agreed_price_per_quintal, 2)
    tx_ref = generate_code("TXN")
    dsp_ref = generate_code("DSP")

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=7,
        stage_name="Dispatch",
        actor=batch.fpo_name,
        location=batch.origin_location,
        supporting_record_id=dsp_ref,
        notes=f"Lot dispatched to {payload.destination.strip()} ({batch.quantity_kg} kg).",
    )
    db.flush()
    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=8,
        stage_name="Transaction",
        actor=payload.buyer_name.strip(),
        location=payload.destination.strip(),
        supporting_record_id=tx_ref,
        notes=f"Buyer settlement @ INR {payload.agreed_price_per_quintal:,.2f}/qtl (Total INR {total_val:,.2f}). {payload.notes or ''}".strip(),
    )
    batch.status = "transacted"
    db.commit()

    return {
        "transaction_id": tx_ref,
        "dispatch_id": dsp_ref,
        "batch_id": batch.id,
        "batch_code": batch.batch_id,
        "buyer_name": payload.buyer_name,
        "agreed_price_per_quintal": payload.agreed_price_per_quintal,
        "total_value": total_val,
        "status": batch.status,
    }
