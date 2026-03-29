# Autonomous Cost Intelligence Platform

An AI-powered enterprise cost management system that continuously monitors operational data, identifies cost leakage and inefficiency patterns, and initiates corrective actions with quantifiable financial impact.

## Features

- **Dashboard** — Real-time analytics on your uploaded enterprise cost data
- **Example Page** — Demo view showing how the platform works with sample data
- **Autonomous Cost Fixer** — AI detects issues and executes corrective actions
- **Continuous Monitoring** — Background scheduler scans for cost leakage
- **Anomaly Detection** — Flags unusual spending patterns
- **Shadow Cost Detector** — Finds duplicate tools and unauthorized licenses
- **Future Cost Predictor** — Forecasts explosive cost growth
- **What-If Simulator** — Test optimization strategies on your data
- **AI Chatbot** — Finance assistant that fetches answers from Wikipedia & Investopedia
- **CSV Upload & Manual Entry** — Import your enterprise expenses

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Recharts, Lucide Icons |
| Backend | Python Flask, Flask-SQLAlchemy, Flask-JWT |
| Database | SQLite (auto-created) |
| AI Agents | Multi-agent architecture (7 specialized agents) |
| Chatbot | Web scraping (Wikipedia, Investopedia, DuckDuckGo) |
| Scheduler | APScheduler for continuous monitoring |

## Setup

**No API keys required.**

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs on http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173

## Project Structure
```
Autonomous_Cost_Platform/
├── backend/
│   ├── agents/
│   │   ├── anomaly_detection_agent.py
│   │   ├── chatbot_agent.py
│   │   ├── cost_monitoring_agent.py
│   │   ├── data_ingestion_agent.py
│   │   ├── future_cost_predictor_agent.py
│   │   ├── predictive_cfo_agent.py
│   │   ├── shadow_cost_detector_agent.py
│   │   └── spend_analysis_agent.py
│   ├── data/
│   │   └── sample_data.json
│   ├── app.py
│   ├── models.py
│   ├── monitoring_scheduler.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Auth.jsx
│   │   ├── DataEntry.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```
