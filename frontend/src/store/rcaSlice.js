import { createSlice, current } from '@reduxjs/toolkit';

// ---- Static config shared by the UI ----

// Pipeline stages = LangGraph nodes on the backend. `needs` drives the progress UI.
export const STAGES = [
  { key: 'extract_deviation', label: 'Extract deviation details', needs: [] },
  { key: 'five_whys', label: '5 Whys analysis', needs: ['extract_deviation'] },
  { key: 'fishbone', label: 'Fishbone (6M) analysis', needs: ['extract_deviation'] },
  { key: 'rank_root_causes', label: 'Identify root causes', needs: ['five_whys', 'fishbone'] },
  { key: 'evidence_gaps', label: 'Find missing evidence', needs: ['rank_root_causes'] },
  { key: 'capa', label: 'Recommend CAPA', needs: ['evidence_gaps'] },
];

export const DEVIATION_FIELDS = [
  { key: 'deviation_number', label: 'Deviation No.', type: 'text' },
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'product_name', label: 'Product (API)', type: 'text' },
  { key: 'batch_number', label: 'Batch No.', type: 'text' },
  { key: 'process_stage', label: 'Process stage', type: 'text' },
  { key: 'equipment_id', label: 'Equipment ID', type: 'text' },
  { key: 'department', label: 'Department / area', type: 'text' },
  { key: 'date_occurred', label: 'Date occurred', type: 'text' },
  { key: 'date_detected', label: 'Date detected', type: 'text' },
  { key: 'reported_by', label: 'Reported by', type: 'text' },
  { key: 'classification', label: 'Classification', type: 'select', options: ['', 'Minor', 'Major', 'Critical'] },
  { key: 'classification_rationale', label: 'Classification rationale', type: 'textarea' },
  { key: 'description', label: 'Description of event', type: 'textarea', wide: true },
  { key: 'immediate_action', label: 'Immediate action / containment', type: 'textarea', wide: true },
  { key: 'impact_assessment', label: 'Impact assessment', type: 'textarea', wide: true },
  { key: 'affected_batches', label: 'Other potentially affected batches', type: 'text', wide: true },
];

export const FISHBONE_CATS = [
  { key: 'man', label: 'Man' },
  { key: 'machine', label: 'Machine' },
  { key: 'method', label: 'Method' },
  { key: 'material', label: 'Material' },
  { key: 'measurement', label: 'Measurement' },
  { key: 'environment', label: 'Environment' },
];

const emptyDeviation = Object.fromEntries(DEVIATION_FIELDS.map((f) => [f.key, '']));
const emptyFishbone = Object.fromEntries(FISHBONE_CATS.map((c) => [c.key, []]));
const noneDone = Object.fromEntries(STAGES.map((s) => [s.key, false]));
const allDone = Object.fromEntries(STAGES.map((s) => [s.key, true]));

const initialState = {
  sourceText: '',
  sourceMeta: null, // { filename, source_type, warnings }
  analysis: { status: 'idle', done: { ...noneDone }, error: null }, // idle | running | done | error
  deviation: { ...emptyDeviation },
  fieldMeta: {}, // field -> 'ai' | 'edited' | 'confirmed'
  missingFields: [],
  fiveWhys: null,
  fishbone: { ...emptyFishbone },
  rootCauses: [],
  contributingFactors: [],
  evidenceGaps: [],
  capas: [],
  aiSnapshot: null,
  reviewedBy: '',
  savedId: null,
  savedStatus: null,
  saveState: { busy: false, message: '', error: false },
  savedList: [],
  chat: [],
  chatBusy: false,
  activeTab: 'deviation',
};

