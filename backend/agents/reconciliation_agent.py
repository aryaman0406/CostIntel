"""
CostIntel — Multi-Source Reconciliation Agent

3-tier matching strategy:
  Tier 1 (Exact):     amount == statement_amount AND date == statement_date AND vendor == statement_vendor
  Tier 2 (Tolerant):  (amount within ±5 AND date exact) OR (amount exact AND date within ±3 days)
                       vendor still compared loosely (exact or close) — one dimension MUST be exact
  Tier 3 (Fuzzy):     difflib.SequenceMatcher(vendor) >= 0.75 AND amount within ±5 AND date within ±3 days

Each match records:
  - match_tier: "exact" | "tolerant_amount" | "tolerant_date" | "fuzzy"
  - confidence: 0–100 float
  - delta_amount: difference in rupees
  - delta_days: difference in days

Exceptions carry a machine-readable reason:
  - "no_candidate_within_tolerance"
  - "multiple_ambiguous_candidates"
  - "orphaned_statement_record"

The agent logs a summary to audit_log (action_type="reconciliation_run").
"""

import json
import logging
import math
from datetime import date, timedelta
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Tunable thresholds
# ─────────────────────────────────────────────────────────────
AMOUNT_TOLERANCE_INR = 5.0    # ± ₹5
DATE_TOLERANCE_DAYS  = 3      # ± 3 calendar days
FUZZY_THRESHOLD      = 0.75   # SequenceMatcher ratio


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def _vendor_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _amount_delta(a: float, b: float) -> float:
    return abs(float(a) - float(b))


def _date_delta(a: str, b: str) -> int:
    return abs((_parse_date(a) - _parse_date(b)).days)


def _exact_vendor(a: str, b: str) -> bool:
    return a.strip().lower() == b.strip().lower()


def _within_amount(a, b) -> bool:
    return _amount_delta(a, b) <= AMOUNT_TOLERANCE_INR


def _within_date(a, b) -> bool:
    return _date_delta(a, b) <= DATE_TOLERANCE_DAYS


def _confidence(tier: str, amt_delta: float, day_delta: int, sim: float) -> float:
    """Return 0-100 confidence based on tier + deltas."""
    base = {"exact": 100.0, "tolerant_amount": 88.0,
            "tolerant_date": 85.0, "fuzzy": 72.0}.get(tier, 60.0)
    # Penalise proportionally to deltas
    penalty = (amt_delta / AMOUNT_TOLERANCE_INR) * 4 + (day_delta / DATE_TOLERANCE_DAYS) * 4
    vendor_bonus = (sim - 0.5) * 10
    return round(min(100.0, max(0.0, base - penalty + vendor_bonus)), 1)


# ─────────────────────────────────────────────────────────────
# Tier matchers — each returns Optional match dict or None
# ─────────────────────────────────────────────────────────────

def _try_exact(ledger_rec: dict, stmt_rec: dict) -> Optional[dict]:
    if (
        _exact_vendor(ledger_rec["vendor"], stmt_rec["vendor"])
        and _amount_delta(ledger_rec["amount"], stmt_rec["amount"]) == 0.0
        and _date_delta(ledger_rec["date"], stmt_rec["date"]) == 0
    ):
        return _build_match("exact", ledger_rec, stmt_rec, 0.0, 0, 1.0)
    return None


def _try_tolerant(ledger_rec: dict, stmt_rec: dict) -> Optional[dict]:
    """
    One dimension MUST be exact; the other may flex within tolerance.
    Vendor must be exact string match (tolerant tier doesn't use fuzzy vendor).
    """
    if not _exact_vendor(ledger_rec["vendor"], stmt_rec["vendor"]):
        return None

    amt_exact  = _amount_delta(ledger_rec["amount"], stmt_rec["amount"]) == 0.0
    date_exact = _date_delta(ledger_rec["date"], stmt_rec["date"]) == 0
    amt_ok     = _within_amount(ledger_rec["amount"], stmt_rec["amount"])
    date_ok    = _within_date(ledger_rec["date"], stmt_rec["date"])

    # Skip pure exact — that's tier 1's job
    if amt_exact and date_exact:
        return None

    if amt_exact and date_ok:
        d = _date_delta(ledger_rec["date"], stmt_rec["date"])
        sim = _vendor_similarity(ledger_rec["vendor"], stmt_rec["vendor"])
        return _build_match("tolerant_date", ledger_rec, stmt_rec, 0.0, d, sim)

    if date_exact and amt_ok:
        a = _amount_delta(ledger_rec["amount"], stmt_rec["amount"])
        sim = _vendor_similarity(ledger_rec["vendor"], stmt_rec["vendor"])
        return _build_match("tolerant_amount", ledger_rec, stmt_rec, a, 0, sim)

    return None


