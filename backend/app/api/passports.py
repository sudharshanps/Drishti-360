from datetime import date, datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.domain import (
    ComplianceInspection,
    CropBatch,
    CropInspection,
    DigitalPassport,
    PassportVerificationLog,
    PriceEstimate,
    TraceabilityEvent,
)
from app.schemas.domain import PassportGenerateRequest, PassportScanRequest
from app.services.fair_price_service import calculate_grade_linked_price
from app.services.passport_service import (
    generate_passport_pdf,
    generate_passport_qr,
    verify_passport_integrity,
)
from app.services.trace_helper import record_traceability_event
from app.utils.crypto import (
    build_compliance_hash_payload,
    build_inspection_hash_payload,
    build_passport_hash_payload,
    compute_sha256,
)
from app.utils.ids import generate_code

router = APIRouter(prefix="/passports", tags=["Digital Quality Passport"])


def _serialize_passport(p: DigitalPassport, batch: CropBatch) -> dict:
    qr_name = Path(p.qr_image_path).name if p.qr_image_path else f"{p.passport_id}.png"
    return {
        "id": p.id,
        "passport_id": p.passport_id,
        "batch_id": batch.id,
        "batch_code": batch.batch_id,
        "farmer_name": batch.owner.full_name if batch.owner else "Registered Farmer",
        "fpo_name": batch.fpo_name,
        "origin_location": batch.origin_location,
        "quantity_kg": batch.quantity_kg,
        "crop_name": p.crop_name,
        "variety": p.variety,
        "grade": p.grade,
        "quality_score": p.quality_score,
        "inspection_timestamp": p.inspection_timestamp.isoformat(),
        "quality_observations": p.quality_observations,
        "compliance_status": p.compliance_status,
        "indicative_price_per_quintal": p.indicative_price_per_quintal,
        "estimated_total_value": p.estimated_total_value,
        "verification_status": p.verification_status,
        "qr_verification_url": p.qr_verification_url,
        "qr_image_url": f"/uploads/qrcodes/{qr_name}",
        "inspection_hash": p.inspection_hash,
        "compliance_hash": p.compliance_hash,
        "passport_hash": p.passport_hash,
        "verification_count": p.verification_count,
        "last_verified_at": p.last_verified_at.isoformat() if p.last_verified_at else None,
        "is_demo": p.is_demo,
        "issued_at": p.issued_at.isoformat(),
    }


