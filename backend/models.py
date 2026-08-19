"""
CostIntel — Database Models
User and Expense models with full schema, relationships, and indexes.
"""

from datetime import datetime
from extensions import db, bcrypt

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
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
