from datetime import date, datetime
import time
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.compliance import _get_rule_dict
from app.api.passports import _issue_passport_for_batch, _serialize_passport
from app.core.security import get_current_user_optional
from app.database.session import get_db
from app.models.domain import (
    ComplianceInspection,
    CropBatch,
    CropInspection,
    PriceEstimate,
    User,
)
from app.schemas.domain import OfflineSyncBatchRequest
from app.services.fair_price_service import calculate_grade_linked_price
from app.services.ocr_service import extract_label_from_image, verify_label_compliance
from app.services.passport_service import verify_passport_integrity
from app.services.trace_helper import record_traceability_event
from app.services.vision_service import analyze_crop_image, decode_base64_image
from app.utils.crypto import (
    build_compliance_hash_payload,
    build_inspection_hash_payload,
    compute_sha256,
)
from app.utils.ids import generate_code
from app.utils.uploads import read_validated_image_upload

router = APIRouter(tags=["Multi-Modal Fusion & Offline Sync"])


@router.post("/pipeline/fusion")
async def run_multimodal_fusion(
    crop_type: str = Form(...),
    variety: str = Form(...),
    quantity_kg: float = Form(...),
    origin_location: str = Form(...),
    mandi_location: str = Form(""),
    fpo_name: str = Form("Kaveri Delta Sustainable FPO"),
    sample_label_text: Optional[str] = Form(None),
    batch_id: Optional[int] = Form(None),
    generate_passport_now: bool = Form(True),
    crop_image: Optional[UploadFile] = File(None),
    label_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    t0 = time.perf_counter()
    owner = current_user or db.query(User).first()
    if not owner:
        raise HTTPException(status_code=400, detail="No registered user available.")

    batch = None
    if batch_id:
        batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Crop batch not found.")
    else:
        batch = CropBatch(
            batch_id=generate_code("DR360-BCH"),
            user_id=owner.id,
            fpo_name=fpo_name.strip(),
            crop_type=crop_type.strip(),
            variety=variety.strip(),
            quantity_kg=quantity_kg,
            origin_location=origin_location.strip(),
            harvest_date=date.today(),
            status="registered",
            is_demo=False,
        )
        db.add(batch)
        db.flush()
        record_traceability_event(
            db, batch.id, batch.batch_id, 1, "Harvest", owner.full_name, batch.origin_location,
            f"Multi-modal batch {batch.batch_id} registered ({quantity_kg} kg {crop_type}).",
            supporting_record_id=batch.batch_id,
        )
        db.flush()

    # 1. Computer Vision Layer
    crop_bytes = await read_validated_image_upload(crop_image) if crop_image else None
    vision_res = analyze_crop_image(
        image_bytes=crop_bytes,
        crop_type=batch.crop_type,
        variety=batch.variety,
        location=batch.origin_location,
        original_filename=crop_image.filename if crop_image else "fusion_crop.jpg",
    )
    insp = CropInspection(
        inspection_id=generate_code("INSP"),
        batch_id=batch.id,
        crop_type=batch.crop_type,
        variety=batch.variety,
        location=batch.origin_location,
        image_filename=vision_res["saved_filename"] if vision_res.get("image_url") else None,
        estimated_grade=vision_res["estimated_grade"],
        ai_grade=vision_res["ai_grade"],
        final_grade=vision_res["estimated_grade"],
        quality_score=vision_res["quality_score"],
        defect_percent=vision_res["defect_percent"],
        discoloration_percent=vision_res["discoloration_percent"],
        uniformity_score=vision_res["uniformity_score"],
        damage_level=vision_res["damage_level"],
        detected_defects=vision_res["detected_defects"],
        analysis_mode=vision_res["analysis_mode"],
        inference_time_ms=vision_res["inference_time_ms"],
        observations=vision_res["observations"],
        status="inspected",
        inspected_at=datetime.utcnow().replace(microsecond=0),
    )
    insp.record_hash = compute_sha256(build_inspection_hash_payload(insp, batch.batch_id))
    db.add(insp)
    db.flush()

    record_traceability_event(
        db, batch.id, batch.batch_id, 2, "Crop Inspection",
        f"Fusion Vision ({vision_res['analysis_mode'].split(' ')[0]})", batch.origin_location,
        f"Inspection {insp.inspection_id}: Grade {insp.final_grade} ({insp.quality_score}/100).",
        supporting_record_id=insp.inspection_id,
    )
    db.flush()
    record_traceability_event(
        db, batch.id, batch.batch_id, 3, "Quality Grading", "Fusion Quality Scorer", batch.origin_location,
        f"Grade {insp.final_grade} locked with SHA-256 {insp.record_hash[:12]}...",
        supporting_record_id=insp.inspection_id,
    )
    db.flush()

    # 2. OCR Packaging Compliance Layer
    label_bytes = await read_validated_image_upload(label_image) if label_image else None
    raw_text = (sample_label_text or "").strip()
    saved_label = None
    ocr_engine = "rule_parser (text input)"
    ocr_ms = 0.0
    if label_bytes:
        ocr_text, _, saved_label, ocr_ms, ocr_engine, _, _ = extract_label_from_image(label_bytes)
        raw_text = ocr_text or raw_text

    rules = _get_rule_dict(db)
    verified_cmp = verify_label_compliance(raw_text=raw_text, batch_code=batch.batch_id, rules=rules)
    cmp_row = ComplianceInspection(
        compliance_id=generate_code("CMP"),
        batch_id=batch.id,
        image_filename=saved_label,
        extracted_fields=verified_cmp["extracted_fields"],
        missing_fields=verified_cmp["missing_fields"],
        inconsistencies=verified_cmp["inconsistencies"],
        ocr_engine=ocr_engine,
        raw_ocr_text=raw_text,
        inference_time_ms=ocr_ms,
        status=verified_cmp["status"],
        notes=verified_cmp["notes"],
        inspected_at=datetime.utcnow().replace(microsecond=0),
    )
    cmp_row.record_hash = compute_sha256(build_compliance_hash_payload(cmp_row, batch.batch_id))
    db.add(cmp_row)
    db.flush()

    record_traceability_event(
        db, batch.id, batch.batch_id, 4, "Compliance Verification",
        f"Fusion OCR ({ocr_engine})", batch.origin_location,
        f"Compliance {cmp_row.compliance_id}: {cmp_row.status}.",
        supporting_record_id=cmp_row.compliance_id,
    )
    db.flush()

    # 3. Grade-Linked Market Valuation Layer
    target_mandi = mandi_location.strip() or batch.origin_location
    calc = calculate_grade_linked_price(
        db=db,
        crop_type=batch.crop_type,
        variety=batch.variety,
        mandi_location=target_mandi,
        grade=insp.final_grade,
        quantity_kg=batch.quantity_kg,
        estimate_date=date.today(),
    )
    prc_row = PriceEstimate(
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
    db.add(prc_row)
    batch.status = "priced"
    db.flush()

    record_traceability_event(
        db, batch.id, batch.batch_id, 5, "Price Estimation", "Fusion Fair Price Engine", calc["matched_mandi"],
        f"Grade {calc['grade']} market valuation: INR {calc['indicative_avg_per_quintal']:,.2f}/qtl.",
        supporting_record_id=prc_row.estimate_id,
    )
    db.commit()

    passport_out = None
    if generate_passport_now:
        psp = _issue_passport_for_batch(db, batch)
        passport_out = _serialize_passport(psp, batch)
        passport_out["integrity"] = verify_passport_integrity(db, psp)

    total_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "pipeline_mode": "Multi-Modal Intelligence Fusion (Vision + OCR + Mandi Pricing)",
        "total_pipeline_ms": total_ms,
        "batch": {
            "id": batch.id,
            "batch_id": batch.batch_id,
            "crop_type": batch.crop_type,
            "variety": batch.variety,
            "quantity_kg": batch.quantity_kg,
            "origin_location": batch.origin_location,
            "status": batch.status,
        },
        "vision": {
            "inspection_id": insp.inspection_id,
            "grade": insp.final_grade,
            "quality_score": insp.quality_score,
            "defect_percent": insp.defect_percent,
            "discoloration_percent": insp.discoloration_percent,
            "uniformity_score": insp.uniformity_score,
            "damage_level": insp.damage_level,
            "analysis_mode": insp.analysis_mode,
            "inference_time_ms": insp.inference_time_ms,
            "image_url": f"/uploads/crops/{insp.image_filename}" if insp.image_filename else None,
            "record_hash": insp.record_hash,
        },
        "compliance": {
            "compliance_id": cmp_row.compliance_id,
            "status": cmp_row.status,
            "missing_fields": cmp_row.missing_fields,
            "inconsistencies": cmp_row.inconsistencies,
            "ocr_engine": cmp_row.ocr_engine,
            "inference_time_ms": cmp_row.inference_time_ms,
            "image_url": f"/uploads/labels/{cmp_row.image_filename}" if cmp_row.image_filename else None,
            "record_hash": cmp_row.record_hash,
        },
        "pricing": {
            "estimate_id": prc_row.estimate_id,
            "matched_mandi": calc["matched_mandi"],
            "benchmark_price_per_quintal": calc["benchmark_price_per_quintal"],
            "indicative_avg_per_quintal": calc["indicative_avg_per_quintal"],
            "estimated_total_value": calc["estimated_total_value"],
            "data_source": calc["data_source"],
            "calculation_explanation": calc["calculation_explanation"],
        },
        "passport": passport_out,
    }


@router.post("/sync/batch")
def sync_offline_records(
    payload: OfflineSyncBatchRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    owner = current_user or db.query(User).first()
    if not owner:
        raise HTTPException(status_code=400, detail="No registered user available.")

    results = []
    for item in payload.items:
        existing = (
            db.query(CropBatch)
            .filter(CropBatch.client_offline_id == item.client_offline_id)
            .first()
        )
        if existing:
            results.append(
                {
                    "client_offline_id": item.client_offline_id,
                    "sync_status": "CONFLICT_DUPLICATE_SKIPPED",
                    "batch_id": existing.batch_id,
                    "db_id": existing.id,
                    "message": f"Offline record already synchronized earlier as {existing.batch_id}; duplicate creation prevented.",
                }
            )
            continue

        batch = CropBatch(
            batch_id=generate_code("DR360-BCH"),
            client_offline_id=item.client_offline_id,
            user_id=owner.id,
            fpo_name=(item.fpo_name or "Kaveri Delta Sustainable FPO").strip(),
            crop_type=item.crop_type.strip(),
            variety=item.variety.strip(),
            quantity_kg=item.quantity_kg,
            origin_location=item.origin_location.strip(),
            harvest_date=item.harvest_date or date.today(),
            status="registered",
            is_demo=False,
        )
        db.add(batch)
        db.flush()

        record_traceability_event(
            db, batch.id, batch.batch_id, 1, "Harvest", f"{owner.full_name} (Offline Sync)",
            batch.origin_location,
            f"Synced offline batch capture ({item.client_offline_id}) for {batch.quantity_kg} kg {batch.crop_type}.",
            supporting_record_id=batch.batch_id,
            recorded_at=item.captured_at or datetime.utcnow(),
        )
        db.flush()

        grade_used = "B"
        if item.run_full_pipeline:
            img_bytes = decode_base64_image(item.crop_image_base64)
            vision_res = analyze_crop_image(
                image_bytes=img_bytes,
                crop_type=batch.crop_type,
                variety=batch.variety,
                location=batch.origin_location,
                original_filename=item.crop_image_filename or "offline_capture.jpg",
            )
            insp = CropInspection(
                inspection_id=generate_code("INSP"),
                batch_id=batch.id,
                crop_type=batch.crop_type,
                variety=batch.variety,
                location=batch.origin_location,
                image_filename=vision_res["saved_filename"] if vision_res.get("image_url") else None,
                estimated_grade=vision_res["estimated_grade"],
                ai_grade=vision_res["ai_grade"],
                final_grade=vision_res["estimated_grade"],
                quality_score=vision_res["quality_score"],
                defect_percent=vision_res["defect_percent"],
                discoloration_percent=vision_res["discoloration_percent"],
                uniformity_score=vision_res["uniformity_score"],
                damage_level=vision_res["damage_level"],
                detected_defects=vision_res["detected_defects"],
                analysis_mode=vision_res["analysis_mode"],
                inference_time_ms=vision_res["inference_time_ms"],
                observations=vision_res["observations"],
                status="synced_from_offline",
                inspected_at=datetime.utcnow().replace(microsecond=0),
            )
            insp.record_hash = compute_sha256(build_inspection_hash_payload(insp, batch.batch_id))
            db.add(insp)
            batch.status = "inspected"
            grade_used = insp.final_grade
            db.flush()
            record_traceability_event(
                db, batch.id, batch.batch_id, 2, "Crop Inspection", "DRISHTI Offline Sync Vision",
                batch.origin_location,
                f"Analyzed synced offline capture -> Grade {grade_used} ({insp.quality_score}/100).",
                supporting_record_id=insp.inspection_id,
            )
            db.flush()

        db.commit()
        results.append(
            {
                "client_offline_id": item.client_offline_id,
                "sync_status": "SYNCED",
                "batch_id": batch.batch_id,
                "db_id": batch.id,
                "grade": grade_used,
                "message": f"Synchronized as {batch.batch_id} (Grade {grade_used}).",
            }
        )

    return {"processed": len(results), "results": results}
