import { useDispatch, useSelector } from 'react-redux';
import { a } from '../store/rcaSlice';
import { saveInvestigation } from '../store/thunks';

export default function ReviewSave() {
  const dispatch = useDispatch();
  const r = useSelector((s) => s.rca);
  const { deviation, rootCauses, evidenceGaps, capas, fieldMeta, reviewedBy, saveState, savedId, savedStatus } = r;

  const unconfirmedFields = Object.keys(fieldMeta).filter((k) => fieldMeta[k] === 'ai').length;
  const suggested = rootCauses.filter((x) => x.status === 'suggested').length;
  const confirmed = rootCauses.filter((x) => x.status === 'confirmed').length;
  const openGaps = evidenceGaps.filter((g) => !g.obtained).length;
  const proposedCapa = capas.filter((c) => c.status === 'Proposed').length;
  const canSave = !!(deviation.deviation_number || deviation.title || deviation.description) && !saveState.busy;

  const warnings = [];
  if (unconfirmedFields) warnings.push(`${unconfirmedFields} deviation field(s) are still unreviewed AI suggestions.`);
  if (suggested) warnings.push(`${suggested} root cause(s) are unverified suggestions; they will be saved as "suggested".`);
  if (openGaps) warnings.push(`${openGaps} evidence item(s) are still outstanding.`);
  if (!reviewedBy.trim()) warnings.push('No reviewer named. Add the qualified person who reviewed this investigation.');

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Review &amp; save</h2>
          <p className="muted">Check the summary, name the reviewer, then save to the database.</p>
        </div>
        {savedId && <span className="chip green">Record #{savedId}: {savedStatus}</span>}
      </div>

      <div className="stats">
        <div><b>{confirmed}/{rootCauses.length}</b><span>root causes confirmed</span></div>
        <div><b>{openGaps}</b><span>evidence items open</span></div>
        <div><b>{proposedCapa}/{capas.length}</b><span>CAPA awaiting decision</span></div>
      </div>

      {!!warnings.length && (
        <ul className="warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}

      <label className="field">
        <span className="label">Reviewed by (qualified person: name and role)</span>
        <input className="input" value={reviewedBy} placeholder="e.g. Sunita Rao, QA Manager"
          onChange={(e) => dispatch(a.setReviewedBy(e.target.value))} />
      </label>

      <div className="row">
        <button className="btn" disabled={!canSave} onClick={() => dispatch(saveInvestigation('Draft'))}>Save draft</button>
        <button className="btn primary" disabled={!canSave} onClick={() => dispatch(saveInvestigation('Submitted for QA review'))}>
          Save &amp; submit for QA review
        </button>
        {saveState.message && <span className={saveState.error ? 'err' : 'ok-text'}>{saveState.message}</span>}
      </div>
    </section>
  );
}
