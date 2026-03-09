export interface TreeNode {
  id: number;
  layer: number;
  node_type: string;
  label: string;
  department: string | null;
  role_key: string | null;
  invocations: number;
  avg_utility: number;
  children?: TreeNode[];
  child_count?: number;
}

export interface NeuronDetail {
  id: number;
  parent_id: number | null;
  layer: number;
  node_type: string;
  label: string;
  content: string | null;
  summary: string | null;
  department: string | null;
  role_key: string | null;
  invocations: number;
  avg_utility: number;
  is_active: boolean;
  cross_ref_departments: string[] | null;
  standard_date: string | null;
}

export interface NeuronScores {
  neuron_id: number;
  burst: number;
  impact: number;
  precision: number;
  novelty: number;
  recency: number;
  relevance: number;
  combined: number;
}

export interface RoleBubble {
  role: string;
  department: string;
  neuron_count: number;
  total_invocations: number;
  avg_utility: number;
}

export interface NeuronStats {
  total_neurons: number;
  by_layer: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
  by_department_roles: Record<string, Record<string, number>>;
  role_bubbles: RoleBubble[];
  total_firings: number;
}

export interface CostReport {
  total_queries: number;
  total_cost_usd: number;
  avg_cost_per_query: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface SlotResult {
  mode: string;
  model: string;
  neurons: boolean;
  response: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  token_budget: number | null;
  top_k: number | null;
  label: string | null;
}

export interface NeuronScoreResponse {
  neuron_id: number;
  combined: number;
  burst: number;
  impact: number;
  precision: number;
  novelty: number;
  recency: number;
  relevance: number;
  spread_boost: number;
  label: string | null;
  department: string | null;
  layer: number;
}

export interface InputGuardOut {
  verdict: string;
  flags: { description: string; severity: string; pattern?: string }[];
  flag_count: number;
}

export interface GroundingOut {
  grounded: boolean | null;
  confidence: number | null;
  overlap_terms?: number;
  response_terms?: number;
  ungrounded_references?: string[];
  reason: string;
}

export interface OutputCheckOut {
  mode: string | null;
  risk_flags: { category: string; description: string; excerpt: string }[];
  grounding: GroundingOut | null;
}

export interface QueryResponse {
  query_id: number;
  intent: string | null;
  departments: string[];
  role_keys: string[];
  keywords: string[];
  neurons_activated: number;
  neuron_scores: NeuronScoreResponse[];
  classify_cost: number;
  classify_input_tokens: number;
  classify_output_tokens: number;
  slots: SlotResult[];
  total_cost: number;
  input_guard?: InputGuardOut | null;
  output_checks?: OutputCheckOut[];
}

export interface QuerySummary {
  id: number;
  user_message: string;
  classified_intent: string | null;
  modes: string[];
  cost_usd: number | null;
  user_rating: number | null;
  created_at: string | null;
}

export interface NeuronHit {
  neuron_id: number;
  label: string;
  layer: number;
  department: string | null;
  combined: number;
  burst: number;
  impact: number;
  precision: number;
  novelty: number;
  recency: number;
  relevance: number;
  spread_boost: number;
}

export interface RefinementOut {
  id: number;
  neuron_id: number;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  neuron_label: string | null;
}

export interface QueryDetail {
  id: number;
  user_message: string;
  classified_intent: string | null;
  departments: string[];
  role_keys: string[];
  keywords: string[];
  assembled_prompt: string | null;
  classify_input_tokens: number;
  classify_output_tokens: number;
  classify_cost: number;
  slots: SlotResult[];
  total_cost: number;
  user_rating: number | null;
  eval_text: string | null;
  eval_model: string | null;
  eval_input_tokens: number;
  eval_output_tokens: number;
  eval_scores: EvalScoreOut[];
  eval_winner: string | null;
  neuron_hits: NeuronHit[];
  refinements: RefinementOut[];
  pending_refine: RefineResponse | null;
  created_at: string | null;
}

export interface EvalScoreOut {
  answer_label: string;
  answer_mode: string;
  accuracy: number;
  completeness: number;
  clarity: number;
  faithfulness: number;
  overall: number;
}

export interface EvalResponse {
  query_id: number;
  eval_text: string;
  eval_model: string;
  eval_input_tokens: number;
  eval_output_tokens: number;
  scores: EvalScoreOut[];
  winner: string | null;
}

export interface RatingResponse {
  query_id: number;
  utility: number;
  neurons_updated: number;
}

export interface NeuronUpdateSuggestion {
  neuron_id: number;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
}

export interface NewNeuronSuggestion {
  parent_id: number | null;
  layer: number;
  node_type: string;
  label: string;
  content: string;
  summary: string;
  department: string | null;
  role_key: string | null;
  reason: string;
}

export interface RefineResponse {
  query_id: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  reasoning: string;
  updates: NeuronUpdateSuggestion[];
  new_neurons: NewNeuronSuggestion[];
}

export interface ApplyRefineResponse {
  updated: number;
  created: number;
}

export interface AutopilotConfig {
  enabled: boolean;
  directive: string;
  interval_minutes: number;
  focus_neuron_id: number | null;
  focus_neuron_label: string | null;
  max_layer: number;
  eval_model: string;
  last_tick_at: string | null;
}

export interface AutopilotChange {
  id: number;
  neuron_id: number;
  neuron_label: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  neuron_detail?: {
    layer: number;
    node_type: string;
    department: string | null;
    role_key: string | null;
    summary: string | null;
    content: string | null;
  };
}

export interface AutopilotRun {
  id: number;
  query_id: number | null;
  generated_query: string;
  directive: string;
  focus_neuron_label: string | null;
  gap_source: string | null;
  gap_target: string | null;
  neurons_activated: number;
  updates_applied: number;
  neurons_created: number;
  eval_overall: number;
  eval_text: string | null;
  refine_reasoning: string | null;
  cost_usd: number;
  status: string;
  error_message: string | null;
  created_at: string | null;
}

export interface AutopilotTickResponse {
  status: string;
  run_id: number | null;
  message: string | null;
}

export interface DeptChordEntry {
  source_dept: string;
  target_dept: string;
  source_department?: string;
  target_department?: string;
  total_weight: number;
  edge_count: number;
}

export interface EgoNeighbor {
  id: number;
  label: string;
  department: string | null;
  layer: number;
  node_type: string;
  weight: number;
  co_fire_count: number;
  hop: number;
}

export interface EgoEdge {
  source: number;
  target: number;
  weight: number;
  co_fire_count: number;
}

export interface EgoGraphResponse {
  center: { id: number; label: string; department: string | null; layer: number };
  neighbors: EgoNeighbor[];
  edges?: EgoEdge[];
}

export interface SpreadTrailNode {
  id: number;
  label: string;
  department: string | null;
  layer: number;
  combined: number;
  spread_boost: number;
}

export interface SpreadTrailEdge {
  source_id: number;
  target_id: number;
  weight: number;
}

export interface SpreadTrailResponse {
  nodes: SpreadTrailNode[];
  edges: SpreadTrailEdge[];
}

export interface NeuronRefinementEntry {
  id: number;
  query_id: number;
  neuron_id: number;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string | null;
  neuron_label: string | null;
  query_snippet: string | null;
}
