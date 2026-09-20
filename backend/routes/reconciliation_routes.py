"""
CostIntel — Reconciliation Routes

POST /api/reconciliation/run       — run against fixture data; returns full result
GET  /api/reconciliation/last-run  — return cached result of most recent run

Both endpoints require JWT. No role restriction — all authenticated users may run.
"""

import json
import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from utils.response import success_response, error_response

reconciliation_bp = Blueprint("reconciliation", __name__)
logger = logging.getLogger(__name__)

# In-memory cache — stores the last result per process lifetime.
# Survives multiple requests; lost on server restart (intentional for this scope).
_last_run_cache: dict = {}


@reconciliation_bp.route("/reconciliation/run", methods=["POST"])
@jwt_required()
def run_reconciliation():
    """
    Execute the reconciliation matching engine against fixture data.
    Caches the result in-memory and returns the full payload.
    """
    global _last_run_cache

    from agents.reconciliation_agent import (
        load_fixtures,
        run_reconciliation as _run,
    )

    try:
        ledger, statement = load_fixtures()
    except Exception as e:
        logger.error(f"Failed to load reconciliation fixtures: {e}", exc_info=True)
        return error_response("Failed to load reconciliation fixtures.", 500)

    try:
        result = _run(ledger, statement)
    except Exception as e:
        logger.error(f"Reconciliation run failed: {e}", exc_info=True)
        return error_response("Reconciliation engine error.", 500)

    result["run_at"]    = datetime.now(timezone.utc).isoformat()
    result["run_by"]    = int(get_jwt_identity())

    # Retain full matches array with scoring deltas for the expandable UI
    _last_run_cache = result

    return success_response(result)


@reconciliation_bp.route("/reconciliation/last-run", methods=["GET"])
@jwt_required()
def get_last_run():
    """
    GET /api/reconciliation/last-run

    Returns the cached result of the most recent reconciliation run.
    Returns 404 if no run has been executed since server start.
    """
    if not _last_run_cache:
        return error_response(
            "No reconciliation run found. POST /api/reconciliation/run first.", 404
        )
    return success_response(_last_run_cache)
