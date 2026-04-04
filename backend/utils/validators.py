"""
CostIntel AI — Input Validation Helpers
Validate request payloads for expenses and user creation.
"""

import re
from datetime import datetime
from models import VALID_CATEGORIES, VALID_TYPES, VALID_ROLES


def validate_expense(data, partial=False):
    """
    Validate expense creation/update payload.

    Args:
        data:    Request JSON dict.
        partial: If True, only validate fields that are present (for PATCH).

    Returns:
        (is_valid: bool, errors: dict)
    """
    errors = {}

    # Amount
    if not partial or "amount" in data:
        amount = data.get("amount")
        if amount is None:
            errors["amount"] = "Amount is required"
        else:
            try:
                amount = float(amount)
                if amount <= 0:
                    errors["amount"] = "Amount must be greater than zero"
                elif amount > 999999999:
                    errors["amount"] = "Amount exceeds maximum allowed value"
            except (ValueError, TypeError):
                errors["amount"] = "Amount must be a valid number"

    # Type
    if not partial or "type" in data:
        type_ = data.get("type")
        if not type_:
            errors["type"] = "Type is required"
        elif type_ not in VALID_TYPES:
            errors["type"] = "Type must be 'income' or 'expense'"

    # Vendor
    if not partial or "vendor" in data:
        vendor = data.get("vendor", "")
        if isinstance(vendor, str):
            vendor = vendor.strip()
        if not vendor:
            errors["vendor"] = "Vendor is required"
        elif len(str(vendor)) > 100:
            errors["vendor"] = "Vendor name must be under 100 characters"

    # Date
    if not partial or "date" in data:
        date_str = data.get("date", "")
        if not date_str:
            errors["date"] = "Date is required"
        else:
            try:
                datetime.strptime(str(date_str).strip(), "%Y-%m-%d")
            except ValueError:
                errors["date"] = "Date must be in YYYY-MM-DD format"

    # Category (optional but must be valid if provided)
    if "category" in data and data["category"]:
        if data["category"] not in VALID_CATEGORIES:
            errors["category"] = (
                f"Category must be one of: {', '.join(VALID_CATEGORIES)}"
            )

    # Notes (optional but length limited)
    if "notes" in data and data["notes"]:
        if len(str(data["notes"])) > 500:
            errors["notes"] = "Notes must be under 500 characters"

    return len(errors) == 0, errors


def validate_user_create(data):
    """
    Validate user creation payload.

    Returns:
        (is_valid: bool, errors: dict)
    """
    errors = {}

    # Email
    email = data.get("email", "")
    if isinstance(email, str):
        email = email.strip()
    if not email:
        errors["email"] = "Email is required"
    elif not re.match(r"^[^@]+@[^@]+\.[^@]+$", str(email)):
        errors["email"] = "Invalid email format"

    # Password
    password = data.get("password", "")
    if not password:
        errors["password"] = "Password is required"
    elif len(password) < 8:
        errors["password"] = "Password must be at least 8 characters"
    elif not re.search(r"[A-Z]", password):
        errors["password"] = "Password must contain at least one uppercase letter"
    elif not re.search(r"\d", password):
        errors["password"] = "Password must contain at least one digit"

    # Full name
    full_name = data.get("full_name", "")
    if isinstance(full_name, str):
        full_name = full_name.strip()
    if not full_name:
        errors["full_name"] = "Full name is required"
    elif len(str(full_name)) > 100:
        errors["full_name"] = "Full name must be under 100 characters"

    # Role (optional, but must be valid if provided)
    role = data.get("role", "")
    if role and role not in VALID_ROLES:
        errors["role"] = f"Role must be one of: {', '.join(VALID_ROLES)}"

    return len(errors) == 0, errors


def validate_password(password):
    """
    Validate a new password against strength rules.

    Returns:
        (is_valid: bool, error_message: str or None)
    """
    if not password:
        return False, "Password is required"
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    return True, None
