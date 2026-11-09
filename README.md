# GTMFlow – AI-Powered Lead Intelligence and GTM Automation Platform

> **Recommended Portfolio Project for Secfix GTM Engineer Application**  
> *Full-stack Python + FastAPI + Next.js + PostgreSQL + Celery + Anthropic Claude 3.5 Sonnet*

---

## 1. Project Overview & Problem Statement

In modern B2B SaaS organizations, sales engineering and business development teams grapple with fragmented data, manual research, duplicate company profiles, and missing compliance signals.

**GTMFlow** is a centralized GTM infrastructure platform that automates company data ingestion, enrichment, deduplication, deterministic account scoring, intelligent routing, and automated CRM synchronization.

### Key Capabilities
- **High-Throughput Data Ingestion:** CSV and Excel upload with chunked parsing, dynamic column mapping, and field-level validation.
- **Relational Integrity & Deduplication:** Multi-stage deduplication hierarchy (exact normalized domain, company identifiers, normalized name + country) backed by PostgreSQL unique constraints.
- **AI Company Research (Claude 3.5 Sonnet):** Structured, Pydantic-validated extraction of industry classification, target market fit, ISO 27001 / SOC 2 compliance buying signals, and recommended decision-maker roles.
- **Deterministic Lead Scoring:** Transparent 100-point scoring algorithm with configurable weights across industry, geography, company size, and evidence-backed buying signals.
- **Automated Sales Assignment:** Least-loaded round-robin routing of high-priority accounts to active sales representatives.
- **Background Orchestration:** Celery worker and Celery Beat task scheduling with Redis message broker, exponential backoff, and idempotency guarantees.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14, TypeScript | Full-stack React web application |
| **Styling** | Tailwind CSS, shadcn/ui patterns | Clean B2B SaaS interface (Linear/HubSpot design) |
| **State & API Client** | Axios, TanStack Query | Type-safe server state and background polling |
| **Backend REST API**| Python 3.13, FastAPI | High-performance asynchronous REST API |
| **Database** | PostgreSQL 16 (psycopg3) | Relational primary source of truth |
| **ORM & Migrations**| SQLAlchemy 2, Alembic | Schema versioning and declarative data models |
| **Data Validation** | Pydantic v2, Pydantic Settings| Strict request/response validation |
| **AI Enrichment** | Anthropic Claude Python SDK | Structured company research & buying signals |
| **Task Queue** | Celery 5.4, Redis 7 | Asynchronous CSV processing and API retries |
| **Scheduler** | Celery Beat | Periodic enrichment and daily summary jobs |
| **Testing** | Pytest, Pytest-Asyncio | Automated backend unit and integration tests |
| **Containerization**| Docker, Docker Compose | Multi-container local orchestration |

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Frontend                     │
│    Dashboard · Accounts · Contacts · Ingestion · Jobs  │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / REST (/api/v1)
┌──────────────────────────▼─────────────────────────────┐
│                 FastAPI REST Service                   │
│   Auth · Validation · Routing · Deduplication · Scores │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
    ┌────────▼────────┐           ┌────────▼────────┐
    │  PostgreSQL 16  │           │     Redis 7     │
    │ Accounts · Scores│          │ Task Queue Broker│
    └─────────────────┘           └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  Celery Workers │
                                  │ Ingestion · AI  │
                                  └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │ Claude 3.5 API  │
                                  │ Anthropic SDK   │
                                  └─────────────────┘
```

---

## 4. Quick Start & Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Docker Desktop (for PostgreSQL & Redis)

### 1. Clone & Environment Configuration
```bash
git clone <repo-url>
cd GTMFlow
cp .env.example .env
```

### 2. Infrastructure (Docker Compose)
Start PostgreSQL and Redis in background:
```bash
docker compose up -d postgres redis
```

### 3. Backend Setup
```bash
cd backend

# Create & activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health Probe: `http://localhost:8000/health`
- Readiness Probe: `http://localhost:8000/ready`

### 4. Celery Worker & Beat (Separate Terminals)
```bash
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker --loglevel=info --pool=solo
```
In another terminal:
```bash
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```

### 5. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Frontend application runs at: `http://localhost:3000`

---

## 5. Backend API Endpoints (Phase 1 Implemented)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Root operational status and API index |
| `GET` | `/health` | Liveness probe returning process status and version |
| `GET` | `/ready` | Readiness probe checking PostgreSQL and Redis dependencies |
| `GET` | `/api/v1/health` | Versioned liveness probe |
| `GET` | `/api/v1/ready` | Versioned readiness probe |
| `GET` | `/docs` | Swagger interactive OpenAPI documentation |
| `GET` | `/redoc` | ReDoc schema documentation |

---

## 6. Running Tests

```bash
cd backend
.\.venv\Scripts\pytest.exe -v tests/test_health.py
```
Outputs:
```
tests/test_health.py::test_root_endpoint PASSED           [ 20%]
tests/test_health.py::test_health_check_liveness PASSED   [ 40%]
tests/test_health.py::test_api_v1_health_check PASSED     [ 60%]
tests/test_health.py::test_ready_check PASSED             [ 80%]
tests/test_health.py::test_response_headers PASSED        [100%]
====================== 5 passed in 9.94s =======================
```