const slice = createSlice({
  name: 'rca',
  initialState,
  reducers: {
    // ----- intake -----
    setSourceText: (s, { payload }) => { s.sourceText = payload; },
    setSourceMeta: (s, { payload }) => { s.sourceMeta = payload; },
    setActiveTab: (s, { payload }) => { s.activeTab = payload; },

    // ----- AI pipeline -----
    analysisStarted: (s) => {
      s.analysis = { status: 'running', done: { ...noneDone }, error: null };
      s.deviation = { ...emptyDeviation };
      s.fieldMeta = {};
      s.missingFields = [];
      s.fiveWhys = null;
      s.fishbone = { ...emptyFishbone };
      s.rootCauses = [];
      s.contributingFactors = [];
      s.evidenceGaps = [];
      s.capas = [];
      s.aiSnapshot = null;
      s.activeTab = 'deviation';
    },
    applyUpdate: (s, { payload: { node, data } }) => {
      s.analysis.done[node] = true;
      if (node === 'extract_deviation') {
        s.deviation = { ...emptyDeviation, ...data.deviation };
        s.fieldMeta = Object.fromEntries(
          Object.entries(s.deviation).filter(([, v]) => String(v).trim()).map(([k]) => [k, 'ai'])
        );
        s.missingFields = data.missing_fields || [];
      } else if (node === 'five_whys') {
        s.fiveWhys = data.five_whys;
      } else if (node === 'fishbone') {
        s.fishbone = { ...emptyFishbone, ...data.fishbone };
      } else if (node === 'rank_root_causes') {
        s.rootCauses = data.root_causes.root_causes.map((rc) => ({ ...rc, status: 'suggested' }));
        s.contributingFactors = data.root_causes.contributing_factors || [];
      } else if (node === 'evidence_gaps') {
        s.evidenceGaps = data.evidence_gaps.gaps.map((g) => ({ ...g, obtained: false, note: '' }));
      } else if (node === 'capa') {
        s.capas = data.capa.capas.map((c) => ({ ...c, status: 'Proposed' }));
      }
    },
    analysisDone: (s) => {
      s.analysis.status = 'done';
      const c = current(s);
      s.aiSnapshot = JSON.parse(
        JSON.stringify({
          deviation: c.deviation,
          fiveWhys: c.fiveWhys,
          fishbone: c.fishbone,
          rootCauses: c.rootCauses,
          contributingFactors: c.contributingFactors,
          evidenceGaps: c.evidenceGaps,
          capas: c.capas,
        })
      );
    },
    analysisFailed: (s, { payload }) => {
      s.analysis.status = 'error';
      s.analysis.error = payload;
    },

    // ----- deviation form -----
    setDeviationField: (s, { payload: { key, value } }) => {
      s.deviation[key] = value;
      s.fieldMeta[key] = 'edited';
    },
    confirmDeviation: (s) => {
      Object.keys(s.deviation).forEach((k) => {
        if (String(s.deviation[k]).trim()) s.fieldMeta[k] = 'confirmed';
      });
    },

    // ----- 5 whys -----
    setProblemStatement: (s, { payload }) => { if (s.fiveWhys) s.fiveWhys.problem_statement = payload; },
    setWhy: (s, { payload: { index, field, value } }) => {
      s.fiveWhys.steps[index][field] = value;
      if (field === 'evidence') s.fiveWhys.steps[index].supported = false;
    },
    addWhy: (s) => {
      if (!s.fiveWhys) s.fiveWhys = { problem_statement: '', steps: [], conclusion: '' };
      s.fiveWhys.steps.push({ question: 'Why?', answer: '', evidence: '', supported: false });
    },
    removeWhy: (s, { payload }) => { s.fiveWhys.steps.splice(payload, 1); },
    setWhyConclusion: (s, { payload }) => { if (s.fiveWhys) s.fiveWhys.conclusion = payload; },

    // ----- fishbone -----
    setFactor: (s, { payload: { cat, index, patch } }) => { Object.assign(s.fishbone[cat][index], patch); },
    addFactor: (s, { payload }) => {
      s.fishbone[payload].push({ factor: '', rationale: '', evidence_status: 'hypothesis' });
    },
    removeFactor: (s, { payload: { cat, index } }) => { s.fishbone[cat].splice(index, 1); },

    // ----- root causes -----
    setRootCause: (s, { payload: { id, patch } }) => {
      const rc = s.rootCauses.find((r) => r.id === id);
      if (rc) Object.assign(rc, patch);
    },
    addRootCause: (s) => {
      const n = s.rootCauses.length + 1;
      s.rootCauses.push({
        id: `RC${n}`, statement: '', category: 'Method', supporting_evidence: [],
        confidence: 'Low', confidence_reason: 'Added by user', status: 'suggested',
      });
    },
    setContributing: (s, { payload: { index, value } }) => { s.contributingFactors[index].statement = value; },
    removeContributing: (s, { payload }) => { s.contributingFactors.splice(payload, 1); },

    // ----- evidence gaps & CAPA -----
    setGap: (s, { payload: { index, patch } }) => { Object.assign(s.evidenceGaps[index], patch); },
    setCapa: (s, { payload: { index, patch } }) => { Object.assign(s.capas[index], patch); },
    addCapa: (s) => {
      s.capas.push({
        id: `CAPA-${s.capas.length + 1}`, type: 'Corrective', action: '', rationale: '',
        linked_cause_ids: [], owner_role: '', target_days: 30, effectiveness_check: '', status: 'Proposed',
      });
    },
    removeCapa: (s, { payload }) => { s.capas.splice(payload, 1); },

    // ----- review & save -----
    setReviewedBy: (s, { payload }) => { s.reviewedBy = payload; },
    setSaveState: (s, { payload }) => { s.saveState = { busy: false, message: '', error: false, ...payload }; },
    setSaved: (s, { payload: { id, status } }) => { s.savedId = id; s.savedStatus = status; },
    setSavedList: (s, { payload }) => { s.savedList = payload; },
    hydrate: (s, { payload: rec }) => {
      const d = rec.data || {};
      s.sourceText = rec.source_text || '';
      s.deviation = { ...emptyDeviation, ...(d.deviation || {}) };
      s.fieldMeta = d.fieldMeta || {};
      s.missingFields = d.missingFields || [];
      s.fiveWhys = d.fiveWhys || null;
      s.fishbone = { ...emptyFishbone, ...(d.fishbone || {}) };
      s.rootCauses = d.rootCauses || [];
      s.contributingFactors = d.contributingFactors || [];
      s.evidenceGaps = d.evidenceGaps || [];
      s.capas = d.capas || [];
      s.aiSnapshot = rec.ai_snapshot || null;
      s.reviewedBy = rec.reviewed_by || '';
      s.savedId = rec.id;
      s.savedStatus = rec.status;
      s.analysis = { status: 'done', done: { ...allDone }, error: null };
      s.chat = [];
      s.activeTab = 'deviation';
      s.saveState = { busy: false, message: '', error: false };
    },
    newInvestigation: (s) => ({ ...initialState, savedList: s.savedList }),

    // ----- chat -----
    addChat: (s, { payload }) => { s.chat.push(payload); },
    setChatBusy: (s, { payload }) => { s.chatBusy = payload; },
  },
});

export const a = slice.actions;
export default slice.reducer;
