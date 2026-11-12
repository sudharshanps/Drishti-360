from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.domain import CropBatch, TraceabilityEvent
from app.schemas.domain import TraceabilityEventCreateRequest
from app.services.trace_helper import record_traceability_event

router = APIRouter(prefix="/traceability", tags=["Traceability Ledger"])


@router.get("/{batch_id}")
def get_traceability(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    events = (
        db.query(TraceabilityEvent)
        .filter(TraceabilityEvent.batch_id == batch.id)
        .order_by(TraceabilityEvent.recorded_at.asc(), TraceabilityEvent.id.asc())
        .all()
    )

    chain_links_valid = True
    prev_seen = "0" * 64
    serialized = []
    for e in events:
        if e.previous_hash and prev_seen != ("0" * 64) and e.previous_hash != prev_seen:
            chain_links_valid = False
        if e.event_hash:
            prev_seen = e.event_hash
        serialized.append(
            {
                "event_id": e.event_id,
                "stage_number": e.stage_number,
                "stage_name": e.stage_name,
                "actor": e.actor,
                "location": e.location,
                "supporting_record_id": e.supporting_record_id,
                "notes": e.notes,
                "previous_hash": e.previous_hash,
                "event_hash": e.event_hash,
                "recorded_at": e.recorded_at.isoformat(),
            }
        )

    return {
        "batch": {
            "id": batch.id,
            "batch_id": batch.batch_id,
            "fpo_name": batch.fpo_name,
            "crop_type": batch.crop_type,
            "variety": batch.variety,
            "quantity_kg": batch.quantity_kg,
            "origin_location": batch.origin_location,
            "status": batch.status,
        },
        "chain_integrity": "CHAIN_VERIFIED" if chain_links_valid else "CHAIN_LINK_MISMATCH",
        "events": serialized,
    }


@router.post("/{batch_id}/events")
def add_traceability_stage_event(
    batch_id: int,
    payload: TraceabilityEventCreateRequest,
    db: Session = Depends(get_db),
):
    batch = db.query(CropBatch).filter(CropBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Crop batch not found.")

    ev = record_traceability_event(
        db=db,
        batch_id=batch.id,
        batch_code=batch.batch_id,
        stage_number=payload.stage_number,
        stage_name=payload.stage_name.strip(),
        actor=payload.actor.strip(),
        location=payload.location.strip(),
        supporting_record_id=(payload.supporting_record_id or "").strip(),
        notes=payload.notes.strip(),
    )
    if payload.stage_number == 7:
        batch.status = "dispatched"
    elif payload.stage_number == 8:
        batch.status = "transacted"
    elif payload.stage_number == 9:
        batch.status = "verified_by_buyer"

    db.commit()
    db.refresh(ev)
    return {
        "event_id": ev.event_id,
        "batch_id": batch.id,
        "batch_code": batch.batch_id,
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
