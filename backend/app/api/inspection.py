from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.domain import CropBatch, CropInspection, InspectorFeedback
from app.schemas.domain import InspectionAnalyzeRequest, InspectorReviewRequest
from app.services.trace_helper import record_traceability_event
from app.services.vision_service import analyze_crop_image, decode_base64_image
from app.utils.crypto import build_inspection_hash_payload, compute_sha256
from app.utils.ids import generate_code
from app.utils.uploads import read_validated_image_upload

router = APIRouter(prefix="/inspection", tags=["AI Crop Intelligence"])


def _serialize_inspection(r: CropInspection) -> dict:
    return {
        "id": r.id,
        "inspection_id": r.inspection_id,
        "batch_id": r.batch_id,
        "batch_code": r.batch.batch_id if r.batch else None,
        "crop_type": r.crop_type,
        "variety": r.variety,
        "location": r.location,
        "image_filename": r.image_filename,
        "image_url": f"/uploads/crops/{r.image_filename}" if r.image_filename else None,
        "estimated_grade": r.estimated_grade,
        "ai_grade": r.ai_grade or r.estimated_grade,
        "final_grade": r.final_grade or r.estimated_grade,
        "quality_score": r.quality_score,
        "defect_percent": r.defect_percent,
        "discoloration_percent": r.discoloration_percent,
        "uniformity_score": r.uniformity_score,
        "damage_level": r.damage_level,
        "detected_defects": r.detected_defects or [],
        "analysis_mode": r.analysis_mode,
        "inference_time_ms": r.inference_time_ms,
        "observations": r.observations,
        "status": r.status,
        "reviewer_corrected": r.reviewer_corrected,
        "correction_reason": r.correction_reason,
        "record_hash": r.record_hash,
        "inspected_at": r.inspected_at.isoformat(),
    }


def _persist_inspection(
    db: Session,
    batch: CropBatch,
    crop_type: str,
    variety: str,
    location: str,
    vision_res: dict,
) -> CropInspection:
    stored_filename = vision_res["saved_filename"] if vision_res.get("image_url") else None
    inspection = CropInspection(
        inspection_id=generate_code("INSP"),
        batch_id=batch.id,
        crop_type=crop_type,
        variety=variety,
        location=location,
        image_filename=stored_filename,
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
    inspection.record_hash = compute_sha256(build_inspection_hash_payload(inspection, batch.batch_id))
    db.add(inspection)
    batch.status = "inspected"
    db.flush()

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=2,
        stage_name="Crop Inspection",
        actor=f"DRISHTI Vision ({vision_res['analysis_mode'].split(' ')[0]})",
        location=location,
        supporting_record_id=inspection.inspection_id,
        notes=f"Visual CV inspection {inspection.inspection_id}: Score {inspection.quality_score}/100, Defects {inspection.defect_percent}%, Discoloration {inspection.discoloration_percent}% in {inspection.inference_time_ms} ms.",
    )
    db.flush()
    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=3,
        stage_name="Quality Grading",
        actor="DRISHTI AI Grader",
        location=location,
        supporting_record_id=inspection.inspection_id,
        notes=f"Assigned Grade {inspection.final_grade} (SHA-256: {inspection.record_hash[:12]}...).",
    )
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("")
def list_inspections(db: Session = Depends(get_db)):
    rows = db.query(CropInspection).order_by(CropInspection.inspected_at.desc()).all()
    return [_serialize_inspection(r) for r in rows]


