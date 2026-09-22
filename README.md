# CostIntel — Autonomous FinOps & Cost Governance Platform

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/react-19-cyan.svg)](https://react.dev/)
[![Flask 3.1](https://img.shields.io/badge/flask-3.1-black.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**CostIntel** is an enterprise FinOps and autonomous cost intelligence platform designed to eliminate financial blindspots. It combines multi-tier ledger-to-bank reconciliation, statistical anomaly detection, scenario simulation, and a tool-calling Gemini CFO reasoning agent — backed by role-based access control and an immutable database audit trail.

---

## Key Features

- **3-Tier Reconciliation Engine**
  - **Exact Match:** 1:1 matching across amount, date, and vendor name.
  - **Tolerant Match:** Configurable threshold matching (amount flex & settlement day lags).
  - **Fuzzy AI Match:** Sequence matching for automatic vendor alias resolution (e.g. *AWS* ↔ *Amazon Web Services*).
  - **Exception Queue & PDF Export:** Tagged discrepancy triage with root causes and one-click audit-ready PDF reporting.

- **Statistical Anomaly Detection**
  - Multi-method detection combining **Z-Score** and **IQR (Interquartile Range)** baselines.
  - Dynamic category scoring with plain-language mathematical rationale and confidence scoring.

- **Autonomous Gemini 2.5 CFO Agent**
  - Multi-turn autonomous assistant with tool/function calling (`get_expense_summary`, `get_category_totals`, `run_simulation`, `get_top_vendors`).
  - Automated fallback to rule-based engine with complete audit logging.

- **Continuous Monitoring & Drift Tracking**
  - Periodic spend snapshots, longitudinal drift trends, and automated leak detection alerts.

- **Predictive Simulator & Financial Impact Calculator**
  - What-if scenario modeling for headcounts, vendor renegotiations, and cloud spend cutbacks.

- **Enterprise Security & Audit Trail**
  - Role-Based Access Control (**Admin**, **Analyst**, **Viewer**) with scoped data visibility and JWT authentication.
  - Immutable audit logs capturing every administrative, analytical, and AI agent execution.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Vanilla CSS, Recharts, Lucide Icons, GSAP, Lenis |
| **Backend** | Python 3.11, Flask 3.1, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Bcrypt |
| **AI & Automation** | Google GenAI SDK (`gemini-2.5-flash`), `difflib`, `ReportLab` |
| **Database** | SQLite (development) / PostgreSQL (production via SQLAlchemy 2.0) |

---

## Project Structure

```
Autonomous_Cost_Platform/
├── backend/
│   ├── agents/          # Autonomous AI agents & tool definitions
│   ├── routes/          # REST API endpoints (auth, expenses, reconciliation, anomalies, chat)
│   ├── services/        # Reconciliation logic, anomaly detection, monitoring services
│   ├── models.py        # SQLAlchemy database schemas & audit models
│   ├── config.py        # Centralized app configuration & connection pooling
│   ├── app.py           # Application factory and bootstrap
│   └── requirements.txt # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/  # Core UI components and tabs (Dashboard, Recon, Anomaly, CFO Chat, Simulator)
│   │   ├── landing/     # Modern landing page & marketing sections
│   │   ├── App.jsx      # Main application router and state
│   │   └── index.css    # Unified design system & responsive styling
│   └── package.json     # Node dependencies & Vite scripts
└── render.yaml          # Cloud deployment configuration
```

---

## Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
# Windows:
python -m venv venv
.\venv\Scripts\activate
# Linux/macOS:
# python3 -m venv venv && source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python app.py
```
Backend API will be available at `http://localhost:5000`. Demo database seeds automatically on first run.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend will be running at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `JWT_SECRET_KEY` | Secret key for signing JWT tokens | `dev-secret-change-me` |
| `GEMINI_API_KEY` | Google Gemini API key for CFO agent | Optional (falls back to rule engine) |
| `DATABASE_URL` | SQLite or PostgreSQL connection string | `sqlite:///instance/costintel.db` |
| `GOOGLE_CLIENT_ID`| Google OAuth Client ID | Optional |

### Frontend (`frontend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE` | Base URL for backend REST API | `http://localhost:5000/api` |
| `VITE_GOOGLE_CLIENT_ID` | Client ID for Google Login button | Optional |

---

## Demo Accounts

Pre-seeded credentials available out of the box:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@costintel.com` | `Admin@123` | Full system access, user management, audit logs |
| **Analyst** | `analyst@costintel.com` | `Analyst@123` | Upload/manage expenses, trigger reconciliation & anomaly scans |
| **Viewer** | `viewer@costintel.com` | `Viewer@123` | Read-only access to dashboard, reports & CFO assistant |

---

## Core API Endpoints

- **Auth:** `POST /api/register`, `POST /api/login`, `POST /api/auth/google`, `GET /api/profile`
- **Reconciliation:** `POST /api/reconciliation/run`, `GET /api/reconciliation/batches`, `GET /api/reconciliation/export/pdf`
- **Anomalies:** `GET /api/anomalies`, `POST /api/anomalies/score`, `POST /api/anomalies/<id>/resolve`
- **CFO Intelligence:** `POST /api/chat`, `POST /api/simulate`, `GET /api/monitoring/status`, `POST /api/monitoring/run`
- **Expenses & Data:** `GET /api/expenses`, `POST /api/expenses`, `POST /api/expenses/upload`, `GET /api/dashboard`
- **Governance:** `GET /api/audit/logs`, `GET /api/users`

---

## Running Tests

```bash
# Run pytest backend suite
pytest backend/tests/ -v
```

---

## License

This project is licensed under the [MIT License](LICENSE).
