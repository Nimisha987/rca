import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { a } from './store/rcaSlice';
import { loadSavedList } from './store/thunks';
import AIPanel from './components/AIPanel';
import DeviationSection from './components/DeviationSection';
import WhysSection from './components/WhysSection';
import FishboneSection from './components/FishboneSection';
import RootCauseSection from './components/RootCauseSection';
import EvidenceSection from './components/EvidenceSection';
import CapaSection from './components/CapaSection';
import ReviewSave from './components/ReviewSave';
import SavedDrawer from './components/SavedDrawer';

const TABS = [
  { key: 'deviation', label: 'Deviation', Comp: DeviationSection },
  { key: 'whys', label: '5 Whys', Comp: WhysSection },
  { key: 'fishbone', label: 'Fishbone', Comp: FishboneSection },
  { key: 'causes', label: 'Root causes', Comp: RootCauseSection },
  { key: 'evidence', label: 'Missing evidence', Comp: EvidenceSection },
  { key: 'capa', label: 'CAPA', Comp: CapaSection },
  { key: 'review', label: 'Review & save', Comp: ReviewSave },
];

// What each step of the investigation needs from the reviewer, shown in the rail.
function stepStatus(key, r) {
  const hasDev = Object.values(r.deviation).some((v) => String(v).trim());
  switch (key) {
    case 'deviation': {
      if (!hasDev) return { text: 'Not started', state: 'idle' };
      const n = Object.values(r.fieldMeta).filter((m) => m === 'ai').length;
      return n ? { text: `${n} to review`, state: 'todo' } : { text: 'Reviewed', state: 'done' };
    }
    case 'whys': {
      const n = r.fiveWhys?.steps?.length || 0;
      return n ? { text: `${n} steps`, state: 'done' } : { text: 'Not started', state: 'idle' };
    }
    case 'fishbone': {
      const n = Object.values(r.fishbone).reduce((t, l) => t + l.length, 0);
      return n ? { text: `${n} factors`, state: 'done' } : { text: 'Not started', state: 'idle' };
    }
    case 'causes': {
      if (!r.rootCauses.length) return { text: 'Not started', state: 'idle' };
      const open = r.rootCauses.filter((x) => x.status === 'suggested').length;
      return open
        ? { text: `${open} unverified`, state: 'todo' }
        : { text: 'All decided', state: 'done' };
    }
    case 'evidence': {
      if (!r.evidenceGaps.length) return { text: 'Not started', state: 'idle' };
      const open = r.evidenceGaps.filter((g) => !g.obtained).length;
      return open ? { text: `${open} open`, state: 'todo' } : { text: 'Complete', state: 'done' };
    }
    case 'capa': {
      if (!r.capas.length) return { text: 'Not started', state: 'idle' };
      const open = r.capas.filter((c) => c.status === 'Proposed').length;
      return open ? { text: `${open} to decide`, state: 'todo' } : { text: 'All decided', state: 'done' };
    }
    case 'review':
      return r.savedId
        ? { text: r.savedStatus === 'Draft' ? 'Draft saved' : 'Submitted', state: 'done' }
        : { text: 'Not saved', state: hasDev ? 'todo' : 'idle' };
    default:
      return { text: '', state: 'idle' };
  }
}

export default function App() {
  const dispatch = useDispatch();
  const r = useSelector((s) => s.rca);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { dispatch(loadSavedList()); }, [dispatch]);

  const Active = TABS.find((t) => t.key === r.activeTab)?.Comp || DeviationSection;
  const dev = r.deviation;
  const hasRecord = dev.deviation_number || dev.product_name || dev.batch_number;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>RCA Assistant</h1>
            <span className="muted small">Deviation to root cause to CAPA</span>
          </div>
        </div>

        <div className="record">
          {hasRecord ? (
            <>
              {dev.deviation_number && <span className="mono rec-id">{dev.deviation_number}</span>}
              {dev.product_name && <span>{dev.product_name}</span>}
              {dev.batch_number && <span className="mono muted">Batch {dev.batch_number}</span>}
              {dev.classification && <span className={`class-chip ${dev.classification.toLowerCase()}`}>{dev.classification}</span>}
            </>
          ) : (
            <span className="muted small">No investigation open</span>
          )}
        </div>

        <div className="row">
          <button className="btn sm" onClick={() => setDrawer(true)}>Saved ({r.savedList.length})</button>
          <button className="btn sm" onClick={() => dispatch(a.newInvestigation())}>New investigation</button>
        </div>
      </header>

      <div className="layout">
        <nav className="rail" aria-label="Investigation steps">
          {TABS.map((t, i) => {
            const st = stepStatus(t.key, r);
            return (
              <button
                key={t.key}
                className={`rail-item ${st.state} ${r.activeTab === t.key ? 'on' : ''}`}
                onClick={() => dispatch(a.setActiveTab(t.key))}
                aria-current={r.activeTab === t.key ? 'step' : undefined}
              >
                <span className="rail-dot">{st.state === 'done' ? '✓' : i + 1}</span>
                <span className="rail-text">
                  <b>{t.label}</b>
                  <small>{st.text}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <main className="main">
          <Active />
          <p className="disclaimer">
            AI output is decision support only. Suggested causes and CAPA must be verified against evidence and approved by a qualified person.
          </p>
        </main>

        <AIPanel />
      </div>

      <SavedDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
