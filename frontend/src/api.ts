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

export function fetchTree(department?: string, maxDepth?: number): Promise<TreeNode[]> {
  const parts: string[] = [];
  if (department) parts.push(`department=${encodeURIComponent(department)}`);
  if (maxDepth != null) parts.push(`max_depth=${maxDepth}`);
  const params = parts.length ? `?${parts.join('&')}` : '';
  return json<TreeNode[]>(`/neurons/tree${params}`);
}

export interface ChildNode {
  id: number;
  layer: number;
  node_type: string;
  label: string;
  department: string | null;
  role_key: string | null;
  invocations: number;
  avg_utility: number;
  parent_id: number | null;
  child_count: number;
}

export function fetchChildren(parentId: number | null, limit = 200): Promise<ChildNode[]> {
  const params = parentId != null ? `?parent_id=${parentId}&limit=${limit}` : `?limit=${limit}`;
  return json<ChildNode[]>(`/neurons/children${params}`);
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

export interface SignalStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  count: number;
}

export interface SignalHealth {
  baseline: SignalStats;
  recent: SignalStats;
  baseline_query_means: SignalStats;
  recent_query_means: SignalStats;
  z_score: number;
  drifted: boolean;
}

export interface DriftAlert {
  signal: string;
  direction: string;
  z_score: number;
  baseline_mean: number;
  recent_mean: number;
  message: string;
}

export interface ScoringHealthResponse {
  status: string;
  queries_analyzed: number;
  queries_available?: number;
  baseline_window: number;
  recent_window: number;
  can_detect_drift: boolean;
  drift_threshold: number;
  signals: Record<string, SignalHealth>;
  drift_alerts: DriftAlert[];
  per_query_timeline: Record<string, number | string | null>[];
}

export function fetchScoringHealth(): Promise<ScoringHealthResponse> {
  return json<ScoringHealthResponse>('/admin/scoring-health');
}

// ── Health Check & Alerts ──

export interface SystemAlertOut {
  id: number;
  type: string;
  severity: string;
  signal: string | null;
  message: string;
  detail?: Record<string, unknown> | null;
  acknowledged: boolean;
  created_at: string | null;
}

export interface HealthCheckResponse {
  status: string;
  circuit_breaker_tripped: boolean;
  reasons: string[];
  avg_eval_overall: number | null;
  avg_user_rating: number | null;
  eval_count: number;
  rating_count: number;
  model_versions: string[];
  model_version_changed: boolean;
  drift_alerts_count: number;
  active_alerts: SystemAlertOut[];
  new_alerts: { type: string; signal?: string; message: string }[];
  thresholds: Record<string, number>;
}

export function fetchHealthCheck(): Promise<HealthCheckResponse> {
  return json<HealthCheckResponse>('/admin/health-check');
}

export function fetchAlerts(includeAcknowledged = false): Promise<SystemAlertOut[]> {
  const params = includeAcknowledged ? '?include_acknowledged=true' : '';
  return json<SystemAlertOut[]>(`/admin/alerts${params}`);
}

export function acknowledgeAlert(alertId: number): Promise<{ status: string }> {
  return json<{ status: string }>(`/admin/alerts/${alertId}/acknowledge`, { method: 'POST' });
}

export function acknowledgeAllAlerts(): Promise<{ status: string; count: number }> {
  return json<{ status: string; count: number }>('/admin/alerts/acknowledge-all', { method: 'POST' });
}

// ── Compliance Audit ──

export interface PiiScanResult {
  findings: { neuron_id: number; neuron_label: string; department: string | null; field: string; pii_type: string; match_count: number; excerpt: string }[];
  total_findings: number;
  neurons_with_pii: number;
  clean: boolean;
}

export interface DeptCoverage {
  department: string;
  neuron_count: number;
  pct_of_total: number;
  total_invocations: number;
  avg_utility: number;
}

export interface EvalDisaggregation {
  mode: string;
  count: number;
  avg_accuracy: number;
  avg_completeness: number;
  avg_clarity: number;
  avg_faithfulness: number;
  avg_overall: number;
}

export interface SignalBaseline {
  count: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface ComplianceAuditResponse {
  total_neurons: number;
  pii_scan: PiiScanResult;
  bias_assessment: {
    department_coverage: DeptCoverage[];
    department_count: number;
    coverage_cv: number;
    coverage_imbalanced: boolean;
    layer_distribution: Record<string, number>;
    eval_disaggregation: EvalDisaggregation[];
  };
  scoring_baselines: {
    queries_analyzed: number;
    signals: Record<string, SignalBaseline>;
    metric_rationale: Record<string, string>;
  };
  provenance_audit: {
    source_type_distribution: Record<string, number>;
    missing_citations: { neuron_id: number; label: string; department: string | null; source_type: string }[];
    missing_citations_count: number;
    missing_source_urls: { neuron_id: number; label: string; department: string | null; source_type: string }[];
    missing_source_urls_count: number;
    stale_neurons: { neuron_id: number; label: string; department: string | null; source_type: string; last_verified: string; days_since_verified: number }[];
    stale_neurons_count: number;
  };
}

export function fetchComplianceAudit(): Promise<ComplianceAuditResponse> {
  return json<ComplianceAuditResponse>('/admin/compliance-audit');
}

// ── Governance Dashboard ──

export interface GovernanceDashboardResponse {
  totals: {
    neurons: number;
    queries: number;
    evaluations: number;
    refinements: number;
    departments: number;
    rated_queries: number;
  };
  kpis: {
    avg_eval_overall: number | null;
    avg_faithfulness: number | null;
    avg_user_rating: number | null;
    avg_cost_per_query: number;
    total_cost_usd: number;
    cost_per_1m_tokens: number | null;
    run_cost_per_1m: number | null;
    zero_hit_pct: number;
    parity_index: number | null;
    value_score: number | null;
    avg_opus_eval: number | null;
    avg_neuron_eval: number | null;
    opus_cost_per_1m: number | null;
  };
  change_activity: {
    refinements_30d: number;
    autopilot_runs_30d: number;
    recent_changes: {
      id: number;
      action: string;
      field: string | null;
      reason: string;
      neuron_id: number;
      created_at: string | null;
    }[];
  };
  active_alerts: number;
}

export function fetchGovernanceDashboard(): Promise<GovernanceDashboardResponse> {
  return json<GovernanceDashboardResponse>('/admin/governance-dashboard');
}
