import { useDispatch, useSelector } from 'react-redux';
import { DEVIATION_FIELDS, a } from '../store/rcaSlice';
import Badge from './Badge';

export default function DeviationSection() {
  const dispatch = useDispatch();
  const { deviation, fieldMeta, missingFields, analysis } = useSelector((s) => s.rca);
  const hasData = Object.values(deviation).some((v) => String(v).trim());
  const unconfirmed = Object.keys(fieldMeta).filter((k) => fieldMeta[k] !== 'confirmed').length;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Deviation details</h2>
          <p className="muted">
            Filled by the AI panel from your document. Review every field; edited or confirmed fields lose the AI tag.
          </p>
        </div>
        <button className="btn sm" disabled={!hasData || !unconfirmed} onClick={() => dispatch(a.confirmDeviation())}>
          Confirm all ({unconfirmed})
        </button>
      </div>

      {!hasData && analysis.status !== 'running' && (
        <div className="empty">Paste or upload an incident document in the AI panel and click <b>Extract &amp; Analyze</b>.</div>
      )}

      <div className="grid2">
        {DEVIATION_FIELDS.map((f) => {
          const value = deviation[f.key] ?? '';
          const kind = fieldMeta[f.key] || (hasData && missingFields.includes(f.key) && !String(value).trim() ? 'missing' : null);
          const common = {
            value,
            onChange: (e) => dispatch(a.setDeviationField({ key: f.key, value: e.target.value })),
            className: kind === 'missing' ? 'input warn' : 'input',
          };
          return (
            <label key={f.key} className={`field ${f.wide ? 'wide' : ''}`}>
              <span className="label">{f.label} <Badge kind={kind} /></span>
              {f.type === 'textarea' ? (
                <textarea rows={f.wide ? 4 : 3} {...common} />
              ) : f.type === 'select' ? (
                <select {...common}>
                  {f.options.map((o) => <option key={o} value={o}>{o || 'Select...'}</option>)}
                </select>
              ) : (
                <input type="text" {...common} />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
