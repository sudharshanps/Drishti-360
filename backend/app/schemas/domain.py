from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthOut(BaseModel):
    status: str
    service: str
    database_dialect: str
    environment: str
    timestamp: datetime


class UserRegister(BaseModel):
    email: str = Field(..., min_length=3)
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=6)
    role: str = "farmer"
    location: str = "Erode, Tamil Nadu"


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    user_uid: str
    email: str
    full_name: str
    role: str
    location: str
    preferred_language: str
    is_demo: bool

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CropBatchCreate(BaseModel):
    crop_type: str = Field(..., min_length=2)
    variety: str = Field(..., min_length=2)
    quantity_kg: float = Field(..., gt=0)
    origin_location: str = Field(..., min_length=2)
    harvest_date: Optional[date] = None
    fpo_name: Optional[str] = "Kaveri Delta Sustainable FPO"
    client_offline_id: Optional[str] = None


class CropBatchOut(BaseModel):
    id: int
    batch_id: str
    crop_type: str
    variety: str
    quantity_kg: float
    origin_location: str
    harvest_date: date
    status: str
    is_demo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionAnalyzeRequest(BaseModel):
    batch_id: int
    crop_type: str
    variety: str
    location: str
    image_filename: Optional[str] = "sample_crop.jpg"
    image_base64: Optional[str] = None


class InspectorReviewRequest(BaseModel):
    corrected_grade: str = Field(..., pattern="^(A|B|C)$")
    correction_reason: str = Field(..., min_length=2)
    reviewer_name: str = Field(..., min_length=2)
    reviewer_notes: Optional[str] = ""


class ComplianceAnalyzeRequest(BaseModel):
    batch_id: int
    image_filename: Optional[str] = "sample_label.png"
    sample_text: Optional[str] = None
    image_base64: Optional[str] = None


class ComplianceRuleUpdateRequest(BaseModel):
    required_fields: List[str]
    enforce_fssai_format: bool = True
    enforce_date_order: bool = True
    enforce_batch_match: bool = True


class PricingEstimateRequest(BaseModel):
    batch_id: Optional[int] = None
    crop_type: str
    variety: str
    mandi_location: str
    estimate_date: Optional[date] = None
    grade: str = Field(..., pattern="^(A|B|C)$")
    quantity_kg: float = Field(..., gt=0)


class PassportGenerateRequest(BaseModel):
    batch_id: int


class PassportScanRequest(BaseModel):
    verifier_name: str = "Buyer / Field Inspector"
    verifier_role: str = "buyer"
    notes: str = "QR verification scan completed"


class TraceabilityEventCreateRequest(BaseModel):
    stage_number: int = Field(..., ge=1, le=9)
    stage_name: str = Field(..., min_length=2)
    actor: str = Field(..., min_length=2)
    location: str = Field(..., min_length=2)
    supporting_record_id: Optional[str] = ""
    notes: str = Field(..., min_length=2)


class OfflineSyncItem(BaseModel):
    client_offline_id: str = Field(..., min_length=4)
    crop_type: str
    variety: str
    quantity_kg: float = Field(..., gt=0)
    origin_location: str
    harvest_date: Optional[date] = None
    fpo_name: Optional[str] = "Kaveri Delta Sustainable FPO"
    captured_at: Optional[datetime] = None
    crop_image_base64: Optional[str] = None
    crop_image_filename: Optional[str] = "offline_capture.jpg"
    label_text: Optional[str] = None
    run_full_pipeline: bool = True


class OfflineSyncBatchRequest(BaseModel):
    items: List[OfflineSyncItem]


class BuyerPurchaseRequest(BaseModel):
    batch_id: int
    buyer_name: str = Field(..., min_length=2)
    agreed_price_per_quintal: float = Field(..., gt=0)
    destination: str = Field(..., min_length=2)
    notes: Optional[str] = ""


class FpoBulkCertifyRequest(BaseModel):
    batch_ids: List[int]


class DashboardStatsOut(BaseModel):
    total_batches: int
    total_inspections: int
    pending_inspections: int
    grade_distribution: Dict[str, int]
    average_indicative_price: float
    compliance_summary: Dict[str, int]
    total_passports: int
    total_traceability_events: int
    fpo_stats: Dict[str, Any]
    inspector_stats: Dict[str, Any]
    integrity_summary: Dict[str, int]
    recent_batches: List[Dict[str, Any]]
    recent_events: List[Dict[str, Any]]
