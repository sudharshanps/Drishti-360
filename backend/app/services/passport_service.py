from io import BytesIO
from pathlib import Path
from typing import Any, Dict
import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.config import LOGO_PATH, QR_UPLOAD_DIR
from app.models.domain import ComplianceInspection, CropInspection, DigitalPassport
from app.utils.crypto import (
    build_compliance_hash_payload,
    build_inspection_hash_payload,
    build_passport_hash_payload,
    compute_sha256,
)


def generate_passport_qr(passport_id: str, verify_url: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#14532D", back_color="white")
    out_path = QR_UPLOAD_DIR / f"{passport_id}.png"
    img.save(str(out_path))
    return str(out_path)


def generate_passport_pdf(passport_data: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    dark_green = colors.HexColor("#14532D")
    primary_green = colors.HexColor("#228B22")
    lime_green = colors.HexColor("#A3E635")
    soft_bg = colors.HexColor("#F7FBEF")
    text_dark = colors.HexColor("#172B1B")

    c.setFillColor(soft_bg)
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # Header
    c.setFillColor(dark_green)
    c.rect(0, height - 38 * mm, width, 38 * mm, stroke=0, fill=1)
    c.setFillColor(lime_green)
    c.rect(0, height - 40 * mm, width, 2 * mm, stroke=0, fill=1)

    if LOGO_PATH.exists():
        c.drawImage(
            str(LOGO_PATH),
            14 * mm,
            height - 34 * mm,
            width=28 * mm,
            height=28 * mm,
            mask="auto",
            preserveAspectRatio=True,
        )

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 19)
    c.drawString(48 * mm, height - 18 * mm, "DRISHTI 360")
    c.setFont("Helvetica", 10)
    c.drawString(48 * mm, height - 25 * mm, "DIGITAL QUALITY PASSPORT & BATCH CERTIFICATE")
    c.setFillColor(lime_green)
    c.setFont("Helvetica-Oblique", 8.5)
    c.drawString(48 * mm, height - 31 * mm, "From Farm to Market - Quality, Compliance, Transparency & Fair Value")

    # Main Certificate Card
    card_x = 14 * mm
    card_y = 22 * mm
    card_w = width - 28 * mm
    card_h = height - 70 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(primary_green)
    c.setLineWidth(1.2)
    c.roundRect(card_x, card_y, card_w, card_h, 6 * mm, stroke=1, fill=1)

    y = height - 54 * mm
    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(22 * mm, y, f"Passport ID: {passport_data['passport_id']}")
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 22 * mm, y, f"Issued: {passport_data['issued_at']}")

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10.5)
    c.setFillColor(primary_green)
    c.drawString(22 * mm, y, f"Batch ID: {passport_data['batch_code']}")
    c.drawRightString(width - 22 * mm, y, f"Status: {passport_data['verification_status']}")

    y -= 6 * mm
    c.setStrokeColor(colors.HexColor("#D9F99D"))
    c.setLineWidth(1.5)
    c.line(22 * mm, y, width - 22 * mm, y)

    # Grade Pill
    y -= 24 * mm
    c.setFillColor(dark_green)
    c.roundRect(22 * mm, y, 48 * mm, 19 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(lime_green)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(46 * mm, y + 8.5 * mm, f"GRADE {passport_data['grade']}")
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(46 * mm, y + 3 * mm, f"Score: {passport_data['quality_score']}/100")

    # Crop Details
    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(76 * mm, y + 13 * mm, f"Crop: {passport_data['crop_name']} ({passport_data['variety']})")
    c.setFont("Helvetica", 9.5)
    c.drawString(76 * mm, y + 7 * mm, f"Farmer / Origin: {passport_data['farmer_name']} | {passport_data['origin_location']}")
    c.drawString(76 * mm, y + 1.5 * mm, f"Batch Qty: {passport_data['quantity_kg']} kg | Inspected: {passport_data['inspection_timestamp']}")

    y -= 14 * mm
    rows = [
        ("Indicative Fair Price Reference", f"INR {passport_data['indicative_price_per_quintal']:,.2f} / quintal (Est. Total: INR {passport_data['estimated_total_value']:,.2f})"),
        ("Label Compliance Status", f"{passport_data['compliance_status']} (Preliminary Automated Verification)"),
        ("Dataset / Record Mode", "Demo Dataset Record" if passport_data.get("is_demo") else "Live Recorded Platform Batch"),
    ]
    for label, val in rows:
        c.setFillColor(colors.HexColor("#F2FCE8"))
        c.rect(22 * mm, y - 4 * mm, card_w - 16 * mm, 10 * mm, stroke=0, fill=1)
        c.setFillColor(dark_green)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(25 * mm, y, label)
        c.setFillColor(text_dark)
        c.setFont("Helvetica", 9.5)
        c.drawString(82 * mm, y, str(val)[:68])
        y -= 12 * mm

    y -= 4 * mm
    c.setFillColor(dark_green)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(22 * mm, y, "Quality Inspection Observations")
    y -= 5 * mm
    c.setFillColor(text_dark)
    c.setFont("Helvetica", 9.5)
    obs = str(passport_data.get("quality_observations", ""))
    for line in [obs[i : i + 88] for i in range(0, len(obs), 88)][:4]:
        c.drawString(22 * mm, y, line)
        y -= 5 * mm

    # QR Box
    qr_path = Path(passport_data["qr_image_path"])
    qr_box_y = 32 * mm
    c.setFillColor(colors.HexColor("#F7FBEF"))
    c.setStrokeColor(colors.HexColor("#D9F99D"))
    c.roundRect(22 * mm, qr_box_y, card_w - 16 * mm, 42 * mm, 3 * mm, stroke=1, fill=1)

    if qr_path.exists():
        c.drawImage(str(qr_path), 26 * mm, qr_box_y + 4 * mm, width=34 * mm, height=34 * mm)

    c.setFillColor(dark_green)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(65 * mm, qr_box_y + 31 * mm, "Scan QR Code for Live Batch & SHA-256 Verification")
    c.setFillColor(text_dark)
    c.setFont("Helvetica", 8.5)
    c.drawString(65 * mm, qr_box_y + 24 * mm, f"Verification URL: {passport_data['qr_verification_url']}")
    p_hash = str(passport_data.get("passport_hash", ""))
    i_hash = str(passport_data.get("inspection_hash", ""))
    c.drawString(65 * mm, qr_box_y + 18 * mm, f"Passport SHA-256: {p_hash[:40]}...")
    c.drawString(65 * mm, qr_box_y + 12.5 * mm, f"Inspection SHA-256: {i_hash[:40]}...")
    c.drawString(65 * mm, qr_box_y + 7 * mm, "Tamper-evident digest check (verifies DB records vs stored SHA-256).")

    c.setFillColor(colors.HexColor("#4B5563"))
    c.setFont("Helvetica-Oblique", 7.8)
    c.drawCentredString(
        width / 2,
        12 * mm,
        "Disclaimer: Indicative mandi prices & SHA-256 digest checks are tamper-evident audit tools (not blockchain or statutory certification).",
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


def verify_passport_integrity(db: Session, passport: DigitalPassport) -> Dict[str, Any]:
    batch = passport.batch
    batch_code = batch.batch_id if batch else ""
    insp = db.query(CropInspection).filter(CropInspection.id == passport.inspection_id).first() if passport.inspection_id else None
    cmp_row = db.query(ComplianceInspection).filter(ComplianceInspection.id == passport.compliance_id).first() if passport.compliance_id else None

    mismatches = []
    recomputed_insp = None
    if insp:
        recomputed_insp = compute_sha256(build_inspection_hash_payload(insp, batch_code))
        if passport.inspection_hash and recomputed_insp != passport.inspection_hash:
            mismatches.append("inspection_record_modified")
        if insp.record_hash and recomputed_insp != insp.record_hash:
            mismatches.append("inspection_self_hash_mismatch")

    recomputed_cmp = None
    if cmp_row:
        recomputed_cmp = compute_sha256(build_compliance_hash_payload(cmp_row, batch_code))
        if passport.compliance_hash and recomputed_cmp != passport.compliance_hash:
            mismatches.append("compliance_record_modified")
        if cmp_row.record_hash and recomputed_cmp != cmp_row.record_hash:
            mismatches.append("compliance_self_hash_mismatch")

    recomputed_psp = compute_sha256(build_passport_hash_payload(passport, batch_code))
    if passport.passport_hash and recomputed_psp != passport.passport_hash:
        mismatches.append("passport_core_modified")

    intact = len(mismatches) == 0
    return {
        "integrity_status": "VERIFIED_INTACT" if intact else "INTEGRITY_MISMATCH",
        "is_intact": intact,
        "mismatches": mismatches,
        "method": "SHA-256 canonical digest comparison (not blockchain)",
        "stored_hashes": {
            "passport_hash": passport.passport_hash,
            "inspection_hash": passport.inspection_hash,
            "compliance_hash": passport.compliance_hash,
        },
        "recomputed_hashes": {
            "passport_hash": recomputed_psp,
            "inspection_hash": recomputed_insp,
            "compliance_hash": recomputed_cmp,
        },
    }
