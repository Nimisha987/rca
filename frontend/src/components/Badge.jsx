const LABELS = {
  ai: 'AI suggested',
  edited: 'Edited',
  confirmed: 'Confirmed',
  missing: 'Not found in document',
};

export default function Badge({ kind }) {
  if (!kind) return null;
  return <span className={`badge ${kind}`}>{LABELS[kind] || kind}</span>;
}

export function Chip({ tone = 'grey', children }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function levelTone(level = '') {
  const l = level.toLowerCase();
  if (l === 'high') return 'green';
  if (l === 'medium') return 'amber';
  return 'red';
}

export function priorityTone(level = '') {
  const l = level.toLowerCase();
  if (l === 'high') return 'red';
  if (l === 'medium') return 'amber';
  return 'grey';
}
