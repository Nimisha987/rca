"""LangGraph workflow for the RCA module.

        START
          |
   extract_deviation          (source text -> structured deviation record)
       /        \\
  five_whys    fishbone       (run in parallel, both need only the deviation)
       \\        /
   rank_root_causes           (join: root causes + contributing factors)
          |
    evidence_gaps             (what is missing to confirm / rule out causes)
          |
        capa                  (corrective & preventive recommendations)
          |
         END

Every node returns a plain dict that is merged into the shared state and is
streamed to the UI as soon as the node finishes (stream_mode="updates").
"""
import json
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .config import MODEL_EXTRACT, MODEL_REASONING
from .llm import run_structured
from .schemas import (
    CapaSet,
    DeviationInfo,
    EvidenceGapSet,
    FiveWhys,
    Fishbone,
    RootCauseSet,
)

REQUIRED_FIELDS = [
    "deviation_number", "product_name", "batch_number", "process_stage",
    "equipment_id", "date_occurred", "date_detected", "reported_by",
    "description", "immediate_action",
]

SYSTEM_BASE = """You are an expert pharmaceutical Quality Assurance investigator at an Active Pharmaceutical Ingredient (API) manufacturer (ICH Q7, EU GMP Part II, 21 CFR 211). You assist QA professionals during deviation investigations.

Rules:
- Use ONLY facts present in the provided material. Never invent batch numbers, dates, names, readings or records.
- If something is not stated, leave text fields empty rather than guessing.
- Any cause you propose is a HYPOTHESIS for a qualified person to verify, never a confirmed finding.
- Be concise and specific to API manufacturing operations."""


def _j(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1)


def _norm_classification(value: str) -> str:
    v = (value or "").strip().lower()
    for label in ("Minor", "Major", "Critical"):
        if label.lower() in v:
            return label
    return ""


class RCAState(TypedDict, total=False):
    source_text: str
    deviation: dict
    missing_fields: list
    five_whys: dict
    fishbone: dict
    root_causes: dict
    evidence_gaps: dict
    capa: dict


async def extract_deviation(state: RCAState) -> dict:
    human = (
        "Extract the deviation record from the document below. Dates as YYYY-MM-DD when unambiguous. "
        "If the classification (Minor/Major/Critical) is not stated, propose one based on potential impact on product "
        "quality and patient safety and explain it in classification_rationale.\n\n"
        f"<document>\n{state['source_text']}\n</document>"
    )
    dev = await run_structured(DeviationInfo, SYSTEM_BASE, human, model=MODEL_EXTRACT)
    data = dev.model_dump()
    data["classification"] = _norm_classification(data["classification"])
    missing = [f for f in REQUIRED_FIELDS if not str(data.get(f, "")).strip()]
    return {"deviation": data, "missing_fields": missing}


async def five_whys(state: RCAState) -> dict:
    human = (
        "Perform a 5 Whys analysis for this deviation. Each answer must logically lead to the next question. "
        "Go beyond the immediate/technical cause until you reach a process or system-level cause. "
        "Do not stop at 'human error'; ask why the system allowed it. For each step cite the supporting fact from the "
        "document, or state that no evidence exists (hypothesis).\n\n"
        f"<deviation>\n{_j(state['deviation'])}\n</deviation>\n\n"
        f"<document>\n{state['source_text']}\n</document>"
    )
    out = await run_structured(FiveWhys, SYSTEM_BASE, human, model=MODEL_REASONING)
    return {"five_whys": out.model_dump()}


async def fishbone(state: RCAState) -> dict:
    human = (
        "Build an Ishikawa (fishbone) analysis using the 6M categories: Man, Machine, Method, Material, Measurement, "
        "Environment. For each category list 0-3 specific potential contributing factors relevant to this deviation. "
        "Mark evidence_status 'documented' only if the document states the underlying fact; otherwise 'hypothesis'. "
        "Leave a category empty if nothing plausible applies.\n\n"
        f"<deviation>\n{_j(state['deviation'])}\n</deviation>\n\n"
        f"<document>\n{state['source_text']}\n</document>"
    )
    out = await run_structured(Fishbone, SYSTEM_BASE, human, model=MODEL_REASONING)
    return {"fishbone": out.model_dump()}


