import hashlib
import json
from typing import Any, Dict


def canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


def compute_sha256(data: Any) -> str:
    raw = data if isinstance(data, str) else canonical_json(data)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def build_inspection_hash_payload(insp: Any, batch_code: str) -> Dict[str, Any]:
    return {
        "inspection_id": insp.inspection_id,
        "batch_code": batch_code,
        "crop_type": insp.crop_type,
        "variety": insp.variety,
        "location": insp.location,
        "ai_grade": insp.ai_grade or insp.estimated_grade,
        "final_grade": insp.final_grade or insp.estimated_grade,
        "quality_score": round(float(insp.quality_score), 2),
        "defect_percent": round(float(insp.defect_percent or 0.0), 2),
        "discoloration_percent": round(float(insp.discoloration_percent or 0.0), 2),
        "uniformity_score": round(float(insp.uniformity_score or 0.0), 2),
        "observations": insp.observations,
        "inspected_at": insp.inspected_at.replace(microsecond=0).isoformat(),
    }


def build_compliance_hash_payload(cmp_row: Any, batch_code: str) -> Dict[str, Any]:
    return {
        "compliance_id": cmp_row.compliance_id,
        "batch_code": batch_code,
        "status": cmp_row.status,
        "extracted_fields": cmp_row.extracted_fields or {},
        "missing_fields": cmp_row.missing_fields or [],
        "inconsistencies": cmp_row.inconsistencies or [],
        "inspected_at": cmp_row.inspected_at.replace(microsecond=0).isoformat(),
    }


def build_passport_hash_payload(passport: Any, batch_code: str) -> Dict[str, Any]:
    return {
        "passport_id": passport.passport_id,
        "batch_code": batch_code,
        "crop_name": passport.crop_name,
        "variety": passport.variety,
        "grade": passport.grade,
        "quality_score": round(float(passport.quality_score), 2),
        "compliance_status": passport.compliance_status,
        "indicative_price_per_quintal": round(float(passport.indicative_price_per_quintal), 2),
        "estimated_total_value": round(float(passport.estimated_total_value), 2),
        "inspection_hash": passport.inspection_hash or "",
        "compliance_hash": passport.compliance_hash or "",
        "qr_verification_url": passport.qr_verification_url,
    }


def build_trace_event_hash_payload(event: Any, batch_code: str, previous_hash: str) -> Dict[str, Any]:
    return {
        "event_id": event.event_id,
        "batch_code": batch_code,
        "stage_number": int(event.stage_number),
        "stage_name": event.stage_name,
        "actor": event.actor,
        "location": event.location,
        "supporting_record_id": event.supporting_record_id or "",
        "notes": event.notes,
        "previous_hash": previous_hash or ("0" * 64),
        "recorded_at": event.recorded_at.replace(microsecond=0).isoformat(),
    }
