# GTMFlow – AI-Powered Lead Intelligence & GTM Automation Platform

> **Portfolio-Grade Engineering Project (Secfix GTM Engineer Application)**  
> *Full-stack Python 3 + FastAPI + Next.js 14 + PostgreSQL 16 + Celery/Redis + Anthropic Claude 3.5 Sonnet*

---

## 1. Overview & Problem Statement

Sales and GTM engineering teams frequently lose velocity to fragmented CSV exports, duplicate company profiles across spreadsheets, unverified contact records, and hours spent manually researching target accounts for compliance readiness (e.g., **ISO 27001**, **SOC 2**, **GDPR**, **NIS2**).

**GTMFlow** centralizes the entire Revenue Operations pipeline into one auditable platform:
1. **Ingest & Normalize:** Upload CSV/Excel lead lists with automatic column-mapping suggestions, domain canonicalization, email validation, and duplicate detection.
2. **Evidence-Grounded AI Research (Claude 3.5 Sonnet):** Extract structured industry classification, compliance buying signals, target decision-maker roles, and recommended next actions strictly from verified company data—with human-in-the-loop review and an automatic offline heuristic fallback when no API key is configured.
3. **Deterministic 100-Pt Lead Scoring:** Score every account transparently across Industry, Geography, Company Size, Buying Signals, and Data Completeness using configurable ICP weights.
4. **Least-Loaded Sales Routing & Alerting:** Automatically balance high-priority (`>= 80`) accounts across active sales representatives and deliver in-app notifications.
5. **Automation Center & Background Orchestration:** Define event/schedule-driven automation rules executed via Celery Workers & Celery Beat with retry telemetry and full PostgreSQL audit logs.

---

## 2. Technology Stack

| Layer | Technology | Role in GTMFlow |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TypeScript | Multi-page B2B SaaS application (Dashboard, Accounts, Contacts, Imports, Enrichment, Scoring, Automations, Jobs, Settings, Login) |
| **Styling & Charts** | Tailwind CSS, Lucide Icons, Recharts | Responsive light-mode UI inspired by Linear / Attio with live Bar & Pie analytics |
| **Client State** | Axios, TanStack React Query | Authenticated REST client with JWT bearer handling & 401 session expiration redirect |
| **Backend API** | Python 3.11+, FastAPI, Pydantic v2 | Modular REST API (`/api/v1`) with OpenAPI/Swagger documentation & request correlation IDs |
| **Database & Migrations** | PostgreSQL 16 (`psycopg3`), SQLAlchemy 2, Alembic | 13 relational tables with foreign keys, uniqueness constraints, and versioned schema migrations |
| **AI Intelligence** | Anthropic Claude Python SDK | Strict JSON-validated company enrichment with backoff retries & offline fallback |
| **Async Processing** | Celery 5.4, Celery Beat, Redis 7 | Chunked CSV processing, batch enrichment, scheduled hourly scoring & 15-min enrichment sweeps |
| **Testing** | Pytest, Vitest | 55+ backend unit & API integration tests + frontend utility test suite |
| **Deployment** | Docker, Docker Compose | One-command multi-service stack (`postgres`, `redis`, `backend`, `celery_worker`, `celery_beat`, `frontend`) |

---

## 3. Architecture & Implemented Modules

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed component diagrams, ER schema diagrams, and data flow specifications.

### Frontend Pages (`frontend/src/app/`)
- **Dashboard (`/`):** Real-time PostgreSQL KPIs, industry & country distribution bar charts, priority donut breakdown, recent CSV imports, and audit activity feed.
- **Accounts (`/accounts`, `/accounts/[id]`):** Filterable/sortable account directory + intelligence workspace featuring the 100-pt score breakdown ("Why this account is prioritized"), recommended next action, buying signals, Contacts tab, and History timeline.
- **Contacts (`/contacts`):** Decision-maker directory with search, email validation, and account linkage.
- **Imports (`/imports`):** 5-step interactive CSV/Excel upload, column mapper, conflict resolution selector (`PRESERVE_EXISTING` / `OVERWRITE_EMPTY` / `UPDATE_ALL`), sample CSV generator, live polling, and import history.
- **AI Enrichment (`/enrichment`):** Queue batch enrichments, inspect confidence & compliance signals, and **Approve & Apply** or **Reject** AI suggestions.
- **Lead Scoring & Routing (`/scoring`):** ICP leaderboard, rep workload balancing view, bulk score/assign controls, and admin ICP weight editor.
- **Automation Center (`/automations`):** Rule builder (`ON_ENRICHMENT_COMPLETE`, `ON_SCORE_CALCULATED`, `SCHEDULED_DAILY`, `MANUAL`), toggle switches, on-demand execution, and run logs.
- **Jobs Monitor (`/jobs`):** Redis/Celery worker readiness indicator, Beat schedule list, and one-click failed job retries.
- **Settings (`/settings`) & Login (`/login`):** Role-based team management (`ADMIN` / `SALES`), live health/readiness probes, JWT sign-in/registration, and demo workspace quick-fill.

---

## 4. How to Run the Project

