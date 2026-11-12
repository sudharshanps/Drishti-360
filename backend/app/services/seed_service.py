from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.domain import (
    ComplianceInspection,
    ComplianceRuleConfig,
    CropBatch,
    CropInspection,
    DigitalPassport,
    InspectorFeedback,
    MandiPrice,
    PassportVerificationLog,
    PriceEstimate,
    TraceabilityEvent,
    User,
)
from app.services.fair_price_service import calculate_grade_linked_price
from app.services.passport_service import generate_passport_qr
from app.services.trace_helper import record_traceability_event
from app.utils.crypto import (
    build_compliance_hash_payload,
    build_inspection_hash_payload,
    build_passport_hash_payload,
    compute_sha256,
)


def seed_foundation_data(db: Session) -> None:
    today = date.today()

    # Ensure default configurable compliance rules exist
    if not db.query(ComplianceRuleConfig).filter(ComplianceRuleConfig.rule_key == "default").first():
        db.add(
            ComplianceRuleConfig(
                rule_key="default",
                required_fields=[
                    "batch_number",
                    "mfg_date",
                    "exp_date",
                    "mrp",
                    "net_quantity",
                    "manufacturer",
                    "fssai_license",
                ],
                enforce_fssai_format=True,
                enforce_date_order=True,
                enforce_batch_match=True,
            )
        )
        db.commit()

    # Seed Mandi Benchmarks + 7-day historical trend points if empty
    if not db.query(MandiPrice).first():
        mandi_rows = [
            ("Turmeric", "Erode Salem", "Erode Turmeric Market, Tamil Nadu", "Tamil Nadu", 11800, 13200, 14600),
            ("Turmeric", "Rajapuri", "Vashi APMC, Mumbai", "Maharashtra", 11200, 12600, 13900),
            ("Tomato", "Roma", "Koyambedu Market, Chennai", "Tamil Nadu", 1900, 2400, 2950),
            ("Tomato", "Hybrid", "Azadpur Mandi, Delhi", "Delhi", 2100, 2600, 3150),
            ("Basmati Rice", "Basmati 1121", "Karnal Mandi, Haryana", "Haryana", 3850, 4300, 4800),
            ("Basmati Rice", "Sona Masoori", "Koyambedu Market, Chennai", "Tamil Nadu", 3400, 3900, 4400),
            ("Red Onion", "Nashik Red", "Lasalgaon APMC, Nashik", "Maharashtra", 2000, 2550, 3050),
            ("Mango", "Alphonso", "Vashi APMC, Mumbai", "Maharashtra", 6800, 8200, 9600),
            ("Wheat", "Sharbati", "Indore Mandi, Madhya Pradesh", "Madhya Pradesh", 2550, 2900, 3300),
            ("Green Chilli", "Guntur Sannam", "Guntur Mirchi Yard, Andhra Pradesh", "Andhra Pradesh", 4200, 5100, 5950),
        ]
        # Historical trend offsets for realistic 6-day series prior to today
        day_deltas = [
            (6, 0.96),
            (5, 0.97),
            (4, 0.985),
            (3, 0.975),
            (2, 0.99),
            (1, 0.995),
            (0, 1.00),
        ]
        for crop, var, mandi, state, min_p, modal_p, max_p in mandi_rows:
            for d_ago, mult in day_deltas:
                # Only store full historical series for primary varieties so count stays crisp
                if d_ago > 0 and var not in ("Erode Salem", "Nashik Red", "Roma", "Alphonso", "Basmati 1121", "Guntur Sannam"):
                    continue
                db.add(
                    MandiPrice(
                        crop_type=crop,
                        variety=var,
                        mandi_name=mandi,
                        state=state,
                        min_price_per_quintal=round(min_p * mult, 2),
                        modal_price_per_quintal=round(modal_p * mult, 2),
                        max_price_per_quintal=round(max_p * mult, 2),
                        data_source="Sample Mandi Benchmark Dataset (Demo — Agmarknet Format)",
                        is_demo=True,
                        price_date=today - timedelta(days=d_ago),
                    )
                )
        db.commit()

    if db.query(User).filter(User.email == "demo@drishti360.in").first():
        return

    demo_farmer = User(
        user_uid="USR-DEMO-001",
        email="demo@drishti360.in",
        full_name="Rameshwar Gowda (Demo Farmer)",
        password_hash=hash_password("drishti2026"),
        role="farmer",
        location="Erode, Tamil Nadu",
        preferred_language="en",
        is_demo=True,
    )
    demo_fpo = User(
        user_uid="USR-DEMO-002",
        email="fpo@drishti360.in",
        full_name="Anitha Selvam (Kaveri Delta FPO)",
        password_hash=hash_password("drishti2026"),
        role="fpo",
        location="Erode, Tamil Nadu",
        preferred_language="ta",
        is_demo=True,
    )
    demo_buyer = User(
        user_uid="USR-DEMO-003",
        email="buyer@drishti360.in",
        full_name="Arjun Mehta (FreshBasket Retail Buyer)",
        password_hash=hash_password("drishti2026"),
        role="buyer",
        location="Chennai, Tamil Nadu",
        preferred_language="en",
        is_demo=True,
    )
    db.add_all([demo_farmer, demo_fpo, demo_buyer])
    db.flush()

    samples = [
        ("DR360-BCH-2026-001", demo_farmer.id, "Kaveri Delta Sustainable FPO", "Turmeric", "Erode Salem", 1200.0, "Erode, Tamil Nadu", "Erode Turmeric Market, Tamil Nadu", "A", "A", 91.2, 3.1, 2.8, 92.4, "Low", "PASS", "DR360-PSP-2026-0001", 3),
        ("DR360-BCH-2026-002", demo_farmer.id, "Godavari Onion Growers FPO", "Red Onion", "Nashik Red", 2500.0, "Niphad, Nashik", "Lasalgaon APMC, Nashik", "A", "A", 87.5, 4.4, 3.6, 89.1, "Low", "PASS", "DR360-PSP-2026-0002", 2),
        ("DR360-BCH-2026-003", demo_fpo.id, "Kaveri Delta Sustainable FPO", "Tomato", "Roma", 850.0, "Erode, Tamil Nadu", "Koyambedu Market, Chennai", "C", "B", 74.0, 8.8, 7.2, 76.5, "Moderate", "REVIEW", "DR360-PSP-2026-0003", 1),
        ("DR360-BCH-2026-004", demo_fpo.id, "Guntur Spice Producer FPO", "Green Chilli", "Guntur Sannam", 450.0, "Guntur, Andhra Pradesh", "Guntur Mirchi Yard, Andhra Pradesh", "C", "C", 58.5, 16.4, 14.1, 63.0, "Elevated", "FLAGGED", None, 0),
    ]

    for idx, (b_code, owner_id, fpo_name, crop, variety, qty, loc, mandi, ai_g, final_g, score, defect_p, discol_p, unif, dmg, cmp_status, psp_id, days_ago) in enumerate(samples, start=1):
        ts = (datetime.utcnow() - timedelta(days=days_ago)).replace(microsecond=0)
        batch = CropBatch(
            batch_id=b_code,
            user_id=owner_id,
            fpo_name=fpo_name,
            crop_type=crop,
            variety=variety,
            quantity_kg=qty,
            origin_location=loc,
            harvest_date=today - timedelta(days=days_ago + 1),
            status="verified_by_buyer" if idx == 1 else ("certified" if psp_id else "inspected"),
            is_demo=True,
            created_at=ts,
        )
        db.add(batch)
        db.flush()

        corrected = ai_g != final_g
        insp = CropInspection(
            inspection_id=f"INSP-2026-00{idx}",
            batch_id=batch.id,
            crop_type=crop,
            variety=variety,
            location=loc,
            image_filename=None,
            estimated_grade=final_g,
            ai_grade=ai_g,
            final_grade=final_g,
            quality_score=score,
            defect_percent=defect_p,
            discoloration_percent=discol_p,
            uniformity_score=unif,
            damage_level=dmg,
            detected_defects=[
                f"Surface blemishes: {defect_p}%",
                f"Discoloration variance: {discol_p}%",
            ],
            analysis_mode="opencv_cv_pipeline (demo seeded record)",
            inference_time_ms=184.5 + idx * 18,
            observations=f"Visual quality inspection for {crop} ({variety}) at {loc}: Uniformity {unif}/100, Defect {defect_p}% -> Grade {final_g} ({score}/100) [Demo Data].",
            status="inspector_calibrated" if corrected else "demo_seeded",
            reviewer_corrected=corrected,
            correction_reason="FPO senior grader recalibrated maturity shade under daylight check." if corrected else "",
            inspected_at=ts + timedelta(minutes=20),
        )
        insp.record_hash = compute_sha256(build_inspection_hash_payload(insp, b_code))
        db.add(insp)
        db.flush()

        # Seed Inspector Feedback for calibration analytics
        db.add(
            InspectorFeedback(
                feedback_id=f"FDB-2026-00{idx}",
                inspection_id=insp.id,
                batch_id=batch.id,
                original_ai_grade=ai_g,
                corrected_grade=final_g,
                agreement_flag=(ai_g == final_g),
                correction_reason=(
                    "Reclassified from C to B after removing 20kg sorted bruised crate before dispatch."
                    if corrected
                    else "Confirmed AI visual grade during shed audit."
                ),
                reviewer_name="Dr. Karthik Subramanian (QCI Certified Grader)",
                reviewer_notes="Logged for human-in-the-loop dataset validation (Demo).",
                reviewed_at=ts + timedelta(minutes=25),
            )
        )

        extracted = {
            "batch_number": b_code,
            "mfg_date": (today - timedelta(days=days_ago)).strftime("%d/%m/%Y"),
            "exp_date": (today + timedelta(days=180)).strftime("%d/%m/%Y") if cmp_status == "PASS" else None,
            "mrp": f"INR {int(qty * 0.45)}",
            "net_quantity": f"{int(qty)} kg",
            "manufacturer": fpo_name,
            "fssai_license": "12426008001924" if cmp_status == "PASS" else None,
        }
        inconsistencies = (
            ["Label batch number mismatch and expired packaging date detected on sample box."]
            if cmp_status == "FLAGGED"
            else []
        )
        cmp_row = ComplianceInspection(
            compliance_id=f"CMP-2026-00{idx}",
            batch_id=batch.id,
            image_filename=None,
            extracted_fields=extracted,
            missing_fields=[] if cmp_status == "PASS" else ["exp_date", "fssai_license"],
            inconsistencies=inconsistencies,
            ocr_engine="rapidocr_ppocr_onnx (demo seeded record)",
            raw_ocr_text=f"Batch No: {b_code} | Net Wt: {int(qty)} kg | Producer: {fpo_name}",
            inference_time_ms=262.0 + idx * 21,
            status=cmp_status,
            notes="Preliminary automated OCR compliance screening record (Demo Data).",
            inspected_at=ts + timedelta(minutes=35),
        )
        cmp_row.record_hash = compute_sha256(build_compliance_hash_payload(cmp_row, b_code))
        db.add(cmp_row)
        db.flush()

        calc = calculate_grade_linked_price(
            db=db,
            crop_type=crop,
            variety=variety,
            mandi_location=mandi,
            grade=final_g,
            quantity_kg=qty,
            estimate_date=today,
        )
        prc_row = PriceEstimate(
            estimate_id=f"PRC-2026-00{idx}",
            batch_id=batch.id,
            crop_type=crop,
            variety=variety,
            mandi_location=mandi,
            estimate_date=today,
            grade=final_g,
            quantity_kg=qty,
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
            is_demo=True,
            created_at=ts + timedelta(minutes=45),
        )
        db.add(prc_row)
        db.flush()

        # Chronological hash-chained Traceability Events
        record_traceability_event(
            db, batch.id, b_code, 1, "Harvest", demo_farmer.full_name, loc,
            f"Registered {qty} kg {crop} ({variety}) under {fpo_name}.",
            supporting_record_id=b_code, recorded_at=ts,
        )
        db.flush()
        record_traceability_event(
            db, batch.id, b_code, 2, "Crop Inspection", "DRISHTI OpenCV Vision Screening", loc,
            f"Visual analysis completed ({score}/100, Defects {defect_p}%).",
            supporting_record_id=insp.inspection_id, recorded_at=ts + timedelta(minutes=20),
        )
        db.flush()
        record_traceability_event(
            db, batch.id, b_code, 3, "Quality Grading", "Inspector Calibration & Grading", loc,
            f"Final calibrated grade confirmed as Grade {final_g} (AI: {ai_g}).",
            supporting_record_id=insp.inspection_id, recorded_at=ts + timedelta(minutes=25),
        )
        db.flush()
        record_traceability_event(
            db, batch.id, b_code, 4, "Compliance Verification", "DRISHTI RapidOCR Rule Engine", loc,
            f"Packaging label check {cmp_row.compliance_id}: {cmp_status}.",
            supporting_record_id=cmp_row.compliance_id, recorded_at=ts + timedelta(minutes=35),
        )
        db.flush()
        record_traceability_event(
            db, batch.id, b_code, 5, "Price Estimation", "DRISHTI Fair Price Engine", mandi,
            f"Grade {final_g} benchmark valuation: INR {prc_row.indicative_avg_per_quintal:,.2f}/qtl.",
            supporting_record_id=prc_row.estimate_id, recorded_at=ts + timedelta(minutes=45),
        )
        db.flush()

        if psp_id:
            verify_url = f"{settings.PUBLIC_VERIFY_BASE_URL}/{psp_id}"
            qr_path = generate_passport_qr(psp_id, verify_url)
            psp = DigitalPassport(
                passport_id=psp_id,
                batch_id=batch.id,
                inspection_id=insp.id,
                compliance_id=cmp_row.id,
                price_estimate_id=prc_row.id,
                crop_name=crop,
                variety=variety,
                grade=final_g,
                quality_score=score,
                inspection_timestamp=insp.inspected_at,
                quality_observations=insp.observations,
                compliance_status=cmp_status,
                indicative_price_per_quintal=prc_row.indicative_avg_per_quintal,
                estimated_total_value=prc_row.estimated_total_value,
                verification_status="DEMO_VERIFIED_RECORD",
                qr_verification_url=verify_url,
                qr_image_path=qr_path,
                inspection_hash=insp.record_hash,
                compliance_hash=cmp_row.record_hash,
                verification_count=2 if idx == 1 else 1,
                last_verified_at=ts + timedelta(hours=3),
                is_demo=True,
                issued_at=ts + timedelta(minutes=60),
            )
            psp.passport_hash = compute_sha256(build_passport_hash_payload(psp, b_code))
            db.add(psp)
            db.flush()

            record_traceability_event(
                db, batch.id, b_code, 6, "Digital Passport", "DRISHTI Passport Authority", loc,
                f"Issued Digital Quality Passport {psp_id} with SHA-256 hash & QR code.",
                supporting_record_id=psp_id, recorded_at=ts + timedelta(minutes=60),
            )
            db.flush()

            db.add(
                PassportVerificationLog(
                    log_id=f"VRF-2026-00{idx}",
                    passport_pk=psp.id,
                    verifier_name=demo_buyer.full_name,
                    verifier_role="buyer",
                    integrity_status="VERIFIED_INTACT",
                    notes="QR verification passed SHA-256 inspection & passport digest match (Demo).",
                    verified_at=ts + timedelta(hours=3),
                )
            )

            # Complete stages 7, 8, 9 on Batch 1 for end-to-end PPT showcase
            if idx == 1:
                record_traceability_event(
                    db, batch.id, b_code, 7, "Dispatch", fpo_name, "Erode Dispatch Hub",
                    "Sealed 24 jute bags (1,200 kg) loaded for Chennai wholesale corridor.",
                    supporting_record_id="DSP-2026-001", recorded_at=ts + timedelta(hours=2),
                )
                db.flush()
                record_traceability_event(
                    db, batch.id, b_code, 8, "Transaction", demo_buyer.full_name, mandi,
                    f"Settled trade @ INR {prc_row.indicative_avg_per_quintal:,.2f}/qtl (Total INR {prc_row.estimated_total_value:,.2f}).",
                    supporting_record_id="TXN-2026-001", recorded_at=ts + timedelta(hours=2, minutes=30),
                )
                db.flush()
                record_traceability_event(
                    db, batch.id, b_code, 9, "Buyer Verification", demo_buyer.full_name, "Chennai Receiving Dock",
                    "Buyer scanned QR passport DR360-PSP-2026-0001 and confirmed SHA-256 intact consignment.",
                    supporting_record_id=psp_id, recorded_at=ts + timedelta(hours=3),
                )
                db.flush()

    db.commit()
