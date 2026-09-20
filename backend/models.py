"""
CostIntel — Database Models
User and Expense models with full schema, relationships, and indexes.
"""

from datetime import datetime, timezone
from extensions import db, bcrypt
from sqlalchemy import Text

def _utc_now():
    return datetime.now(timezone.utc)

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────

VALID_ROLES = ["Viewer", "Analyst", "Admin"]
VALID_STATUS = ["active", "inactive"]
VALID_TYPES = ["income", "expense"]
VALID_CATEGORIES = [
    "Cloud",
    "SaaS",
    "Operations",
    "Payroll",
    "Marketing",
    "Infrastructure",
    "Travel",
    "Utilities",
    "Subscriptions",
    "Manual",
    "Conversational",
    "Uncategorized",
]


# ──────────────────────────────────────────────────────────────
# User Model
# ──────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="Viewer")
    status = db.Column(db.String(20), nullable=False, default="active")
    monthly_budget = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=_utc_now)
    updated_at = db.Column(
        db.DateTime, default=_utc_now, onupdate=_utc_now
    )

    # Relationship
    expenses = db.relationship(
        "Expense", backref="owner", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, password):
        """Hash and store a plaintext password."""
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        """Verify a plaintext password against the stored hash."""
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serialize user to a dict (excludes password_hash)."""
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "status": self.status,
            "monthly_budget": self.monthly_budget,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<User {self.email}>"


# ──────────────────────────────────────────────────────────────
# Expense Model
# ──────────────────────────────────────────────────────────────

class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(10), nullable=False)  # 'income' | 'expense'
    category = db.Column(db.String(50), nullable=False, default="Uncategorized")
    vendor = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    currency = db.Column(db.String(10), nullable=False, default="INR")
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_utc_now)
    updated_at = db.Column(
        db.DateTime, default=_utc_now, onupdate=_utc_now
    )

    # Composite indexes for query performance
    __table_args__ = (
        db.Index("ix_expenses_date_v2", "date"),
        db.Index("ix_expenses_category_v2", "category"),
        db.Index("ix_expenses_type_v2", "type"),
        db.Index("ix_expenses_is_deleted_v2", "is_deleted"),
        db.Index("ix_expenses_user_date_v2", "user_id", "date"),
    )

    def to_dict(self):
        """Serialize expense to a dict."""
        result = {
            "id": self.id,
            "user_id": self.user_id,
            "amount": self.amount,
            "type": self.type,
            "category": self.category,
            "vendor": self.vendor,
            "date": self.date.strftime("%Y-%m-%d") if self.date else None,
            "notes": self.notes,
            "currency": self.currency,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.is_deleted and self.deleted_at:
            result["deleted_at"] = self.deleted_at.isoformat()
        return result

    def __repr__(self):
        return f"<Expense {self.id} {self.vendor} {self.amount}>"


# ──────────────────────────────────────────────────────────────
# MonitoringRun Model
# ──────────────────────────────────────────────────────────────

class MonitoringRun(db.Model):
    """Persists each monitoring cycle result for history / before-after comparison."""
    __tablename__ = "monitoring_runs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=_utc_now, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    records_scanned = db.Column(db.Integer, nullable=False, default=0)
    issues_found = db.Column(db.Integer, nullable=False, default=0)
    total_estimated_savings = db.Column(db.Float, nullable=False, default=0.0)
    raw_result = db.Column(Text, nullable=True)  # JSON blob of full cycle result

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_id": self.user_id,
            "records_scanned": self.records_scanned,
            "issues_found": self.issues_found,
            "total_estimated_savings": self.total_estimated_savings,
        }

    def __repr__(self):
        return f"<MonitoringRun {self.id} issues={self.issues_found}>"


# ──────────────────────────────────────────────────────────────
# AuditLog Model
# ──────────────────────────────────────────────────────────────

class AuditLog(db.Model):
    """Every AI-suggested action: chat, monitoring recommendation, simulation."""
    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=_utc_now, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    action_type = db.Column(db.String(50), nullable=False)  # 'chat' | 'monitoring' | 'simulation' | 'anomaly'
    input_summary = db.Column(Text, nullable=True)   # User message / trigger
    output_summary = db.Column(Text, nullable=True)  # AI response / result summary
    data_sources_used = db.Column(Text, nullable=True)  # JSON list of tool names called
    session_id = db.Column(db.String(64), nullable=True)  # Optional correlation ID

    def to_dict(self):
        import json
        sources = []
        try:
            sources = json.loads(self.data_sources_used) if self.data_sources_used else []
        except Exception:
            sources = []
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_id": self.user_id,
            "action_type": self.action_type,
            "input_summary": self.input_summary,
            "output_summary": self.output_summary,
            "data_sources_used": sources,
        }

    def __repr__(self):
        return f"<AuditLog {self.id} {self.action_type}>"


# ──────────────────────────────────────────────────────────────
# AnomalyScore Model
# ──────────────────────────────────────────────────────────────

class AnomalyScore(db.Model):
    """Z-score/IQR-based outlier flags on individual expense records."""
    __tablename__ = "anomaly_scores"

    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey("expenses.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    score = db.Column(db.Float, nullable=False)           # 0–100 confidence this is anomalous
    z_score = db.Column(db.Float, nullable=True)          # Raw z-score for transparency
    method = db.Column(db.String(20), nullable=False, default="zscore")  # 'zscore' | 'iqr'
    reason = db.Column(Text, nullable=False)              # Plain-language explanation
    flagged_at = db.Column(db.DateTime, default=_utc_now)
    category = db.Column(db.String(50), nullable=True)
    vendor = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "expense_id": self.expense_id,
            "user_id": self.user_id,
            "score": self.score,
            "z_score": self.z_score,
            "method": self.method,
            "reason": self.reason,
            "flagged_at": self.flagged_at.isoformat() if self.flagged_at else None,
            "category": self.category,
            "vendor": self.vendor,
            "amount": self.amount,
        }

    def __repr__(self):
        return f"<AnomalyScore expense={self.expense_id} score={self.score:.1f}>"
