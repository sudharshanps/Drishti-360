from datetime import date
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.domain import MandiPrice

AGMARKNET_RESOURCE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"


def fetch_live_agmarknet_benchmark(crop_type: str, mandi_location: str) -> Optional[Dict[str, Any]]:
    if not settings.AGMARKNET_API_KEY:
        return None
    try:
        params = {
            "api-key": settings.AGMARKNET_API_KEY,
            "format": "json",
            "limit": 5,
            "filters[commodity]": crop_type.strip(),
        }
        with httpx.Client(timeout=2.5) as client:
            resp = client.get(AGMARKNET_RESOURCE_URL, params=params)
            if resp.status_code != 200:
                return None
            records = resp.json().get("records") or []
            if not records:
                return None
            chosen = next(
                (r for r in records if mandi_location.lower().split(",")[0] in str(r.get("market", "")).lower()),
                records[0],
            )
            return {
                "min_price": float(chosen["min_price"]),
                "modal_price": float(chosen["modal_price"]),
                "max_price": float(chosen["max_price"]),
                "mandi_name": f"{chosen.get('market', mandi_location)}, {chosen.get('state', '')}".strip(", "),
                "data_source": "Live Agmarknet / data.gov.in Mandi API",
                "price_date": str(chosen.get("arrival_date", date.today().isoformat())),
            }
    except Exception:
        return None

GRADE_MULTIPLIERS = {
    "A": 1.12,
    "B": 1.00,
    "C": 0.82,
}

VARIETY_FACTORS = {
    "erode salem": 1.05,
    "rajapuri": 1.02,
    "basmati 1121": 1.08,
    "sona masoori": 1.02,
    "alphonso": 1.08,
    "kesar": 1.04,
    "guntur sannam": 1.05,
    "nashik red": 1.03,
    "sharbati": 1.06,
    "lokwan": 1.02,
    "roma": 1.01,
    "hybrid": 0.99,
}

LOCATION_FACTORS = {
    "erode turmeric market, tamil nadu": 1.03,
    "koyambedu market, chennai": 1.04,
    "lasalgaon apmc, nashik": 1.02,
    "vashi apmc, mumbai": 1.05,
    "azadpur mandi, delhi": 1.05,
    "guntur mirchi yard, andhra pradesh": 1.03,
    "karnal mandi, haryana": 1.02,
    "indore mandi, madhya pradesh": 1.00,
}