You can run GTMFlow either as a **complete containerized stack via Docker Compose** (recommended for quick evaluation) or natively in **local development mode**.

### Option A: Run Everything with Docker Compose (Recommended)

#### Prerequisites
- **Docker Desktop** (with Docker Compose v2)

#### Step 1: Configure Environment Variables (Optional)
Create a `.env` file in the repository root from the template:
```bash
cp .env.example .env
```
> **Note on `ANTHROPIC_API_KEY`:** If you add a real `ANTHROPIC_API_KEY` in `.env`, GTMFlow calls Claude 3.5 Sonnet directly. If you leave it blank or keep the placeholder, GTMFlow automatically runs in transparent **`offline_heuristic`** mode using verified account metadata—every feature still works out of the box.

*(In Windows PowerShell, make sure to copy with `Copy-Item .env.example .env`, and remove the placeholder `your_anthropic_api_key_here` or leave `ANTHROPIC_API_KEY=` blank unless using a real Anthropic key.)*

#### Step 2: Build and Start All 6 Services
```bash
docker compose up --build -d
```
Wait ~30–60 seconds for PostgreSQL, Redis, FastAPI (auto-running `alembic upgrade head`), Celery Worker, Celery Beat, and Next.js to start cleanly.

Check container health/status:
```bash
docker compose ps
```

#### Step 3: Seed Demo Workspace Data (Idempotent)
Populate realistic European B2B SaaS / Cybersecurity demo accounts, contacts, AI enrichments, 100-pt scores, rep routing, automation rules, and demo logins:
```bash
docker compose exec backend python -m app.seed
```

#### Step 4: Open & Sign In
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **Swagger / OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health / Readiness:** [http://localhost:8000/ready](http://localhost:8000/ready)

**Seeded Demo Credentials:**
- **Admin:** `admin@secfix-gtm.example` / `AdminPass123!` *(or click **Fill Demo** on `/login`)*
- **Sales Rep 1:** `lena@secfix-gtm.example` / `SalesPass123!`
- **Sales Rep 2:** `marcus@secfix-gtm.example` / `SalesPass123!`

---

### Option B: Run Locally Without Full Docker App Containers

#### Prerequisites
- Python 3.11+ (tested on 3.13)
- Node.js 20+ & npm
- Docker Desktop (to run PostgreSQL 16 + Redis 7 quickly)

#### 1. Start PostgreSQL & Redis
```powershell
docker compose up -d postgres redis
```

#### 2. Configure `.env`
Copy `.env.example` to `.env` in both `c:\GTMFlow\.env` and `c:\GTMFlow\backend\.env` (or export environment variables):
```powershell
Copy-Item .env.example .env
```
Edit `ANTHROPIC_API_KEY=` in `.env` to either your real Anthropic key or leave it empty (`ANTHROPIC_API_KEY=`) for offline heuristic mode.

#### 3. Start Backend API (Terminal 1)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

#### 4. Start Celery Worker & Beat (Optional — API has automatic sync fallback when Redis/Worker isn't needed)
In Terminal 2 (Worker):
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker --loglevel=info --pool=solo
```
In Terminal 3 (Beat Scheduler):
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```

#### 5. Start Next.js Frontend (Terminal 4)
```powershell
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with `admin@secfix-gtm.example` / `AdminPass123!`.

---

## 5. Running Automated Tests & Production Builds

### Backend Tests (Pytest)
```powershell
cd backend
.\.venv\Scripts\pytest.exe -v
```

### Frontend Unit Tests & Production Build
```powershell
cd frontend
npm run test
npm run build
```

---

## 6. Key API Endpoints (`/api/v1`)

| Group | Endpoints |
| :--- | :--- |
| **Health** | `GET /health`, `GET /ready`, `GET /api/v1/health`, `GET /api/v1/ready` |
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/admin-only` |
| **Accounts & Contacts** | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/{id}`, `GET /accounts/{id}/activity`, `GET/POST/PATCH/DELETE /contacts` |
| **Ingestion** | `POST /imports/upload`, `POST /imports/start`, `GET /imports`, `GET /imports/{id}` |
| **AI Enrichment** | `POST /accounts/bulk-enrich`, `POST /accounts/{id}/enrich`, `GET /accounts/{id}/enrichment`, `GET /enrichment`, `POST /enrichment/{id}/review` |
| **Scoring & Routing** | `POST /accounts/bulk-score`, `POST /accounts/bulk-assign`, `POST /accounts/{id}/score`, `GET /accounts/{id}/scores`, `POST /accounts/{id}/assign`, `GET/PUT /scoring/config`, `GET /scoring/overview` |
| **Automation & Jobs** | `GET/POST /automations/rules`, `PATCH/DELETE /automations/rules/{id}`, `POST /automations/rules/{id}/run`, `GET /automations/executions`, `GET /jobs`, `GET /jobs/worker-status`, `POST /jobs/{id}/retry` |
| **Dashboard & Team** | `GET /dashboard/overview`, `GET /notifications`, `POST /notifications/{id}/read`, `GET/POST/PATCH /users` |
