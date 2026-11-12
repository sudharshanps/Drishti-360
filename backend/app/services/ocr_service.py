import re
import time
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

from app.core.config import LABEL_UPLOAD_DIR
from app.services.vision_service import compress_and_save_image

_OCR_ENGINE = None


def get_ocr_engine():
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR
        _OCR_ENGINE = RapidOCR()
    return _OCR_ENGINE


def _parse_date_str(val: Optional[str]) -> Optional[date]:
    if not val:
        return None
    cleaned = re.sub(r"[^0-9/\-]", "", val.strip())
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y", "%m/%Y", "%m-%Y"):
        try:
            dt = datetime.strptime(cleaned, fmt).date()
            return dt
        except ValueError:
            continue
    return None


def extract_label_from_image(image_bytes: bytes) -> Tuple[str, List[Dict[str, Any]], str, float, str, float, float]:
    t0 = time.perf_counter()
    _, saved_filename, orig_kb, comp_kb, img = compress_and_save_image(
        image_bytes=image_bytes,
        dest_dir=LABEL_UPLOAD_DIR,
        prefix="label",
        max_dim=1100,
        jpeg_quality=85,
    )

    # Light CLAHE contrast enhancement on luminance to aid label OCR readability
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = cv2.cvtColor(cv2.merge((clahe.apply(l_ch), a_ch, b_ch)), cv2.COLOR_LAB2BGR)

    engine = get_ocr_engine()
    res, _ = engine(enhanced)
    lines: List[Dict[str, Any]] = []
    texts: List[str] = []
    if res:
        for item in res:
            # item = [box, text, confidence]
            txt = str(item[1]).strip()
            conf = round(float(item[2]), 3)
            if txt:
                texts.append(txt)
                lines.append({"text": txt, "confidence": conf})

    raw_text = " | ".join(texts)
    inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return raw_text, lines, saved_filename, inference_ms, "rapidocr_ppocr_onnx", orig_kb, comp_kb


def verify_label_compliance(
    raw_text: str,
    batch_code: str,
    rules: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cfg = rules or {
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
    text = raw_text or ""

    batch_m = re.search(r"(?:Batch(?:\s*No\.?|\s*ID)?|Lot(?:\s*No\.?)?)\s*[:#\-]?\s*([A-Za-z0-9\-_/]+)", text, re.IGNORECASE)
    mfg_m = re.search(r"(?:Mfd|Mfg|Packed|Manufactur(?:ed|ing)\s*Date)\s*[:\-]?\s*([0-9]{1,4}[/\-][0-9]{1,2}(?:[/\-][0-9]{2,4})?)", text, re.IGNORECASE)
    exp_m = re.search(r"(?:Exp|Expiry|Best\s*Before|Use\s*By)\s*[:\-]?\s*([0-9]{1,4}[/\-][0-9]{1,2}(?:[/\-][0-9]{2,4})?)", text, re.IGNORECASE)
    mrp_m = re.search(r"(?:MRP|Price)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)", text, re.IGNORECASE)
    qty_m = re.search(r"(?:Net\s*(?:Wt|Weight|Qty|Quantity))\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|gm|grams|qtl|quintal|ml|l))", text, re.IGNORECASE)
    fssai_m = re.search(r"(?:FSSAI(?:\s*Lic\.?\s*(?:No\.?)?)?|Lic\.?\s*No\.?)\s*[:#\-]?\s*([0-9]{10,16})", text, re.IGNORECASE)
    mfg_name_m = re.search(r"(?:Mfg\s*By|Manufacturer|Packed\s*By|FPO|Producer)\s*[:\-]?\s*([A-Za-z0-9 &.,\-]{3,48})", text, re.IGNORECASE)

    extracted = {
        "batch_number": batch_m.group(1).strip() if batch_m else None,
        "mfg_date": mfg_m.group(1).strip() if mfg_m else None,
        "exp_date": exp_m.group(1).strip() if exp_m else None,
        "mrp": f"INR {mrp_m.group(1)}" if mrp_m else None,
        "net_quantity": qty_m.group(1).strip() if qty_m else None,
        "fssai_license": fssai_m.group(1).strip() if fssai_m else None,
        "manufacturer": mfg_name_m.group(1).strip(" ,|") if mfg_name_m else None,
    }

    required_fields = cfg.get("required_fields") or [
        "batch_number",
        "mfg_date",
        "exp_date",
        "mrp",
        "net_quantity",
        "fssai_license",
    ]
    missing_fields = [f for f in required_fields if not extracted.get(f)]

    inconsistencies: List[str] = []
    if cfg.get("enforce_fssai_format", True) and extracted["fssai_license"]:
        if len(extracted["fssai_license"]) != 14:
            inconsistencies.append(
                f"FSSAI number '{extracted['fssai_license']}' is {len(extracted['fssai_license'])} digits (standard FSSAI requires 14 digits)."
            )

    if cfg.get("enforce_date_order", True):
        mfg_dt = _parse_date_str(extracted["mfg_date"])
        exp_dt = _parse_date_str(extracted["exp_date"])
        if mfg_dt and exp_dt and exp_dt <= mfg_dt:
            inconsistencies.append(
                f"Expiry date ({extracted['exp_date']}) is on or before Manufacturing date ({extracted['mfg_date']})."
            )
        if exp_dt and exp_dt < date.today():
            inconsistencies.append(f"Package expiry date ({extracted['exp_date']}) has already passed.")

    if mrp_m:
        try:
            if float(mrp_m.group(1)) <= 0:
                inconsistencies.append("MRP must be greater than 0.")
        except ValueError:
            pass

    if cfg.get("enforce_batch_match", True) and extracted["batch_number"] and batch_code:
        ext_b = extracted["batch_number"].upper()
        ref_b = batch_code.upper()
        if ext_b != ref_b and ext_b not in ref_b and ref_b not in ext_b:
            inconsistencies.append(
                f"Label batch code '{extracted['batch_number']}' differs from selected CropBatch '{batch_code}'."
            )

    if inconsistencies or len(missing_fields) >= 4:
        status = "FLAGGED"
    elif missing_fields:
        status = "REVIEW"
    else:
        status = "PASS"

    reasons = []
    if not missing_fields and not inconsistencies:
        reasons.append("All configured packaging declarations extracted and rule-verified.")
    if missing_fields:
        reasons.append(f"Missing declarations: {', '.join(missing_fields)}.")
    if inconsistencies:
        reasons.append(f"Inconsistencies detected: {' '.join(inconsistencies)}")
    reasons.append("Note: Automated preliminary OCR rule screening — not an official regulatory certification.")

    return {
        "extracted_fields": extracted,
        "missing_fields": missing_fields,
        "inconsistencies": inconsistencies,
        "status": status,
        "notes": " ".join(reasons),
    }
