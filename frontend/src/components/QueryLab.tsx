import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { submitQuery, submitRating, fetchQueryHistory, fetchQueryDetail, evaluateQuery, refineQuery, applyRefinements, fetchGraphCapacity } from '../api'
import type { SlotSpec, GraphCapacity } from '../api'
import type { QueryResponse, QuerySummary, QueryDetail, SlotResult, EvalScoreOut, RefineResponse } from '../types'
import TokenCharts from './TokenCharts'
import SpreadTrail from './SpreadTrail'

const layerColors = ['var(--layer0)', 'var(--layer1)', 'var(--layer2)', 'var(--layer3)', 'var(--layer4)', 'var(--layer5)'];

const ALL_MODES = [
  { key: 'haiku_neuron', label: 'Haiku + Neurons', short: 'HN' },
  { key: 'haiku_raw', label: 'Haiku Raw', short: 'H' },
  { key: 'sonnet_neuron', label: 'Sonnet + Neurons', short: 'SN' },
  { key: 'sonnet_raw', label: 'Sonnet Raw', short: 'S' },
  { key: 'opus_neuron', label: 'Opus + Neurons', short: 'ON' },
  { key: 'opus_raw', label: 'Opus Raw', short: 'O' },
] as const;

const NEURON_MODES = new Set(['haiku_neuron', 'sonnet_neuron', 'opus_neuron']);

const MODE_COLORS: Record<string, string> = {
  haiku_neuron: '#60a5fa',
  haiku_raw: '#38bdf8',
  sonnet_neuron: '#a78bfa',
  sonnet_raw: '#c084fc',
  opus_neuron: '#fb7185',
  opus_raw: '#f472b6',
};