def _try_fuzzy(ledger_rec: dict, stmt_rec: dict) -> Optional[dict]:
    """Fuzzy vendor + both dimensions within tolerance (but not exact)."""
    sim = _vendor_similarity(ledger_rec["vendor"], stmt_rec["vendor"])
    if sim < FUZZY_THRESHOLD:
        return None
    if _exact_vendor(ledger_rec["vendor"], stmt_rec["vendor"]):
        return None  # Not fuzzy — covered by tiers 1/2
    amt_ok  = _within_amount(ledger_rec["amount"], stmt_rec["amount"])
    date_ok = _within_date(ledger_rec["date"], stmt_rec["date"])
    if amt_ok and date_ok:
        a = _amount_delta(ledger_rec["amount"], stmt_rec["amount"])
        d = _date_delta(ledger_rec["date"], stmt_rec["date"])
        return _build_match("fuzzy", ledger_rec, stmt_rec, a, d, sim)
    return None


def _build_match(tier: str, l: dict, s: dict, amt_delta: float,
                 day_delta: int, sim: float) -> dict:
    return {
        "tier": tier,
        "ledger_id": l["id"],
        "statement_id": s["id"],
        "ledger_vendor": l["vendor"],
        "statement_vendor": s["vendor"],
        "ledger_amount": l["amount"],
        "statement_amount": s["amount"],
        "ledger_date": l["date"],
        "statement_date": s["date"],
        "delta_amount": round(amt_delta, 2),
        "delta_days": day_delta,
        "vendor_similarity": round(sim, 4),
        "confidence": _confidence(tier, amt_delta, day_delta, sim),
    }


# ─────────────────────────────────────────────────────────────
# Core engine
# ─────────────────────────────────────────────────────────────

