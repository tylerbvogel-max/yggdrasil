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
  if (!res.ok) {
    try {
      const body = await res.json();
      const detail = body?.detail;
      if (detail?.message) {
        const flags = detail.flags as Array<{ description: string; severity: string; pattern?: string }>;
        if (flags?.length) {
          const reasons = flags.map((f: { description: string; pattern?: string }) =>
            f.description + (f.pattern ? ` — "${f.pattern}"` : '')).join('; ');
          throw new Error(`${detail.message}: ${reasons}`);
        }
        throw new Error(detail.message);
      }
      if (typeof detail === 'string') throw new Error(detail);
    } catch (e) {
      if (e instanceof Error && e.message !== `${res.status} ${res.statusText}`) throw e;
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }
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

export interface LayerFlowNode {
  key: string;
  layer: number;
  department: string;
  neuron_count?: number;
}

export interface LayerFlowLink {
  source: string;
  target: string;
  total_weight: number;
  edge_count: number;
}

export interface LayerFlowResponse {
  nodes: LayerFlowNode[];
  links: LayerFlowLink[];
}

export function fetchLayerFlow(minWeight = 0.15): Promise<LayerFlowResponse> {
  return json<LayerFlowResponse>(`/neurons/edges/layer-flow?min_weight=${minWeight}`);
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

export interface ConfidenceInterval {
  mean: number;
  ci_lower: number;
  ci_upper: number;
  n: number;
  stderr: number;
}

export interface CrossValidation {
  folds: number;
  n: number;
  fold_means: number[];
  fold_cv: number;
  stable: boolean;
  message: string;
}

export interface RemediationItem {
  type: string;
  severity: string;
  department: string;
  message: string;
  action: string;
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
  validity_reliability: {
    confidence_intervals: Record<string, Record<string, ConfidenceInterval>>;
    cross_validation: Record<string, CrossValidation>;
    signal_robustness: Record<string, { cv: number; robust: boolean; n: number }>;
    total_evals: number;
  };
  fairness_analysis: {
    department_eval_quality: { department: string; answer_mode: string; eval_count: number; avg_overall: number; avg_faithfulness: number }[];
    invocation_disparity_ratio: number | null;
    utility_range: number;
    coverage_cv: number;
    remediation_plan: RemediationItem[];
    remediation_count: number;
    fairness_pass: boolean;
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
    coverage_cv: number;
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

// ── Emergent Queue ──

export interface EmergentQueueEntry {
  id: number;
  citation_pattern: string;
  domain: string;
  family: string | null;
  detection_count: number;
  first_detected_at: string | null;
  last_detected_at: string | null;
  detected_in_neuron_ids: number[];
  detected_in_query_ids: number[];
  status: string;
  resolved_neuron_id: number | null;
  resolved_at: string | null;
  notes: string | null;
}

export interface EmergentQueueResponse {
  total: number;
  entries: EmergentQueueEntry[];
}

export interface ScanReferencesResponse {
  neurons_scanned: number;
  neurons_with_references: number;
  total_references_found: number;
  resolved: number;
  unresolved: number;
  new_queue_entries: number;
  existing_queue_entries_incremented: number;
  top_unresolved_families: { family: string; count: number }[];
}

export function fetchEmergentQueue(status?: string): Promise<EmergentQueueResponse> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return json<EmergentQueueResponse>(`/admin/emergent-queue${params}`);
}

export function dismissEmergentEntry(entryId: number, notes?: string): Promise<{ status: string; id: number }> {
  return json<{ status: string; id: number }>(`/admin/emergent-queue/${entryId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notes || '' }),
  });
}

export function scanReferences(): Promise<ScanReferencesResponse> {
  return json<ScanReferencesResponse>('/admin/scan-references', { method: 'POST' });
}

export interface IngestProposal {
  layer: number;
  node_type: string;
  label: string;
  content: string;
  summary: string;
  reason: string;
  department: string | null;
  role_key: string | null;
  parent_id: number | null;
  source_type: string;
  citation: string;
  source_url: string | null;
  effective_date: string | null;
}

export interface IngestSourceResponse {
  proposals: IngestProposal[];
  count: number;
  citation: string;
  source_type: string;
  department: string | null;
  role_key: string | null;
  parent_id: number | null;
  parent_label: string | null;
  queue_entry_id: number | null;
  llm_cost: { input_tokens: number; output_tokens: number; cost_usd: number };
}

export interface IngestApplyResponse {
  status: string;
  neurons_created: number;
  neuron_ids: number[];
  edges_created: number;
  queue_entry_resolved: boolean;
}

export function ingestSource(body: {
  source_text: string;
  citation: string;
  source_type: string;
  source_url?: string;
  effective_date?: string;
  department?: string;
  role_key?: string;
  queue_entry_id?: number;
}): Promise<IngestSourceResponse> {
  return json<IngestSourceResponse>('/admin/ingest-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface ExtractSourceResponse {
  text: string;
  char_count: number;
  total_pages: number;
  source_info: string;
}

export async function extractSourceFromFile(file: File, pageStart?: number, pageEnd?: number): Promise<ExtractSourceResponse> {
  const form = new FormData();
  form.append('file', file);
  if (pageStart) form.append('page_start', String(pageStart));
  if (pageEnd) form.append('page_end', String(pageEnd));
  const res = await fetch('/admin/extract-source', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function extractSourceFromUrl(url: string, pageStart?: number, pageEnd?: number): Promise<ExtractSourceResponse> {
  const params = new URLSearchParams({ url });
  if (pageStart) params.set('page_start', String(pageStart));
  if (pageEnd) params.set('page_end', String(pageEnd));
  const res = await fetch(`/admin/extract-source?${params}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface BatchIngestStartResponse {
  job_id: string;
  total_chunks: number;
  total_chars: number;
  status: string;
}

export interface BatchIngestStatusResponse {
  job_id: string;
  status: string;
  step: string;
  total_chunks: number;
  current_chunk: number;
  proposals_count: number;
  proposals: IngestProposal[];
  errors: string[];
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  citation: string;
  department: string | null;
  role_key: string | null;
  parent_id: number | null;
  parent_label: string | null;
  queue_entry_id: number | null;
}

export function startBatchIngest(body: {
  source_text: string;
  citation: string;
  source_type: string;
  source_url?: string;
  effective_date?: string;
  department?: string;
  role_key?: string;
  queue_entry_id?: number;
  model?: string;
  chunk_size?: number;
}): Promise<BatchIngestStartResponse> {
  return json<BatchIngestStartResponse>('/admin/ingest-source/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function pollBatchIngest(jobId: string): Promise<BatchIngestStatusResponse> {
  return json<BatchIngestStatusResponse>(`/admin/ingest-source/batch/${jobId}`);
}

export function cancelBatchIngest(jobId: string): Promise<{ status: string }> {
  return json<{ status: string }>(`/admin/ingest-source/batch/${jobId}/cancel`, { method: 'POST' });
}

export function resumeBatchIngest(jobId: string): Promise<{ job_id: string; status: string; resuming_from_chunk: number; total_chunks: number; existing_proposals: number }> {
  return json(`/admin/ingest-source/batch/${jobId}/resume`, { method: 'POST' });
}

export interface BatchJobSummary {
  job_id: string;
  status: string;
  step: string;
  total_chunks: number;
  current_chunk: number;
  proposals_count: number;
  errors: string[];
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  citation: string;
  queue_entry_id: number | null;
}

export function listBatchJobs(): Promise<{ jobs: BatchJobSummary[]; active_count: number }> {
  return json<{ jobs: BatchJobSummary[]; active_count: number }>('/admin/ingest-source/batch');
}

export function applyIngestSource(body: {
  proposals: IngestProposal[];
  queue_entry_id?: number;
}): Promise<IngestApplyResponse> {
  return json<IngestApplyResponse>('/admin/ingest-source/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
