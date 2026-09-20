"""
CostIntel — Anomaly / Leak Detection Service
Pure-Python implementation: z-score + IQR, no pandas or scipy required.

Scoring logic:
  1. Group active (non-deleted) expenses by category.
  2. Per category, compute mean and std (population) of amounts.
  3. For each expense, compute z-score = (amount - mean) / std.
  4. IQR check: flag if amount > Q3 + 1.5*IQR.
  5. Combine signals -> confidence score 0-100.
  6. Persist AnomalyScore rows (upsert by user_id).

A score >= 70 is HIGH, 40-70 is MEDIUM, < 40 is LOW.
"""

import math
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Statistical helpers (no external libs)
# ──────────────────────────────────────────────────────────────

def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _population_std(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    variance = sum((x - m) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


def _quartiles(values: List[float]) -> Tuple[float, float, float]:
    """Return (Q1, median, Q3) using linear interpolation."""
    if not values:
        return 0.0, 0.0, 0.0
    s = sorted(values)
    n = len(s)

    def percentile(p):
        idx = p / 100 * (n - 1)
        lo = int(idx)
        hi = lo + 1
        frac = idx - lo
        if hi >= n:
            return s[lo]
        return s[lo] + frac * (s[hi] - s[lo])

    return percentile(25), percentile(50), percentile(75)


def _z_score(value: float, mean: float, std: float) -> float:
    if std == 0:
        return 0.0
    return (value - mean) / std


def _confidence_from_z(z: float) -> float:
    """
    Map absolute z-score to a 0-100 confidence that the point is anomalous.
    z < 1.5  -> 0   (normal)
    z ~ 2    -> 40
    z ~ 3    -> 80
    z >= 4   -> 100
    """
    az = abs(z)
    if az < 1.5:
        return 0.0
    if az >= 4.0:
        return 100.0
    return min(100.0, (az - 1.5) / 2.5 * 100.0)


# ──────────────────────────────────────────────────────────────
# Plain-language reason builder
# ──────────────────────────────────────────────────────────────

def _build_reason(exp, amount: float, stats: Dict, z: float,
                  iqr_flag: bool, upper_fence: float, confidence: float) -> str:
    cat = exp.category or "Uncategorized"
    vendor = exp.vendor or "Unknown"
    mean = stats["mean"]
    std = stats["std"]
    pct_above = ((amount - mean) / mean * 100) if mean > 0 else 0

    parts = []

    if abs(z) >= 1.5:
        direction = "higher" if z > 0 else "lower"
        parts.append(
            f"Rs {amount:,.0f} is {abs(pct_above):.0f}% {direction} than the "
            f"average {cat} expense of Rs {mean:,.0f} (std=Rs {std:,.0f})"
        )
        parts.append(f"z-score = {z:.1f} (threshold: +/-2.0)")

    if iqr_flag:
        parts.append(
            f"Exceeds the upper IQR fence of Rs {upper_fence:,.0f} "
            f"(Q3=Rs {stats['q3']:,.0f} + 1.5xIQR)"
        )

    severity = "HIGH" if confidence >= 70 else ("MEDIUM" if confidence >= 40 else "LOW")
    parts.append(f"Confidence: {confidence:.0f}% ({severity}) -- vendor: {vendor}")

    return ". ".join(parts) + "."


# ──────────────────────────────────────────────────────────────
# Core scorer
# ──────────────────────────────────────────────────────────────

def score_expenses_for_user(user_id: int) -> Dict[str, Any]:
    """
    Run anomaly detection for all non-deleted expenses belonging to user_id.
    Returns a summary dict and persists AnomalyScore rows to the DB.
    """
    from models import Expense, AnomalyScore, db

    expenses = (
        Expense.query
        .filter_by(user_id=user_id, is_deleted=False)
        .order_by(Expense.date.asc())
        .all()
    )

    if not expenses:
        return {
            "records_scanned": 0,
            "anomalies_found": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "anomalies": [],
        }

    # Group amounts by category
    category_amounts: Dict[str, List[float]] = {}
    for exp in expenses:
        cat = exp.category or "Uncategorized"
        category_amounts.setdefault(cat, []).append(float(exp.amount))

    # Compute per-category stats
    category_stats: Dict[str, Dict] = {}
    for cat, amounts in category_amounts.items():
        m = _mean(amounts)
        std = _population_std(amounts)
        q1, median, q3 = _quartiles(amounts)
        iqr = q3 - q1
        category_stats[cat] = {
            "mean": m, "std": std,
            "q1": q1, "median": median, "q3": q3,
            "iqr": iqr,
            "count": len(amounts),
        }

    # Score each expense
    anomalies = []

    for exp in expenses:
        cat = exp.category or "Uncategorized"
        amount = float(exp.amount)
        stats = category_stats[cat]

        # Need at least 3 data points to establish a baseline
        if stats["count"] < 3:
            continue

        z = _z_score(amount, stats["mean"], stats["std"])
        z_conf = _confidence_from_z(z)

        # IQR check
        upper_fence = stats["q3"] + 1.5 * stats["iqr"]
        iqr_flag = amount > upper_fence and stats["iqr"] > 0
        iqr_conf = 60.0 if iqr_flag else 0.0

        # Combine signals
        confidence = max(z_conf, iqr_conf)
        if z_conf > 0 and iqr_conf > 0:
            # Both agree -- bonus
            confidence = min(100.0, (z_conf + iqr_conf) / 2 * 1.2)

        if confidence < 20.0:
            continue

        method = "zscore+iqr" if (z_conf > 0 and iqr_conf > 0) else ("iqr" if iqr_conf > z_conf else "zscore")
        reason = _build_reason(exp, amount, stats, z, iqr_flag, upper_fence, confidence)

        anomalies.append({
            "expense_id": exp.id,
            "user_id": user_id,
            "score": round(confidence, 1),
            "z_score": round(z, 2),
            "method": method,
            "reason": reason,
            "category": cat,
            "vendor": exp.vendor,
            "amount": amount,
            "date": exp.date.strftime("%Y-%m-%d") if exp.date else None,
        })

    # Persist to DB (full replace for this user)
    try:
        AnomalyScore.query.filter_by(user_id=user_id).delete()
        for a in anomalies:
            row = AnomalyScore(
                expense_id=a["expense_id"],
                user_id=a["user_id"],
                score=a["score"],
                z_score=a["z_score"],
                method=a["method"],
                reason=a["reason"],
                flagged_at=datetime.now(timezone.utc),
                category=a["category"],
                vendor=a["vendor"],
                amount=a["amount"],
            )
            db.session.add(row)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to persist anomaly scores for user {user_id}: {e}")

    high = [a for a in anomalies if a["score"] >= 70]
    medium = [a for a in anomalies if 40 <= a["score"] < 70]
    low_sev = [a for a in anomalies if a["score"] < 40]

    return {
        "records_scanned": len(expenses),
        "anomalies_found": len(anomalies),
        "high": len(high),
        "medium": len(medium),
        "low": len(low_sev),
        "anomalies": sorted(anomalies, key=lambda x: x["score"], reverse=True),
    }


def get_anomalies_for_user(user_id: int) -> List[Dict]:
    """Return persisted anomaly scores for user, highest confidence first."""
    from models import AnomalyScore
    rows = (
        AnomalyScore.query
        .filter_by(user_id=user_id)
        .order_by(AnomalyScore.score.desc())
        .all()
    )
    return [r.to_dict() for r in rows]
