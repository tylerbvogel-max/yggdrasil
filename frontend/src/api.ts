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

export function submitQuery(message: string, modes: string[]): Promise<QueryResponse> {
  return json<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, modes }),
  });
}

export function evaluateQuery(queryId: number, model: 'haiku' | 'sonnet'): Promise<EvalResponse> {
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

export function refineQuery(queryId: number, model: 'haiku' | 'sonnet'): Promise<RefineResponse> {
  return json<RefineResponse>(`/query/${queryId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
}

export function applyRefinements(queryId: number, updateIds: number[], newNeuronIds: number[]): Promise<ApplyRefineResponse> {
  return json<ApplyRefineResponse>(`/query/${queryId}/refine/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_ids: updateIds, new_neuron_ids: newNeuronIds }),
  });
}

export function fetchRefinementHistory(): Promise<NeuronRefinementEntry[]> {
  return json<NeuronRefinementEntry[]>('/neurons/refinements');
}
