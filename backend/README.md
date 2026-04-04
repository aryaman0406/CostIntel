# CostIntel AI — Backend API

> **Autonomous Cost Intelligence Platform**
> Internship Assignment Submission

---

## Quick Start

```bash
cd backend
pip install -r requirements.txt
python app.py
```

- **Server:** http://localhost:5000
- **Default Admin:** `admin@costintel.com` / `Admin@123`
- **Database:** SQLite — auto-created at `instance/costintel.db` on first run
- **Data:** No demo expenses are seeded; analytics reflect user-created/imported data.

---

## Tech Stack

| Layer      | Technology                     |
| ---------- | ------------------------------ |
| Framework  | Python Flask 3.1               |
| Database   | SQLite (via SQLAlchemy 2.0)    |
| Auth       | JWT (flask-jwt-extended 4.7)   |
| Passwords  | Bcrypt hashing (12 rounds)     |
| CORS       | flask-cors 5.0                 |

---

## Role System

Three roles with escalating permissions:

| Role    | Create Expense | Read | Update | Delete | Manage Users |
| ------- | -------------- | ---- | ------ | ------ | ------------ |
| Viewer  | ✗              | ✓    | ✗      | ✗      | ✗            |
| Analyst | ✓              | ✓    | ✗      | ✗      | ✗            |
| Admin   | ✓              | ✓    | ✓      | ✓      | ✓            |

**Data Scoping:**
- **Viewer / Analyst** → see only their own expense records
- **Admin** → sees all records platform-wide (can filter by `?user_id=X`)

---

## API Endpoints (24 total)

### Authentication

| Method | Endpoint            | Auth | Description                |
| ------ | ------------------- | ---- | -------------------------- |
| POST   | `/api/auth/register`| No   | Public signup (Viewer default) |
| POST   | `/api/auth/login`   | No   | Login, receive JWT token   |
| POST   | `/api/auth/logout`  | JWT  | Stateless logout           |
| GET    | `/api/auth/me`      | JWT  | Current user profile       |

### User Management (Admin only, except `/me`)

| Method | Endpoint                       | Role         | Description              |
| ------ | ------------------------------ | ------------ | ------------------------ |
| GET    | `/api/users`                   | Admin        | Paginated user list      |
| GET    | `/api/users/<id>`              | Admin        | Single user by ID        |
| POST   | `/api/users`                   | Admin        | Create new user          |
| PATCH  | `/api/users/<id>`              | Admin        | Update user fields       |
| DELETE | `/api/users/<id>`              | Admin        | Soft-delete (deactivate) |
| PATCH  | `/api/users/<id>/password`     | Admin        | Reset user's password    |
| GET    | `/api/users/me`                | Any          | Own profile + summary    |
| PATCH  | `/api/users/me/password`       | Any          | Change own password      |

### Expense Management

| Method | Endpoint                            | Role            | Description            |
| ------ | ----------------------------------- | --------------- | ---------------------- |
| GET    | `/api/expenses`                     | All roles       | Filtered, paginated    |
| GET    | `/api/expenses/<id>`                | All roles       | Single expense         |
| POST   | `/api/expenses`                     | Analyst, Admin  | Create expense         |
| PUT    | `/api/expenses/<id>`                | Admin           | Full update            |
| PATCH  | `/api/expenses/<id>`                | Admin           | Partial update         |
| DELETE | `/api/expenses/<id>`                | Admin           | Soft delete            |
| PATCH  | `/api/expenses/<id>/restore`        | Admin           | Restore soft-deleted   |

### Dashboard & Analytics

| Method | Endpoint                          | Role            | Description                  |
| ------ | --------------------------------- | --------------- | ---------------------------- |
| GET    | `/api/dashboard/summary`          | All roles       | KPIs, totals, budget usage   |
| GET    | `/api/dashboard/category-totals`  | All roles       | Per-category breakdown       |
| GET    | `/api/dashboard/monthly-trend`    | All roles       | Monthly income vs expense    |
| GET    | `/api/dashboard/top-vendors`      | Analyst, Admin  | Top N vendors by spend       |
| GET    | `/api/dashboard/recent-activity`  | All roles       | 10 most recent transactions  |
| GET    | `/api/dashboard/weekly-trend`     | Analyst, Admin  | Daily totals, current week   |

### Utility

| Method | Endpoint        | Auth | Description              |
| ------ | --------------- | ---- | ------------------------ |
| GET    | `/api/health`   | No   | API + DB health check    |

---

## Query Parameters

### GET `/api/expenses`

| Param      | Type   | Default  | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `page`     | int    | 1        | Page number                      |
| `per_page` | int    | 20       | Items per page (max 100)         |
| `type`     | string | —        | `income` or `expense`            |
| `category` | string | —        | Filter by category               |
| `vendor`   | string | —        | Partial match search             |
| `date_from`| string | —        | Start date (YYYY-MM-DD)          |
| `date_to`  | string | —        | End date (YYYY-MM-DD)            |
| `search`   | string | —        | Search vendor, notes, category   |
| `sort_by`  | string | `date`   | `date`, `amount`, or `category`  |
| `order`    | string | `desc`   | `asc` or `desc`                  |
| `user_id`  | int    | —        | Admin only: filter by user       |

