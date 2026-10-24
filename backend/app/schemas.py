"""Pydantic models. The LLM nodes return these directly (structured output),
so the shapes here are exactly what the React form binds to."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------- LLM output models ----------

class DeviationInfo(BaseModel):
    deviation_number: str = Field("", description="Deviation / incident ID exactly as written, else empty")
    title: str = Field("", description="Short title of the deviation (max ~15 words)")
    product_name: str = Field("", description="API / product name")
    batch_number: str = Field("", description="Batch / lot number")
    process_stage: str = Field("", description="Manufacturing stage, e.g. reaction, crystallisation, drying, milling")
    equipment_id: str = Field("", description="Equipment tag/ID involved")
    department: str = Field("", description="Department / area / block")
    date_occurred: str = Field("", description="When it occurred, YYYY-MM-DD if clear")
    date_detected: str = Field("", description="When it was detected, YYYY-MM-DD if clear")
    reported_by: str = Field("", description="Name and role of reporter")
    classification: str = Field("", description="Minor, Major or Critical. If not stated, propose one")
    classification_rationale: str = Field("", description="One or two sentences justifying the classification")
    description: str = Field("", description="Factual description of what happened, from the document only")
    immediate_action: str = Field("", description="Containment / immediate actions already taken")
    impact_assessment: str = Field("", description="Impact on product quality, other batches, patient safety, as stated")
    affected_batches: str = Field("", description="Other potentially affected batches, comma separated")


class WhyStep(BaseModel):
    question: str = Field(description="The 'Why' question for this level")
    answer: str = Field(description="Causal answer for this level")
    evidence: str = Field(description="Where the document supports this, or 'No supporting evidence in document - hypothesis to verify'")
    supported: bool = Field(description="True only if the document directly supports the answer")


class FiveWhys(BaseModel):
    problem_statement: str = Field(description="One-sentence problem statement")
    steps: List[WhyStep] = Field(description="3 to 5 sequential whys, each answer leads to the next question")
    conclusion: str = Field(description="Where the chain ends up (a suggested systemic cause)")


class FishboneFactor(BaseModel):
    factor: str = Field(description="Potential contributing factor, specific")
    rationale: str = Field(description="Why this could contribute, referencing the facts")
    evidence_status: str = Field(description="'documented' if the document states the fact, otherwise 'hypothesis'")


class Fishbone(BaseModel):
    man: List[FishboneFactor] = Field(default_factory=list, description="People: training, handover, workload, procedure adherence")
    machine: List[FishboneFactor] = Field(default_factory=list, description="Equipment: condition, maintenance, calibration, design")
    method: List[FishboneFactor] = Field(default_factory=list, description="Procedures: SOP/BMR clarity, process parameters")
    material: List[FishboneFactor] = Field(default_factory=list, description="Raw materials, solvents, intermediates")
    measurement: List[FishboneFactor] = Field(default_factory=list, description="Sampling, analytical methods, instruments")
    environment: List[FishboneFactor] = Field(default_factory=list, description="Facility, utilities, HVAC, humidity, temperature")


class RootCause(BaseModel):
    id: str = Field("", description="RC1, RC2, ...")
    statement: str = Field(description="Systemic root cause statement, not a restatement of the symptom")
    category: str = Field(description="One of: Man, Machine, Method, Material, Measurement, Environment")
    supporting_evidence: List[str] = Field(default_factory=list, description="Facts from the document that support it")
    confidence: str = Field(description="High, Medium or Low")
    confidence_reason: str = Field(description="Why this confidence level; what would raise it")
    status: str = Field("suggested")


class ContributingFactor(BaseModel):
    statement: str
    category: str = Field(description="Man, Machine, Method, Material, Measurement or Environment")


class RootCauseSet(BaseModel):
    root_causes: List[RootCause] = Field(description="2 to 4 potential root causes ranked most likely first")
    contributing_factors: List[ContributingFactor] = Field(default_factory=list, description="2 to 5 contributing factors")


class EvidenceGap(BaseModel):
    item: str = Field(description="Specific record/information needed")
    why_needed: str = Field(description="What it would confirm or rule out")
    where_to_find: str = Field(description="Likely source, e.g. 'FBD-203 audit trail', 'Training matrix'")
    priority: str = Field(description="High, Medium or Low")
    related_cause_ids: List[str] = Field(default_factory=list, description="Root cause ids it relates to, e.g. ['RC1']")


class EvidenceGapSet(BaseModel):
    gaps: List[EvidenceGap] = Field(description="5 to 8 missing evidence items, most important first")


class Capa(BaseModel):
    id: str = Field("", description="CAPA-1, CAPA-2, ...")
    type: str = Field(description="Corrective or Preventive")
    action: str = Field(description="Concrete, verifiable action")
    rationale: str = Field(description="1-2 sentences: why this addresses the cause")
    linked_cause_ids: List[str] = Field(default_factory=list, description="Root cause ids addressed")
    owner_role: str = Field(description="Responsible ROLE (not a person), e.g. 'Production Head'")
    target_days: int = Field(description="Suggested completion target in days from approval")
    effectiveness_check: str = Field(description="How effectiveness will be verified")


class CapaSet(BaseModel):
    capas: List[Capa] = Field(description="At most 8 CAPA recommendations")


# ---------- API models ----------

class AnalyzeRequest(BaseModel):
    text: str


class ChatRequest(BaseModel):
    message: str
    context: Dict[str, Any] = Field(default_factory=dict)
    history: List[Dict[str, str]] = Field(default_factory=list)


class InvestigationIn(BaseModel):
    source_text: str = ""
    ai_snapshot: Optional[Dict[str, Any]] = None
    data: Dict[str, Any]
    reviewed_by: str = ""
    status: str = "Draft"


class InvestigationSummary(BaseModel):
    id: int
    deviation_number: str = ""
    title: str = ""
    product_name: str = ""
    batch_number: str = ""
    classification: str = ""
    status: str = ""
    reviewed_by: str = ""
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InvestigationOut(InvestigationSummary):
    source_text: str = ""
    ai_snapshot: Optional[Dict[str, Any]] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
