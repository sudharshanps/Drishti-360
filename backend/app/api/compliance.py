from datetime import datetime
import time
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.domain import ComplianceInspection, ComplianceRuleConfig, CropBatch
from app.schemas.domain import ComplianceAnalyzeRequest, ComplianceRuleUpdateRequest
from app.services.ocr_service import extract_label_from_image, verify_label_compliance
from app.services.trace_helper import record_traceability_event
from app.services.vision_service import decode_base64_image
from app.utils.crypto import build_compliance_hash_payload, compute_sha256
from app.utils.ids import generate_code
from app.utils.uploads import read_validated_image_upload

router = APIRouter(prefix="/compliance", tags=["Smart Label Compliance"])


def _get_rule_dict(db: Session) -> dict:
    cfg = db.query(ComplianceRuleConfig).filter(ComplianceRuleConfig.rule_key == "default").first()
    if not cfg:
        return {
            "required_fields": [
                "batch_number",
                "mfg_date",
                "exp_date",
                "mrp",
                "net_quantity",
                "manufacturer",
                "fssai_license",
            ],
            "enforce_fssai_format": True,
            "enforce_date_order": True,
            "enforce_batch_match": True,
        }
    return {
        "required_fields": cfg.required_fields,
        "enforce_fssai_format": cfg.enforce_fssai_format,
        "enforce_date_order": cfg.enforce_date_order,
        "enforce_batch_match": cfg.enforce_batch_match,
    }


def _serialize_compliance(r: ComplianceInspection) -> dict:
    return {
        "id": r.id,
        "compliance_id": r.compliance_id,
        "batch_id": r.batch_id,
        "batch_code": r.batch.batch_id if r.batch else None,
        "image_filename": r.image_filename,
        "image_url": f"/uploads/labels/{r.image_filename}" if r.image_filename else None,
        "extracted_fields": r.extracted_fields,
        "missing_fields": r.missing_fields,
        "inconsistencies": r.inconsistencies or [],
        "ocr_engine": r.ocr_engine,
        "raw_ocr_text": r.raw_ocr_text,
        "inference_time_ms": r.inference_time_ms,
        "status": r.status,
        "notes": r.notes,
        "record_hash": r.record_hash,
        "inspected_at": r.inspected_at.isoformat(),
    }


def _run_and_save_compliance(
    db: Session,
    batch: CropBatch,
    img_bytes: Optional[bytes],
    sample_text: Optional[str],
) -> ComplianceInspection:
    t0 = time.perf_counter()
    saved_filename = None
    ocr_lines = []
    ocr_engine = "rule_parser (text input)"
    raw_text = (sample_text or "").strip()

    if img_bytes:
        raw_ocr, ocr_lines, saved_filename, ocr_ms, ocr_engine, _, _ = extract_label_from_image(img_bytes)
        raw_text = raw_ocr if raw_ocr else raw_text
        inference_ms = ocr_ms
    else:
        inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    rules = _get_rule_dict(db)
    verified = verify_label_compliance(raw_text=raw_text, batch_code=batch.batch_id, rules=rules)

    record = ComplianceInspection(
        compliance_id=generate_code("CMP"),
        batch_id=batch.id,
        image_filename=saved_filename,
        extracted_fields={**verified["extracted_fields"], "ocr_lines_count": len(ocr_lines)},
        missing_fields=verified["missing_fields"],
        inconsistencies=verified["inconsistencies"],
        ocr_engine=ocr_engine,
        raw_ocr_text=raw_text,
        inference_time_ms=inference_ms,
        status=verified["status"],
        notes=verified["notes"],
        inspected_at=datetime.utcnow().replace(microsecond=0),
    )
    record.record_hash = compute_sha256(build_compliance_hash_payload(record, batch.batch_id))
    db.add(record)
    db.flush()

    record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=4,
        stage_name="Compliance Verification",
        actor=f"DRISHTI OCR ({ocr_engine})",
        location=batch.origin_location,
        supporting_record_id=record.compliance_id,
        notes=f"Packaging compliance check {record.compliance_id}: {record.status} ({len(record.missing_fields)} missing, {len(record.inconsistencies)} inconsistencies).",
    )
    db.commit()
    db.refresh(record)
    return record


@router.get("")
def list_compliance(db: Session = Depends(get_db)):
    rows = db.query(ComplianceInspection).order_by(ComplianceInspection.inspected_at.desc()).all()
    return [_serialize_compliance(r) for r in rows]


@router.get("/rules")
def get_compliance_rules(db: Session = Depends(get_db)):
    return _get_rule_dict(db)


@router.put("/rules")
def update_compliance_rules(payload: ComplianceRuleUpdateRequest, db: Session = Depends(get_db)):
    cfg = db.query(ComplianceRuleConfig).filter(ComplianceRuleConfig.rule_key == "default").first()
    if not cfg:
        cfg = ComplianceRuleConfig(rule_key="default")
        db.add(cfg)
    cfg.required_fields = payload.required_fields
    cfg.enforce_fssai_format = payload.enforce_fssai_format
    cfg.enforce_date_order = payload.enforce_date_order
    cfg.enforce_batch_match = payload.enforce_batch_match
    cfg.updated_at = datetime.utcnow()
    db.commit()
    return _get_rule_dict(db)


@router.post("/analyze")
def analyze_compliance_json(payload: ComplianceAnalyzeRequest, db: Session = Depends(get_db)):
    batch = db.query(CropBatch).filter(CropBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    img_bytes = decode_base64_image(payload.image_base64)
    record = _run_and_save_compliance(db=db, batch=batch, img_bytes=img_bytes, sample_text=payload.sample_text)
    return _serialize_compliance(record)


@router.post("/analyze-upload")
async def analyze_compliance_upload(
    batch_id: int = Form(...),
    sample_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    img_bytes = await read_validated_image_upload(file)
    try:
        record = _run_and_save_compliance(db=db, batch=batch, img_bytes=img_bytes, sample_text=sample_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _serialize_compliance(record)