def run_reconciliation(ledger: List[dict], statement: List[dict]) -> Dict[str, Any]:
    """
    Run 3-tier reconciliation.  Returns a structured result dict.
    """
    unmatched_ledger    = list(ledger)
    unmatched_statement = list(statement)
    matches: List[dict] = []

    # ── Tier 1: Exact ────────────────────────────────────────
    still_ledger    = []
    matched_stmt_ids = set()

    for l in unmatched_ledger:
        hit = None
        for s in unmatched_statement:
            if s["id"] in matched_stmt_ids:
                continue
            m = _try_exact(l, s)
            if m:
                hit = (m, s)
                break
        if hit:
            matches.append(hit[0])
            matched_stmt_ids.add(hit[1]["id"])
        else:
            still_ledger.append(l)

    unmatched_statement = [s for s in unmatched_statement if s["id"] not in matched_stmt_ids]
    unmatched_ledger    = still_ledger

    # ── Tier 2: Tolerant ─────────────────────────────────────
    still_ledger     = []
    matched_stmt_ids2 = set()

    for l in unmatched_ledger:
        candidates = []
        for s in unmatched_statement:
            if s["id"] in matched_stmt_ids2:
                continue
            m = _try_tolerant(l, s)
            if m:
                candidates.append((m, s))

        if len(candidates) == 1:
            matches.append(candidates[0][0])
            matched_stmt_ids2.add(candidates[0][1]["id"])
        elif len(candidates) > 1:
            # Pick best confidence, but record ambiguity warning in match
            best = max(candidates, key=lambda x: x[0]["confidence"])
            best_match = dict(best[0])
            best_match["ambiguity_note"] = f"tier2 had {len(candidates)} candidates; picked highest confidence"
            matches.append(best_match)
            matched_stmt_ids2.add(best[1]["id"])
        else:
            still_ledger.append(l)

    unmatched_statement = [s for s in unmatched_statement if s["id"] not in matched_stmt_ids2]
    unmatched_ledger    = still_ledger

    # ── Tier 3: Fuzzy ────────────────────────────────────────
    still_ledger      = []
    matched_stmt_ids3 = set()

    for l in unmatched_ledger:
        candidates = []
        for s in unmatched_statement:
            if s["id"] in matched_stmt_ids3:
                continue
            m = _try_fuzzy(l, s)
            if m:
                candidates.append((m, s))

        if len(candidates) == 1:
            matches.append(candidates[0][0])
            matched_stmt_ids3.add(candidates[0][1]["id"])
        elif len(candidates) > 1:
            # Check for ambiguity: if two candidates have identical confidence, flag it
            confs = [c[0]["confidence"] for c in candidates]
            if confs.count(max(confs)) > 1:
                # Genuinely ambiguous — exception, do not auto-pick
                still_ledger.append(l)
                # Mark these statement records to note the ambiguity below
                # We'll add them to exceptions with special reason
                l["_ambiguous_fuzzy_candidates"] = [c[1]["id"] for c in candidates]
                l["_ambiguous_candidates"] = [
                    {"statement": _summarise_candidate(c[1]), "match_detail": c[0]}
                    for c in candidates
                ]
                continue
            best = max(candidates, key=lambda x: x[0]["confidence"])
            matches.append(best[0])
            matched_stmt_ids3.add(best[1]["id"])
        else:
            still_ledger.append(l)

    unmatched_statement = [s for s in unmatched_statement if s["id"] not in matched_stmt_ids3]
    unmatched_ledger    = still_ledger

    # ── Build exception list ─────────────────────────────────
    exceptions: List[dict] = []

    for l in unmatched_ledger:
        # Find closest statement candidate (for the "nearest miss" column in UI)
        best_candidate = _find_closest_candidate(l, statement)
        candidate_match_detail = None
        if best_candidate:
            a_delta = _amount_delta(l["amount"], best_candidate["amount"])
            d_delta = _date_delta(l["date"], best_candidate["date"])
            sim = _vendor_similarity(l["vendor"], best_candidate["vendor"])
            candidate_match_detail = {
                "delta_amount": round(a_delta, 2),
                "delta_days": d_delta,
                "vendor_similarity": round(sim, 4),
            }

        if l.get("_ambiguous_fuzzy_candidates"):
            reason = f"multiple_ambiguous_candidates ({len(l['_ambiguous_fuzzy_candidates'])})"
        elif best_candidate:
            a_delta = _amount_delta(l["amount"], best_candidate["amount"])
            d_delta = _date_delta(l["date"], best_candidate["date"])
            if a_delta > AMOUNT_TOLERANCE_INR and d_delta > DATE_TOLERANCE_DAYS:
                reason = f"amount_delta_INR_{round(a_delta,2)}_and_date_delta_{d_delta}d_both_beyond_tolerance"
            elif a_delta > AMOUNT_TOLERANCE_INR:
                reason = f"amount_delta_INR_{round(a_delta,2)}_beyond_tolerance"
            elif d_delta > DATE_TOLERANCE_DAYS:
                reason = f"date_delta_{d_delta}d_beyond_tolerance"
            else:
                reason = "no_candidate_within_tolerance"
        else:
            reason = "no_candidate_within_tolerance"

        exceptions.append({
            "type": "ledger_unmatched",
            "ledger": {
                "id": l["id"],
                "vendor": l["vendor"],
                "amount": l["amount"],
                "date": l["date"],
            },
            "closest_statement_candidate": _summarise_candidate(best_candidate),
            "candidate_match_detail": candidate_match_detail,
            "ambiguous_candidates": l.get("_ambiguous_candidates", []),
            "reason": reason,
        })

    for s in unmatched_statement:
        exceptions.append({
            "type": "statement_orphan",
            "ledger": None,
            "closest_statement_candidate": {
                "id": s["id"],
                "vendor": s["vendor"],
                "amount": s["amount"],
                "date": s["date"],
            },
            "candidate_match_detail": None,
            "ambiguous_candidates": [],
            "reason": "orphaned_statement_record",
        })

    # ── Tier breakdown ───────────────────────────────────────
    tier_counts = {
        "exact":             sum(1 for m in matches if m["tier"] == "exact"),
        "tolerant_amount":   sum(1 for m in matches if m["tier"] == "tolerant_amount"),
        "tolerant_date":     sum(1 for m in matches if m["tier"] == "tolerant_date"),
        "fuzzy":             sum(1 for m in matches if m["tier"] == "fuzzy"),
    }

    total_ledger     = len(ledger)
    total_statement  = len(statement)
    matched_count    = len(matches)
    match_rate       = round(matched_count / total_ledger * 100, 1) if total_ledger else 0.0

    result = {
        "total_ledger_records":    total_ledger,
        "total_statement_records": total_statement,
        "matched_count":           matched_count,
        "match_rate":              match_rate,
        "tier_breakdown":          tier_counts,
        "unresolved_count":        len(exceptions),
        "exceptions":              exceptions,
        "matches":                 matches,          # full detail available for deep-dive
        "thresholds": {
            "amount_tolerance_inr": AMOUNT_TOLERANCE_INR,
            "date_tolerance_days":  DATE_TOLERANCE_DAYS,
            "fuzzy_vendor_threshold": FUZZY_THRESHOLD,
        },
    }

    _log_audit_trail(result)
    return result