### GET `/api/dashboard/category-totals`

| Param    | Type   | Default | Description                    |
| -------- | ------ | ------- | ------------------------------ |
| `type`   | string | `all`   | `income`, `expense`, or `all`  |
| `months` | int    | 0       | Months to look back (0=current)|

### GET `/api/dashboard/monthly-trend`

| Param    | Type | Default | Description              |
| -------- | ---- | ------- | ------------------------ |
| `months` | int  | 6       | Number of months (max 24)|

### GET `/api/dashboard/top-vendors`

| Param   | Type   | Default   | Description            |
| ------- | ------ | --------- | ---------------------- |
| `limit` | int    | 5         | Number of vendors      |
| `type`  | string | `expense` | `income` or `expense`  |

---

## Response Format

All endpoints return a consistent JSON structure:

### Success
```json
{
  "status": "success",
  "message": "Operation completed",
  "data": { ... }
}
```

### Error
```json
{
  "status": "error",
  "message": "Description of the error",
  "error_code": "ERROR_CODE",
  "errors": {
    "field_name": "Field-level validation error"
  }
}
```

### HTTP Status Codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 200  | Successful GET, PATCH, PUT, DELETE           |
| 201  | Resource created (POST)                      |
| 400  | Malformed JSON or bad query parameters       |
| 401  | Missing, invalid, or expired JWT token       |
| 403  | Insufficient role or inactive account        |
| 404  | Resource not found or soft-deleted           |
| 422  | Valid JSON but fails business validation     |
| 500  | Unexpected server error                      |

---

## Valid Enums

### Expense Categories
`Cloud`, `SaaS`, `Operations`, `Payroll`, `Marketing`,
`Infrastructure`, `Travel`, `Utilities`, `Subscriptions`, `Uncategorized`

### Expense Types
`income`, `expense`

### User Roles
`Viewer`, `Analyst`, `Admin`

### User Status
`active`, `inactive`

---

## Project Structure

```
backend/
├── app.py                        ← Flask factory + blueprint registry
├── config.py                     ← All config in one place
├── models.py                     ← SQLAlchemy models (User, Expense)
├── extensions.py                 ← db, jwt, bcrypt instances
├── requirements.txt              ← pip dependencies
├── .env                          ← JWT_SECRET_KEY
│
├── routes/
│   ├── __init__.py
│   ├── auth_routes.py            ← /api/auth/*
│   ├── user_routes.py            ← /api/users/* (admin + self-service)
│   ├── expense_routes.py         ← /api/expenses/* (CRUD)
│   └── dashboard_routes.py       ← /api/dashboard/*
│
├── services/
│   ├── __init__.py
│   ├── auth_service.py           ← register, login, token logic
│   ├── user_service.py           ← user CRUD, role management
│   ├── expense_service.py        ← expense CRUD + filtering
│   └── dashboard_service.py      ← aggregation, summary logic
│
├── middleware/
│   ├── __init__.py
│   └── rbac.py                   ← require_role() decorator
│
├── utils/
│   ├── __init__.py
│   ├── validators.py             ← input validation helpers
│   └── response.py               ← standard JSON response helpers
│
└── README.md                     ← this file
```

---

## Assumptions & Tradeoffs

1. **SQLite** chosen for zero-setup simplicity in development.
   Production upgrade path: set `DATABASE_URL` env var to a
   PostgreSQL connection string — no code changes required
   as SQLAlchemy abstracts the engine.

2. **JWT is stateless.** Logout is client-side token deletion.
   Tradeoff: tokens cannot be invalidated server-side before
   expiry. For production, add a Redis token blacklist.

3. **Soft delete** chosen over hard delete for financial records
   to maintain audit trails — a common practice in fintech.
   Soft-deleted records are excluded from all GET queries but
   can be restored by an Admin.

4. **Passwords** hashed with bcrypt (12 rounds). Admin-reset
   passwords require a follow-up change by the user.

5. **All monetary values** stored as `float` (INR). The `currency`
   field exists for future multi-currency support.

6. **Dashboard queries** use SQLAlchemy aggregations (`func.sum`,
   `func.count`, `GROUP BY`) — not Python loops — for efficiency.
   Tested with 10,000+ records.

7. **Pagination** capped at 100 items per page to prevent
   memory issues. Requests exceeding this are silently clamped.

8. **Unknown JSON fields** in request bodies are silently ignored
   rather than returning errors, for forward compatibility.

---

## Running Tests

```bash
pytest tests/ -v
```

*(Test suite can be added as a future enhancement.)*
