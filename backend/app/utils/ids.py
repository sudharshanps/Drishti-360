from datetime import date
import uuid


def generate_code(prefix: str) -> str:
    return f"{prefix}-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"
