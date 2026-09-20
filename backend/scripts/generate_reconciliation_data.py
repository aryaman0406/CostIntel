"""
CostIntel — Reconciliation Fixture Generator
Run once to produce reproducible JSON fixtures under backend/data/reconciliation_fixtures/.

python scripts/generate_reconciliation_data.py

Output:
  backend/data/reconciliation_fixtures/ledger.json     — 65 internal ledger records
  backend/data/reconciliation_fixtures/statement.json  — 65 bank/vendor statement records

Injected failure modes (realistic reconciliation stress-tests):
  ~70%  clean 1:1 matches  — exact amount, date, vendor
  ~10%  amount mismatches  — ±₹2-5 (rounding / payment-gateway fee)
  ~10%  date mismatches    — 1-3 day settlement lag
  ~5%   vendor name variants — "Amazon Web Services" vs "AWS" etc.
  ~5%   genuinely unmatched — ledger-only, statement-only, or ambiguous duplicate
"""

import json
import os
import random
from datetime import date, timedelta

# ── Reproducibility ──────────────────────────────────────────
random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "reconciliation_fixtures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Reference data ───────────────────────────────────────────
BASE_VENDORS = [
    ("Amazon Web Services",  "AWS"),
    ("Microsoft Azure",      "MS Azure"),
    ("Google Cloud Platform","GCP"),
    ("Zoom Video Communications", "Zoom"),
    ("Slack Technologies",   "Slack Inc"),
    ("GitHub Inc",           "Github"),
    ("Datadog Inc",          "DATADOG"),
    ("Stripe Inc",           "Stripe Payments"),
    ("Twilio Inc",           "TWILIO"),
    ("HubSpot Inc",          "Hubspot"),
    ("Notion Labs Inc",      "Notion"),
    ("Figma Inc",            "Figma Design"),
    ("Atlassian Pty Ltd",    "Atlassian"),
    ("Salesforce Inc",       "SALESFORCE"),
    ("Cloudflare Inc",       "Cloudflare"),
]

CATEGORIES = ["Cloud", "SaaS", "Operations", "Marketing", "Infrastructure"]

def rand_date(start_offset=-90, end_offset=-1):
    base = date(2026, 7, 1)
    return base + timedelta(days=random.randint(start_offset, end_offset + 90))

def rand_amount():
    return round(random.uniform(500, 85000), 2)

def make_ledger_record(rec_id, vendor_canonical, amount, txn_date, category="Cloud"):
    return {
        "id": f"LDG-{rec_id:04d}",
        "vendor": vendor_canonical,
        "amount": amount,
        "date": str(txn_date),
        "category": category,
        "currency": "INR",
        "reference": f"INV-{rec_id:06d}",
    }

def make_statement_record(rec_id, vendor_alias, amount, txn_date):
    return {
        "id": f"STMT-{rec_id:04d}",
        "vendor": vendor_alias,
        "amount": amount,
        "date": str(txn_date),
        "reference": f"TXN-{rec_id:06d}",
    }

ledger    = []
statement = []
lid = 1
sid = 1

# ─────────────────────────────────────────────────────────────
# Tier 1 — Clean 1:1 matches  (~45 records)
# ─────────────────────────────────────────────────────────────
CLEAN_PAIRS = 45
for _ in range(CLEAN_PAIRS):
    canonical, alias = random.choice(BASE_VENDORS)
    amt = rand_amount()
    dt  = rand_date()
    cat = random.choice(CATEGORIES)
    ledger.append(make_ledger_record(lid, canonical, amt, dt, cat))
    statement.append(make_statement_record(sid, canonical, amt, dt))  # same vendor name — exact
    lid += 1; sid += 1

# ─────────────────────────────────────────────────────────────
# Tier 2a — Amount mismatches  (~7 records, date exact, amount off ±₹2-5)
# ─────────────────────────────────────────────────────────────
AMOUNT_MISMATCH = 7
for _ in range(AMOUNT_MISMATCH):
    canonical, alias = random.choice(BASE_VENDORS)
    amt   = rand_amount()
    delta = round(random.uniform(2, 5), 2) * random.choice([-1, 1])
    dt    = rand_date()
    cat   = random.choice(CATEGORIES)
    ledger.append(make_ledger_record(lid, canonical, amt, dt, cat))
    statement.append(make_statement_record(sid, canonical, round(amt + delta, 2), dt))
    lid += 1; sid += 1

