import { useEffect, useState, type ReactNode } from 'react'
import { submitQuery, submitRating, fetchQueryHistory, fetchQueryDetail, evaluateQuery, refineQuery, applyRefinements } from '../api'
import type { QueryResponse, QuerySummary, QueryDetail, SlotResult, EvalScoreOut, RefineResponse } from '../types'
import TokenCharts from './TokenCharts'

const layerColors = ['var(--layer0)', 'var(--layer1)', 'var(--layer2)', 'var(--layer3)', 'var(--layer4)', 'var(--layer5)'];

const ALL_MODES = [
  { key: 'haiku_neuron', label: 'Haiku + Neurons', short: 'HN' },
  { key: 'haiku_raw', label: 'Haiku Raw', short: 'H' },
  { key: 'sonnet_neuron', label: 'Sonnet + Neurons', short: 'SN' },
  { key: 'sonnet_raw', label: 'Sonnet Raw', short: 'S' },
  { key: 'opus_neuron', label: 'Opus + Neurons', short: 'ON' },
  { key: 'opus_raw', label: 'Opus Raw', short: 'O' },
] as const;

const MODE_COLORS: Record<string, string> = {
  haiku_neuron: '#60a5fa',
  haiku_raw: '#38bdf8',
  sonnet_neuron: '#a78bfa',
  sonnet_raw: '#c084fc',
  opus_neuron: '#fb7185',
  opus_raw: '#f472b6',
};

function slotLabel(slot: SlotResult): string {
  const m = ALL_MODES.find(m => m.key === slot.mode);
  return m?.label ?? slot.mode;
}

function slotsToChartModels(slots: SlotResult[], classifyCost: number, baseline: string) {
  const models = [];
  for (const slot of slots) {
    const isFirstNeuron = slot.neurons && slots.filter(s => s.neurons).indexOf(slot) === 0;
    models.push({
      label: slotLabel(slot),
      mode: slot.mode,
      color: MODE_COLORS[slot.mode] ?? '#8892a8',
      inputTokens: slot.input_tokens,
      outputTokens: slot.output_tokens,
      cost: slot.cost_usd + (isFirstNeuron ? classifyCost : 0),
      neurons: slot.neurons,
    });
  }
  return { models, baseline };
}

const DIMENSIONS = ['accuracy', 'completeness', 'clarity', 'faithfulness', 'overall'] as const;
const DIM_LABELS: Record<string, string> = { accuracy: 'Accuracy', completeness: 'Completeness', clarity: 'Clarity', faithfulness: 'Faithfulness', overall: 'Overall' };

function scoreColor(val: number): string {
  if (val >= 5) return '#22c55e';
  if (val >= 4) return '#86efac';
  if (val >= 3) return '#facc15';
  if (val >= 2) return '#fb923c';
  return '#ef4444';
}

function Section({ title, children, defaultOpen = true, className, headerRight, titleStyle }: {
  title: string; children: ReactNode; defaultOpen?: boolean; className?: string;
  headerRight?: ReactNode; titleStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`result-card${className ? ' ' + className : ''}`}>
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <h3 style={titleStyle}>
          <span className={`section-chevron${open ? ' open' : ''}`} />
          {title}
        </h3>
        {headerRight && <div className="section-header-right" onClick={e => e.stopPropagation()}>{headerRight}</div>}
      </div>
      {open && children}
    </div>
  );
}

