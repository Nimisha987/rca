// -- Active: 1770352827501@@127.0.0.1@3306
import { Fragment, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { STAGES, a } from '../store/rcaSlice';
import { ingestFile, loadSample, runAnalysis, sendChat } from '../store/thunks';

function stageState(stage, analysis) {
  if (analysis.done[stage.key]) return 'done';
  if (analysis.status !== 'running') return analysis.status === 'error' ? 'failed' : 'idle';
  return stage.needs.every((n) => analysis.done[n]) ? 'running' : 'queued';
}

const ICON = { done: '✓', running: '…', queued: '·', idle: '·', failed: '!' };
const SUGGESTIONS = [
  'Why is RC1 the most likely cause?',
  'What should I verify first?',
  'Which batches are at risk?',
  'What is missing from the document?',
];

// ---- tiny markdown renderer for chat replies (bold, `code`, bullets, numbers, paragraphs) ----
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Markdown({ text }) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let cur = null;
  const flush = () => { if (cur) { blocks.push(cur); cur = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[*\-•]\s+(.*)$/);
    const number = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) { flush(); continue; }
    if (bullet || number) {
      const type = bullet ? 'ul' : 'ol';
      if (!cur || cur.type !== type) { flush(); cur = { type, items: [] }; }
      cur.items.push((bullet || number)[1]);
    } else if (cur && cur.type === 'p') {
      cur.lines.push(line.trim());
    } else {
      flush();
      cur = { type: 'p', lines: [line.trim()] };
    }
  }
  flush();
  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.type === 'ul') return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
        return <p key={i}>{inline(b.lines.join(' '))}</p>;
      })}
    </div>
  );
}

export default function AIPanel() {
  const dispatch = useDispatch();
  const { sourceText, sourceMeta, analysis, chat, chatBusy } = useSelector((s) => s.rca);
  const [mode, setMode] = useState('paste');
  const [draft, setDraft] = useState('');
  const fileRef = useRef(null);
  const logRef = useRef(null);
  const running = analysis.status === 'running';
  const ready = analysis.status === 'done';

  // Show a new reply from its first line; show your own message / the typing dots at the end.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const items = log.querySelectorAll('.turn');
    const last = items[items.length - 1];
    if (!last) return;
    const top = last.classList.contains('assistant') && !last.classList.contains('typing');
    log.scrollTo({ top: top ? last.offsetTop - log.offsetTop - 4 : log.scrollHeight, behavior: 'smooth' });
  }, [chat.length, chatBusy]);

  const send = (text) => {
    const m = (text ?? draft).trim();
    if (!m || chatBusy || !ready) return;
    setDraft('');
    dispatch(sendChat(m));
  };

  const sourceControls = (
    <>
      <div className="seg">
        <button className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>Paste text / email</button>
        <button className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}>Upload PDF / .eml</button>
      </div>

      {mode === 'upload' && (
        <div className="drop" onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" hidden accept=".pdf,.eml,.txt,.md"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) dispatch(ingestFile(f)); e.target.value = ''; }} />
          <b>Click to choose a file</b>
          <span className="muted small">PDF, .eml or .txt. The text is extracted and shown below.</span>
        </div>
      )}

      {sourceMeta && (
        <p className="muted small">
          Loaded <b>{sourceMeta.filename || 'pasted text'}</b> ({sourceMeta.source_type})
          {sourceMeta.truncated && '. Long document: only the first part is analyzed.'}
          {sourceMeta.warnings?.map((w) => <span key={w} className="err"> {w}</span>)}
        </p>
      )}

      <textarea className="input source" rows={ready ? 6 : 9} value={sourceText} disabled={running}
        placeholder="Paste the deviation report, incident notes or an email here..."
        onChange={(e) => { dispatch(a.setSourceText(e.target.value)); dispatch(a.setSourceMeta(null)); }} />

      <div className="row">
        <button className="btn ghost sm" disabled={running} onClick={() => dispatch(loadSample())}>Load sample deviation</button>
        <button className="btn primary grow" disabled={running || sourceText.trim().length < 40} onClick={() => dispatch(runAnalysis())}>
          {running ? 'Analyzing...' : ready ? 'Re-run analysis' : 'Extract & Analyze'}
        </button>
      </div>
    </>
  );

  const steps = (
    <ul className="pipeline">
      {STAGES.map((st) => {
        const state = stageState(st, analysis);
        return (
          <li key={st.key} className={state}>
            <span className="dot">{ICON[state]}</span>{st.label}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="aside">
      <div className="aside-head">
        <h2>AI assistant</h2>
        <p className="muted">
          {ready
            ? 'Form filled. Review each tab, or ask below.'
            : 'Add the incident document and I will fill the RCA form for you to review.'}
        </p>
      </div>

      {/* Before the analysis: the source is the main thing. Afterwards it folds away so the chat gets the room. */}
      {ready ? (
        <details className="fold">
          <summary>
            <span>Source document</span>
            <small>{sourceMeta?.filename || 'pasted text'} · {sourceText.length.toLocaleString()} characters</small>
          </summary>
          <div className="fold-body">{sourceControls}</div>
        </details>
      ) : (
        sourceControls
      )}

      {analysis.error && <div className="alert">{analysis.error}</div>}

      {(running || analysis.status === 'error') && steps}
      {ready && (
        <details className="pipeline-done">
          <summary>Analysis complete: {STAGES.length} of {STAGES.length} steps</summary>
          {steps}
        </details>
      )}

      <section className="chat" aria-label="Ask about this investigation">
        <h3 className="chat-title">Ask about this investigation</h3>

        <div className="chat-log" ref={logRef}>
          {!chat.length && (
            <p className="muted small chat-empty">
              {ready
                ? 'Pick a question below or type your own. Answers use only this investigation.'
                : 'Chat unlocks after the analysis finishes.'}
            </p>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`turn ${m.role} ${m.error ? 'error' : ''}`}>
              <span className="who">{m.role === 'user' ? 'You' : 'AI'}</span>
              <div className="bubble">{m.role === 'assistant' && !m.error ? <Markdown text={m.content} /> : m.content}</div>
            </div>
          ))}
          {chatBusy && (
            <div className="turn assistant typing">
              <span className="who">AI</span>
              <div className="bubble"><span className="dots"><i /><i /><i /></span></div>
            </div>
          )}
        </div>

        {ready && (
          <div className="sugg" role="group" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip clickable" disabled={chatBusy} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="row chat-input">
          <input className="input" value={draft} placeholder={ready ? 'Ask a question...' : 'Run the analysis first'} disabled={!ready}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="btn primary sm" disabled={!ready || chatBusy || !draft.trim()} onClick={() => send()}>Send</button>
        </div>
      </section>
    </aside>
  );
}
