import { useDispatch, useSelector } from 'react-redux';
import { openInvestigation } from '../store/thunks';

export default function SavedDrawer({ open, onClose }) {
  const dispatch = useDispatch();
  const { savedList, savedId } = useSelector((s) => s.rca);
  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>Saved investigations</h2>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        {!savedList.length && <p className="muted">Nothing saved yet.</p>}
        {savedList.map((r) => (
          <button key={r.id} className={`saved ${r.id === savedId ? 'on' : ''}`}
            onClick={() => { dispatch(openInvestigation(r.id)); onClose(); }}>
            <b>{r.deviation_number || `#${r.id}`}</b>
            <span>{r.title || r.product_name || 'Untitled'}</span>
            <span className="muted small">
              {r.batch_number} · {r.status} · {r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