function EvalScoreTable({ scores, winner }: { scores: EvalScoreOut[]; winner: string | null }) {
  if (scores.length === 0) return null;
  return (
    <div className="eval-score-table">
      <table className="score-table">
        <thead>
          <tr>
            <th>Dimension</th>
            {scores.map(s => (
              <th key={s.answer_label} style={{ borderBottom: `2px solid ${MODE_COLORS[s.answer_mode] ?? '#8892a8'}` }}>
                {s.answer_label} — {ALL_MODES.find(m => m.key === s.answer_mode)?.label ?? s.answer_mode}
                {winner === s.answer_label && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#22c55e' }}>★ Winner</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map(dim => (
            <tr key={dim}>
              <td style={{ fontWeight: dim === 'overall' ? 700 : 400 }}>{DIM_LABELS[dim]}</td>
              {scores.map(s => {
                const val = s[dim];
                return (
                  <td key={s.answer_label} style={{ color: scoreColor(val), fontWeight: dim === 'overall' ? 700 : 400 }}>
                    {val}/5
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefinePanel({ queryId, hasEval, hasNeurons }: { queryId: number; hasEval: boolean; hasNeurons: boolean }) {
  const [refineModel, setRefineModel] = useState<'haiku' | 'sonnet'>('haiku');
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineResult, setRefineResult] = useState<RefineResponse | null>(null);
  const [refineError, setRefineError] = useState('');
  const [checkedUpdates, setCheckedUpdates] = useState<Set<number>>(new Set());
  const [checkedNewNeurons, setCheckedNewNeurons] = useState<Set<number>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number; created: number } | null>(null);

  if (!hasEval || !hasNeurons) return null;

  async function handleRefine() {
    setRefineLoading(true);
    setRefineError('');
    setApplyResult(null);
    try {
      const res = await refineQuery(queryId, refineModel);
      setRefineResult(res);
      // Pre-check all suggestions
      setCheckedUpdates(new Set(res.updates.map((_, i) => i)));
      setCheckedNewNeurons(new Set(res.new_neurons.map((_, i) => i)));
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : 'Refinement failed');
    } finally {
      setRefineLoading(false);
    }
  }

  function toggleUpdate(idx: number) {
    setCheckedUpdates(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleNewNeuron(idx: number) {
    setCheckedNewNeurons(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleApply() {
    if (!refineResult) return;
    setApplyLoading(true);
    try {
      const res = await applyRefinements(queryId, Array.from(checkedUpdates), Array.from(checkedNewNeurons));
      setApplyResult(res);
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplyLoading(false);
    }
  }

  const totalChecked = checkedUpdates.size + checkedNewNeurons.size;

  return (
    <div className="result-card refine-card">
      <div className="eval-header">
        <h3>Refine Neurons</h3>
        <div className="eval-controls">
          <select value={refineModel} onChange={e => setRefineModel(e.target.value as 'haiku' | 'sonnet')}>
            <option value="haiku">Refine with Haiku</option>
            <option value="sonnet">Refine with Sonnet</option>
          </select>
          <button className="btn btn-sm" onClick={handleRefine} disabled={refineLoading}>
            {refineLoading ? 'Analyzing...' : refineResult ? 'Re-analyze' : 'Refine Neurons'}
          </button>
        </div>
      </div>

      {refineError && <div className="error-msg" style={{ marginBottom: 12 }}>{refineError}</div>}

      {refineResult && (
        <div className="refine-results">
          <div className="refine-reasoning">
            <div className="eval-model-tag">Analysis by {refineResult.model}</div>
            <div className="response-text" style={{ marginBottom: 12 }}>{refineResult.reasoning}</div>
            <div className="token-breakdown">
              <div className="breakdown-item"><div className="bd-value">{refineResult.input_tokens}</div><div className="bd-label">In</div></div>
              <div className="breakdown-item"><div className="bd-value">{refineResult.output_tokens}</div><div className="bd-label">Out</div></div>
            </div>
          </div>

          {refineResult.updates.length > 0 && (
            <div className="refine-section">
              <h4>Neuron Updates ({refineResult.updates.length})</h4>
              {refineResult.updates.map((u, i) => (
                <label key={i} className={`refine-row${checkedUpdates.has(i) ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checkedUpdates.has(i)} onChange={() => toggleUpdate(i)} />
                  <div className="refine-row-content">
                    <div className="refine-row-header">
                      <span className="refine-neuron-id">#{u.neuron_id}</span>
                      <span className="refine-field">{u.field}</span>
                    </div>
                    <div className="refine-diff">
                      <div className="refine-old">{u.old_value}</div>
                      <div className="refine-arrow">→</div>
                      <div className="refine-new">{u.new_value}</div>
                    </div>
                    <div className="refine-reason">{u.reason}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {refineResult.new_neurons.length > 0 && (
            <div className="refine-section">
              <h4>New Neurons ({refineResult.new_neurons.length})</h4>
              {refineResult.new_neurons.map((n, i) => (
                <label key={i} className={`refine-row${checkedNewNeurons.has(i) ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checkedNewNeurons.has(i)} onChange={() => toggleNewNeuron(i)} />
                  <div className="refine-row-content">
                    <div className="refine-row-header">
                      <span className="refine-field">L{n.layer} {n.node_type}</span>
                      {n.parent_id != null && <span className="refine-neuron-id">under #{n.parent_id}</span>}
                      {n.department && <span className="tag dept" style={{ fontSize: '0.65rem' }}>{n.department}</span>}
                    </div>
                    <div className="refine-label">{n.label}</div>
                    <div className="refine-content-preview">{n.content.length > 200 ? n.content.slice(0, 200) + '...' : n.content}</div>
                    <div className="refine-reason">{n.reason}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {(refineResult.updates.length > 0 || refineResult.new_neurons.length > 0) && (
            <div className="refine-apply-bar">
              {applyResult ? (
                <div className="refine-apply-success">
                  Applied: {applyResult.updated} updated, {applyResult.created} created
                </div>
              ) : (
                <button className="btn" onClick={handleApply} disabled={applyLoading || totalChecked === 0}>
                  {applyLoading ? 'Applying...' : `Apply Selected (${totalChecked})`}
                </button>
              )}
            </div>
          )}

          {refineResult.updates.length === 0 && refineResult.new_neurons.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 12 }}>
              No changes suggested — neurons look good for this query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QueryLab() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0.5);
  const [rated, setRated] = useState(false);

  const [enabledModes, setEnabledModes] = useState<Set<string>>(new Set(['haiku_neuron']));
  const [baseline, setBaseline] = useState('opus_raw');

  const [evalLoading, setEvalLoading] = useState(false);
  const [evalModel, setEvalModel] = useState<'haiku' | 'sonnet'>('haiku');
  const [evalText, setEvalText] = useState<string | null>(null);
  const [evalMdl, setEvalMdl] = useState<string | null>(null);
  const [evalIn, setEvalIn] = useState(0);
  const [evalOut, setEvalOut] = useState(0);
  const [evalScores, setEvalScores] = useState<EvalScoreOut[]>([]);
  const [evalWinner, setEvalWinner] = useState<string | null>(null);

  const [history, setHistory] = useState<QuerySummary[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryDetail | null>(null);
  const [view, setView] = useState<'new' | 'history'>('new');

  useEffect(() => { loadHistory(); }, []);

  function loadHistory() {
    fetchQueryHistory().then(setHistory).catch(() => {});
  }

  function toggleMode(key: string) {
    setEnabledModes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    const modes = Array.from(enabledModes);
    if (!message.trim() || modes.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    setEvalText(null);
    setEvalScores([]);
    setEvalWinner(null);
    setRated(false);
    setView('new');
    setSelectedQuery(null);
    try {
      const res = await submitQuery(message, modes);
      setResult(res);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleEval() {
    if (!result) return;
    setEvalLoading(true);
    try {
      const res = await evaluateQuery(result.query_id, evalModel);
      setEvalText(res.eval_text);
      setEvalMdl(res.eval_model);
      setEvalIn(res.eval_input_tokens);
      setEvalOut(res.eval_output_tokens);
      setEvalScores(res.scores ?? []);
      setEvalWinner(res.winner ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setEvalLoading(false);
    }
  }

  async function handleRate() {
    if (!result) return;
    try {
      await submitRating(result.query_id, rating);
      setRated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rating failed');
    }
  }

  async function selectHistoryItem(id: number) {
    try {
      const detail = await fetchQueryDetail(id);
      setSelectedQuery(detail);
      setView('history');
      setResult(null);
      setEvalText(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load query');
    }
  }

  return (
    <div className="query-lab-layout">
      <div className="query-history">
        <h3>Query History</h3>
        {history.length === 0 && <div className="history-empty">No queries yet</div>}
        {history.map(q => (
          <div
            key={q.id}
            className={`history-item${selectedQuery?.id === q.id ? ' selected' : ''}`}
            onClick={() => selectHistoryItem(q.id)}
          >
            <div className="history-msg">{q.user_message}</div>
            <div className="history-meta">
              {q.classified_intent && <span className="tag intent">{q.classified_intent}</span>}
              <span className="history-modes">
                {q.modes.map(m => {
                  const def = ALL_MODES.find(d => d.key === m);
                  return <span key={m} className="mode-badge" style={{ background: (MODE_COLORS[m] ?? '#8892a8') + '33', color: MODE_COLORS[m] ?? '#8892a8' }}>{def?.short ?? m}</span>;
                })}
              </span>
              {q.cost_usd != null && <span className="history-cost">${q.cost_usd.toFixed(4)}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="query-main">
        <div className="query-form">
          <textarea
            placeholder="Enter your message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
          />
          <div className="query-controls">
            <div className="mode-toggles">
              {ALL_MODES.map(m => (
                <label key={m.key} className={`toggle-label${enabledModes.has(m.key) ? ' active' : ''}`} style={enabledModes.has(m.key) ? { borderColor: MODE_COLORS[m.key] } : undefined}>
                  <input type="checkbox" checked={enabledModes.has(m.key)} onChange={() => toggleMode(m.key)} />
                  {m.label}
                </label>
              ))}
              <select className="baseline-select" value={baseline} onChange={e => setBaseline(e.target.value)}>
                {ALL_MODES.map(m => (
                  <option key={m.key} value={m.key}>Baseline: {m.label}</option>
                ))}
              </select>
            </div>
            <button className="btn" onClick={handleSubmit} disabled={loading || !message.trim() || enabledModes.size === 0}>
              {loading ? 'Processing...' : 'Submit Query'}
            </button>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {result && view === 'new' && (
          <>
            <LiveResult
              result={result} baseline={baseline}
              rating={rating} setRating={setRating} rated={rated} onRate={handleRate}
              evalText={evalText} evalMdl={evalMdl} evalIn={evalIn} evalOut={evalOut}
              evalScores={evalScores} evalWinner={evalWinner}
              evalModel={evalModel} setEvalModel={setEvalModel}
              evalLoading={evalLoading} onEval={handleEval}
            />
          </>
        )}

        {selectedQuery && view === 'history' && <HistoryDetail query={selectedQuery} baseline={baseline} />}
      </div>
    </div>
  );
}

function LiveResult({ result, baseline, rating, setRating, rated, onRate, evalText, evalMdl, evalIn, evalOut, evalScores, evalWinner, evalModel, setEvalModel, evalLoading, onEval }: {
  result: QueryResponse; baseline: string;
  rating: number; setRating: (v: number) => void; rated: boolean; onRate: () => void;
  evalText: string | null; evalMdl: string | null; evalIn: number; evalOut: number;
  evalScores: EvalScoreOut[]; evalWinner: string | null;
  evalModel: 'haiku' | 'sonnet'; setEvalModel: (v: 'haiku' | 'sonnet') => void;
  evalLoading: boolean; onEval: () => void;
}) {
  const hasNeurons = result.neuron_scores.length > 0;

  return (
    <>
      {hasNeurons && result.intent && (
        <Section title="Classification" defaultOpen={false}>
          <div className="tags">
            <span className="tag intent">{result.intent}</span>
            {result.departments.map(d => <span key={d} className="tag dept">{d}</span>)}
            {result.role_keys.map(r => <span key={r} className="tag role">{r}</span>)}
            {result.keywords.map(k => <span key={k} className="tag keyword">{k}</span>)}
          </div>
        </Section>
      )}

      {hasNeurons && (
        <Section title={`Top Neuron Activations (${result.neurons_activated} total)`} defaultOpen={false}>
          <table className="score-table">
            <thead>
              <tr><th>ID</th><th>Combined</th><th>Burst</th><th>Impact</th><th>Precision</th><th>Novelty</th><th>Recency</th><th>Relevance</th></tr>
            </thead>
            <tbody>
              {result.neuron_scores.map(s => (
                <tr key={s.neuron_id}>
                  <td>{s.neuron_id}</td><td>{s.combined.toFixed(3)}</td><td>{s.burst.toFixed(3)}</td>
                  <td>{s.impact.toFixed(3)}</td><td>{s.precision.toFixed(3)}</td>
                  <td>{s.novelty.toFixed(3)}</td><td>{s.recency.toFixed(3)}</td><td>{s.relevance.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Responses */}
      {result.slots.map(slot => (
        <Section key={slot.mode} title={slotLabel(slot)} titleStyle={{ borderLeft: `3px solid ${MODE_COLORS[slot.mode] ?? '#8892a8'}`, paddingLeft: 8 }}>
          <div className="response-text">{slot.response}</div>
        </Section>
      ))}

      {/* Token Charts */}
      <Section title="Cost & Tokens">
        <TokenCharts {...slotsToChartModels(result.slots, result.classify_cost, baseline)} />
      </Section>

      {/* Compare */}
      {result.slots.length >= 2 && (
        <Section title="Compare Outputs" className="eval-card" headerRight={
          <div className="eval-controls">
            <select value={evalModel} onChange={e => setEvalModel(e.target.value as 'haiku' | 'sonnet')}>
              <option value="haiku">Evaluate with Haiku</option>
              <option value="sonnet">Evaluate with Sonnet</option>
            </select>
            <button className="btn btn-sm" onClick={onEval} disabled={evalLoading || !!evalText}>
              {evalLoading ? 'Evaluating...' : evalText ? 'Evaluated' : 'Compare Outputs'}
            </button>
          </div>
        }>
          {evalText && (
            <div className="eval-result">
              <div className="eval-model-tag">Evaluated by {evalMdl}</div>
              <EvalScoreTable scores={evalScores} winner={evalWinner} />
              <div className="response-text" style={{ marginTop: 12 }}>{evalText}</div>
              <div className="token-breakdown" style={{ marginTop: 12 }}>
                <div className="breakdown-item"><div className="bd-value">{evalIn}</div><div className="bd-label">Eval In</div></div>
                <div className="breakdown-item"><div className="bd-value">{evalOut}</div><div className="bd-label">Eval Out</div></div>
              </div>
            </div>
          )}
        </Section>
      )}

      <RefinePanel queryId={result.query_id} hasEval={!!evalText} hasNeurons={hasNeurons} />

      <Section title="Rate Response">
        <div className="rating-row">
          <input type="range" min="0" max="1" step="0.05" value={rating} onChange={e => setRating(parseFloat(e.target.value))} disabled={rated} />
          <span className="rating-value">{rating.toFixed(2)}</span>
          <button className="btn btn-sm" onClick={onRate} disabled={rated}>{rated ? 'Rated!' : 'Submit Rating'}</button>
        </div>
      </Section>
    </>
  );
}

function HistoryDetail({ query, baseline }: { query: QueryDetail; baseline: string }) {
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalModel, setEvalModel] = useState<'haiku' | 'sonnet'>('haiku');
  const [localEvalText, setLocalEvalText] = useState(query.eval_text);
  const [localEvalMdl, setLocalEvalMdl] = useState(query.eval_model);
  const [localEvalIn, setLocalEvalIn] = useState(query.eval_input_tokens);
  const [localEvalOut, setLocalEvalOut] = useState(query.eval_output_tokens);
  const [localEvalScores, setLocalEvalScores] = useState<EvalScoreOut[]>(query.eval_scores ?? []);
  const [localEvalWinner, setLocalEvalWinner] = useState<string | null>(query.eval_winner ?? null);

  useEffect(() => {
    setLocalEvalText(query.eval_text);
    setLocalEvalMdl(query.eval_model);
    setLocalEvalIn(query.eval_input_tokens);
    setLocalEvalOut(query.eval_output_tokens);
    setLocalEvalScores(query.eval_scores ?? []);
    setLocalEvalWinner(query.eval_winner ?? null);
  }, [query]);

  async function handleEval() {
    setEvalLoading(true);
    try {
      const res = await evaluateQuery(query.id, evalModel);
      setLocalEvalText(res.eval_text);
      setLocalEvalMdl(res.eval_model);
      setLocalEvalIn(res.eval_input_tokens);
      setLocalEvalOut(res.eval_output_tokens);
      setLocalEvalScores(res.scores ?? []);
      setLocalEvalWinner(res.winner ?? null);
    } catch { /* ignore */ }
    finally { setEvalLoading(false); }
  }

  const hasNeurons = query.neuron_hits.length > 0;

  return (
    <>
      <div className="result-card">
        <h3>
          Query #{query.id}
          <span className="history-modes" style={{ marginLeft: 8 }}>
            {query.slots.map(s => {
              const def = ALL_MODES.find(d => d.key === s.mode);
              return <span key={s.mode} className="mode-badge" style={{ background: (MODE_COLORS[s.mode] ?? '#8892a8') + '33', color: MODE_COLORS[s.mode] ?? '#8892a8' }}>{def?.short ?? s.mode}</span>;
            })}
          </span>
        </h3>
        <div className="response-text" style={{ marginBottom: 12 }}>{query.user_message}</div>
        {hasNeurons && (
          <div className="tags">
            {query.classified_intent && <span className="tag intent">{query.classified_intent}</span>}
            {query.departments.map(d => <span key={d} className="tag dept">{d}</span>)}
            {query.role_keys.map(r => <span key={r} className="tag role">{r}</span>)}
            {query.keywords.map(k => <span key={k} className="tag keyword">{k}</span>)}
          </div>
        )}
        {query.created_at && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8 }}>{new Date(query.created_at).toLocaleString()}</div>}
      </div>

      {hasNeurons && (
        <Section title={`Neuron Hits (${query.neuron_hits.length} neurons activated)`} defaultOpen={false}>
          <table className="score-table">
            <thead>
              <tr><th>ID</th><th>Neuron</th><th>Layer</th><th>Dept</th><th>Combined</th><th>Burst</th><th>Impact</th><th>Precision</th><th>Novelty</th><th>Recency</th><th>Relevance</th></tr>
            </thead>
            <tbody>
              {query.neuron_hits.map(h => (
                <tr key={h.neuron_id}>
                  <td>{h.neuron_id}</td>
                  <td style={{ color: layerColors[h.layer], maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</td>
                  <td><span style={{ color: layerColors[h.layer] }}>L{h.layer}</span></td>
                  <td style={{ fontSize: '0.75rem' }}>{h.department ?? '—'}</td>
                  <td><strong>{h.combined.toFixed(3)}</strong></td>
                  <td>{h.burst.toFixed(3)}</td>
                  <td>{h.impact.toFixed(3)}</td>
                  <td>{h.precision.toFixed(3)}</td>
                  <td>{h.novelty.toFixed(3)}</td>
                  <td>{h.recency.toFixed(3)}</td>
                  <td>{h.relevance.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Responses */}
      {query.slots.map(slot => (
        <Section key={slot.mode} title={slotLabel(slot)} titleStyle={{ borderLeft: `3px solid ${MODE_COLORS[slot.mode] ?? '#8892a8'}`, paddingLeft: 8 }}>
          <div className="response-text">{slot.response}</div>
        </Section>
      ))}

      {/* Token Charts */}
      {query.slots.length > 0 && (
        <Section title="Cost & Tokens">
          <TokenCharts {...slotsToChartModels(query.slots, query.classify_cost, baseline)} />
        </Section>
      )}

      {/* Compare */}
      {query.slots.length >= 2 && (
        <Section title="Compare Outputs" className="eval-card" headerRight={
          <div className="eval-controls">
            <select value={evalModel} onChange={e => setEvalModel(e.target.value as 'haiku' | 'sonnet')}>
              <option value="haiku">Evaluate with Haiku</option>
              <option value="sonnet">Evaluate with Sonnet</option>
            </select>
            <button className="btn btn-sm" onClick={handleEval} disabled={evalLoading}>
              {evalLoading ? 'Evaluating...' : localEvalText ? 'Re-evaluate' : 'Compare Outputs'}
            </button>
          </div>
        }>
          {localEvalText && (
            <div className="eval-result">
              <div className="eval-model-tag">Evaluated by {localEvalMdl}</div>
              <EvalScoreTable scores={localEvalScores} winner={localEvalWinner} />
              <div className="response-text" style={{ marginTop: 12 }}>{localEvalText}</div>
              <div className="token-breakdown" style={{ marginTop: 12 }}>
                <div className="breakdown-item"><div className="bd-value">{localEvalIn}</div><div className="bd-label">Eval In</div></div>
                <div className="breakdown-item"><div className="bd-value">{localEvalOut}</div><div className="bd-label">Eval Out</div></div>
              </div>
            </div>
          )}
        </Section>
      )}

      <RefinePanel queryId={query.id} hasEval={!!localEvalText} hasNeurons={hasNeurons} />

      {hasNeurons && query.assembled_prompt && (
        <Section title="Assembled System Prompt" defaultOpen={false}>
          <div className="response-text">{query.assembled_prompt}</div>
        </Section>
      )}
    </>
  );
}
