# DRISHTI 360 – AI-Powered Farm-to-Market Intelligence Platform

> **From Farm to Market – Quality, Compliance, Transparency & Fair Value.**

Foundation setup for **DRISHTI 360** using **React + Vite + Tailwind CSS + Axios** on the frontend and **Python + FastAPI + SQLAlchemy (PostgreSQL-ready)** on the backend.

---

## Project Structure

```text
drishti 360/
├── drishti-360-logo.jpg
├── frontend/
│   ├── src/
│   │   ├── assets/drishti-360-logo.jpg
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/api.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   └── package.json
└── backend/
    ├── app/
    │   ├── api/
    │   ├── core/
    │   ├── database/
    │   ├── models/
    │   ├── schemas/
    │   ├── services/
    │   ├── utils/
    │   └── main.py
    ├── .env.example
    └── requirements.txt
```

---

## Windows PowerShell Setup & Run Commands

### 1. Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt
Copy-Item .env.example .env
# Edit backend/.env with your PostgreSQL DATABASE_URL (or sqlite:///./drishti360_local.db for local dev)
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

### Access URLs
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

---

## Starter API Endpoints

- `GET /api/health`
- `GET /api/dashboard/stats`
- `GET /api/crops`
- `POST /api/crops`
- `POST /api/inspection/analyze`
- `POST /api/compliance/analyze`
- `POST /api/pricing/estimate`
- `POST /api/passports/generate`
- `GET /api/passports/{passport_id}`
- `GET /api/passports/{passport_id}/verify`
- `GET /api/passports/{passport_id}/pdf`
- `GET /api/traceability/{batch_id}`

---

## Cloud Deployment (Vercel + Render + PostgreSQL)

### 1. Backend & PostgreSQL (Render Blueprint)
This repository includes [`render.yaml`](render.yaml) and [`backend/Dockerfile`](backend/Dockerfile).
1. Push this repository to GitHub (`main` branch).
2. In **Render Dashboard** -> **New +** -> **Blueprint** -> connect `sudharshanps/Drishti-360`.
3. Render provisions `drishti360-db` (PostgreSQL) and `drishti360-api` (FastAPI Docker web service) with health check `/api/health`.
4. After Vercel deploys the frontend, set these Render environment variables:
   - `FRONTEND_URL=https://<your-vercel-domain>.vercel.app`
   - `CORS_ORIGINS=https://<your-vercel-domain>.vercel.app`
   - `PUBLIC_VERIFY_BASE_URL=https://<your-vercel-domain>.vercel.app/verify`

### 2. Frontend (Vercel)
This repository includes [`frontend/vercel.json`](frontend/vercel.json) for SPA routing (`/verify/:passportId` and `/app/*`).
1. In **Vercel Dashboard** -> **Add New Project** -> import `sudharshanps/Drishti-360`.
2. Set **Root Directory** to `frontend` and **Framework Preset** to `Vite`.
3. Add environment variable:
   - `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`
4. Deploy!

### 3. Docker Compose (Self-Hosted)
```bash
cp .env.example .env
docker compose up --build -d
```
