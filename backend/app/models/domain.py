from datetime import date, datetime
import uuid
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String(40), unique=True, nullable=False, default=lambda: _uid("USR"), index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="farmer", nullable=False)
    location = Column(String(150), default="Erode, Tamil Nadu", nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batches = relationship("CropBatch", back_populates="owner")


class CropBatch(Base):
    __tablename__ = "crop_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("DR360-BCH"), index=True)
    client_offline_id = Column(String(80), unique=True, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fpo_name = Column(String(150), default="Kaveri Delta Sustainable FPO", nullable=False)
    crop_type = Column(String(100), nullable=False, index=True)
    variety = Column(String(120), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    origin_location = Column(String(200), nullable=False)
    harvest_date = Column(Date, default=date.today, nullable=False)
    status = Column(String(50), default="registered", nullable=False)
    is_demo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="batches")
    inspections = relationship("CropInspection", back_populates="batch", cascade="all, delete-orphan")
    compliance_checks = relationship("ComplianceInspection", back_populates="batch", cascade="all, delete-orphan")
    price_estimates = relationship("PriceEstimate", back_populates="batch", cascade="all, delete-orphan")
    passport = relationship("DigitalPassport", back_populates="batch", uselist=False, cascade="all, delete-orphan")
    traceability_events = relationship("TraceabilityEvent", back_populates="batch", cascade="all, delete-orphan")


class CropInspection(Base):
    __tablename__ = "crop_inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("INSP"), index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    crop_type = Column(String(100), nullable=False)
    variety = Column(String(120), nullable=False)
    location = Column(String(200), nullable=False)
    image_filename = Column(String(255), nullable=True)
    estimated_grade = Column(String(5), default="A", nullable=False)
    ai_grade = Column(String(5), default="A", nullable=False)
    final_grade = Column(String(5), default="A", nullable=False)
    quality_score = Column(Float, default=85.0, nullable=False)
    defect_percent = Column(Float, default=4.5, nullable=False)
    discoloration_percent = Column(Float, default=3.2, nullable=False)
    uniformity_score = Column(Float, default=88.0, nullable=False)
    damage_level = Column(String(30), default="Low", nullable=False)
    detected_defects = Column(JSON, default=list, nullable=False)
    analysis_mode = Column(String(120), default="opencv_cv_heuristic_v1", nullable=False)
    inference_time_ms = Column(Float, default=0.0, nullable=False)
    observations = Column(Text, nullable=False)
    status = Column(String(40), default="inspected", nullable=False)
    reviewer_corrected = Column(Boolean, default=False, nullable=False)
    correction_reason = Column(Text, default="", nullable=False)
    record_hash = Column(String(64), default="", nullable=False)
    inspected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("CropBatch", back_populates="inspections")
    feedback_logs = relationship("InspectorFeedback", back_populates="inspection", cascade="all, delete-orphan")


class ComplianceInspection(Base):
    __tablename__ = "compliance_inspections"

    id = Column(Integer, primary_key=True, index=True)
    compliance_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("CMP"), index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    image_filename = Column(String(255), nullable=True)
    extracted_fields = Column(JSON, default=dict, nullable=False)
    missing_fields = Column(JSON, default=list, nullable=False)
    inconsistencies = Column(JSON, default=list, nullable=False)
    ocr_engine = Column(String(80), default="rapidocr_ppocr_onnx", nullable=False)
    raw_ocr_text = Column(Text, default="", nullable=False)
    inference_time_ms = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="REVIEW", nullable=False)
    notes = Column(Text, nullable=False)
    record_hash = Column(String(64), default="", nullable=False)
    inspected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("CropBatch", back_populates="compliance_checks")


class MandiPrice(Base):
    __tablename__ = "mandi_prices"

    id = Column(Integer, primary_key=True, index=True)
    crop_type = Column(String(100), nullable=False, index=True)
    variety = Column(String(120), nullable=False)
    mandi_name = Column(String(150), nullable=False, index=True)
    state = Column(String(100), nullable=False)
    min_price_per_quintal = Column(Float, nullable=False)
    modal_price_per_quintal = Column(Float, nullable=False)
    max_price_per_quintal = Column(Float, nullable=False)
    data_source = Column(String(200), nullable=False)
    is_demo = Column(Boolean, default=True, nullable=False)
    price_date = Column(Date, default=date.today, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PriceEstimate(Base):
    __tablename__ = "price_estimates"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("PRC"), index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    crop_type = Column(String(100), nullable=False)
    variety = Column(String(120), nullable=False)
    mandi_location = Column(String(150), nullable=False)
    estimate_date = Column(Date, default=date.today, nullable=False)
    grade = Column(String(5), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    benchmark_price_per_quintal = Column(Float, nullable=False)
    grade_multiplier = Column(Float, default=1.0, nullable=False)
    variety_factor = Column(Float, default=1.0, nullable=False)
    location_factor = Column(Float, default=1.0, nullable=False)
    seasonal_factor = Column(Float, default=1.0, nullable=False)
    indicative_min_per_quintal = Column(Float, nullable=False)
    indicative_avg_per_quintal = Column(Float, nullable=False)
    indicative_max_per_quintal = Column(Float, nullable=False)
    estimated_total_value = Column(Float, nullable=False)
    data_source = Column(String(200), nullable=False)
    last_updated_date = Column(String(40), default="", nullable=False)
    calculation_explanation = Column(Text, default="", nullable=False)
    is_demo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("CropBatch", back_populates="price_estimates")


class DigitalPassport(Base):
    __tablename__ = "digital_passports"

    id = Column(Integer, primary_key=True, index=True)
    passport_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("DR360-PSP"), index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False, unique=True)
    inspection_id = Column(Integer, ForeignKey("crop_inspections.id"), nullable=True)
    compliance_id = Column(Integer, ForeignKey("compliance_inspections.id"), nullable=True)
    price_estimate_id = Column(Integer, ForeignKey("price_estimates.id"), nullable=True)
    crop_name = Column(String(100), nullable=False)
    variety = Column(String(120), nullable=False)
    grade = Column(String(5), nullable=False)
    quality_score = Column(Float, default=85.0, nullable=False)
    inspection_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    quality_observations = Column(Text, default="", nullable=False)
    compliance_status = Column(String(30), nullable=False)
    indicative_price_per_quintal = Column(Float, nullable=False)
    estimated_total_value = Column(Float, default=0.0, nullable=False)
    verification_status = Column(String(40), default="VERIFIED_BATCH_RECORD", nullable=False)
    qr_verification_url = Column(String(300), nullable=False)
    qr_image_path = Column(String(500), default="", nullable=False)
    inspection_hash = Column(String(64), default="", nullable=False)
    compliance_hash = Column(String(64), default="", nullable=False)
    passport_hash = Column(String(64), default="", nullable=False)
    verification_count = Column(Integer, default=0, nullable=False)
    last_verified_at = Column(DateTime, nullable=True)
    is_demo = Column(Boolean, default=True, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("CropBatch", back_populates="passport")
    verification_logs = relationship("PassportVerificationLog", back_populates="passport", cascade="all, delete-orphan")


class TraceabilityEvent(Base):
    __tablename__ = "traceability_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("EVT"), index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    stage_number = Column(Integer, nullable=False)
    stage_name = Column(String(100), nullable=False)
    actor = Column(String(150), nullable=False)
    location = Column(String(200), nullable=False)
    supporting_record_id = Column(String(60), default="", nullable=False)
    notes = Column(Text, nullable=False)
    previous_hash = Column(String(64), default="", nullable=False)
    event_hash = Column(String(64), default="", nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("CropBatch", back_populates="traceability_events")


class InspectorFeedback(Base):
    __tablename__ = "inspector_feedback"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("FDB"), index=True)
    inspection_id = Column(Integer, ForeignKey("crop_inspections.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    original_ai_grade = Column(String(5), nullable=False)
    corrected_grade = Column(String(5), nullable=False)
    agreement_flag = Column(Boolean, default=True, nullable=False)
    correction_reason = Column(Text, default="", nullable=False)
    reviewer_name = Column(String(120), nullable=False)
    reviewer_notes = Column(Text, default="", nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    inspection = relationship("CropInspection", back_populates="feedback_logs")


class PassportVerificationLog(Base):
    __tablename__ = "passport_verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String(50), unique=True, nullable=False, default=lambda: _uid("VRF"), index=True)
    passport_pk = Column(Integer, ForeignKey("digital_passports.id"), nullable=False)
    verifier_name = Column(String(120), default="Anonymous Buyer Scan", nullable=False)
    verifier_role = Column(String(50), default="buyer", nullable=False)
    integrity_status = Column(String(40), default="VERIFIED_INTACT", nullable=False)
    notes = Column(Text, default="QR passport verified", nullable=False)
    verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    passport = relationship("DigitalPassport", back_populates="verification_logs")


class ComplianceRuleConfig(Base):
    __tablename__ = "compliance_rule_configs"

    id = Column(Integer, primary_key=True, index=True)
    rule_key = Column(String(50), unique=True, default="default", nullable=False)
    required_fields = Column(JSON, default=list, nullable=False)
    enforce_fssai_format = Column(Boolean, default=True, nullable=False)
    enforce_date_order = Column(Boolean, default=True, nullable=False)
    enforce_batch_match = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
