import { useDispatch, useSelector } from 'react-redux';
import { a } from '../store/rcaSlice';
import { Chip, priorityTone } from './Badge';

export default function EvidenceSection() {
  const dispatch = useDispatch();
  const gaps = useSelector((s) => s.rca.evidenceGaps);
  const open = gaps.filter((g) => !g.obtained).length;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Missing evidence</h2>
          <p className="muted">Information still needed to confirm or rule out the suggested causes. Tick items as you obtain them.</p>
        </div>
        {!!gaps.length && <Chip tone={open ? 'amber' : 'green'}>{open} open</Chip>}
      </div>

      {!gaps.length && <div className="empty">Evidence gaps will appear here after analysis.</div>}

      {gaps.map((g, i) => (
        <div key={i} className={`gap ${g.obtained ? 'done' : ''}`}>
          <input type="checkbox" checked={g.obtained} title="Obtained"
            onChange={(e) => dispatch(a.setGap({ index: i, patch: { obtained: e.target.checked } }))} />
          <div className="gap-body">
            <div className="row">
              <b>{g.item}</b>
              <Chip tone={priorityTone(g.priority)}>{g.priority}</Chip>
              {g.related_cause_ids?.map((id) => <Chip key={id}>{id}</Chip>)}
            </div>
            <p className="muted small">{g.why_needed}</p>
            <p className="small"><b>Where to look:</b> {g.where_to_find}</p>
            <input className="input slim" placeholder="Notes / findings" value={g.note}
              onChange={(e) => dispatch(a.setGap({ index: i, patch: { note: e.target.value } }))} />
          </div>
        </div>
      ))}
    </section>
  );
}
