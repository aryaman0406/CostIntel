"""
CostIntel — Edge Cases & Stress Tests
Covers random inputs, non-csv file uploads, malformed data, and chatbot random questions.
"""
import io
import pytest
from app import create_app
from extensions import db
from models import User, Expense


@pytest.fixture
def client():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        # Seed test user
        user = User(email="stress_test@costintel.com", full_name="Stress Tester", role="Admin")
        user.set_password("Admin@123")
        db.session.add(user)
        db.session.commit()

        with app.test_client() as client:
            # Login to get JWT
            res = client.post("/api/auth/login", json={"email": "stress_test@costintel.com", "password": "Admin@123"})
            token = res.get_json()["data"]["access_token"]
            client.environ_base["HTTP_AUTHORIZATION"] = f"Bearer {token}"
            yield client
        db.session.remove()
        db.drop_all()


def test_upload_binary_file_rejected(client):
    """Uploading a binary file (e.g. fake PNG/PDF) should return a clean 400 error, not 500."""
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01")
    res = client.post("/api/upload-csv", data={"file": (fake_png, "photo.png")}, content_type="multipart/form-data")
    assert res.status_code == 400
    assert "Unsupported" in res.get_json()["message"]


def test_upload_empty_csv_rejected(client):
    """Uploading a 0-byte file should return a clean 400 error."""
    empty_file = io.BytesIO(b"")
    res = client.post("/api/upload-csv", data={"file": (empty_file, "empty.csv")}, content_type="multipart/form-data")
    assert res.status_code == 400
    assert "empty" in res.get_json()["message"].lower()


def test_upload_blank_lines_csv_rejected(client):
    """Uploading CSV with only whitespace/empty lines should return 400."""
    bad_csv = io.BytesIO(b"\n\n\n   \n")
    res = client.post("/api/upload-csv", data={"file": (bad_csv, "bad.csv")}, content_type="multipart/form-data")
    assert res.status_code == 400


def test_upload_valid_csv_with_dirty_formatting(client):
    """CSV with currency symbols, commas, and varied headers should import cleanly."""
    csv_content = io.BytesIO(
        b"Date,Vendor,Category,Amount\n"
        b"2026-05-01,AWS Cloud,Cloud,\xe2\x82\xb912,450.50\n"
        b"2026-05-02,Slack Tech,SaaS,$450.00\n"
    )
    res = client.post("/api/upload-csv", data={"file": (csv_content, "expenses.csv")}, content_type="multipart/form-data")
    assert res.status_code == 200
    assert "Successfully imported 2 expenses" in res.get_json()["message"]


def test_upload_unlabeled_headerless_csv(client):
    """Unlabeled / headerless CSV data should be auto-detected and imported seamlessly using pandas type inference."""
    unlabeled_csv = io.BytesIO(
        b"2026-08-01,Amazon Web Services,Cloud,18500.00\n"
        b"2026-08-03,GitHub Enterprise,SaaS,4200.00\n"
        b"2026-08-05,DigitalOcean,Cloud,3100.00\n"
    )
    res = client.post("/api/upload-csv", data={"file": (unlabeled_csv, "raw_data.csv")}, content_type="multipart/form-data")
    assert res.status_code == 200
    assert "Successfully imported 3 expenses" in res.get_json()["message"]
    assert "unlabeled" in res.get_json()["message"]



def test_manual_expense_validation(client):
    """Manual expense with zero/negative amount or empty vendor should be rejected with 400."""
    # Negative amount
    res = client.post("/api/add-expense", json={"amount": -500, "vendor": "AWS", "date": "2026-05-01"})
    assert res.status_code == 400
    assert "positive" in res.get_json()["message"].lower()

    # Empty vendor
    res = client.post("/api/add-expense", json={"amount": 100, "vendor": "", "date": "2026-05-01"})
    assert res.status_code == 400

    # Valid entry
    res = client.post("/api/add-expense", json={"amount": 1500, "vendor": "Google Cloud", "date": "2026-05-01", "category": "Cloud"})
    assert res.status_code == 200


def test_budget_validation(client):
    """Setting a negative budget should be rejected."""
    res = client.post("/api/budget", json={"budget": -1000})
    assert res.status_code == 400
    assert "negative" in res.get_json()["message"].lower()

    res = client.post("/api/budget", json={"budget": 75000})
    assert res.status_code == 200


def test_chatbot_math_and_random_queries(client):
    """Chatbot handles calculations, conversational additions, and random questions cleanly."""
    # Arithmetic calculation
    res = client.post("/api/chat", json={"message": "What is 15000 * 12?"})
    assert res.status_code == 200
    assert "180,000" in res.get_json()["data"]["response"]

    # Division calculation
    res = client.post("/api/chat", json={"message": "calculate 45000 / 3"})
    assert res.status_code == 200
    assert "15,000" in res.get_json()["data"]["response"]

    # Conversational expense entry
    res = client.post("/api/chat", json={"message": "Add 750 for Figma"})
    assert res.status_code == 200
    assert "Recorded" in res.get_json()["data"]["response"]

    # Empty query
    res = client.post("/api/chat", json={"message": ""})
    assert res.status_code == 200
    assert len(res.get_json()["data"]["response"]) > 0
