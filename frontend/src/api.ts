import type {
  TreeNode,
  NeuronDetail,
  NeuronScores,
  NeuronStats,
  CostReport,
  QueryResponse,
  QuerySummary,
  QueryDetail,
  EvalResponse,
  RatingResponse,
  RefineResponse,
  ApplyRefineResponse,
  NeuronRefinementEntry,
  AutopilotConfig,
  AutopilotRun,
  AutopilotTickResponse,
  AutopilotChange,
  DeptChordEntry,
  EgoGraphResponse,
  SpreadTrailResponse,
} from './types';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchTree(department?: string): Promise<TreeNode[]> {
  const params = department ? `?department=${encodeURIComponent(department)}` : '';
  return json<TreeNode[]>(`/neurons/tree${params}`);
}

export function fetchNeuron(id: number): Promise<NeuronDetail> {
  return json<NeuronDetail>(`/neurons/${id}`);
}

export function fetchScores(id: number): Promise<NeuronScores> {
  return json<NeuronScores>(`/neurons/${id}/scores`);
}

export function fetchStats(): Promise<NeuronStats> {
  return json<NeuronStats>('/neurons/stats');
}

export function fetchCostReport(): Promise<CostReport> {
  return json<CostReport>('/admin/cost-report');
}

export function fetchQueryHistory(): Promise<QuerySummary[]> {
  return json<QuerySummary[]>('/queries');
}

export function fetchQueryDetail(id: number): Promise<QueryDetail> {
  return json<QueryDetail>(`/queries/${id}`);
}

export function fetchQueryRunCounts(texts: string[]): Promise<Record<string, number>> {
  return json<Record<string, number>>('/queries/run-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(texts),
  });
}

export interface SlotSpec {
  mode: string;
  token_budget: number;
  top_k: number;
  label?: string;
}

export interface GraphCapacity {
  active_neurons: number;
  total_content_tokens: number;
  total_summary_tokens: number;
  total_tokens: number;
}

export function fetchGraphCapacity(): Promise<GraphCapacity> {
  return json<GraphCapacity>('/neurons/capacity');
}

export function submitQuery(message: string, slots: SlotSpec[]): Promise<QueryResponse> {
  return json<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, slots_v2: slots }),
  });
}

export function evaluateQuery(queryId: number, model: 'haiku' | 'sonnet' | 'opus'): Promise<EvalResponse> {
  return json<EvalResponse>(`/query/${queryId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
}

export function submitRating(queryId: number, utility: number): Promise<RatingResponse> {
  return json<RatingResponse>(`/query/${queryId}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utility }),
  });
}

export function refineQuery(queryId: number, model: 'haiku' | 'sonnet' | 'opus', maxTokens: number = 4096, userContext?: string): Promise<RefineResponse> {
  const body: Record<string, string | number> = { model, max_tokens: maxTokens };
  if (userContext?.trim()) body.user_context = userContext.trim();
  return json<RefineResponse>(`/query/${queryId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function applyRefinements(queryId: number, updateIds: number[], newNeuronIds: number[]): Promise<ApplyRefineResponse> {
  return json<ApplyRefineResponse>(`/query/${queryId}/refine/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_ids: updateIds, new_neuron_ids: newNeuronIds }),
  });
}

export function fetchDeptChord(layer = 1, minWeight = 0.15): Promise<DeptChordEntry[]> {
  return json<DeptChordEntry[]>(`/neurons/edges/department-chord?layer=${layer}&min_weight=${minWeight}`);
}

export function fetchNeuronEdges(id: number, limit = 15): Promise<EgoGraphResponse> {
  return json<EgoGraphResponse>(`/neurons/${id}/edges?limit=${limit}`);
}

export function fetchSpreadTrail(queryId: number): Promise<SpreadTrailResponse> {
  return json<SpreadTrailResponse>(`/neurons/edges/spread-trail?query_id=${queryId}`);
}

export interface SpreadLogEntry {
  query_id: number;
  user_message: string;
  created_at: string | null;
  promoted_count: number;
  avg_boost: number;
  max_boost: number;
  cross_dept: boolean;
  promoted_neurons: { neuron_id: number; label: string; department: string; boost: number }[];
}

export interface SpreadLogResponse {
  total_queries: number;
  queries_with_spread: number;
  spread_rate: number;
  entries: SpreadLogEntry[];
  top_neurons: { neuron_id: number; label: string; department: string; spread_count: number }[];
  top_corridors: { pair: string; count: number }[];
}

export function fetchSpreadLog(limit = 100): Promise<SpreadLogResponse> {
  return json<SpreadLogResponse>(`/neurons/edges/spread-log?limit=${limit}`);
}

export function fetchRefinementHistory(): Promise<NeuronRefinementEntry[]> {
  return json<NeuronRefinementEntry[]>('/neurons/refinements');
}

export interface CheckpointResponse {
  status: string;
  filename: string;
  neuron_count: number;
  commit_sha: string;
}

export function createCheckpoint(): Promise<CheckpointResponse> {
  return json<CheckpointResponse>('/admin/checkpoint', { method: 'POST' });
}

// Autopilot
export function fetchAutopilotConfig(): Promise<AutopilotConfig> {
  return json<AutopilotConfig>('/admin/autopilot/config');
}

export function updateAutopilotConfig(update: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
  return json<AutopilotConfig>('/admin/autopilot/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}

export function triggerAutopilotTick(): Promise<AutopilotTickResponse> {
  return json<AutopilotTickResponse>('/admin/autopilot/tick', { method: 'POST' });
}

export function triggerAutopilotRunNow(): Promise<AutopilotTickResponse> {
  return json<AutopilotTickResponse>('/admin/autopilot/run-now', { method: 'POST' });
}

export function fetchAutopilotRuns(): Promise<AutopilotRun[]> {
  return json<AutopilotRun[]>('/admin/autopilot/runs');
}

export function fetchAutopilotRunChanges(runId: number): Promise<AutopilotChange[]> {
  return json<AutopilotChange[]>(`/admin/autopilot/runs/${runId}/changes`);
}

export function cancelAutopilotTick(): Promise<AutopilotTickResponse> {
  return json<AutopilotTickResponse>('/admin/autopilot/cancel', { method: 'POST' });
}

export function fetchAutopilotStatus(): Promise<{ running: boolean; step: string; detail: string }> {
  return json<{ running: boolean; step: string; detail: string }>('/admin/autopilot/status');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchPerformance(): Promise<any> {
  return json<unknown>('/admin/performance');
}
