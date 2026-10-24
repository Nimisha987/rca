import { useDispatch, useSelector } from 'react-redux';
import { a } from '../store/rcaSlice';
import { Chip, levelTone } from './Badge';

const STATUS_TONE = { suggested: 'amber', confirmed: 'green', rejected: 'grey' };

export default function RootCauseSection() {
  const dispatch = useDispatch();
  const { rootCauses, contributingFactors } = useSelector((s) => s.rca);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Root causes</h2>
          <p className="muted">
            AI-generated causes are <b>suggestions</b>. They stay "Suggested" until a qualified person confirms them against evidence.
          </p>
        </div>
        <button className="btn sm" onClick={() => dispatch(a.addRootCause())}>+ Add cause</button>
      </div>

      {!rootCauses.length && <div className="empty">Potential root causes will appear here after analysis.</div>}

      {rootCauses.map((rc) => (
        <div key={rc.id} className={`rc ${rc.status}`}>
          <div className="row between">
            <div className="row">
              <b>{rc.id}</b>
              <Chip>{rc.category}</Chip>
              <Chip tone={levelTone(rc.confidence)}>{rc.confidence} confidence</Chip>
              <Chip tone={STATUS_TONE[rc.status]}>{rc.status === 'suggested' ? 'Suggested - unverified' : rc.status}</Chip>
            </div>
            <div className="row">
              <button className="btn sm ok" onClick={() => dispatch(a.setRootCause({ id: rc.id, patch: { status: 'confirmed' } }))}>Confirm</button>
              <button className="btn sm danger" onClick={() => dispatch(a.setRootCause({ id: rc.id, patch: { status: 'rejected' } }))}>Reject</button>
              {rc.status !== 'suggested' && (
                <button className="btn sm ghost" onClick={() => dispatch(a.setRootCause({ id: rc.id, patch: { status: 'suggested' } }))}>Reset</button>
              )}
            </div>
          </div>
          <textarea rows={2} className="input" value={rc.statement}
            onChange={(e) => dispatch(a.setRootCause({ id: rc.id, patch: { statement: e.target.value } }))} />
          {!!rc.supporting_evidence?.length && (
            <div>
              <span className="label">Supporting evidence from document</span>
              <ul className="plain">{rc.supporting_evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <p className="muted small"><b>Why this confidence:</b> {rc.confidence_reason}</p>
        </div>
      ))}

      {!!contributingFactors.length && (
        <>
          <h3>Contributing factors</h3>
          {contributingFactors.map((cf, i) => (
            <div key={i} className="row">
              <Chip>{cf.category}</Chip>
              <input className="input slim" value={cf.statement}
                onChange={(e) => dispatch(a.setContributing({ index: i, value: e.target.value }))} />
              <button className="btn ghost sm" onClick={() => dispatch(a.removeContributing(i))}>✕</button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
