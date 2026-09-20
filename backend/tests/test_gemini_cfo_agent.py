"""
CostIntel — Gemini CFO Agent Test Suite

Tests the Gemini CFO conversational intelligence engine:
  - Graceful fallback to ChatbotAgent when GEMINI_API_KEY is absent
  - AuditLog persistence on fallback events
  - Mocked Gemini API function calling and tool dispatching (no live API calls in CI)
  - Resilient exception recovery when external model calls fail
"""

import json
import os
import pytest
from unittest.mock import MagicMock, patch

from agents.data_ingestion_agent import DataIngestionAgent
from agents.cost_monitoring_agent import CostMonitoringAgent
from agents.gemini_cfo_agent import GeminiCFOAgent
from models import AuditLog, User, db


def test_fallback_when_api_key_absent(app, test_user):
    """
    Assert that when GEMINI_API_KEY is unset/absent:
      1. GeminiCFOAgent falls back cleanly to ChatbotAgent without raising exceptions.
      2. The fallback response returns valid text and empty tools list.
      3. A corresponding AuditLog entry is persisted for compliance tracking.
    """
    with app.app_context():
        user = User.query.filter_by(email="analyst@test.com").first()
        user_id = user.id

        # Ensure GEMINI_API_KEY is absent in env
        with patch.dict(os.environ, {}, clear=True):
            data_agent = DataIngestionAgent()
            monitoring_agent = CostMonitoringAgent(data_agent)

            agent = GeminiCFOAgent(data_agent, monitoring_agent)
            assert agent._client is None, "Client should be None when API key is missing"

            initial_log_count = AuditLog.query.filter_by(user_id=user_id).count()

            # Execute query
            response = agent.get_response("What is my budget?", user_id=user_id)

            # Assertions on response structure
            assert isinstance(response, dict)
            assert "text" in response
            assert isinstance(response["text"], str)
            assert len(response["text"]) > 0
            assert response["tools_used"] == []

            # Assert AuditLog was recorded
            new_log_count = AuditLog.query.filter_by(user_id=user_id).count()
            assert new_log_count == initial_log_count + 1

            latest_log = (
                AuditLog.query.filter_by(user_id=user_id)
                .order_by(AuditLog.id.desc())
                .first()
            )
            assert latest_log.action_type == "chat"
            assert "fallback:chatbot_agent" in latest_log.data_sources_used
            assert latest_log.input_summary == "What is my budget?"


def test_mocked_gemini_function_calling_and_audit(app, test_user):
    """
    Mock the Gemini 2.5 API with multi-turn function calling:
      Turn 1: Model requests `get_expense_summary` tool execution.
      Turn 2: Model returns synthesized answer using tool output.
    Asserts tool dispatch, return structure, and AuditLog recording.
    """
    with app.app_context():
        user = User.query.filter_by(email="analyst@test.com").first()
        user_id = user.id

        data_agent = DataIngestionAgent()
        monitoring_agent = CostMonitoringAgent(data_agent)

        with patch.dict(os.environ, {"GEMINI_API_KEY": "mock-test-key"}):
            with patch("google.genai.Client") as mock_client_cls:
                mock_client = MagicMock()
                mock_client_cls.return_value = mock_client

                # Turn 1: Model returns a function call
                part_fn = MagicMock()
                part_fn.function_call.name = "get_expense_summary"
                part_fn.function_call.args = {}
                part_fn.text = None

                candidate_turn1 = MagicMock()
                candidate_turn1.content.parts = [part_fn]

                response_turn1 = MagicMock()
                response_turn1.candidates = [candidate_turn1]

                # Turn 2: Model returns final synthesized text
                part_text = MagicMock()
                part_text.function_call = None
                part_text.text = "Your total spend is INR 45,000 across Cloud and SaaS."

                candidate_turn2 = MagicMock()
                candidate_turn2.content.parts = [part_text]

                response_turn2 = MagicMock()
                response_turn2.candidates = [candidate_turn2]

                mock_client.models.generate_content.side_effect = [
                    response_turn1,
                    response_turn2,
                ]

                agent = GeminiCFOAgent(data_agent, monitoring_agent)
                agent._client = mock_client

                res = agent.get_response("Give me a spend breakdown", user_id=user_id)

                assert res["text"] == "Your total spend is INR 45,000 across Cloud and SaaS."
                assert "get_expense_summary" in res["tools_used"]

                # Assert AuditLog captured the tool execution
                latest_log = (
                    AuditLog.query.filter_by(user_id=user_id)
                    .order_by(AuditLog.id.desc())
                    .first()
                )
                assert latest_log.action_type == "chat"
                assert "get_expense_summary" in latest_log.data_sources_used


def test_exception_in_gemini_recovers_to_fallback(app, test_user):
    """
    Assert that if the Gemini API raises a network or runtime error,
    GeminiCFOAgent gracefully falls back to ChatbotAgent without crashing.
    """
    with app.app_context():
        user = User.query.filter_by(email="analyst@test.com").first()
        user_id = user.id

        data_agent = DataIngestionAgent()
        monitoring_agent = CostMonitoringAgent(data_agent)

        with patch.dict(os.environ, {"GEMINI_API_KEY": "mock-test-key"}):
            agent = GeminiCFOAgent(data_agent, monitoring_agent)
            mock_client = MagicMock()
            mock_client.models.generate_content.side_effect = RuntimeError("API connection timeout")
            agent._client = mock_client

            response = agent.get_response("Optimize my AWS bill", user_id=user_id)

            assert isinstance(response, dict)
            assert "text" in response
            assert len(response["text"]) > 0

            latest_log = (
                AuditLog.query.filter_by(user_id=user_id)
                .order_by(AuditLog.id.desc())
                .first()
            )
            assert "fallback:chatbot_agent_error" in latest_log.data_sources_used
