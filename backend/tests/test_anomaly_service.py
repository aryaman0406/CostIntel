"""
CostIntel — Anomaly Detection Service Test Suite

Tests statistical anomaly and cost leakage detection:
  - Synthetic outlier detection (outlier flagged with high confidence)
  - In-range baseline expenses remain unflagged
  - Persistence of AnomalyScore records in database
  - Plain-language mathematical reasoning generation
"""

import pytest
from datetime import date
from extensions import db
from models import User, Expense, AnomalyScore
from services.anomaly_service import score_expenses_for_user, get_anomalies_for_user


def test_synthetic_outlier_flagged_and_normal_expense_clean(app):
    """
    Assert that an injected synthetic outlier (e.g. 5x-10x category average)
    is flagged with high confidence (score >= 70), while standard in-range expenses
    are not flagged as high anomalies.
    """
    with app.app_context():
        # Create or fetch dedicated test user
        user = User.query.filter_by(email="anomaly_test_user@costintel.com").first()
        if not user:
            user = User(
                email="anomaly_test_user@costintel.com",
                full_name="Anomaly Tester",
                role="Analyst",
                status="active",
                monthly_budget=200000.0,
            )
            user.set_password("SecurePass123!")
            db.session.add(user)
            db.session.commit()
        else:
            Expense.query.filter_by(user_id=user.id).delete()
            AnomalyScore.query.filter_by(user_id=user.id).delete()
            db.session.commit()

        # Seed 12 baseline Cloud expenses with average ~₹5,000
        baseline_amounts = [
            4900.0, 5100.0, 5000.0, 5200.0, 4800.0, 5050.0,
            4950.0, 5000.0, 5150.0, 4850.0, 5020.0, 4980.0
        ]
        for i, amt in enumerate(baseline_amounts):
            exp = Expense(
                user_id=user.id,
                amount=amt,
                category="Cloud",
                vendor="AWS",
                date=date(2026, 7, i + 1),
                type="expense",
                notes=f"Normal cloud bill {i+1}",
                is_deleted=False,
            )
            db.session.add(exp)

        # Inject 1 massive outlier (₹50,000 — 10x baseline average)
        outlier_expense = Expense(
            user_id=user.id,
            amount=50000.0,
            category="Cloud",
            vendor="AWS",
            date=date(2026, 7, 25),
            type="expense",
            notes="Unexpected unthrottled data egress",
            is_deleted=False,
        )
        db.session.add(outlier_expense)
        db.session.commit()

        # Run anomaly scoring
        result = score_expenses_for_user(user.id)

        assert result["records_scanned"] == 13
        assert result["anomalies_found"] >= 1
        assert result["high"] >= 1

        # Verify the outlier is specifically caught
        flagged_ids = [a["expense_id"] for a in result["anomalies"]]
        assert outlier_expense.id in flagged_ids, "Outlier must be detected"

        outlier_data = next(a for a in result["anomalies"] if a["expense_id"] == outlier_expense.id)
        assert outlier_data["score"] >= 70.0, f"Outlier confidence score should be >= 70, got {outlier_data['score']}"
        assert outlier_data["z_score"] >= 2.0, f"Outlier z-score should be >= 2.0, got {outlier_data['z_score']}"
        assert "Cloud" in outlier_data["reason"]
        assert "AWS" in outlier_data["reason"]

        # Verify normal baseline expenses are not flagged as high anomalies
        for exp in Expense.query.filter_by(user_id=user.id).all():
            if exp.id != outlier_expense.id:
                match = next((a for a in result["anomalies"] if a["expense_id"] == exp.id), None)
                if match:
                    assert match["score"] < 40.0, f"Normal expense {exp.id} should not have elevated score: {match['score']}"

        # Verify DB persistence of AnomalyScore
        persisted = AnomalyScore.query.filter_by(user_id=user.id).all()
        assert len(persisted) == result["anomalies_found"]
        persisted_outlier = next(p for p in persisted if p.expense_id == outlier_expense.id)
        assert persisted_outlier.amount == 50000.0
        assert persisted_outlier.score >= 70.0

        # Verify get_anomalies_for_user service helper
        fetched = get_anomalies_for_user(user.id)
        assert len(fetched) == len(persisted)
        assert fetched[0]["expense_id"] == outlier_expense.id


def test_empty_expenses_handled_gracefully(app):
    """Assert anomaly scorer returns zeroed response without errors for user with no expenses."""
    with app.app_context():
        user = User.query.filter_by(email="empty_user@costintel.com").first()
        if not user:
            user = User(
                email="empty_user@costintel.com",
                full_name="Empty User",
                role="Viewer",
                status="active",
            )
            user.set_password("SecurePass123!")
            db.session.add(user)
            db.session.commit()
        else:
            Expense.query.filter_by(user_id=user.id).delete()
            AnomalyScore.query.filter_by(user_id=user.id).delete()
            db.session.commit()

        result = score_expenses_for_user(user.id)
        assert result["records_scanned"] == 0
        assert result["anomalies_found"] == 0
        assert result["anomalies"] == []