def calculate_grade_linked_price(
    db: Session,
    crop_type: str,
    variety: str,
    mandi_location: str,
    grade: str,
    quantity_kg: float,
    estimate_date: Optional[date] = None,
) -> Dict[str, Any]:
    resolved_date = estimate_date or date.today()
    live_benchmark = fetch_live_agmarknet_benchmark(crop_type, mandi_location)
    live_api_used = live_benchmark is not None

    # Look up matching Mandi benchmark by crop + mandi, then crop fallback
    mandi_row = (
        db.query(MandiPrice)
        .filter(
            MandiPrice.crop_type.ilike(f"%{crop_type.strip()}%"),
            MandiPrice.mandi_name.ilike(f"%{mandi_location.strip()}%"),
        )
        .order_by(MandiPrice.price_date.desc())
        .first()
    )
    if not mandi_row:
        mandi_row = (
            db.query(MandiPrice)
            .filter(MandiPrice.crop_type.ilike(f"%{crop_type.strip()}%"))
            .order_by(MandiPrice.price_date.desc())
            .first()
        )

    if live_benchmark:
        benchmark_min = live_benchmark["min_price"]
        benchmark_modal = live_benchmark["modal_price"]
        benchmark_max = live_benchmark["max_price"]
        matched_mandi = live_benchmark["mandi_name"]
        data_source = live_benchmark["data_source"]
        last_updated_date = live_benchmark["price_date"]
        is_demo = False
    elif mandi_row:
        benchmark_min = float(mandi_row.min_price_per_quintal)
        benchmark_modal = float(mandi_row.modal_price_per_quintal)
        benchmark_max = float(mandi_row.max_price_per_quintal)
        matched_mandi = mandi_row.mandi_name
        data_source = mandi_row.data_source
        last_updated_date = mandi_row.price_date.isoformat()
        is_demo = mandi_row.is_demo
    else:
        benchmark_min = 2900.0
        benchmark_modal = 3300.0
        benchmark_max = 3700.0
        matched_mandi = mandi_location
        data_source = "DRISHTI 360 Sample Mandi Dataset (Demo Fallback)"
        last_updated_date = resolved_date.isoformat()
        is_demo = True

    grade_upper = grade.upper()
    grade_mult = GRADE_MULTIPLIERS.get(grade_upper, 1.00)
    variety_factor = VARIETY_FACTORS.get(variety.strip().lower(), 1.00)
    location_factor = LOCATION_FACTORS.get(mandi_location.strip().lower(), LOCATION_FACTORS.get(matched_mandi.lower(), 1.00))

    month = resolved_date.month
    seasonal_factor = 1.02 if month in (10, 11, 12, 1) else (0.99 if month in (4, 5, 6) else 1.00)

    indicative_avg = round(benchmark_modal * grade_mult * variety_factor * location_factor * seasonal_factor, 2)
    indicative_min = round(max(benchmark_min * grade_mult * 0.94, indicative_avg * 0.94), 2)
    indicative_max = round(max(indicative_avg * 1.06, benchmark_max * grade_mult * 0.98), 2)

    quintals = quantity_kg / 100.0
    estimated_total_value = round(quintals * indicative_avg, 2)

    explanation = (
        f"Mandi modal benchmark ₹{benchmark_modal:,.0f}/quintal ({matched_mandi}) × "
        f"Grade {grade_upper} multiplier ({grade_mult:.2f}×) × "
        f"Variety factor ({variety_factor:.2f}×) × "
        f"Location factor ({location_factor:.2f}×) × "
        f"Seasonal date factor ({seasonal_factor:.2f}×) = "
        f"₹{indicative_avg:,.2f}/quintal. "
        f"For {quantity_kg:,.1f} kg ({quintals:.2f} quintals), estimated indicative batch value is ₹{estimated_total_value:,.2f}. "
        f"Advisory note: Indicative market estimate only, not a guaranteed auction selling price."
    )

    return {
        "crop_type": crop_type,
        "variety": variety,
        "mandi_location": mandi_location,
        "matched_mandi": matched_mandi,
        "estimate_date": resolved_date,
        "grade": grade_upper,
        "quantity_kg": quantity_kg,
        "benchmark_min_per_quintal": benchmark_min,
        "benchmark_price_per_quintal": benchmark_modal,
        "benchmark_max_per_quintal": benchmark_max,
        "grade_multiplier": grade_mult,
        "variety_factor": variety_factor,
        "location_factor": location_factor,
        "seasonal_factor": seasonal_factor,
        "indicative_min_per_quintal": indicative_min,
        "indicative_avg_per_quintal": indicative_avg,
        "indicative_max_per_quintal": indicative_max,
        "estimated_total_value": estimated_total_value,
        "data_source": data_source,
        "live_api_used": live_api_used,
        "last_updated_date": last_updated_date,
        "calculation_explanation": explanation,
        "is_demo": is_demo,
    }


def get_price_trend(db: Session, crop_type: str, mandi_location: str = "", grade: str = "A") -> List[Dict[str, Any]]:
    query = db.query(MandiPrice).filter(MandiPrice.crop_type.ilike(f"%{crop_type.strip()}%"))
    if mandi_location.strip():
        matched = query.filter(MandiPrice.mandi_name.ilike(f"%{mandi_location.strip()}%")).all()
        rows = matched if matched else query.all()
    else:
        rows = query.all()

    rows = sorted(rows, key=lambda r: r.price_date)
    grade_mult = GRADE_MULTIPLIERS.get(grade.upper(), 1.0)
    seen_dates = set()
    series = []
    for r in rows:
        d_str = r.price_date.isoformat()
        if d_str in seen_dates:
            continue
        seen_dates.add(d_str)
        modal = float(r.modal_price_per_quintal)
        series.append(
            {
                "date": d_str,
                "mandi_name": r.mandi_name,
                "mandi_modal": round(modal, 2),
                "grade_adjusted": round(modal * grade_mult, 2),
                "min_price": float(r.min_price_per_quintal),
                "max_price": float(r.max_price_per_quintal),
            }
        )
    return series


def compute_grade_comparison(
    db: Session,
    crop_type: str,
    variety: str,
    mandi_location: str,
    quantity_kg: float,
    estimate_date: Optional[date] = None,
) -> List[Dict[str, Any]]:
    rows = []
    for g in ("A", "B", "C"):
        calc = calculate_grade_linked_price(
            db=db,
            crop_type=crop_type,
            variety=variety,
            mandi_location=mandi_location,
            grade=g,
            quantity_kg=quantity_kg,
            estimate_date=estimate_date,
        )
        rows.append(
            {
                "grade": f"Grade {g}",
                "grade_code": g,
                "benchmark": calc["benchmark_price_per_quintal"],
                "indicative_min": calc["indicative_min_per_quintal"],
                "indicative_avg": calc["indicative_avg_per_quintal"],
                "indicative_max": calc["indicative_max_per_quintal"],
                "total_value": calc["estimated_total_value"],
            }
        )
    return rows
