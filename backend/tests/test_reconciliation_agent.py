"""
CostIntel — Reconciliation Agent Test Suite

Tests the 3-tier multi-source reconciliation engine:
  - 65-record fixture verification (Exact, Tolerant, Fuzzy, Exception distribution)
  - Dual tolerance failure reason string generation (both amount and date cited)
  - Ambiguous duplicate candidate handling (flagged as exception, not silently resolved)
"""

import pytest
from agents.reconciliation_agent import load_fixtures, run_reconciliation


def test_reconciliation_fixture_breakdown(app):
    """
    Assert that the standard 65-record synthetic stress test produces the expected
    tier distribution matching the failure-mode engineering design:
      - Exact matches: ~45-46
      - Tolerant matches: ~14 (7 amount delta, 7 date lag)
      - Fuzzy vendor matches: ~2-3
      - Exceptions: ~4-6 (ledger-only, statement-only, ambiguous duplicates)
    """
    with app.app_context():
        ledger, statement = load_fixtures()
        assert len(ledger) == 65, "Expected 65 ledger records in fixture"
        assert len(statement) == 65, "Expected 65 statement records in fixture"

        result = run_reconciliation(ledger, statement)

        # High-level metrics
        assert result["total_ledger_records"] == 65
        assert result["total_statement_records"] == 65
        assert result["matched_count"] == 62
        assert result["match_rate"] >= 95.0

        # Tier breakdown assertions
        breakdown = result["tier_breakdown"]
        assert breakdown["exact"] == 46, f"Expected 46 exact matches, got {breakdown['exact']}"
        assert breakdown["tolerant_amount"] == 7, f"Expected 7 tolerant amount matches, got {breakdown['tolerant_amount']}"
        assert breakdown["tolerant_date"] == 7, f"Expected 7 tolerant date matches, got {breakdown['tolerant_date']}"
        assert breakdown["tolerant_amount"] + breakdown["tolerant_date"] == 14, "Expected 14 total tolerant matches"
        assert breakdown["fuzzy"] == 2, f"Expected 2 fuzzy matches, got {breakdown['fuzzy']}"

        # Exceptions
        assert result["unresolved_count"] == 6, f"Expected 6 exceptions, got {result['unresolved_count']}"
        assert len(result["exceptions"]) == 6


def test_dual_tolerance_violation_reason(app):
    """
    Assert that a candidate with BOTH amount delta (> ±INR 5) AND date delta (> 3 days)
    produces a machine-readable reason string explicitly naming both dimensions.
    """
    with app.app_context():
        ledger_record = {
            "id": "LDG-TEST-01",
            "vendor": "Amazon Web Services",
            "amount": 25000.00,
            "date": "2026-07-01",
            "category": "Cloud",
            "currency": "INR",
        }
        # Statement has both a ₹500 discrepancy and a 15-day settlement delta
        statement_record = {
            "id": "STMT-TEST-01",
            "vendor": "Amazon Web Services",
            "amount": 25500.00,
            "date": "2026-07-16",
        }

        result = run_reconciliation([ledger_record], [statement_record])

        assert result["matched_count"] == 0
        assert len(result["exceptions"]) >= 1

        ledger_exception = next(
            (e for e in result["exceptions"] if e["type"] == "ledger_unmatched"), None
        )
        assert ledger_exception is not None, "Ledger record must be flagged as unmatched exception"

        reason = ledger_exception["reason"]
        # Must name both amount and date
        assert "amount_delta_INR" in reason, f"Reason should cite amount delta: {reason}"
        assert "date_delta" in reason, f"Reason should cite date delta: {reason}"
        assert "both_beyond_tolerance" in reason, f"Reason should cite both beyond tolerance: {reason}"


def test_ambiguous_fuzzy_candidate_not_silently_resolved(app):
    """
    Assert that when a ledger record matches multiple statement candidates with
    identical fuzzy confidence, it is flagged as ambiguous and held as an exception
    rather than silently auto-resolved with false certainty.
    """
    with app.app_context():
        ledger_record = {
            "id": "LDG-AMB-01",
            "vendor": "Google Cloud Platform",
            "amount": 12000.00,
            "date": "2026-07-10",
            "category": "Cloud",
            "currency": "INR",
        }
        # Two distinct statement records with identical fuzzy match properties
        stmt_1 = {
            "id": "STMT-AMB-01",
            "vendor": "Google Cloud Plt Ltd",
            "amount": 12002.00,
            "date": "2026-07-11",
        }
        stmt_2 = {
            "id": "STMT-AMB-02",
            "vendor": "Google Cloud Plt Ltd",
            "amount": 12002.00,
            "date": "2026-07-11",
        }

        result = run_reconciliation([ledger_record], [stmt_1, stmt_2])

        # Assert not silently resolved
        assert result["matched_count"] == 0, "Ambiguous records must not be auto-matched"
        assert result["unresolved_count"] > 0

        ledger_exception = next(
            (e for e in result["exceptions"] if e["type"] == "ledger_unmatched"), None
        )
        assert ledger_exception is not None
        assert "multiple_ambiguous_candidates" in ledger_exception["reason"]


def test_tolerant_amount_and_date_isolated_matching(app):
    """
    Assert single-dimension tolerant matching:
      - Exact date + amount within INR 5 -> tolerant_amount
      - Exact amount + date within 3 days -> tolerant_date
    """
    with app.app_context():
        l_amt = {"id": "L-1", "vendor": "Datadog", "amount": 1000.0, "date": "2026-07-01"}
        s_amt = {"id": "S-1", "vendor": "Datadog", "amount": 1003.5, "date": "2026-07-01"}

        res_amt = run_reconciliation([l_amt], [s_amt])
        assert res_amt["matched_count"] == 1
        assert res_amt["matches"][0]["tier"] == "tolerant_amount"
        assert res_amt["matches"][0]["delta_amount"] == 3.5

        l_date = {"id": "L-2", "vendor": "Slack", "amount": 500.0, "date": "2026-07-05"}
        s_date = {"id": "S-2", "vendor": "Slack", "amount": 500.0, "date": "2026-07-07"}

        res_date = run_reconciliation([l_date], [s_date])
        assert res_date["matched_count"] == 1
        assert res_date["matches"][0]["tier"] == "tolerant_date"
        assert res_date["matches"][0]["delta_days"] == 2