async def rank_root_causes(state: RCAState) -> dict:
    human = (
        "Using the 5 Whys and fishbone below, identify 2-4 POTENTIAL root causes ranked most likely first, plus 2-5 "
        "contributing factors. A root cause is a systemic/process-level cause which, if corrected, prevents recurrence; "
        "it is not a restatement of the symptom and not 'operator error' alone. Supporting evidence must be facts from "
        "the document. Calibrate confidence: High only when the document directly evidences the cause; Medium when "
        "partly evidenced; Low when it is inferred. Explain what would raise confidence. Ids: RC1, RC2, ...\n\n"
        f"<deviation>\n{_j(state['deviation'])}\n</deviation>\n\n"
        f"<five_whys>\n{_j(state['five_whys'])}\n</five_whys>\n\n"
        f"<fishbone>\n{_j(state['fishbone'])}\n</fishbone>\n\n"
        f"<document>\n{state['source_text']}\n</document>"
    )
    out = await run_structured(RootCauseSet, SYSTEM_BASE, human, model=MODEL_REASONING)
    data = out.model_dump()
    for i, rc in enumerate(data["root_causes"], start=1):
        rc["id"] = f"RC{i}"
        rc["status"] = "suggested"
    return {"root_causes": data}


async def evidence_gaps(state: RCAState) -> dict:
    human = (
        "List 5-8 pieces of evidence or information that are MISSING from the material and are needed to confirm or "
        "rule out the suggested root causes. Be specific to API manufacturing (e.g. batch manufacturing record, equipment "
        "logbook and audit trail, calibration certificates, PM records, training records for the current SOP revision, "
        "analytical raw data, similar past deviations / trend, operator interviews). Do not list information that the "
        "document already contains. Link each item to root cause ids.\n\n"
        f"<deviation>\n{_j(state['deviation'])}\n</deviation>\n\n"
        f"<root_causes>\n{_j(state['root_causes'])}\n</root_causes>\n\n"
        f"<document>\n{state['source_text']}\n</document>"
    )
    out = await run_structured(EvidenceGapSet, SYSTEM_BASE, human, model=MODEL_REASONING)
    return {"evidence_gaps": out.model_dump()}


async def capa(state: RCAState) -> dict:
    human = (
        "Recommend CAPA (max 8 total) for the suggested root causes: corrective actions to fix the current issue and "
        "preventive actions to stop recurrence, including other batches/equipment at risk. Each needs a concrete "
        "action, a 1-2 sentence rationale, an owner ROLE, a target in days, and an effectiveness check. Where a root "
        "cause confidence is Low, make the first action for it a verification step. These are recommendations for QA "
        "approval; changes to validated processes require change control.\n\n"
        f"<deviation>\n{_j(state['deviation'])}\n</deviation>\n\n"
        f"<root_causes>\n{_j(state['root_causes'])}\n</root_causes>\n\n"
        f"<evidence_gaps>\n{_j(state['evidence_gaps'])}\n</evidence_gaps>"
    )
    out = await run_structured(CapaSet, SYSTEM_BASE, human, model=MODEL_REASONING)
    data = out.model_dump()
    valid_ids = {rc["id"] for rc in state["root_causes"]["root_causes"]}
    for i, c in enumerate(data["capas"], start=1):
        c["id"] = f"CAPA-{i}"
        c["linked_cause_ids"] = [x for x in c["linked_cause_ids"] if x in valid_ids]
        c["type"] = "Preventive" if "prevent" in c["type"].lower() else "Corrective"
    return {"capa": data}


def build_graph():
    g = StateGraph(RCAState)
    g.add_node("extract_deviation", extract_deviation)
    g.add_node("five_whys", five_whys)
    g.add_node("fishbone", fishbone)
    g.add_node("rank_root_causes", rank_root_causes)
    g.add_node("evidence_gaps", evidence_gaps)
    g.add_node("capa", capa)

    g.add_edge(START, "extract_deviation")
    g.add_edge("extract_deviation", "five_whys")
    g.add_edge("extract_deviation", "fishbone")
    g.add_edge(["five_whys", "fishbone"], "rank_root_causes")  # join
    g.add_edge("rank_root_causes", "evidence_gaps")
    g.add_edge("evidence_gaps", "capa")
    g.add_edge("capa", END)
    return g.compile()


rca_graph = build_graph()
