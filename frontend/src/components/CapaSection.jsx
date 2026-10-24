import { useDispatch, useSelector } from 'react-redux';
import { a } from '../store/rcaSlice';
import { Chip } from './Badge';

export default function CapaSection() {
  const dispatch = useDispatch();
  const capas = useSelector((s) => s.rca.capas);
  const set = (index, patch) => dispatch(a.setCapa({ index, patch }));

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>CAPA recommendations</h2>
          <p className="muted">Corrective and preventive actions proposed for QA approval. Edit, accept or reject each one.</p>
        </div>
        <button className="btn sm" onClick={() => dispatch(a.addCapa())}>+ Add CAPA</button>
      </div>

      {!capas.length && <div className="empty">CAPA recommendations will appear here after analysis.</div>}

      {capas.map((c, i) => (
        <div key={i} className={`capa ${c.status.toLowerCase()}`}>
          <div className="row between">
            <div className="row">
              <b>{c.id}</b>
              <select className="input slim fit" value={c.type} onChange={(e) => set(i, { type: e.target.value })}>
                <option>Corrective</option>
                <option>Preventive</option>
              </select>
              {c.linked_cause_ids?.map((id) => <Chip key={id}>{id}</Chip>)}
            </div>
            <div className="row">
              <select className="input slim fit" value={c.status} onChange={(e) => set(i, { status: e.target.value })}>
                <option>Proposed</option>
                <option>Accepted</option>
                <option>Rejected</option>
              </select>
              <button className="btn ghost sm" onClick={() => dispatch(a.removeCapa(i))}>✕</button>
            </div>
          </div>

          <label className="field">
            <span className="label">Action</span>
            <textarea rows={2} className="input" value={c.action} onChange={(e) => set(i, { action: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Why (AI explanation)</span>
            <textarea rows={2} className="input" value={c.rationale} onChange={(e) => set(i, { rationale: e.target.value })} />
          </label>
          <div className="grid3">
            <label className="field">
              <span className="label">Owner (role)</span>
              <input className="input" value={c.owner_role} onChange={(e) => set(i, { owner_role: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Target (days)</span>
              <input className="input" type="number" min="0" value={c.target_days}
                onChange={(e) => set(i, { target_days: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Effectiveness check</span>
              <input className="input" value={c.effectiveness_check} onChange={(e) => set(i, { effectiveness_check: e.target.value })} />
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}
