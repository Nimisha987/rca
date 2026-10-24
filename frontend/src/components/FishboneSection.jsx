import { useDispatch, useSelector } from 'react-redux';
import { FISHBONE_CATS, a } from '../store/rcaSlice';

function Bone({ cat }) {
  const dispatch = useDispatch();
  const factors = useSelector((s) => s.rca.fishbone[cat.key]) || [];
  return (
    <div className="bone">
      <div className="bone-head">
        <b>{cat.label}</b>
        <button className="btn ghost sm" onClick={() => dispatch(a.addFactor(cat.key))}>+</button>
      </div>
      {!factors.length && <p className="muted small">No factors identified</p>}
      {factors.map((f, i) => (
        <div key={i} className="factor">
          <div className="row">
            <textarea rows={2} className="input slim" value={f.factor} placeholder="Factor"
              onChange={(e) => dispatch(a.setFactor({ cat: cat.key, index: i, patch: { factor: e.target.value } }))} />
            <button className="btn ghost sm" onClick={() => dispatch(a.removeFactor({ cat: cat.key, index: i }))}>✕</button>
          </div>
          <p className="muted small">{f.rationale}</p>
          <button
            className={`chip ${f.evidence_status === 'documented' ? 'green' : 'amber'} clickable`}
            title="Click to toggle"
            onClick={() => dispatch(a.setFactor({
              cat: cat.key, index: i,
              patch: { evidence_status: f.evidence_status === 'documented' ? 'hypothesis' : 'documented' },
            }))}
          >
            {f.evidence_status === 'documented' ? 'Documented' : 'Hypothesis'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function FishboneSection() {
  const { fiveWhys, deviation } = useSelector((s) => s.rca);
  const problem = fiveWhys?.problem_statement || deviation.title || 'Deviation';
  const top = FISHBONE_CATS.slice(0, 3);
  const bottom = FISHBONE_CATS.slice(3);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Fishbone (Ishikawa) analysis</h2>
          <p className="muted">Potential contributing factors by 6M category. Edit, add or remove factors.</p>
        </div>
      </div>
      <div className="fishbone">
        <div className="bones">{top.map((c) => <Bone key={c.key} cat={c} />)}</div>
        <div className="spine">
          <div className="spine-line" />
          <div className="spine-head">{problem}</div>
        </div>
        <div className="bones">{bottom.map((c) => <Bone key={c.key} cat={c} />)}</div>
      </div>
    </section>
  );
}
