"""
CostIntel — Standard JSON Response Helpers
Ensures every API response follows a consistent format:
  { "status": "success"|"error", "message": ..., "data": ... }
"""

from flask import jsonify


def success_response(data=None, message="Success", code=200):
    """
    Return a standardised success JSON response.

    Args:
        data:    Payload to include under the "data" key (optional).
        message: Human-readable message (default "Success").
        code:    HTTP status code (default 200).
    """
    response = {"status": "success", "message": message}
    if data is not None:
        response["data"] = data
    return jsonify(response), code


def error_response(message, code=400, error_code=None, errors=None):
    """
    Return a standardised error JSON response.

    Args:
        message:    Human-readable error description.
        code:       HTTP status code (default 400).
        error_code: Machine-readable error identifier (optional).
        errors:     Field-level validation errors dict (optional).
    """
    response = {"status": "error", "message": message}
    if error_code:
        response["error_code"] = error_code
    if errors:
        response["errors"] = errors
    return jsonify(response), code


def paginate_query(query, page, per_page):
    """
    Apply pagination to a SQLAlchemy query and return items + metadata.

    Args:
        query:    A SQLAlchemy BaseQuery object.
        page:     Current page number (1-indexed).
        per_page: Number of items per page (clamped to max 100).

    Returns:
        (items, pagination_meta) tuple.
    """
    per_page = min(per_page, 100)
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    pagination_meta = {
        "total": paginated.total,
        "page": paginated.page,
        "per_page": paginated.per_page,
        "pages": paginated.pages,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }
    return paginated.items, pagination_meta
