"""Pydantic request/response DTOs."""

from pydantic import BaseModel, Field


class QuerySlotRequest(BaseModel):
    mode: str
    token_budget: int = Field(4000, ge=1000, le=32000)
    top_k: int = Field(30, ge=1, le=500)
    label: str | None = None


class QueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    modes: list[str] = ["haiku_neuron"]
    token_budget: int | None = Field(None, ge=1000, le=32000)
    slots_v2: list[QuerySlotRequest] | None = None


class SlotResult(BaseModel):
    mode: str
    model: str
    neurons: bool
    response: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    token_budget: int | None = None
    top_k: int | None = None
    label: str | None = None


class NeuronScoreResponse(BaseModel):
    neuron_id: int
    combined: float
    burst: float
    impact: float
    precision: float
    novelty: float
    recency: float
    relevance: float
    spread_boost: float = 0


class QueryResponse(BaseModel):
    query_id: int
    intent: str | None = None
    departments: list[str] = []
    role_keys: list[str] = []
    keywords: list[str] = []
    neurons_activated: int = 0
    neuron_scores: list[NeuronScoreResponse] = []
    classify_cost: float = 0
    classify_input_tokens: int = 0
    classify_output_tokens: int = 0
    slots: list[SlotResult] = []
    total_cost: float = 0


class EvalRequest(BaseModel):
    model: str = Field("haiku", pattern="^(haiku|sonnet|opus)$")


class EvalScoreOut(BaseModel):
    answer_label: str
    answer_mode: str
    accuracy: int
    completeness: int
    clarity: int
    faithfulness: int
    overall: int


class EvalResponse(BaseModel):
    query_id: int
    eval_text: str
    eval_model: str
    eval_input_tokens: int
    eval_output_tokens: int
    scores: list[EvalScoreOut] = []
    winner: str | None = None


class EvalScoreSummary(BaseModel):
    id: int
    query_id: int
    eval_model: str
    answer_mode: str
    answer_label: str
    accuracy: int
    completeness: int
    clarity: int
    faithfulness: int
    overall: int
    created_at: str | None


class RatingRequest(BaseModel):
    utility: float = Field(..., ge=0.0, le=1.0)


class RatingResponse(BaseModel):
    query_id: int
    utility: float
    neurons_updated: int


class NeuronDetail(BaseModel):
    id: int
    parent_id: int | None
    layer: int
    node_type: str
    label: str
    content: str | None
    summary: str | None
    department: str | None
    role_key: str | None
    invocations: int
    avg_utility: float
    is_active: bool
    cross_ref_departments: list[str] | None = None
    standard_date: str | None = None


class NeuronScoreDetail(BaseModel):
    neuron_id: int
    burst: float
    impact: float
    precision: float
    novelty: float
    recency: float
    relevance: float
    combined: float


class SeedResponse(BaseModel):
    status: str
    neuron_count: int


class ResetResponse(BaseModel):
    status: str


class CostReportResponse(BaseModel):
    total_queries: int
    total_cost_usd: float
    avg_cost_per_query: float
    total_input_tokens: int
    total_output_tokens: int


class QuerySummary(BaseModel):
    id: int
    user_message: str
    classified_intent: str | None
    modes: list[str] = []
    cost_usd: float | None
    user_rating: float | None
    created_at: str | None


class NeuronHit(BaseModel):
    neuron_id: int
    label: str
    layer: int
    department: str | None
    combined: float
    burst: float
    impact: float
    precision: float
    novelty: float
    recency: float
    relevance: float
    spread_boost: float = 0


class QueryDetail(BaseModel):
    id: int
    user_message: str
    classified_intent: str | None
    departments: list[str]
    role_keys: list[str]
    keywords: list[str]
    assembled_prompt: str | None
    classify_input_tokens: int
    classify_output_tokens: int
    classify_cost: float = 0
    slots: list[SlotResult] = []
    total_cost: float = 0
    user_rating: float | None
    eval_text: str | None = None
    eval_model: str | None = None
    eval_input_tokens: int = 0
    eval_output_tokens: int = 0
    eval_scores: list[EvalScoreOut] = []
    eval_winner: str | None = None
    neuron_hits: list[NeuronHit]
    created_at: str | None


class RefineRequest(BaseModel):
    model: str = Field("haiku", pattern="^(haiku|sonnet)$")
    user_context: str | None = Field(None, max_length=4000)


class NeuronUpdateSuggestion(BaseModel):
    neuron_id: int
    field: str  # content, summary, label, is_active
    old_value: str
    new_value: str
    reason: str


class NewNeuronSuggestion(BaseModel):
    parent_id: int | None = None
    layer: int
    node_type: str
    label: str
    content: str
    summary: str
    department: str | None = None
    role_key: str | None = None
    reason: str


class RefineResponse(BaseModel):
    query_id: int
    model: str
    input_tokens: int
    output_tokens: int
    reasoning: str
    updates: list[NeuronUpdateSuggestion] = []
    new_neurons: list[NewNeuronSuggestion] = []


class ApplyRefineRequest(BaseModel):
    update_ids: list[int] = []
    new_neuron_ids: list[int] = []


class ApplyRefineResponse(BaseModel):
    updated: int
    created: int


class NeuronRefinementOut(BaseModel):
    id: int
    query_id: int | None = None
    neuron_id: int
    action: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    reason: str | None = None
    created_at: str | None = None
    neuron_label: str | None = None
    query_snippet: str | None = None


class BolsterRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    model: str = Field("haiku", pattern="^(haiku|sonnet|opus)$")
    department: str | None = None
    role_key: str | None = None


class BolsterResponse(BaseModel):
    session_id: str
    model: str
    input_tokens: int
    output_tokens: int
    neurons_scanned: int
    reasoning: str
    updates: list[NeuronUpdateSuggestion] = []
    new_neurons: list[NewNeuronSuggestion] = []


class ApplyBolsterRequest(BaseModel):
    session_id: str
    update_ids: list[int] = []
    new_neuron_ids: list[int] = []


class CheckpointResponse(BaseModel):
    status: str
    filename: str
    neuron_count: int
    commit_sha: str


class HealthResponse(BaseModel):
    status: str
    neuron_count: int
    total_queries: int


class AutopilotConfigOut(BaseModel):
    enabled: bool
    directive: str
    interval_minutes: int
    focus_neuron_id: int | None = None
    focus_neuron_label: str | None = None
    max_layer: int = 5
    eval_model: str = "haiku"
    last_tick_at: str | None = None


class AutopilotConfigUpdate(BaseModel):
    enabled: bool | None = None
    directive: str | None = None
    interval_minutes: int | None = None
    focus_neuron_id: int | None = Field(None, description="Neuron ID to focus on (L0-L5). Set to 0 to clear.")
    max_layer: int | None = Field(None, ge=0, le=5, description="Max layer depth for new neuron creation (0-5)")
    eval_model: str | None = Field(None, pattern="^(haiku|sonnet|opus)$")


class AutopilotRunOut(BaseModel):
    id: int
    query_id: int | None = None
    generated_query: str
    directive: str
    focus_neuron_label: str | None = None
    neurons_activated: int
    updates_applied: int
    neurons_created: int
    eval_overall: int
    eval_text: str | None = None
    refine_reasoning: str | None = None
    cost_usd: float
    status: str
    error_message: str | None = None
    created_at: str | None = None


class AutopilotTickResponse(BaseModel):
    status: str
    run_id: int | None = None
    message: str | None = None
