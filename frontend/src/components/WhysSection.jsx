import { useDispatch, useSelector } from 'react-redux';
import { a } from '../store/rcaSlice';
import { Chip } from './Badge';

export default function WhysSection() {
  const dispatch = useDispatch();
  const fw = useSelector((s) => s.rca.fiveWhys);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>5 Whys analysis</h2>
          <p className="muted">Each answer should lead to the next question. Steps without document evidence are hypotheses.</p>
        </div>
        <button className="btn sm" onClick={() => dispatch(a.addWhy())}>+ Add why</button>
      </div>

      {!fw || (!fw.steps.length && !fw.problem_statement) ? (
        <div className="empty">The 5 Whys chain will appear here after analysis.</div>
      ) : (
        <>
          <label className="field">
            <span className="label">Problem statement</span>
            <textarea rows={2} className="input" value={fw.problem_statement}
              onChange={(e) => dispatch(a.setProblemStatement(e.target.value))} />
          </label>

          <ol className="whys">
            {fw.steps.map((st, i) => (
              <li key={i} className="why">
                <div className="why-n">{i + 1}</div>
                <div className="why-body">
                  <input className="input why-q" value={st.question}
                    onChange={(e) => dispatch(a.setWhy({ index: i, field: 'question', value: e.target.value }))} />
                  <textarea rows={2} className="input" value={st.answer}
                    onChange={(e) => dispatch(a.setWhy({ index: i, field: 'answer', value: e.target.value }))} />
                  <div className="row">
                    <Chip tone={st.supported ? 'green' : 'amber'}>{st.supported ? 'Evidence in document' : 'Hypothesis'}</Chip>
                    <input className="input slim" value={st.evidence} placeholder="Evidence / source"
                      onChange={(e) => dispatch(a.setWhy({ index: i, field: 'evidence', value: e.target.value }))} />
                    <button className="btn ghost sm" onClick={() => dispatch(a.removeWhy(i))} title="Remove">✕</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <label className="field">
            <span className="label">Chain conclusion (suggested)</span>
            <textarea rows={2} className="input" value={fw.conclusion}
              onChange={(e) => dispatch(a.setWhyConclusion(e.target.value))} />
          </label>
        </>
      )}
    </section>
  );
}
