export interface TreeNode {
  id: number;
  layer: number;
  node_type: string;
  label: string;
  department: string | null;
  role_key: string | null;
  invocations: number;
  avg_utility: number;
  children: TreeNode[];
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
}

export interface NeuronScores {
  neuron_id: number;
  burst: number;
  impact: number;
  practice: number;
  novelty: number;
  recency: number;
  combined: number;
}

export interface NeuronStats {
  total_neurons: number;
  by_layer: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
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
}

export interface NeuronScoreResponse {
  neuron_id: number;
  combined: number;
  burst: number;
  impact: number;
  practice: number;
  novelty: number;
  recency: number;
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
  practice: number;
  novelty: number;
  recency: number;
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