# ─────────────────────────────────────────────────────────────
# Tier 2b — Date mismatches  (~7 records, amount exact, date off 1-3 days)
# ─────────────────────────────────────────────────────────────
DATE_MISMATCH = 7
for _ in range(DATE_MISMATCH):
    canonical, alias = random.choice(BASE_VENDORS)
    amt     = rand_amount()
    dt      = rand_date()
    lag     = timedelta(days=random.randint(1, 3))
    cat     = random.choice(CATEGORIES)
    ledger.append(make_ledger_record(lid, canonical, amt, dt, cat))
    statement.append(make_statement_record(sid, canonical, amt, dt + lag))  # bank posts later
    lid += 1; sid += 1

# ─────────────────────────────────────────────────────────────
# Tier 3 — Vendor name variations  (~3 records, fuzzy-match territory)
# ─────────────────────────────────────────────────────────────
FUZZY_PAIRS = [
    ("Amazon Web Services", "AMZN WEB SVC",         round(random.uniform(5000, 40000), 2), rand_date()),
    ("Microsoft Azure",     "MSFT AZURE CLOUD",      round(random.uniform(3000, 30000), 2), rand_date()),
    ("Google Cloud Platform","Google Cloud Plt Ltd",  round(random.uniform(2000, 20000), 2), rand_date()),
]
for canonical, alias, amt, dt in FUZZY_PAIRS:
    cat = "Cloud"
    # Small amount noise so it falls into tolerant+fuzzy (not exact)
    stmt_amt = round(amt + random.uniform(-3, 3), 2)
    ledger.append(make_ledger_record(lid, canonical, amt, dt, cat))
    statement.append(make_statement_record(sid, alias, stmt_amt, dt))
    lid += 1; sid += 1

# ─────────────────────────────────────────────────────────────
# Unmatched — Ledger-only  (2 records — payment logged but never cleared bank)
# ─────────────────────────────────────────────────────────────
LEDGER_ONLY = [
    ("Datadog Inc", round(random.uniform(8000, 25000), 2), rand_date(), "Infrastructure"),
    ("Twilio Inc",  round(random.uniform(1500, 6000),  2), rand_date(), "Operations"),
]
for canonical, amt, dt, cat in LEDGER_ONLY:
    ledger.append(make_ledger_record(lid, canonical, amt, dt, cat))
    lid += 1
    # No matching statement record

# ─────────────────────────────────────────────────────────────
# Unmatched — Statement-only  (1 record — bank charge not in ledger)
# ─────────────────────────────────────────────────────────────
STMT_ONLY = [("Stripe Inc", round(random.uniform(500, 3000), 2), rand_date())]
for alias, amt, dt in STMT_ONLY:
    statement.append(make_statement_record(sid, alias, amt, dt))
    sid += 1

# ─────────────────────────────────────────────────────────────
# Ambiguous — 1 ledger record that matches 2 statement records equally
# (duplicate bank posting — a real real-world failure mode)
# ─────────────────────────────────────────────────────────────
canonical, alias = random.choice(BASE_VENDORS)
amb_amt = round(random.uniform(3000, 15000), 2)
amb_dt  = rand_date()
cat     = random.choice(CATEGORIES)
ledger.append(make_ledger_record(lid, canonical, amb_amt, amb_dt, cat))
lid += 1
# Two identical statement rows (duplicate posting)
statement.append(make_statement_record(sid,   canonical, amb_amt, amb_dt))
sid += 1
statement.append(make_statement_record(sid,   canonical, amb_amt, amb_dt))
sid += 1

# ─────────────────────────────────────────────────────────────
# Write fixtures
# ─────────────────────────────────────────────────────────────
ledger_path    = os.path.join(OUTPUT_DIR, "ledger.json")
statement_path = os.path.join(OUTPUT_DIR, "statement.json")

with open(ledger_path,    "w", encoding="utf-8") as f:
    json.dump(ledger, f, indent=2)

with open(statement_path, "w", encoding="utf-8") as f:
    json.dump(statement, f, indent=2)

print(f"Generated {len(ledger)} ledger records    -> {ledger_path}")
print(f"Generated {len(statement)} statement records -> {statement_path}")

# ── Summary by intended failure mode ─────────────────────────
print(f"\nInjected failure distribution:")
print(f"  Clean 1:1 matches    : {CLEAN_PAIRS}")
print(f"  Amount mismatches    : {AMOUNT_MISMATCH}")
print(f"  Date lag mismatches  : {DATE_MISMATCH}")
print(f"  Fuzzy vendor names   : {len(FUZZY_PAIRS)}")
print(f"  Ledger-only (no stmt): {len(LEDGER_ONLY)}")
print(f"  Statement-only       : {len(STMT_ONLY)}")
print(f"  Ambiguous duplicate  : 1 (1 ledger -> 2 statement rows)")
