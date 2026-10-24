import json
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .config import CORS_ORIGINS, GROQ_API_KEY, MAX_SOURCE_CHARS, SAMPLE_DIR
from .db import Investigation, get_db, init_db
from .extract import extract_text
from .graph import rca_graph
from .llm import run_text
from .schemas import (
    AnalyzeRequest,
    ChatRequest,
    InvestigationIn,
    InvestigationOut,
    InvestigationSummary,
)

app = FastAPI(title="AI RCA Module", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/api/health")
def health():
    return {"ok": True, "groq_key_set": bool(GROQ_API_KEY)}


# ---------- Intake ----------

@app.get("/api/sample")
def sample():
    path = SAMPLE_DIR / "DEV-2026-0412.txt"
    if not path.exists():
        raise HTTPException(404, "Sample document not found")
    return {"text": path.read_text(encoding="utf-8"), "filename": path.name}


@app.post("/api/ingest")
async def ingest(file: Optional[UploadFile] = File(None), text: Optional[str] = Form(None)):
    """Accepts a PDF / .eml / .txt upload or pasted text and returns clean text."""
    if file is not None:
        data = await file.read()
        if not data:
            raise HTTPException(400, "Uploaded file is empty")
        content, source_type, warnings = extract_text(file.filename or "", data)
        name = file.filename
    elif text:
        content, source_type, warnings, name = text.strip(), "text", [], None
    else:
        raise HTTPException(400, "Provide a file or text")
    if not content:
        raise HTTPException(422, "Could not extract any text. " + " ".join(warnings))
    return {
        "text": content,
        "source_type": source_type,
        "filename": name,
        "chars": len(content),
        "warnings": warnings,
        "truncated": len(content) > MAX_SOURCE_CHARS,
    }


# ---------- AI analysis (LangGraph, streamed) ----------

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    text = req.text.strip()
    if len(text) < 40:
        raise HTTPException(400, "Please provide more text to analyze")
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY is not set in backend/.env")

    async def event_stream():
        try:
            yield _sse({"type": "start"})
            state = {"source_text": text[:MAX_SOURCE_CHARS]}
            async for chunk in rca_graph.astream(state, stream_mode="updates"):
                for node, update in chunk.items():
                    yield _sse({"type": "update", "node": node, "data": update})
            yield _sse({"type": "done"})
        except Exception as e:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(e)[:600]})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


CHAT_SYSTEM = """You are the AI assistant inside an RCA (root cause analysis) tool for an API pharmaceutical manufacturer.
You are given the current state of the investigation as JSON. Help the quality professional understand, challenge and
refine it. Rules: answer only from the investigation context and general GMP knowledge; never present a suggested
cause as confirmed; say plainly when evidence is missing; keep answers short (under 150 words) and practical."""


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY is not set in backend/.env")
    ctx = json.dumps(req.context, ensure_ascii=False)[:9000]
    msgs = [(m.get("role", "user") if m.get("role") in ("user", "assistant") else "user", m.get("content", ""))
            for m in req.history[-6:]]
    msgs.append(("user", f"<investigation>\n{ctx}\n</investigation>\n\nQuestion: {req.message}"))
    try:
        reply = await run_text(CHAT_SYSTEM, msgs)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"LLM error: {e}") from e
    return {"reply": reply}


# ---------- Persistence ----------

def _apply(row: Investigation, body: InvestigationIn):
    dev = (body.data or {}).get("deviation", {}) or {}
    row.deviation_number = dev.get("deviation_number", "")[:64]
    row.title = dev.get("title", "")[:300]
    row.product_name = dev.get("product_name", "")[:200]
    row.batch_number = dev.get("batch_number", "")[:100]
    row.classification = dev.get("classification", "")[:20]
    row.status = body.status
    row.reviewed_by = body.reviewed_by[:200]
    row.source_text = body.source_text
    row.ai_snapshot = body.ai_snapshot
    row.data = body.data


@app.post("/api/investigations", response_model=InvestigationOut)
def create_investigation(body: InvestigationIn, db: Session = Depends(get_db)):
    row = Investigation(data=body.data)
    _apply(row, body)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.put("/api/investigations/{inv_id}", response_model=InvestigationOut)
def update_investigation(inv_id: int, body: InvestigationIn, db: Session = Depends(get_db)):
    row = db.get(Investigation, inv_id)
    if not row:
        raise HTTPException(404, "Investigation not found")
    _apply(row, body)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/investigations", response_model=List[InvestigationSummary])
def list_investigations(db: Session = Depends(get_db)):
    return db.query(Investigation).order_by(Investigation.updated_at.desc()).limit(100).all()


@app.get("/api/investigations/{inv_id}", response_model=InvestigationOut)
def get_investigation(inv_id: int, db: Session = Depends(get_db)):
    row = db.get(Investigation, inv_id)
    if not row:
        raise HTTPException(404, "Investigation not found")
    return row