@router.post("/analyze")
def analyze_crop_json(payload: InspectionAnalyzeRequest, db: Session = Depends(get_db)):
    batch = db.query(CropBatch).filter(CropBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    img_bytes = decode_base64_image(payload.image_base64)
    vision_res = analyze_crop_image(
        image_bytes=img_bytes,
        crop_type=payload.crop_type,
        variety=payload.variety,
        location=payload.location,
        original_filename=payload.image_filename or "sample_crop.jpg",
    )
    inspection = _persist_inspection(
        db=db,
        batch=batch,
        crop_type=payload.crop_type,
        variety=payload.variety,
        location=payload.location,
        vision_res=vision_res,
    )
    out = _serialize_inspection(inspection)
    out["original_kb"] = vision_res.get("original_kb", 0.0)
    out["compressed_kb"] = vision_res.get("compressed_kb", 0.0)
    return out


@router.post("/analyze-upload")
async def analyze_crop_upload(
    batch_id: int = Form(...),
    crop_type: str = Form(...),
    variety: str = Form(...),
    location: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    img_bytes = await read_validated_image_upload(file)
    try:
        vision_res = analyze_crop_image(
            image_bytes=img_bytes,
            crop_type=crop_type,
            variety=variety,
            location=location,
            original_filename=file.filename or "crop_upload.jpg",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    inspection = _persist_inspection(
        db=db,
        batch=batch,
        crop_type=crop_type,
        variety=variety,
        location=location,
        vision_res=vision_res,
    )
    out = _serialize_inspection(inspection)
    out["original_kb"] = vision_res.get("original_kb", 0.0)
    out["compressed_kb"] = vision_res.get("compressed_kb", 0.0)
    return out


@router.post("/{inspection_id}/review")
def submit_inspector_review(
    inspection_id: str,
    payload: InspectorReviewRequest,
    db: Session = Depends(get_db),
):
    insp = db.query(CropInspection).filter(CropInspection.inspection_id == inspection_id).first()
    if not insp or not insp.batch:
        raise HTTPException(status_code=404, detail="Inspection record not found.")

    batch = insp.batch
    orig_ai_grade = insp.ai_grade or insp.estimated_grade
    agreed = orig_ai_grade == payload.corrected_grade

    feedback = InspectorFeedback(
        feedback_id=generate_code("FDB"),
        inspection_id=insp.id,
        batch_id=batch.id,
        original_ai_grade=orig_ai_grade,
        corrected_grade=payload.corrected_grade,
        agreement_flag=agreed,
        correction_reason=payload.correction_reason.strip(),
        reviewer_name=payload.reviewer_name.strip(),
        reviewer_notes=(payload.reviewer_notes or "").strip(),
    )
    db.add(feedback)

    insp.final_grade = payload.corrected_grade
    insp.estimated_grade = payload.corrected_grade
    insp.reviewer_corrected = not agreed
    insp.correction_reason = payload.correction_reason.strip()
    insp.status = "inspector_calibrated"
    # Recompute inspection hash and check downstream passport integrity automatically on next verify!
    insp.record_hash = compute_sha256(build_inspection_hash_payload(insp, batch.batch_id))

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=3,
        stage_name="Quality Grading",
        actor=f"Inspector {payload.reviewer_name.strip()}",
        location=insp.location,
        supporting_record_id=feedback.feedback_id,
        notes=(
            f"Human-in-the-loop calibration: AI predicted Grade {orig_ai_grade}, "
            f"Inspector {'confirmed' if agreed else 'calibrated to'} Grade {payload.corrected_grade}. "
            f"Reason: {payload.correction_reason.strip()}. Logged for controlled validation (no automatic model retraining)."
        ),
    )
    db.commit()
    db.refresh(feedback)

    return {
        "feedback_id": feedback.feedback_id,
        "inspection_id": insp.inspection_id,
        "batch_code": batch.batch_id,
        "original_ai_grade": feedback.original_ai_grade,
        "corrected_grade": feedback.corrected_grade,
        "agreement_flag": feedback.agreement_flag,
        "reviewer_name": feedback.reviewer_name,
        "correction_reason": feedback.correction_reason,
        "updated_record_hash": insp.record_hash,
        "validation_policy": "Recorded to human feedback dataset for controlled validation; production weights are not auto-retrained.",
        "reviewed_at": feedback.reviewed_at.isoformat(),
    }


@router.get("/calibration/stats")
def get_calibration_stats(db: Session = Depends(get_db)):
    rows = db.query(InspectorFeedback).order_by(InspectorFeedback.reviewed_at.desc()).all()
    total = len(rows)
    agreed = sum(1 for r in rows if r.agreement_flag)
    corrected = total - agreed
    agreement_rate = round((agreed / total) * 100.0, 1) if total else 100.0
    return {
        "total_reviews": total,
        "agreed_count": agreed,
        "corrected_count": corrected,
        "agreement_rate_percent": agreement_rate,
        "validation_policy": "Feedback dataset stored for offline validation; no automatic online retraining.",
        "recent_feedback": [
            {
                "feedback_id": r.feedback_id,
                "inspection_id": r.inspection.inspection_id if r.inspection else None,
                "batch_code": r.inspection.batch.batch_id if (r.inspection and r.inspection.batch) else None,
                "crop_type": r.inspection.crop_type if r.inspection else None,
                "original_ai_grade": r.original_ai_grade,
                "corrected_grade": r.corrected_grade,
                "agreement_flag": r.agreement_flag,
                "correction_reason": r.correction_reason,
                "reviewer_name": r.reviewer_name,
                "reviewed_at": r.reviewed_at.isoformat(),
            }
            for r in rows[:20]
        ],
    }