def _issue_passport_for_batch(db: Session, batch: CropBatch) -> DigitalPassport:
    if batch.passport:
        if not batch.passport.qr_image_path or not Path(batch.passport.qr_image_path).exists():
            batch.passport.qr_image_path = generate_passport_qr(
                batch.passport.passport_id, batch.passport.qr_verification_url
            )
            db.commit()
        return batch.passport

    latest_insp = (
        db.query(CropInspection)
        .filter(CropInspection.batch_id == batch.id)
        .order_by(CropInspection.inspected_at.desc())
        .first()
    )
    if not latest_insp:
        raise HTTPException(
            status_code=400,
            detail="Please complete Crop Inspection for this batch before generating a Digital Quality Passport.",
        )

    latest_cmp = (
        db.query(ComplianceInspection)
        .filter(ComplianceInspection.batch_id == batch.id)
        .order_by(ComplianceInspection.inspected_at.desc())
        .first()
    )
    latest_prc = (
        db.query(PriceEstimate)
        .filter(PriceEstimate.batch_id == batch.id)
        .order_by(PriceEstimate.created_at.desc())
        .first()
    )

    resolved_grade = (latest_insp.final_grade or latest_insp.estimated_grade).upper()
    if not latest_prc:
        calc = calculate_grade_linked_price(
            db=db,
            crop_type=batch.crop_type,
            variety=batch.variety,
            mandi_location=batch.origin_location,
            grade=resolved_grade,
            quantity_kg=batch.quantity_kg,
            estimate_date=date.today(),
        )
        latest_prc = PriceEstimate(
            estimate_id=generate_code("PRC"),
            batch_id=batch.id,
            crop_type=calc["crop_type"],
            variety=calc["variety"],
            mandi_location=calc["matched_mandi"],
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
        db.add(latest_prc)
        db.flush()

    insp_hash = latest_insp.record_hash or compute_sha256(build_inspection_hash_payload(latest_insp, batch.batch_id))
    cmp_hash = (
        (latest_cmp.record_hash or compute_sha256(build_compliance_hash_payload(latest_cmp, batch.batch_id)))
        if latest_cmp
        else ""
    )

    passport_id = generate_code("DR360-PSP")
    verify_url = f"{settings.effective_public_verify_base_url}/{passport_id}"
    qr_path = generate_passport_qr(passport_id, verify_url)

    p = DigitalPassport(
        passport_id=passport_id,
        batch_id=batch.id,
        inspection_id=latest_insp.id,
        compliance_id=latest_cmp.id if latest_cmp else None,
        price_estimate_id=latest_prc.id,
        crop_name=batch.crop_type,
        variety=batch.variety,
        grade=resolved_grade,
        quality_score=latest_insp.quality_score,
        inspection_timestamp=latest_insp.inspected_at,
        quality_observations=latest_insp.observations,
        compliance_status=latest_cmp.status if latest_cmp else "PENDING",
        indicative_price_per_quintal=latest_prc.indicative_avg_per_quintal,
        estimated_total_value=latest_prc.estimated_total_value,
        verification_status="DEMO_VERIFIED_RECORD" if batch.is_demo else "VERIFIED_BATCH_RECORD",
        qr_verification_url=verify_url,
        qr_image_path=qr_path,
        inspection_hash=insp_hash,
        compliance_hash=cmp_hash,
        is_demo=batch.is_demo,
    )
    p.passport_hash = compute_sha256(build_passport_hash_payload(p, batch.batch_id))
    db.add(p)
    batch.status = "certified"
    db.flush()

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=6,
        stage_name="Digital Passport",
        actor="DRISHTI Passport Authority",
        location=batch.origin_location,
        supporting_record_id=passport_id,
        notes=f"Generated Digital Quality Passport {passport_id} (SHA-256: {p.passport_hash[:12]}...) with QR verification.",
    )
    db.commit()
    db.refresh(p)
    return p


@router.get("")
def list_passports(db: Session = Depends(get_db)):
    rows = db.query(DigitalPassport).order_by(DigitalPassport.issued_at.desc()).all()
    out = []
    for p in rows:
        if not p.batch:
            continue
        item = _serialize_passport(p, p.batch)
        item["integrity"] = verify_passport_integrity(db, p)
        out.append(item)
    return out


