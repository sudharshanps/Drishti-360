from datetime import datetime
from sqlalchemy.orm import Session

from app.models.domain import TraceabilityEvent
from app.utils.crypto import build_trace_event_hash_payload, compute_sha256
from app.utils.ids import generate_code


def record_traceability_event(
    db: Session,
    batch_id: int,
    batch_code: str,
    stage_number: int,
    stage_name: str,
    actor: str,
    location: str,
    notes: str,
    supporting_record_id: str = "",
    recorded_at: datetime | None = None,
) -> TraceabilityEvent:
    prev = (
        db.query(TraceabilityEvent)
        .filter(TraceabilityEvent.batch_id == batch_id)
        .order_by(TraceabilityEvent.recorded_at.desc(), TraceabilityEvent.id.desc())
        .first()
    )
    previous_hash = prev.event_hash if (prev and prev.event_hash) else ("0" * 64)
    ts = (recorded_at or datetime.utcnow()).replace(microsecond=0)

    ev = TraceabilityEvent(
        event_id=generate_code("EVT"),
        batch_id=batch_id,
        stage_number=stage_number,
        stage_name=stage_name,
        actor=actor,
        location=location,
        supporting_record_id=supporting_record_id,
        notes=notes,
        previous_hash=previous_hash,
        recorded_at=ts,
    )
    ev.event_hash = compute_sha256(build_trace_event_hash_payload(ev, batch_code, previous_hash))
    db.add(ev)
    return ev