// Generate distinct hex colors for same-mode slots at different budgets
// Must produce valid hex for Chart.js canvas (CSS color-mix doesn't work in canvas)
function slotColor(mode: string, index: number, total: number): string {
  const base = MODE_COLORS[mode] ?? '#c8d0dc';
  if (total <= 1) return base;
  // Parse hex to RGB, shift lightness per index
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const shift = -30 + (index * 30);
  const clamp = (v: number) => Math.max(0, Math.min(255, v + shift));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function slotDisplayLabel(slot: SlotResult): string {
  if (slot.label) return slot.label;
  const m = ALL_MODES.find(m => m.key === slot.mode);
  const base = m?.label ?? slot.mode;
  if (slot.token_budget != null && NEURON_MODES.has(slot.mode)) {
    const budgetStr = `${(slot.token_budget / 1000).toFixed(0)}K`;
    const topKStr = slot.top_k != null && slot.top_k !== 30 ? ` / K=${slot.top_k}` : '';
    return `${base} @ ${budgetStr}${topKStr}`;
  }
  return base;
}

function slotsToChartModels(slots: SlotResult[], classifyCost: number, baseline: string) {
  const models = [];
  let firstNeuronDone = false;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isFirstNeuron = slot.neurons && !firstNeuronDone;
    if (isFirstNeuron) firstNeuronDone = true;
    // Count how many of this mode we've seen so far for color shifting
    const sameModeBefore = slots.slice(0, i).filter(s => s.mode === slot.mode).length;
    const sameModeTotal = slots.filter(s => s.mode === slot.mode).length;
    models.push({
      label: slotDisplayLabel(slot),
      mode: slot.mode,
      color: sameModeTotal > 1 ? slotColor(slot.mode, sameModeBefore, sameModeTotal) : (MODE_COLORS[slot.mode] ?? '#c8d0dc'),
      inputTokens: slot.input_tokens,
      outputTokens: slot.output_tokens,
      cost: slot.cost_usd + (isFirstNeuron ? classifyCost : 0),
      durationMs: slot.duration_ms ?? 0,
      neurons: slot.neurons,
      tokenBudget: slot.token_budget,
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

function Section({ title, children, defaultOpen = false, className, headerRight, titleStyle, id }: {
  title: string; children: ReactNode; defaultOpen?: boolean; className?: string;
  headerRight?: ReactNode; titleStyle?: React.CSSProperties; id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [read, setRead] = useState(defaultOpen);
  return (
    <div id={id} className={`result-card${className ? ' ' + className : ''}`}>
      <div className="section-header" onClick={() => { setOpen(o => !o); setRead(true); }}>
        <h3 style={titleStyle}>
          <span className={`section-chevron${open ? ' open' : ''}`} />
          {title}
          {!read && <span className="unread-dot" />}
        </h3>
        {headerRight && <div className="section-header-right" onClick={e => e.stopPropagation()}>{headerRight}</div>}
      </div>
      {open && children}
    </div>
  );
}

function EvalScoreTable({ scores, winner, slots }: { scores: EvalScoreOut[]; winner: string | null; slots?: SlotResult[] }) {
  if (scores.length === 0) return null;
  return (
    <div className="eval-score-table">
      <table className="score-table">
        <thead>
          <tr>
            <th>Dimension</th>
            {scores.map(s => {
              // Match by position (A=0, B=1, ...) not by mode, since multiple slots can share a mode
              const slotIndex = s.answer_label.charCodeAt(0) - 65;
              const matchedSlot = slots?.[slotIndex];
              const displayLabel = matchedSlot ? slotDisplayLabel(matchedSlot) : (ALL_MODES.find(m => m.key === s.answer_mode)?.label ?? s.answer_mode);
              return (
                <th key={s.answer_label} style={{ borderBottom: `2px solid ${MODE_COLORS[s.answer_mode] ?? '#c8d0dc'}` }}>
                  {s.answer_label} — {displayLabel}
                  {winner === s.answer_label && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#22c55e' }}>&#9733; Winner</span>}
                </th>
              );
            })}
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

type RefinePhase = 'idle' | 'ready' | 'loading' | 'has-suggestions' | 'applying' | 'applied';

function RefinePanel({ queryId, hasEval, hasNeurons, onRunAgain, onPhaseChange, initialRefineResult, onNavigateToNeuron }: {
  queryId: number; hasEval: boolean; hasNeurons: boolean;
  onRunAgain?: () => void; onPhaseChange?: (phase: RefinePhase) => void;
  initialRefineResult?: RefineResponse | null;
  onNavigateToNeuron?: (id: number) => void;
}) {
  const [refineModel, setRefineModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [refineMaxTokens, setRefineMaxTokens] = useState(4096);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineResult, setRefineResult] = useState<RefineResponse | null>(null);
  const [refineError, setRefineError] = useState('');
  const [checkedUpdates, setCheckedUpdates] = useState<Set<number>>(new Set());
  const [checkedNewNeurons, setCheckedNewNeurons] = useState<Set<number>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number; created: number } | null>(null);
  const [userContext, setUserContext] = useState('');

  // Restore saved refine results (e.g. backend finished while user was on another tab)
  useEffect(() => {
    if (initialRefineResult && !refineResult && !refineLoading) {
      setRefineResult(initialRefineResult);
      setCheckedUpdates(new Set(initialRefineResult.updates.map((_, i) => i)));
      setCheckedNewNeurons(new Set(initialRefineResult.new_neurons.map((_, i) => i)));
    }
  }, [initialRefineResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onPhaseChange || !hasEval || !hasNeurons) return;
    if (applyResult) onPhaseChange('applied');
    else if (applyLoading) onPhaseChange('applying');
    else if (refineResult && (refineResult.updates.length > 0 || refineResult.new_neurons.length > 0)) onPhaseChange('has-suggestions');
    else if (refineLoading) onPhaseChange('loading');
    else onPhaseChange('ready');
  }, [hasEval, hasNeurons, refineLoading, refineResult, applyLoading, applyResult, onPhaseChange]);

  if (!hasEval || !hasNeurons) return null;

  async function handleRefine() {
    setRefineLoading(true);
    setRefineError('');
    setApplyResult(null);
    try {
      const res = await refineQuery(queryId, refineModel, refineMaxTokens, userContext || undefined);
      setRefineResult(res);
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
    <div id="section-refine" className="result-card refine-card">
      <div className="eval-header">
        <h3>Refine Neurons</h3>
        <div className="eval-controls">
          <select value={refineModel} onChange={e => setRefineModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}>
            <option value="haiku">Refine with Haiku</option>
            <option value="sonnet">Refine with Sonnet</option>
            <option value="opus">Refine with Opus</option>
          </select>
          <label className="refine-token-slider">
            <span>Max tokens: {refineMaxTokens >= 1000 ? `${(refineMaxTokens / 1000).toFixed(1).replace(/\.0$/, '')}K` : refineMaxTokens}</span>
            <input
              type="range"
              min={512}
              max={16384}
              step={512}
              value={refineMaxTokens}
              onChange={e => setRefineMaxTokens(Number(e.target.value))}
            />
          </label>
          <button id="btn-refine" className="btn btn-sm" onClick={handleRefine} disabled={refineLoading}>
            {refineLoading ? 'Analyzing...' : refineResult ? 'Re-analyze' : 'Refine Neurons'}
          </button>
        </div>
      </div>

      <textarea
        className="refine-user-context"
        placeholder="Add your own context to guide refinement (e.g., specific standards, corrections, domain knowledge)..."
        value={userContext}
        onChange={e => setUserContext(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          marginTop: 10,
          marginBottom: 10,
          resize: 'vertical',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-input, var(--bg-card))',
          color: 'var(--text)',
        }}
        maxLength={16000}
      />

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
                      <span className="refine-neuron-id" style={onNavigateToNeuron ? { cursor: 'pointer', textDecoration: 'underline' } : undefined} onClick={onNavigateToNeuron ? (e) => { e.preventDefault(); e.stopPropagation(); onNavigateToNeuron(u.neuron_id); } : undefined} title={onNavigateToNeuron ? 'View in Explorer' : undefined}>#{u.neuron_id}</span>
                      <span className="refine-field">{u.field}</span>
                    </div>
                    <div className="refine-diff">
                      <div className="refine-old">{u.old_value}</div>
                      <div className="refine-arrow">&rarr;</div>
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
                  {onRunAgain && (
                    <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={onRunAgain}>
                      Run Again
                    </button>
                  )}
                </div>
              ) : (
                <button id="btn-apply" className="btn" onClick={handleApply} disabled={applyLoading || totalChecked === 0}>
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

// ────────── Slot Builder ──────────

interface SlotConfig {
  id: number;
  mode: string;
  tokenBudget: number;
  topK: number;
  candidatePool: number;
}

let nextSlotId = 1;

const TOKEN_MIN = 1000;
const TOKEN_MAX = 32000;
const TOPK_MIN = 1;
const TOPK_MAX = 500;

const POOL_MIN = 50;
const POOL_MAX = 2000;

function XYPlot({ tokenBudget, topK, candidatePool, maxNeurons, onChange }: {
  tokenBudget: number;
  topK: number;
  candidatePool: number;
  maxNeurons: number;
  onChange: (tokenBudget: number, topK: number, candidatePool: number) => void;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'topk' | 'pool' | null>(null);

  const effectiveTopKMax = Math.min(maxNeurons, TOPK_MAX);
  // Pool axis shares the Y space but uses a wider range
  const yMax = Math.max(effectiveTopKMax, POOL_MAX);

  const yPctFromVal = useCallback((v: number) => {
    return (1 - (v - TOPK_MIN) / (yMax - TOPK_MIN)) * 100;
  }, [yMax]);

  const yValFromPct = useCallback((yPct: number) => {
    return Math.round(TOPK_MIN + (1 - yPct) * (yMax - TOPK_MIN));
  }, [yMax]);

  const xPctFromVal = useCallback((tb: number) => {
    return ((tb - TOKEN_MIN) / (TOKEN_MAX - TOKEN_MIN)) * 100;
  }, []);

  const xValFromPct = useCallback((xPct: number) => {
    return Math.round((TOKEN_MIN + xPct * (TOKEN_MAX - TOKEN_MIN)) / 1000) * 1000;
  }, []);

  const topKPct = yPctFromVal(topK);
  const poolPct = yPctFromVal(candidatePool);
  const budgetPct = xPctFromVal(tokenBudget);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = plotRef.current!.getBoundingClientRect();
    const yPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yVal = yValFromPct(yPct);
    const xVal = xValFromPct(xPct);

    if (dragging.current === 'topk') {
      const newTopK = Math.max(TOPK_MIN, Math.min(effectiveTopKMax, yVal));
      const newBudget = Math.max(TOKEN_MIN, Math.min(TOKEN_MAX, xVal));
      // top_k can't exceed candidate_pool
      onChange(newBudget, Math.min(newTopK, candidatePool), candidatePool);
    } else if (dragging.current === 'pool') {
      const newPool = Math.max(POOL_MIN, Math.min(POOL_MAX, yVal));
      const newBudget = Math.max(TOKEN_MIN, Math.min(TOKEN_MAX, xVal));
      // candidate_pool can't be less than top_k
      onChange(newBudget, topK, Math.max(newPool, topK));
    }
  }, [yValFromPct, xValFromPct, effectiveTopKMax, candidatePool, topK, onChange]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = plotRef.current!.getBoundingClientRect();
    const yPct = (e.clientY - rect.top) / rect.height;

    // Grab whichever dot is closer vertically
    const topKYDist = Math.abs(yPct - topKPct / 100);
    const poolYDist = Math.abs(yPct - poolPct / 100);
    dragging.current = topKYDist <= poolYDist ? 'topk' : 'pool';

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  }, [topKPct, poolPct, handlePointerMove]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  // Tick marks
  const xTicks = [1, 4, 8, 16, 32];
  const yTicks = [1, 10, 30, 50, 100, 250, 500, 1000, POOL_MAX].filter((v, i, a) => a.indexOf(v) === i && v <= yMax);

  return (
    <div className="xy-plot-container">
      <div className="xy-plot-ylabel">Neurons</div>
      <div className="xy-plot-inner">
        <div className="xy-plot-yticks">
          {yTicks.map(v => {
            const top = yPctFromVal(v);
            return <span key={v} className="xy-tick-y" style={{ top: `${top}%` }}>{v}</span>;
          })}
        </div>
        <div
          ref={plotRef}
          className="xy-plot-area"
          onPointerDown={onPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Grid lines */}
          {xTicks.map(v => {
            const left = xPctFromVal(v * 1000);
            return <div key={v} className="xy-gridline-v" style={{ left: `${left}%` }} />;
          })}
          {yTicks.map(v => {
            const top = yPctFromVal(v);
            return <div key={v} className="xy-gridline-h" style={{ top: `${top}%` }} />;
          })}
          {/* Line connecting the two dots */}
          <div className="xy-range-line" style={{
            left: `${budgetPct}%`,
            top: `${Math.min(topKPct, poolPct)}%`,
            height: `${Math.abs(poolPct - topKPct)}%`,
          }} />
          {/* Crosshair for budget (horizontal from topK dot) */}
          <div className="xy-crosshair-h" style={{ top: `${topKPct}%` }} />
          <div className="xy-crosshair-v" style={{ left: `${budgetPct}%` }} />
          {/* Pool dot (upper, larger pool) */}
          <div
            className="xy-dot xy-dot-pool"
            style={{ left: `${budgetPct}%`, top: `${poolPct}%` }}
            title="Candidate Pool"
          />
          {/* TopK dot (lower, active neurons) */}
          <div
            className="xy-dot xy-dot-topk"
            style={{ left: `${budgetPct}%`, top: `${topKPct}%` }}
            title="Top-K (max active)"
          />
          {/* Value readout */}
          <div className="xy-readout">
            {(tokenBudget / 1000).toFixed(0)}K &middot; K={topK} &middot; Pool={candidatePool}
          </div>
        </div>
        <div className="xy-plot-xticks">
          {xTicks.map(v => {
            const left = xPctFromVal(v * 1000);
            return <span key={v} className="xy-tick-x" style={{ left: `${left}%` }}>{v}K</span>;
          })}
        </div>
      </div>
      <div className="xy-plot-xlabel">Token Budget</div>
    </div>
  );
}

function SlotBuilder({ slots, onChange, capacity }: {
  slots: SlotConfig[];
  onChange: (slots: SlotConfig[]) => void;
  capacity: GraphCapacity | null;
}) {
  function addSlot() {
    onChange([...slots, { id: nextSlotId++, mode: 'haiku_neuron', tokenBudget: 4000, topK: 30, candidatePool: 250 }]);
  }

  function removeSlot(id: number) {
    onChange(slots.filter(s => s.id !== id));
  }

  function updateSlot(id: number, patch: Partial<SlotConfig>) {
    onChange(slots.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  const maxNeurons = capacity?.active_neurons ?? 500;

  return (
    <div className="slot-builder">
      {capacity && (
        <div className="graph-capacity-bar">
          <span className="capacity-label">Graph:</span>
          <span className="capacity-value">{capacity.active_neurons.toLocaleString()} neurons</span>
          <span className="capacity-sep">&middot;</span>
          <span className="capacity-value">{capacity.total_content_tokens.toLocaleString()} content tokens</span>
          <span className="capacity-sep">&middot;</span>
          <span className="capacity-value">{capacity.total_tokens.toLocaleString()} total</span>
        </div>
      )}
      <div className="slot-grid">
        {slots.map(slot => {
          const isNeuron = NEURON_MODES.has(slot.mode);
          return (
            <div key={slot.id} className="slot-card" style={{ borderColor: (MODE_COLORS[slot.mode] ?? '#c8d0dc') + '66' }}>
              <div className="slot-card-header">
                <select
                  className="slot-mode-select"
                  value={slot.mode}
                  onChange={e => updateSlot(slot.id, { mode: e.target.value })}
                >
                  {ALL_MODES.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <button
                  className="slot-remove-btn"
                  onClick={() => removeSlot(slot.id)}
                  title="Remove slot"
                  disabled={slots.length <= 1}
                >
                  &times;
                </button>
              </div>
              {isNeuron ? (
                <XYPlot
                  tokenBudget={slot.tokenBudget}
                  topK={slot.topK}
                  candidatePool={slot.candidatePool}
                  maxNeurons={maxNeurons}
                  onChange={(tb, tk, cp) => updateSlot(slot.id, { tokenBudget: tb, topK: tk, candidatePool: cp })}
                />
              ) : (
                <div className="slot-raw-label">Raw mode — no neuron context</div>
              )}
            </div>
          );
        })}
        <button className="slot-card slot-add-card" onClick={addSlot}>
          <span className="slot-add-icon">+</span>
          <span>Add Slot</span>
        </button>
      </div>
    </div>
  );
}

// ────────── Action Rail ──────────

function ActionRail({ hasResult, hasMultiSlot, hasNeurons, evalDone, evalLoading, refinePhase, loading, onEval, onSubmit }: {
  hasResult: boolean; hasMultiSlot: boolean; hasNeurons: boolean;
  evalDone: boolean; evalLoading: boolean; refinePhase: RefinePhase;
  loading: boolean; onEval: () => void; onSubmit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  function scrollAndClick(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.click();
    }
  }

  let currentStep = 0;
  if (hasResult) currentStep = 1;
  if (evalDone) currentStep = 2;
  if (refinePhase === 'has-suggestions' || refinePhase === 'loading') currentStep = 3;
  if (refinePhase === 'applied') currentStep = 4;

  const steps = [
    {
      label: loading ? 'Running...' : 'Submit',
      enabled: !loading,
      active: currentStep === 0,
      done: currentStep >= 1,
      action: onSubmit,
    },
    {
      label: evalLoading ? 'Evaluating...' : evalDone ? 'Evaluated' : 'Evaluate',
      enabled: hasResult && hasMultiSlot && !evalLoading && !evalDone,
      active: currentStep === 1 && hasMultiSlot,
      done: evalDone,
      action: () => {
        document.getElementById('section-compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onEval();
      },
    },
    {
      label: refinePhase === 'loading' ? 'Refining...' : refinePhase !== 'idle' && refinePhase !== 'ready' ? 'Refined' : 'Refine',
      enabled: evalDone && hasNeurons && (refinePhase === 'ready' || refinePhase === 'has-suggestions' || refinePhase === 'applied'),
      active: currentStep === 2,
      done: refinePhase === 'has-suggestions' || refinePhase === 'applying' || refinePhase === 'applied',
      action: () => scrollAndClick('btn-refine'),
    },
    {
      label: refinePhase === 'applying' ? 'Applying...' : refinePhase === 'applied' ? 'Applied' : 'Apply',
      enabled: refinePhase === 'has-suggestions',
      active: refinePhase === 'has-suggestions',
      done: refinePhase === 'applied',
      action: () => scrollAndClick('btn-apply'),
    },
    {
      label: 'Run Again',
      enabled: refinePhase === 'applied',
      active: refinePhase === 'applied',
      done: false,
      action: onSubmit,
    },
  ];

  return (
    <div className={`action-rail${collapsed ? ' collapsed' : ''}`}>
      <div className="rail-header" onClick={() => setCollapsed(c => !c)}>
        <span className={`section-chevron${!collapsed ? ' open' : ''}`} />
        {!collapsed && <span>Actions</span>}
      </div>
      {!collapsed && (
        <div className="rail-steps">
          {steps.map((step, i) => (
            <button
              key={i}
              className={`rail-step${step.active ? ' active' : ''}${step.done ? ' done' : ''}`}
              disabled={!step.enabled && !step.done}
              onClick={step.action}
            >
              <span className="rail-step-num">{step.done ? '\u2713' : i + 1}</span>
              <span className="rail-step-label">{step.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── Main Component ──────────

export default function QueryLab({ onNavigateToNeuron }: { onNavigateToNeuron?: (id: number) => void } = {}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0.5);
  const [rated, setRated] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([
    { id: nextSlotId++, mode: 'haiku_neuron', tokenBudget: 4000, topK: 30, candidatePool: 250 },
  ]);
  const [baseline, setBaseline] = useState('opus_raw');
  const [graphCapacity, setGraphCapacity] = useState<GraphCapacity | null>(null);
  // Track which slot indices are still loading (for per-slot spinners)
  const [slotLoadingSet, setSlotLoadingSet] = useState<Set<number>>(new Set());

  const [evalLoading, setEvalLoading] = useState(false);
  const [evalModel, setEvalModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [evalText, setEvalText] = useState<string | null>(null);
  const [evalMdl, setEvalMdl] = useState<string | null>(null);
  const [evalIn, setEvalIn] = useState(0);
  const [evalOut, setEvalOut] = useState(0);
  const [evalScores, setEvalScores] = useState<EvalScoreOut[]>([]);
  const [evalWinner, setEvalWinner] = useState<string | null>(null);

  const [history, setHistory] = useState<QuerySummary[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryDetail | null>(null);
  const [view, setView] = useState<'new' | 'history'>('new');

  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [refinePhase, setRefinePhase] = useState<RefinePhase>('idle');
  const [liveRefineRestore, setLiveRefineRestore] = useState<RefineResponse | null>(null);

  useEffect(() => {
    loadHistory();
    fetchGraphCapacity().then(setGraphCapacity).catch(() => {});
  }, []);

  // When returning to a live result, check if backend has saved refine results
  useEffect(() => {
    if (!result || refinePhase !== 'idle' || liveRefineRestore) return;
    fetchQueryDetail(result.query_id)
      .then(detail => {
        if (detail.pending_refine) setLiveRefineRestore(detail.pending_refine);
      })
      .catch(() => {});
  }, [result, refinePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadHistory() {
    fetchQueryHistory().then(setHistory).catch(() => {});
  }

  function buildSlotSpecs(): SlotSpec[] {
    return slotConfigs.map(sc => {
      const isNeuron = NEURON_MODES.has(sc.mode);
      const modeLabel = ALL_MODES.find(m => m.key === sc.mode)?.label ?? sc.mode;
      const label = isNeuron
        ? `${modeLabel} @ ${(sc.tokenBudget / 1000).toFixed(0)}K / K=${sc.topK} / Pool=${sc.candidatePool}`
        : undefined;
      return {
        mode: sc.mode,
        token_budget: sc.tokenBudget,
        top_k: sc.topK,
        candidate_pool: isNeuron ? sc.candidatePool : undefined,
        label,
      };
    });
  }

  async function handleSubmit() {
    const specs = buildSlotSpecs();
    if (!message.trim() || specs.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    setEvalText(null);
    setEvalScores([]);
    setEvalWinner(null);
    setRated(false);
    setRefinePhase('idle');
    setLiveRefineRestore(null);
    setView('new');
    setSelectedQuery(null);
    // Start elapsed timer
    const t0 = Date.now();
    elapsedRef.current = 0;
    setElapsedMs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsedRef.current = Date.now() - t0;
      setElapsedMs(elapsedRef.current);
    }, 100);
    // Mark all slots as loading
    setSlotLoadingSet(new Set(slotConfigs.map((_, i) => i)));
    // Add pending entry to history immediately
    const pendingEntry: QuerySummary = {
      id: -Date.now(),
      user_message: message,
      classified_intent: null,
      modes: specs.map(s => s.mode),
      cost_usd: null,
      user_rating: null,
      created_at: new Date().toISOString(),
    };
    setHistory(prev => [pendingEntry, ...prev]);
    try {
      const res = await submitQuery(message, specs);
      setResult(res);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsedMs(elapsedRef.current); // freeze final value
      setLoading(false);
      setSlotLoadingSet(new Set());
    }
  }

  function handleNewQuery() {
    setMessage('');
    setResult(null);
    setEvalText(null);
    setEvalScores([]);
    setEvalWinner(null);
    setRated(false);
    setRefinePhase('idle');
    setLiveRefineRestore(null);
    setError('');
    setView('new');
    setSelectedQuery(null);
    document.querySelector('.query-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleRunAgain() {
    setResult(null);
    setEvalText(null);
    setEvalScores([]);
    setEvalWinner(null);
    setRated(false);
    setRefinePhase('idle');
    setLiveRefineRestore(null);
    setView('new');
    setSelectedQuery(null);
    document.querySelector('.query-form')?.scrollIntoView({ behavior: 'smooth' });
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
      setRefinePhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load query');
    }
  }

  const hasResult = !!result && view === 'new';
  const hasNeurons = hasResult && result.neuron_scores.length > 0;
  const hasMultiSlot = hasResult && result.slots.length >= 2;

  return (
    <div className="query-lab-layout">
      <div className={`query-history${historyCollapsed ? ' collapsed' : ''}`}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span onClick={() => setHistoryCollapsed(c => !c)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            <span className={`section-chevron${!historyCollapsed ? ' open' : ''}`} />
            {!historyCollapsed ? 'Query History' : ''}
          </span>
          {!historyCollapsed && (
            <button
              className="btn btn-sm"
              title="New query"
              style={{ padding: '2px 7px', fontSize: '0.85rem', lineHeight: 1 }}
              onClick={handleNewQuery}
            >+</button>
          )}
        </h3>
        {!historyCollapsed && (
          <>
            {history.length === 0 && <div className="history-empty">No queries yet</div>}
            {history.map(q => {
              const isPending = q.id < 0;
              return (
                <div
                  key={q.id}
                  className={`history-item${selectedQuery?.id === q.id ? ' selected' : ''}${isPending ? ' pending' : ''}`}
                  onClick={() => !isPending && selectHistoryItem(q.id)}
                  style={isPending ? { cursor: 'default' } : undefined}
                >
                  <div className="history-msg">{q.user_message}</div>
                  <div className="history-meta">
                    {isPending && <span className="tag intent" style={{ opacity: 0.7 }}>Running...</span>}
                    {!isPending && q.classified_intent && <span className="tag intent">{q.classified_intent}</span>}
                    <span className="history-modes">
                      {q.modes.map(m => {
                        const def = ALL_MODES.find(d => d.key === m);
                        return <span key={m} className="mode-badge" style={{ background: (MODE_COLORS[m] ?? '#c8d0dc') + '33', color: MODE_COLORS[m] ?? '#c8d0dc' }}>{def?.short ?? m}</span>;
                      })}
                    </span>
                    {q.cost_usd != null && <span className="history-cost">${q.cost_usd.toFixed(4)}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
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
            <SlotBuilder slots={slotConfigs} onChange={setSlotConfigs} capacity={graphCapacity} />
            <div className="query-controls-bottom">
              <select className="baseline-select" value={baseline} onChange={e => setBaseline(e.target.value)}>
                {ALL_MODES.map(m => (
                  <option key={m.key} value={m.key}>Baseline: {m.label}</option>
                ))}
              </select>
              <button className="btn" onClick={handleSubmit} disabled={loading || !message.trim() || slotConfigs.length === 0}>
                {loading ? 'Processing...' : `Submit (${slotConfigs.length} slot${slotConfigs.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Per-slot loading indicators */}
        {loading && (
          <div className="slot-loading-panel">
            <div className="slot-loading-timer">{(elapsedMs / 1000).toFixed(1)}s</div>
            {slotConfigs.map((sc, i) => {
              const modeInfo = ALL_MODES.find(m => m.key === sc.mode);
              const isNeuron = NEURON_MODES.has(sc.mode);
              const label = isNeuron
                ? `${modeInfo?.label ?? sc.mode} @ ${(sc.tokenBudget / 1000).toFixed(0)}K`
                : (modeInfo?.label ?? sc.mode);
              const done = !slotLoadingSet.has(i);
              return (
                <div key={sc.id} className={`slot-loading-item${done ? ' done' : ''}`}>
                  {!done && <span className="slot-spinner" />}
                  {done && <span className="slot-check">&#10003;</span>}
                  <span className="slot-loading-label" style={{ color: MODE_COLORS[sc.mode] ?? '#c8d0dc' }}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {result && view === 'new' && (
          <LiveResult
            result={result} baseline={baseline}
            totalElapsedMs={elapsedMs}
            rating={rating} setRating={setRating} rated={rated} onRate={handleRate}
            evalText={evalText} evalMdl={evalMdl} evalIn={evalIn} evalOut={evalOut}
            evalScores={evalScores} evalWinner={evalWinner}
            evalModel={evalModel} setEvalModel={setEvalModel}
            evalLoading={evalLoading} onEval={handleEval}
            onRunAgain={handleRunAgain} onRefinePhaseChange={setRefinePhase}
            initialRefineResult={liveRefineRestore}
            onNavigateToNeuron={onNavigateToNeuron}
          />
        )}

        {selectedQuery && view === 'history' && <HistoryDetail query={selectedQuery} baseline={baseline} onNavigateToNeuron={onNavigateToNeuron} />}
      </div>

      {hasResult && (
        <ActionRail
          hasResult={hasResult}
          hasMultiSlot={hasMultiSlot}
          hasNeurons={hasNeurons}
          evalDone={!!evalText}
          evalLoading={evalLoading}
          refinePhase={refinePhase}
          loading={loading}
          onEval={handleEval}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ────────── Live Result ──────────

function LiveResult({ result, baseline, totalElapsedMs, rating, setRating, rated, onRate, evalText, evalMdl, evalIn, evalOut, evalScores, evalWinner, evalModel, setEvalModel, evalLoading, onEval, onRunAgain, onRefinePhaseChange, initialRefineResult, onNavigateToNeuron }: {
  result: QueryResponse; baseline: string; totalElapsedMs?: number;
  rating: number; setRating: (v: number) => void; rated: boolean; onRate: () => void;
  evalText: string | null; evalMdl: string | null; evalIn: number; evalOut: number;
  evalScores: EvalScoreOut[]; evalWinner: string | null;
  evalModel: 'haiku' | 'sonnet' | 'opus'; setEvalModel: (v: 'haiku' | 'sonnet' | 'opus') => void;
  evalLoading: boolean; onEval: () => void;
  onRunAgain: () => void; onRefinePhaseChange: (phase: RefinePhase) => void;
  initialRefineResult?: RefineResponse | null;
  onNavigateToNeuron?: (id: number) => void;
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
              <tr><th>Neuron</th><th>Combined</th><th>Spread</th><th>Burst</th><th>Impact</th><th>Precision</th><th>Novelty</th><th>Recency</th><th>Relevance</th></tr>
            </thead>
            <tbody>
              {result.neuron_scores.slice(0, 10).map(s => (
                <tr key={s.neuron_id}>
                  <td title={`ID: ${s.neuron_id}`} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label ? `${s.label} (${s.department || '?'})` : `#${s.neuron_id}`}</td><td>{s.combined.toFixed(3)}</td>
                  <td style={s.spread_boost > 0 ? { color: '#e8a735', fontWeight: 600 } : undefined}>{s.spread_boost > 0 ? s.spread_boost.toFixed(3) : '—'}</td>
                  <td>{s.burst.toFixed(3)}</td>
                  <td>{s.impact.toFixed(3)}</td><td>{s.precision.toFixed(3)}</td>
                  <td>{s.novelty.toFixed(3)}</td><td>{s.recency.toFixed(3)}</td><td>{s.relevance.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {result.neuron_scores.length > 0 && (
        <Section title="Activation Graph" defaultOpen={false}>
          <SpreadTrail queryId={result.query_id} neuronScores={result.neuron_scores} onNavigateToNeuron={onNavigateToNeuron} />
        </Section>
      )}

      {/* Input Guard */}
      {result.input_guard && result.input_guard.flag_count > 0 && (
        <div style={{
          padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: '0.8rem',
          background: result.input_guard.verdict === 'warn' ? '#fb923c18' : '#ef444418',
          border: `1px solid ${result.input_guard.verdict === 'warn' ? '#fb923c44' : '#ef444444'}`,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: result.input_guard.verdict === 'warn' ? '#fb923c' : '#ef4444' }}>
            Input Guard: {result.input_guard.verdict.toUpperCase()} ({result.input_guard.flag_count} flag{result.input_guard.flag_count !== 1 ? 's' : ''})
          </div>
          {result.input_guard.flags.map((f, i) => (
            <div key={i} style={{ color: 'var(--text-dim)' }}>
              <span style={{ color: f.severity === 'warn' ? '#fb923c' : '#ef4444', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{f.severity}</span>
              {' '}{f.description}{f.pattern ? ` — "${f.pattern}"` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Responses with output checks */}
      {result.slots.map((slot, i) => {
        const check = result.output_checks?.[i];
        return (
          <Section key={i} title={slotDisplayLabel(slot)} titleStyle={{ borderLeft: `3px solid ${MODE_COLORS[slot.mode] ?? '#c8d0dc'}`, paddingLeft: 8 }}>
            {check && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {check.grounding && check.grounding.confidence !== null && (
                  <span style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono, monospace)',
                    background: check.grounding.grounded ? '#22c55e22' : '#fb923c22',
                    color: check.grounding.grounded ? '#22c55e' : '#fb923c',
                    border: `1px solid ${check.grounding.grounded ? '#22c55e44' : '#fb923c44'}`,
                  }} title={check.grounding.reason}>
                    Grounding: {(check.grounding.confidence * 100).toFixed(0)}%
                    {check.grounding.ungrounded_references && check.grounding.ungrounded_references.length > 0 &&
                      ` (${check.grounding.ungrounded_references.length} unverified ref${check.grounding.ungrounded_references.length !== 1 ? 's' : ''})`
                    }
                  </span>
                )}
                {check.risk_flags.map((rf, j) => (
                  <span key={j} style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono, monospace)',
                    background: rf.category === 'dual_use' ? '#ef444422' : rf.category === 'safety_critical' ? '#fb923c22' : '#3b82f622',
                    color: rf.category === 'dual_use' ? '#ef4444' : rf.category === 'safety_critical' ? '#fb923c' : '#3b82f6',
                    border: `1px solid ${rf.category === 'dual_use' ? '#ef444444' : rf.category === 'safety_critical' ? '#fb923c44' : '#3b82f644'}`,
                  }} title={rf.excerpt}>
                    {rf.category}: {rf.description}
                  </span>
                ))}
              </div>
            )}
            <div className="response-text">{slot.response}</div>
          </Section>
        );
      })}

      {/* Token Charts */}
      <Section title="Cost & Tokens">
        <TokenCharts {...slotsToChartModels(result.slots, result.classify_cost, baseline)} totalElapsedMs={totalElapsedMs} />
      </Section>

      {/* Compare */}
      {result.slots.length >= 2 && (
        <Section id="section-compare" title="Compare Outputs" className="eval-card" headerRight={
          <div className="eval-controls">
            <select value={evalModel} onChange={e => setEvalModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}>
              <option value="haiku">Evaluate with Haiku</option>
              <option value="sonnet">Evaluate with Sonnet</option>
              <option value="opus">Evaluate with Opus</option>
            </select>
            <button className="btn btn-sm" onClick={onEval} disabled={evalLoading || !!evalText}>
              {evalLoading ? 'Evaluating...' : evalText ? 'Evaluated' : 'Compare Outputs'}
            </button>
          </div>
        }>
          {evalText && (
            <div className="eval-result">
              <div className="eval-model-tag">Evaluated by {evalMdl}</div>
              <EvalScoreTable scores={evalScores} winner={evalWinner} slots={result.slots} />
              <div className="response-text" style={{ marginTop: 12 }}>{evalText}</div>
              <div className="token-breakdown" style={{ marginTop: 12 }}>
                <div className="breakdown-item"><div className="bd-value">{evalIn}</div><div className="bd-label">Eval In</div></div>
                <div className="breakdown-item"><div className="bd-value">{evalOut}</div><div className="bd-label">Eval Out</div></div>
              </div>
            </div>
          )}
        </Section>
      )}

      <RefinePanel queryId={result.query_id} hasEval={!!evalText} hasNeurons={hasNeurons} onRunAgain={onRunAgain} onPhaseChange={onRefinePhaseChange} initialRefineResult={initialRefineResult} onNavigateToNeuron={onNavigateToNeuron} />

      {result.slots.length >= 1 && (
        <Section title="Export for External Review">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 12 }}>
            Download a blind evaluation file for an external model (e.g., ChatGPT). Answers are labeled A/B/C with no model identification.
          </p>
          <button className="btn btn-sm" onClick={() => {
            const lines: string[] = [];
            lines.push('='.repeat(80));
            lines.push('BLIND EVALUATION REQUEST');
            lines.push('='.repeat(80));
            lines.push('');
            lines.push('You are evaluating multiple AI-generated answers to the same prompt.');
            lines.push('Each answer is labeled with a letter (A, B, C, etc.). You do not know');
            lines.push('which model produced which answer.');
            lines.push('');
            lines.push('Score each answer on the following dimensions (1-5 scale):');
            lines.push('');
            lines.push('  Accuracy      - Are the facts, standards, and procedures correct?');
            lines.push('  Completeness  - Does it cover all relevant aspects of the question?');
            lines.push('  Clarity       - Is it well-organized and easy to follow?');
            lines.push('  Faithfulness  - Does it avoid hallucinated facts or made-up references?');
            lines.push('  Overall       - Holistic quality considering all dimensions above.');
            lines.push('');
            lines.push('After scoring, select a winner (the best overall answer).');
            lines.push('Provide a brief justification for your scores and winner selection.');
            lines.push('');
            lines.push('='.repeat(80));
            lines.push('PROMPT');
            lines.push('='.repeat(80));
            lines.push('');
            lines.push(`User query: ${baseline}`);
            lines.push('');

            result.slots.forEach((slot, i) => {
              const label = String.fromCharCode(65 + i);
              lines.push('='.repeat(80));
              lines.push(`ANSWER ${label}`);
              lines.push('='.repeat(80));
              lines.push('');
              lines.push(slot.response);
              lines.push('');
            });

            if (evalScores.length > 0) {
              lines.push('='.repeat(80));
              lines.push('INTERNAL EVALUATION (for comparison — do not let this bias your scoring)');
              lines.push('='.repeat(80));
              lines.push('');
              lines.push('Dimension'.padEnd(16) + evalScores.map(s => `Answer ${s.answer_label}`.padEnd(12)).join(''));
              lines.push('-'.repeat(16 + evalScores.length * 12));
              for (const dim of ['accuracy', 'completeness', 'clarity', 'faithfulness', 'overall'] as const) {
                const label = dim.charAt(0).toUpperCase() + dim.slice(1);
                lines.push(label.padEnd(16) + evalScores.map(s => `${s[dim]}/5`.padEnd(12)).join(''));
              }
              lines.push('');
              if (evalWinner) {
                lines.push(`Internal winner: Answer ${evalWinner}`);
              }
              if (evalText) {
                lines.push('');
                lines.push('Internal verdict:');
                lines.push(evalText);
              }
            }

            lines.push('');
            lines.push('='.repeat(80));
            lines.push('END OF EVALUATION FILE');
            lines.push('='.repeat(80));

            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yggdrasil-blind-eval-q${result.query_id}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            Export Blind Evaluation (.txt)
          </button>
        </Section>
      )}

      <Section title="Rate Response">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            className="btn btn-sm"
            style={{ fontSize: '1.1rem', padding: '4px 12px', background: rated && rating >= 0.7 ? '#22c55e33' : undefined, border: rated && rating >= 0.7 ? '1px solid #22c55e' : undefined }}
            onClick={() => { setRating(0.85); }}
            disabled={rated}
            title="Good response (0.85)"
          >
            {'👍'}
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: '1.1rem', padding: '4px 12px', background: rated && rating < 0.3 ? '#ef444433' : undefined, border: rated && rating < 0.3 ? '1px solid #ef4444' : undefined }}
            onClick={() => { setRating(0.15); }}
            disabled={rated}
            title="Poor response (0.15)"
          >
            {'👎'}
          </button>
          <button className="btn btn-sm" onClick={onRate} disabled={rated} style={{ marginLeft: 'auto' }}>{rated ? 'Rated!' : 'Submit Rating'}</button>
        </div>
        <div className="rating-row">
          <input type="range" min="0" max="1" step="0.05" value={rating} onChange={e => setRating(parseFloat(e.target.value))} disabled={rated} />
          <span className="rating-value">{rating.toFixed(2)}</span>
        </div>
      </Section>
    </>
  );
}

// ────────── History Detail ──────────

function HistoryDetail({ query, baseline, onNavigateToNeuron }: { query: QueryDetail; baseline: string; onNavigateToNeuron?: (id: number) => void }) {
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalModel, setEvalModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
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
            {query.slots.map((s, i) => {
              const label = slotDisplayLabel(s);
              return <span key={i} className="mode-badge" style={{ background: (MODE_COLORS[s.mode] ?? '#c8d0dc') + '33', color: MODE_COLORS[s.mode] ?? '#c8d0dc' }}>{label}</span>;
            })}
          </span>
        </h3>
        <div className="response-text" style={{ marginBottom: 12, position: 'relative' }}>
          {query.user_message}
          <button
            className="copy-btn"
            title="Copy prompt"
            onClick={() => {
              navigator.clipboard.writeText(query.user_message);
            }}
          >
            Copy
          </button>
        </div>
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
              <tr><th>ID</th><th>Neuron</th><th>Layer</th><th>Dept</th><th>Combined</th><th>Spread</th><th>Burst</th><th>Impact</th><th>Precision</th><th>Novelty</th><th>Recency</th><th>Relevance</th></tr>
            </thead>
            <tbody>
              {query.neuron_hits.map(h => (
                <tr key={h.neuron_id}>
                  <td>{h.neuron_id}</td>
                  <td style={{ color: layerColors[h.layer], maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</td>
                  <td><span style={{ color: layerColors[h.layer] }}>L{h.layer}</span></td>
                  <td style={{ fontSize: '0.75rem' }}>{h.department ?? '—'}</td>
                  <td><strong>{h.combined.toFixed(3)}</strong></td>
                  <td style={h.spread_boost > 0 ? { color: '#e8a735', fontWeight: 600 } : undefined}>{h.spread_boost > 0 ? h.spread_boost.toFixed(3) : '—'}</td>
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

      {query.neuron_hits.length > 0 && (
        <Section title="Activation Graph" defaultOpen={false}>
          <SpreadTrail queryId={query.id} neuronScores={query.neuron_hits.map(h => ({
            neuron_id: h.neuron_id, combined: h.combined, burst: h.burst,
            impact: h.impact, precision: h.precision, novelty: h.novelty,
            recency: h.recency, relevance: h.relevance, spread_boost: h.spread_boost,
            label: h.label, department: h.department, layer: h.layer,
          }))} onNavigateToNeuron={onNavigateToNeuron} />
        </Section>
      )}

      {/* Responses */}
      {query.slots.map((slot, i) => (
        <Section key={i} title={slotDisplayLabel(slot)} titleStyle={{ borderLeft: `3px solid ${MODE_COLORS[slot.mode] ?? '#c8d0dc'}`, paddingLeft: 8 }}>
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
            <select value={evalModel} onChange={e => setEvalModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}>
              <option value="haiku">Evaluate with Haiku</option>
              <option value="sonnet">Evaluate with Sonnet</option>
              <option value="opus">Evaluate with Opus</option>
            </select>
            <button className="btn btn-sm" onClick={handleEval} disabled={evalLoading}>
              {evalLoading ? 'Evaluating...' : localEvalText ? 'Re-evaluate' : 'Compare Outputs'}
            </button>
          </div>
        }>
          {localEvalText && (
            <div className="eval-result">
              <div className="eval-model-tag">Evaluated by {localEvalMdl}</div>
              <EvalScoreTable scores={localEvalScores} winner={localEvalWinner} slots={query.slots} />
              <div className="response-text" style={{ marginTop: 12 }}>{localEvalText}</div>
              <div className="token-breakdown" style={{ marginTop: 12 }}>
                <div className="breakdown-item"><div className="bd-value">{localEvalIn}</div><div className="bd-label">Eval In</div></div>
                <div className="breakdown-item"><div className="bd-value">{localEvalOut}</div><div className="bd-label">Eval Out</div></div>
              </div>
            </div>
          )}
        </Section>
      )}

      {query.slots.length >= 1 && (
        <Section title="Export for External Review">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 12 }}>
            Download a blind evaluation file for an external model (e.g., ChatGPT). Answers are labeled A/B/C with no model identification.
          </p>
          <button className="btn btn-sm" onClick={() => {
            const lines: string[] = [];
            lines.push('='.repeat(80));
            lines.push('BLIND EVALUATION REQUEST');
            lines.push('='.repeat(80));
            lines.push('');
            lines.push('You are evaluating multiple AI-generated answers to the same prompt.');
            lines.push('Each answer is labeled with a letter (A, B, C, etc.). You do not know');
            lines.push('which model produced which answer.');
            lines.push('');
            lines.push('Score each answer on the following dimensions (1-5 scale):');
            lines.push('');
            lines.push('  Accuracy      - Are the facts, standards, and procedures correct?');
            lines.push('  Completeness  - Does it cover all relevant aspects of the question?');
            lines.push('  Clarity       - Is it well-organized and easy to follow?');
            lines.push('  Faithfulness  - Does it avoid hallucinated facts or made-up references?');
            lines.push('  Overall       - Holistic quality considering all dimensions above.');
            lines.push('');
            lines.push('After scoring, select a winner (the best overall answer).');
            lines.push('Provide a brief justification for your scores and winner selection.');
            lines.push('');
            lines.push('='.repeat(80));
            lines.push('PROMPT');
            lines.push('='.repeat(80));
            lines.push('');
            lines.push(`User query: ${query.user_message}`);
            lines.push('');

            query.slots.forEach((slot, i) => {
              const label = String.fromCharCode(65 + i);
              lines.push('='.repeat(80));
              lines.push(`ANSWER ${label}`);
              lines.push('='.repeat(80));
              lines.push('');
              lines.push(slot.response);
              lines.push('');
            });

            if (localEvalScores.length > 0) {
              lines.push('='.repeat(80));
              lines.push('INTERNAL EVALUATION (for comparison — do not let this bias your scoring)');
              lines.push('='.repeat(80));
              lines.push('');
              lines.push('Dimension'.padEnd(16) + localEvalScores.map(s => `Answer ${s.answer_label}`.padEnd(12)).join(''));
              lines.push('-'.repeat(16 + localEvalScores.length * 12));
              for (const dim of ['accuracy', 'completeness', 'clarity', 'faithfulness', 'overall'] as const) {
                const dimLabel = dim.charAt(0).toUpperCase() + dim.slice(1);
                lines.push(dimLabel.padEnd(16) + localEvalScores.map(s => `${s[dim]}/5`.padEnd(12)).join(''));
              }
              lines.push('');
              if (localEvalWinner) {
                lines.push(`Internal winner: Answer ${localEvalWinner}`);
              }
              if (localEvalText) {
                lines.push('');
                lines.push('Internal verdict:');
                lines.push(localEvalText);
              }
            }

            lines.push('');
            lines.push('='.repeat(80));
            lines.push('END OF EVALUATION FILE');
            lines.push('='.repeat(80));

            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yggdrasil-blind-eval-q${query.id}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            Export Blind Evaluation (.txt)
          </button>
        </Section>
      )}

      <RefinePanel queryId={query.id} hasEval={!!localEvalText} hasNeurons={hasNeurons} initialRefineResult={query.pending_refine} onNavigateToNeuron={onNavigateToNeuron} />

      {query.refinements && query.refinements.length > 0 && (
        <Section title={`Applied Refinements (${query.refinements.length})`} defaultOpen={true}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {query.refinements.map(r => (
              <div key={r.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 600,
                    background: r.action === 'create' ? 'rgba(34,197,94,0.15)' : 'rgba(250,204,21,0.15)',
                    color: r.action === 'create' ? '#22c55e' : '#facc15',
                  }}>
                    {r.action === 'create' ? 'CREATED' : 'UPDATED'}
                  </span>
                  <span
                    style={{ fontSize: '0.85rem', color: 'var(--text-bright, #e0e0e0)', cursor: onNavigateToNeuron ? 'pointer' : undefined }}
                    onClick={onNavigateToNeuron ? () => onNavigateToNeuron(r.neuron_id) : undefined}
                    title={onNavigateToNeuron ? 'View in Explorer' : undefined}
                  >
                    <span style={{ color: '#60a5fa', textDecoration: onNavigateToNeuron ? 'underline' : undefined }}>#{r.neuron_id}</span> {r.neuron_label ?? ''}
                  </span>
                  {r.field && <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>{r.field}</span>}
                </div>
                {r.action === 'update' && r.old_value && r.new_value && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    <div style={{ color: '#f87171', opacity: 0.7 }}>{r.old_value.length > 200 ? r.old_value.slice(0, 200) + '...' : r.old_value}</div>
                    <div style={{ color: '#4ade80', marginTop: 2 }}>{r.new_value.length > 200 ? r.new_value.slice(0, 200) + '...' : r.new_value}</div>
                  </div>
                )}
                {r.action === 'create' && r.new_value && (
                  <div style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: 4 }}>{r.new_value}</div>
                )}
                {r.reason && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>{r.reason}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {hasNeurons && query.assembled_prompt && (
        <Section title="Assembled System Prompt" defaultOpen={false}>
          <div className="response-text">{query.assembled_prompt}</div>
        </Section>
      )}
    </>
  );
}
