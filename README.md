# CostIntel

An enterprise cost governance and FinOps platform that continuously monitors operational data, identifies cost leakage and inefficiency patterns, and provides actionable recommendations with quantifiable financial impact.

## Assignment Fulfillment Checklist

✅ **User and Role Management:** Supports Role-Based Access Control (Viewer, Analyst, Admin).
✅ **Financial Records Management:** Complete CRUD functionality for expenses with validation.
✅ **Dashboard Summary APIs:** Dedicated REST APIs for aggregating data (category totals, trends, recent activity).
✅ **Access Control Logic:** JWT Middleware with granular role enforcement for all endpoints.
✅ **Validation and Error Handling:** Robust input validation and standardized HTTP response codes.
✅ **Data Persistence:** SQLAlchemy over SQLite / PostgreSQL (fully relational).

## API Documentation

### 1. Authentication & Users
- `POST /api/auth/register` — Public signup (new users are created as Viewer by default).
- `POST /api/auth/login` — Returns a Bearer token.
- `GET /api/users/me` — Retrieve the authenticated user's profile and lifetime stats.
- `GET /api/users` — Admin only: Fetch a paginated list of all users.
- `PATCH /api/users/<id>` — Admin only: Modify roles/status.

### 2. Financial Management
- `GET /api/expenses/` — Fetch paginated, sortable, and filterable expenses (query by date, vendor, category).
- `POST /api/expenses/` — Create a new financial record. Validates `amount`, `category`, and `date`.
- `PATCH /api/expenses/<id>` — Partial updates for a given record.
- `DELETE /api/expenses/<id>` — Admin only: soft deletes a record.
- `POST /api/budget` — Update the monthly budget tracking limit.

### 3. Dashboard Aggregation APIs
- `GET /api/dashboard/summary` — Returns overarching KPIs: monthly mapped budget, total income vs expenses.
- `GET /api/dashboard/category-totals` — Retrieves normalized cost breakdowns by SaaS, Cloud, etc.
- `GET /api/dashboard/monthly-trend` — Formats rolling 6 to 12 month expenditure data.
- `GET /api/dashboard/recent-activity` — Yields a slice of the 10 most recent transactions.
- `GET /api/dashboard/top-vendors` — Groups and orders top vendor expenditures for the quarter.
- `GET /api/dashboard/weekly-trend` — Day-by-day week trend visualization data.

### 4. Autonomous Monitoring & Decision Workflows
- `POST /api/monitoring/run` — Triggers the autonomous monitoring cycle to scan for leaks and inefficiencies.
- `GET /api/monitoring/status` — Retrieves the latest executive summary and potential savings.
- `GET /api/monitoring/recommendations` — Retrieves prioritized corrective recommendations.
- `POST /api/simulate` — Simulates optimization strategies (Conservative, Balanced, Aggressive) with risk & ROI metrics.
- `POST /api/chat` — Interactive CFO Assistant endpoint for natural data queries, web finance lookups, and fast conversational expense entry.
- `GET /api/report/generate` — Exports a clean PDF financial report with transaction line items.

## Validation & Architecture Details

1. **Validation Middleware:** All routes run input checks returning `422 Unprocessable Entity` with exact field errors for missing/invalid payloads.
2. **Access Control:** Implemented via `@require_role("Admin", "Analyst", "Viewer")` decorators. Any invalid role automatically returns `403 Forbidden`.
3. **Soft Deletes:** Enforced via ORM schema (`is_deleted`) ensuring safe financial record tracking and compliance.

## Setup Instructions

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
*Note: The application automatically creates an SQLite DB and a default admin account on startup. Dashboard and monitoring analytics reflect user-entered or imported dataset records.*

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Fresh Database Reset
```bash
cd backend
python reset_db.py
```
This clears all existing users/expenses and recreates only the default admin account.

### Credentials
**System Admin Profile** (Pre-Seeded)
Email: `admin@costintel.com`
Password: `Admin@123`