def _find_closest_candidate(l: dict, statement: List[dict]) -> Optional[dict]:
    """Find the statement record with highest combined closeness score to ledger record."""
    best = None
    best_score = -1.0
    for s in statement:
        sim     = _vendor_similarity(l["vendor"], s["vendor"])
        a_delta = _amount_delta(l["amount"], s["amount"])
        d_delta = _date_delta(l["date"], s["date"])
        # Normalised closeness (higher = closer)
        score = sim - (a_delta / 100000) - (d_delta / 365)
        if score > best_score:
            best_score = score
            best = s
    return best


def _summarise_candidate(s: Optional[dict]) -> Optional[dict]:
    if not s:
        return None
    return {
        "id":     s["id"],
        "vendor": s["vendor"],
        "amount": s["amount"],
        "date":   s["date"],
    }


def _log_audit_trail(result: dict):
    """Write a summary row to audit_log. Best-effort — never raises."""
    try:
        from models import AuditLog, db
        from datetime import datetime
        import json as _json
        row = AuditLog(
            user_id=None,
            action_type="reconciliation_run",
            input_summary=(
                f"Ledger: {result['total_ledger_records']} records, "
                f"Statement: {result['total_statement_records']} records"
            ),
            output_summary=(
                f"Matched {result['matched_count']}/{result['total_ledger_records']} "
                f"({result['match_rate']}%) — "
                f"Exact:{result['tier_breakdown']['exact']} "
                f"Tolerant:{result['tier_breakdown']['tolerant_amount']+result['tier_breakdown']['tolerant_date']} "
                f"Fuzzy:{result['tier_breakdown']['fuzzy']} "
                f"Exceptions:{result['unresolved_count']}"
            ),
            data_sources_used=_json.dumps(["ledger.json", "statement.json"]),
        )
        db.session.add(row)
        db.session.commit()
    except Exception as exc:
        logger.warning(f"reconciliation audit log failed (non-fatal): {exc}")


# ─────────────────────────────────────────────────────────────
# Fixture loader
# ─────────────────────────────────────────────────────────────

def load_fixtures() -> Tuple[List[dict], List[dict]]:
    """Load the pre-generated JSON fixtures. Raises FileNotFoundError if missing."""
    import os
    base = os.path.join(os.path.dirname(__file__), "..", "data", "reconciliation_fixtures")
    ledger_path    = os.path.join(base, "ledger.json")
    statement_path = os.path.join(base, "statement.json")

    if not os.path.exists(ledger_path) or not os.path.exists(statement_path):
        raise FileNotFoundError(
            "Reconciliation fixtures not found. "
            "Run: python backend/scripts/generate_reconciliation_data.py"
        )

    with open(ledger_path,    encoding="utf-8") as f:
        ledger = json.load(f)
    with open(statement_path, encoding="utf-8") as f:
        statement = json.load(f)

    return ledger, statement
