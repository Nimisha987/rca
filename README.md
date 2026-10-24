# AI-Powered RCA Module (API Manufacturing)

Deviation → **Root Cause Analysis** → CAPA, with an AI panel that reads an incident document and fills the RCA form for a quality professional to review, edit and save.

**Stack:** React + Redux Toolkit · FastAPI · LangGraph + Groq · PostgreSQL

> **Privacy:** the assignment forbids publishing code, videos, sample docs or screenshots publicly. Keep this repo **private** (or just a local folder).

## Run it

```bash
# 1. Database
docker compose up -d db            # Postgres on :5432  (or set DATABASE_URL=sqlite:///./rca.db to skip Docker)

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # put your GROQ_API_KEY in it
uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                                         # http://localhost:5173  (proxies /api -> :8000)
```

Tables are created automatically on startup.

## Workflow

```
Incident doc (PDF / .eml / pasted text)
   │  POST /api/ingest        pypdf / email parser -> plain text (shown in the AI panel)
   ▼
POST /api/analyze  (Server-Sent Events, one event per finished LangGraph node)
   │
   ├─ extract_deviation   -> deviation form fields + list of fields not found in the document
   ├─ five_whys     ┐ run in parallel
   ├─ fishbone (6M) ┘
   ├─ rank_root_causes    -> 2-4 suggested root causes w/ evidence + confidence, contributing factors
   ├─ evidence_gaps       -> missing records needed to confirm / rule out causes
   └─ capa                -> corrective & preventive actions w/ rationale, owner role, target, effectiveness check
   ▼
User reviews / edits every section  ->  POST/PUT /api/investigations  ->  PostgreSQL
```

### Product decisions (worth saying in the demo)
- **AI output is a suggestion until a person confirms it.** Deviation fields carry an *AI suggested → Edited → Confirmed* badge; root causes stay *Suggested - unverified* until someone clicks Confirm; the save screen warns about anything still unreviewed and records the reviewer.
- **No invented facts.** Prompts allow only facts from the document; fields it can't find stay empty and are flagged "Not found in document".
- **Honest confidence.** Each root cause has High/Medium/Low confidence with the reason and what would raise it; 5 Whys steps and fishbone factors are marked *Documented* vs *Hypothesis*.
- **Missing evidence is first-class:** a checklist (batch record, audit trail, calibration, training, PM, trend…) users tick off as they obtain items.
- **Audit-friendly storage:** `investigations.ai_snapshot` keeps the untouched AI output next to the user-edited `data`, so a reviewer can see what the human changed.
- CAPA owners are **roles**, not names; CAPA touching validated processes are flagged as needing change control.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + whether a Groq key is configured |
| GET | `/api/sample` | sample deviation text (for the demo button) |
| POST | `/api/ingest` | multipart `file` (pdf/eml/txt) or form `text` → extracted text |
| POST | `/api/analyze` | `{text}` → SSE stream of LangGraph node results |
| POST | `/api/chat` | follow-up Q&A grounded in the current investigation |
| POST/PUT | `/api/investigations[/{id}]` | save / update |
| GET | `/api/investigations[/{id}]` | list / load |

## Code map

```
backend/app/graph.py      LangGraph definition + all prompts      <- core of the AI logic
backend/app/schemas.py    Pydantic models = LLM structured output = form shape
backend/app/llm.py        Groq client, structured output, retry on 429
backend/app/extract.py    PDF / EML / text extraction
backend/app/main.py       FastAPI routes, SSE streaming, persistence
backend/app/db.py         SQLAlchemy model (Investigation)
frontend/src/store/       rcaSlice.js (state + reducers), thunks.js (SSE reader, API calls)
frontend/src/components/  AIPanel (intake, pipeline, chat) + one component per form section
```

## Demo scripts

**Video 1 (5-8 min):** (1) Show the AI panel, click *Load sample deviation* (or upload `backend/sample_docs/DEV-2026-0412.txt`/the `.eml`). (2) *Extract & Analyze*: watch the pipeline tick and tabs fill. (3) Deviation tab: AI badges, amber "Not found" fields, the AI-proposed classification. (4) 5 Whys + Fishbone. (5) Root causes: confidence, evidence, Confirm/Reject. (6) Missing evidence checklist. (7) CAPA: edit an action, accept/reject. (8) Edit a field, ask the chat "Why is RC1 the most likely cause?". (9) Review & save, then reopen from *Saved*.

**Video 2 (5-10 min):** `thunks.js` (SSE reader) → `rcaSlice.js` (`applyUpdate`) → `AIPanel.jsx` → `main.py` (`/analyze` stream) → `graph.py` (nodes, parallel branch, join) → `schemas.py` (structured output) → `db.py` + save endpoints.

## Notes
- Models are set in `.env` (`GROQ_MODEL_REASONING`, `GROQ_MODEL_EXTRACT`). Free-tier Groq rate limits are handled by retry/backoff in `llm.py`; if you still hit them, point `GROQ_MODEL_EXTRACT` at a smaller model.
- Scanned PDFs (no text layer) are detected and reported; OCR is intentionally out of scope.
- Possible extensions: attach evidence files per gap, CAPA tracking/due dates, e-signature, similar-deviation search.
