import { a } from './rcaSlice';

// Empty in local dev (Vite proxies /api). Set VITE_API_BASE to the backend URL when deployed.
const API = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

async function jsonOrThrow(res) {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new Error(body.detail || `${res.status} ${res.statusText}`);
}

// ---- Intake ----

export const loadSample = () => async (dispatch) => {
  try {
    const r = await jsonOrThrow(await fetch(API + '/api/sample'));
    dispatch(a.setSourceText(r.text));
    dispatch(a.setSourceMeta({ filename: r.filename, source_type: 'sample', warnings: [] }));
  } catch (e) {
    dispatch(a.analysisFailed(e.message));
  }
};

export const ingestFile = (file) => async (dispatch) => {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await jsonOrThrow(await fetch(API + '/api/ingest', { method: 'POST', body: fd }));
    dispatch(a.setSourceText(r.text));
    dispatch(a.setSourceMeta({ filename: r.filename, source_type: r.source_type, warnings: r.warnings, truncated: r.truncated }));
  } catch (e) {
    dispatch(a.analysisFailed(e.message));
  }
};

// ---- AI analysis: reads the SSE stream from the LangGraph backend ----

export const runAnalysis = () => async (dispatch, getState) => {
  const text = getState().rca.sourceText;
  dispatch(a.analysisStarted());
  try {
    const res = await fetch(API + '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) await jsonOrThrow(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop();
      for (const raw of events) {
        if (!raw.startsWith('data: ')) continue;
        const evt = JSON.parse(raw.slice(6));
        if (evt.type === 'update') dispatch(a.applyUpdate(evt));
        else if (evt.type === 'error') throw new Error(evt.message);
        else if (evt.type === 'done') { dispatch(a.analysisDone()); finished = true; }
      }
    }
    if (!finished) throw new Error('Analysis stream ended unexpectedly');
  } catch (e) {
    dispatch(a.analysisFailed(e.message));
  }
};

// ---- Persistence ----

function buildPayload(state, status) {
  const r = state.rca;
  return {
    source_text: r.sourceText,
    ai_snapshot: r.aiSnapshot,
    reviewed_by: r.reviewedBy,
    status,
    data: {
      deviation: r.deviation,
      fieldMeta: r.fieldMeta,
      missingFields: r.missingFields,
      fiveWhys: r.fiveWhys,
      fishbone: r.fishbone,
      rootCauses: r.rootCauses,
      contributingFactors: r.contributingFactors,
      evidenceGaps: r.evidenceGaps,
      capas: r.capas,
    },
  };
}

export const saveInvestigation = (status) => async (dispatch, getState) => {
  const state = getState();
  const id = state.rca.savedId;
  dispatch(a.setSaveState({ busy: true }));
  try {
    const send = (url, method) =>
      fetch(API + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(state, status)),
      });
    let res = await send(id ? `/api/investigations/${id}` : '/api/investigations', id ? 'PUT' : 'POST');
    // The remembered record may not exist any more (e.g. the database was switched): save as a new record instead.
    if (id && res.status === 404) res = await send('/api/investigations', 'POST');
    const rec = await jsonOrThrow(res);
    dispatch(a.setSaved({ id: rec.id, status: rec.status }));
    dispatch(a.setSaveState({ message: `Saved as #${rec.id} (${rec.status})` }));
    dispatch(loadSavedList());
  } catch (e) {
    dispatch(a.setSaveState({ message: e.message, error: true }));
  }
};

export const loadSavedList = () => async (dispatch) => {
  try {
    dispatch(a.setSavedList(await jsonOrThrow(await fetch(API + '/api/investigations'))));
  } catch {
    /* DB may be down; ignore in the list refresh */
  }
};

export const openInvestigation = (id) => async (dispatch) => {
  try {
    dispatch(a.hydrate(await jsonOrThrow(await fetch(`${API}/api/investigations/${id}`))));
  } catch (e) {
    dispatch(a.analysisFailed(e.message));
  }
};

// ---- Chat ----

export const sendChat = (message) => async (dispatch, getState) => {
  const r = getState().rca;
  const history = r.chat.map((m) => ({ role: m.role, content: m.content }));
  dispatch(a.addChat({ role: 'user', content: message }));
  dispatch(a.setChatBusy(true));
  const context = {
    deviation: r.deviation,
    five_whys: r.fiveWhys,
    root_causes: r.rootCauses.map(({ id, statement, category, confidence, confidence_reason, status, supporting_evidence }) => ({
      id, statement, category, confidence, confidence_reason, status, supporting_evidence,
    })),
    missing_evidence: r.evidenceGaps.map(({ item, priority, obtained }) => ({ item, priority, obtained })),
    capa: r.capas.map(({ id, type, action, linked_cause_ids }) => ({ id, type, action, linked_cause_ids })),
  };
  try {
    const res = await jsonOrThrow(
      await fetch(API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, history }),
      })
    );
    dispatch(a.addChat({ role: 'assistant', content: res.reply }));
  } catch (e) {
    dispatch(a.addChat({ role: 'assistant', content: `Sorry, that failed: ${e.message}`, error: true }));
  } finally {
    dispatch(a.setChatBusy(false));
  }
};