@router.post("/generate")
def generate_passport(payload: PassportGenerateRequest, db: Session = Depends(get_db)):
    batch = db.query(CropBatch).filter(CropBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")
    p = _issue_passport_for_batch(db, batch)
    res = _serialize_passport(p, batch)
    res["integrity"] = verify_passport_integrity(db, p)
    return res


@router.get("/{passport_id}")
def get_passport(passport_id: str, db: Session = Depends(get_db)):
    p = db.query(DigitalPassport).filter(DigitalPassport.passport_id == passport_id).first()
    if not p or not p.batch:
        raise HTTPException(status_code=404, detail="Digital Quality Passport not found.")
    if not p.qr_image_path or not Path(p.qr_image_path).exists():
        p.qr_image_path = generate_passport_qr(p.passport_id, p.qr_verification_url)
        db.commit()
    res = _serialize_passport(p, p.batch)
    res["integrity"] = verify_passport_integrity(db, p)
    return res


@router.get("/{passport_id}/pdf")
def download_passport_pdf(passport_id: str, db: Session = Depends(get_db)):
    p = db.query(DigitalPassport).filter(DigitalPassport.passport_id == passport_id).first()
    if not p or not p.batch:
        raise HTTPException(status_code=404, detail="Digital Quality Passport not found.")
    if not p.qr_image_path or not Path(p.qr_image_path).exists():
        p.qr_image_path = generate_passport_qr(p.passport_id, p.qr_verification_url)
        db.commit()

    batch = p.batch
    pdf_bytes = generate_passport_pdf(
        {
            "passport_id": p.passport_id,
            "batch_code": batch.batch_id,
            "farmer_name": batch.owner.full_name if batch.owner else "Registered Farmer",
            "origin_location": batch.origin_location,
            "quantity_kg": batch.quantity_kg,
            "crop_name": p.crop_name,
            "variety": p.variety,
            "grade": p.grade,
            "quality_score": p.quality_score,
            "inspection_timestamp": p.inspection_timestamp.strftime("%d %b %Y, %H:%M UTC"),
            "quality_observations": p.quality_observations,
            "compliance_status": p.compliance_status,
            "indicative_price_per_quintal": p.indicative_price_per_quintal,
            "estimated_total_value": p.estimated_total_value,
            "verification_status": p.verification_status,
            "qr_verification_url": p.qr_verification_url,
            "qr_image_path": p.qr_image_path,
            "passport_hash": p.passport_hash,
            "inspection_hash": p.inspection_hash,
            "issued_at": p.issued_at.strftime("%d %b %Y, %H:%M UTC"),
            "is_demo": p.is_demo,
        }
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{passport_id}.pdf"'},
    )


@router.get("/{passport_id}/verify")
def verify_passport_full(
    passport_id: str,
    record_scan: bool = Query(False),
    db: Session = Depends(get_db),
):
    p = db.query(DigitalPassport).filter(DigitalPassport.passport_id == passport_id).first()
    if not p or not p.batch:
        raise HTTPException(status_code=404, detail=f"Passport {passport_id} not found.")

    batch = p.batch
    integrity = verify_passport_integrity(db, p)

    if record_scan:
        now = datetime.utcnow().replace(microsecond=0)
        p.verification_count = (p.verification_count or 0) + 1
        p.last_verified_at = now
        db.add(
            PassportVerificationLog(
                log_id=generate_code("VRF"),
                passport_pk=p.id,
                verifier_name="Public QR Scanner",
                verifier_role="buyer",
                integrity_status=integrity["integrity_status"],
                notes=f"Public QR page load check ({integrity['integrity_status']}).",
                verified_at=now,
            )
        )
        db.commit()

    insp = (
        db.query(CropInspection).filter(CropInspection.id == p.inspection_id).first()
        if p.inspection_id
        else (batch.inspections[-1] if batch.inspections else None)
    )
    cmp_row = (
        db.query(ComplianceInspection).filter(ComplianceInspection.id == p.compliance_id).first()
        if p.compliance_id
        else (batch.compliance_checks[-1] if batch.compliance_checks else None)
    )
    prc_row = (
        db.query(PriceEstimate).filter(PriceEstimate.id == p.price_estimate_id).first()
        if p.price_estimate_id
        else (batch.price_estimates[-1] if batch.price_estimates else None)
    )
    events = (
        db.query(TraceabilityEvent)
        .filter(TraceabilityEvent.batch_id == batch.id)
        .order_by(TraceabilityEvent.recorded_at.asc(), TraceabilityEvent.id.asc())
        .all()
    )
    scan_logs = (
        db.query(PassportVerificationLog)
        .filter(PassportVerificationLog.passport_pk == p.id)
        .order_by(PassportVerificationLog.verified_at.desc())
        .all()
    )

    return {
        "passport": _serialize_passport(p, batch),
        "integrity": integrity,
        "inspection": {
            "inspection_id": insp.inspection_id,
            "estimated_grade": insp.estimated_grade,
            "ai_grade": insp.ai_grade,
            "final_grade": insp.final_grade,
            "quality_score": insp.quality_score,
            "defect_percent": insp.defect_percent,
            "discoloration_percent": insp.discoloration_percent,
            "uniformity_score": insp.uniformity_score,
            "damage_level": insp.damage_level,
            "detected_defects": insp.detected_defects,
            "analysis_mode": insp.analysis_mode,
            "reviewer_corrected": insp.reviewer_corrected,
            "image_url": f"/uploads/crops/{insp.image_filename}" if insp.image_filename else None,
            "observations": insp.observations,
            "record_hash": insp.record_hash,
            "inspected_at": insp.inspected_at.isoformat(),
        }
        if insp
        else None,
        "compliance": {
            "compliance_id": cmp_row.compliance_id,
            "status": cmp_row.status,
            "extracted_fields": cmp_row.extracted_fields,
            "missing_fields": cmp_row.missing_fields,
            "inconsistencies": cmp_row.inconsistencies,
            "image_url": f"/uploads/labels/{cmp_row.image_filename}" if cmp_row.image_filename else None,
            "record_hash": cmp_row.record_hash,
            "notes": cmp_row.notes,
        }
        if cmp_row
        else None,
        "pricing": {
            "estimate_id": prc_row.estimate_id,
            "mandi_location": prc_row.mandi_location,
            "benchmark_price_per_quintal": prc_row.benchmark_price_per_quintal,
            "indicative_min_per_quintal": prc_row.indicative_min_per_quintal,
            "indicative_avg_per_quintal": prc_row.indicative_avg_per_quintal,
            "indicative_max_per_quintal": prc_row.indicative_max_per_quintal,
            "estimated_total_value": prc_row.estimated_total_value,
            "data_source": prc_row.data_source,
            "last_updated_date": prc_row.last_updated_date,
            "calculation_explanation": prc_row.calculation_explanation,
        }
        if prc_row
        else None,
        "traceability_events": [
            {
                "event_id": ev.event_id,
                "stage_number": ev.stage_number,
                "stage_name": ev.stage_name,
                "actor": ev.actor,
                "location": ev.location,
                "supporting_record_id": ev.supporting_record_id,
                "notes": ev.notes,
                "previous_hash": ev.previous_hash,
                "event_hash": ev.event_hash,
                "recorded_at": ev.recorded_at.isoformat(),
            }
            for ev in events
        ],
        "verification_history": [
            {
                "log_id": lg.log_id,
                "verifier_name": lg.verifier_name,
                "verifier_role": lg.verifier_role,
                "integrity_status": lg.integrity_status,
                "notes": lg.notes,
                "verified_at": lg.verified_at.isoformat(),
            }
            for lg in scan_logs
        ],
    }


@router.post("/{passport_id}/verify-scan")
def log_buyer_verification_scan(
    passport_id: str,
    payload: PassportScanRequest,
    db: Session = Depends(get_db),
):
    p = db.query(DigitalPassport).filter(DigitalPassport.passport_id == passport_id).first()
    if not p or not p.batch:
        raise HTTPException(status_code=404, detail="Passport not found.")

    batch = p.batch
    integrity = verify_passport_integrity(db, p)
    now = datetime.utcnow().replace(microsecond=0)
    p.verification_count = (p.verification_count or 0) + 1
    p.last_verified_at = now

    log = PassportVerificationLog(
        log_id=generate_code("VRF"),
        passport_pk=p.id,
        verifier_name=payload.verifier_name.strip(),
        verifier_role=payload.verifier_role.strip(),
        integrity_status=integrity["integrity_status"],
        notes=payload.notes.strip(),
        verified_at=now,
    )
    db.add(log)
    if integrity["is_intact"] and batch.status != "verified_by_buyer":
        batch.status = "verified_by_buyer"

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=9,
        stage_name="Buyer Verification",
        actor=f"{payload.verifier_name.strip()} ({payload.verifier_role})",
        location=batch.origin_location,
        supporting_record_id=p.passport_id,
        notes=f"QR verification scan {log.log_id}: SHA-256 check = {integrity['integrity_status']}. {payload.notes.strip()}",
    )
    db.commit()
    return {
        "log_id": log.log_id,
        "passport_id": p.passport_id,
        "verification_count": p.verification_count,
        "integrity": integrity,
        "verified_at": log.verified_at.isoformat(),
    }
