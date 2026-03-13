import { useState, useEffect, useCallback } from 'react';
import {
  fetchObservations,
  fetchObservationDetail,
  evaluateObservation,
  applyObservation,
  rejectObservation,
} from '../api';
import type {
  ObservationSummary,
  ObservationDetail,
  NeuronUpdateSuggestion,
  NewNeuronSuggestion,
} from '../types';

const STATUS_FILTERS = ['', 'queued', 'evaluated', 'approved', 'rejected', 'duplicate'] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  queued: { bg: 'rgba(56,189,248,0.15)', color: 'var(--accent)' },
  evaluated: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: 'var(--precision)' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: 'var(--impact)' },
  duplicate: { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)' },
};

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  create: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  update: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  merge: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  dismiss: { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-dim)' },
};

export default function ObservationReviewPage() {
  const [observations, setObservations] = useState<ObservationSummary[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ObservationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [model, setModel] = useState<string>('haiku');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [checkedUpdates, setCheckedUpdates] = useState<Set<number>>(new Set());
  const [checkedNewNeurons, setCheckedNewNeurons] = useState<Set<number>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadObservations = useCallback(async () => {
    try {
      const data = await fetchObservations(filter || undefined);
      setObservations(data);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => { loadObservations(); }, [loadObservations]);

  const loadDetail = useCallback(async (id: number) => {
    setSelectedId(id);
    setLoading(true);
    setError(null);
    setCheckedUpdates(new Set());
    setCheckedNewNeurons(new Set());
    try {
      const d = await fetchObservationDetail(id);
      setDetail(d);
      // Auto-check all proposals
      if (d.eval_json) {
        setCheckedUpdates(new Set(d.eval_json.updates.map((_, i) => i)));
        setCheckedNewNeurons(new Set(d.eval_json.new_neurons.map((_, i) => i)));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEvaluate = async (obsId: number) => {
    setEvalLoading(true);
    setError(null);
    try {
      await evaluateObservation(obsId, model);
      await loadDetail(obsId);
      await loadObservations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleBatchEvaluate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBatchProgress({ done: 0, total: ids.length });
    setError(null);
    try {
      // Evaluate sequentially to show progress
      for (let i = 0; i < ids.length; i++) {
        try {
          await evaluateObservation(ids[i], model);
        } catch { /* continue */ }
        setBatchProgress({ done: i + 1, total: ids.length });
      }
      setSelectedIds(new Set());
      await loadObservations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Batch evaluation failed');
    } finally {
      setBatchProgress(null);
    }
  };

  const handleApply = async () => {
    if (!detail || !selectedId) return;
    setApplyLoading(true);
    setError(null);
    try {
      await applyObservation(selectedId, Array.from(checkedUpdates), Array.from(checkedNewNeurons));
      await loadDetail(selectedId);
      await loadObservations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleReject = async (obsId: number) => {
    try {
      await rejectObservation(obsId);
      if (selectedId === obsId) {
        await loadDetail(obsId);
      }
      await loadObservations();
    } catch { /* ignore */ }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllQueued = () => {
    const queued = observations.filter(o => o.status === 'queued').map(o => o.id);
    setSelectedIds(new Set(queued));
  };

  const queuedCount = observations.filter(o => o.status === 'queued').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel: observation list */}
      <div style={{ width: 420, minWidth: 320, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
        {/* Header with batch controls */}
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Observations
            </h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{
                  padding: '3px 8px', fontSize: '0.7rem', borderRadius: 4,
                  background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <option value="haiku">Haiku</option>
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
              </select>
            </div>
          </div>

          {/* Batch actions */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            {queuedCount > 0 && (
              <>
                <button
                  onClick={selectAllQueued}
                  style={{
                    padding: '2px 8px', fontSize: '0.65rem', borderRadius: 4,
                    background: 'var(--bg-input)', color: 'var(--text-dim)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Select All Queued ({queuedCount})
                </button>
                {selectedIds.size > 0 && (
                  <button
                    className="btn"
                    onClick={handleBatchEvaluate}
                    disabled={!!batchProgress}
                    style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                  >
                    {batchProgress
                      ? `Evaluating ${batchProgress.done}/${batchProgress.total}...`
                      : `Evaluate Selected (${selectedIds.size})`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '2px 8px', fontSize: '0.65rem', borderRadius: 4,
                  background: filter === f ? 'var(--accent)' : 'var(--bg-input)',
                  color: filter === f ? '#000' : 'var(--text-dim)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Observation cards */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {observations.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', padding: 20, textAlign: 'center', fontSize: '0.8rem' }}>
              No observations found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {observations.map(o => {
                const sc = STATUS_COLORS[o.status] || STATUS_COLORS.duplicate;
                return (
                  <div
                    key={o.id}
                    onClick={() => loadDetail(o.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: selectedId === o.id ? 'rgba(56,189,248,0.08)' : 'transparent',
                      border: selectedId === o.id ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      {o.status === 'queued' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={e => { e.stopPropagation(); toggleSelect(o.id); }}
                          onClick={e => e.stopPropagation()}
                          style={{ marginRight: 2 }}
                        />
                      )}
                      <span style={{
                        padding: '1px 5px', borderRadius: 3, fontSize: '0.6rem', fontWeight: 600,
                        textTransform: 'uppercase', background: sc.bg, color: sc.color,
                      }}>
                        {o.status}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{o.observation_type}</span>
                      {o.proposed_department && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>· {o.proposed_department}</span>
                      )}
                      {o.similarity_score != null && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                          · {(o.similarity_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {o.text}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 3 }}>
                      {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                      {o.eval_model && <span> · eval: {o.eval_model}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: detail + review */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        {!selectedId ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 60, fontSize: '0.85rem' }}>
            Select an observation from the list to review
          </div>
        ) : loading ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 60, fontSize: '0.85rem' }}>
            Loading...
          </div>
        ) : detail ? (
          <div>
            {/* Observation header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
                  Observation #{detail.id}
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 600,
                    textTransform: 'uppercase',
                    ...(STATUS_COLORS[detail.status] || STATUS_COLORS.duplicate),
                  }}>
                    {detail.status}
                  </span>
                  <span>{detail.observation_type}</span>
                  {detail.proposed_department && <span>· {detail.proposed_department}</span>}
                  {detail.app_context && <span>· {detail.app_context}</span>}
                  {detail.created_at && <span>· {new Date(detail.created_at).toLocaleString()}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(detail.status === 'queued' || detail.status === 'evaluated') && (
                  <button
                    className="btn"
                    onClick={() => handleEvaluate(detail.id)}
                    disabled={evalLoading}
                    style={{ fontSize: '0.7rem', padding: '4px 12px' }}
                  >
                    {evalLoading ? 'Evaluating...' : detail.status === 'evaluated' ? 'Re-evaluate' : 'Evaluate'}
                  </button>
                )}
                {(detail.status === 'queued' || detail.status === 'evaluated') && (
                  <button
                    onClick={() => handleReject(detail.id)}
                    style={{
                      fontSize: '0.7rem', padding: '4px 12px', borderRadius: 4,
                      background: 'var(--bg-input)', color: 'var(--text-dim)',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            {/* Observation text */}
            <div className="result-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {detail.text}
              </div>
              {detail.entities.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {detail.entities.map((e, i) => (
                    <span key={i} style={{
                      padding: '1px 6px', borderRadius: 10, fontSize: '0.65rem',
                      background: 'rgba(56,189,248,0.1)', color: 'var(--accent)',
                    }}>
                      {e.type}: {e.value}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Similar neuron */}
            {detail.similar_neuron && (
              <div className="result-card" style={{ padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Most Similar Neuron ({detail.similarity_score ? (detail.similarity_score * 100).toFixed(0) + '%' : '?'})
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                  <strong>[{detail.similar_neuron.id}]</strong> L{detail.similar_neuron.layer} {detail.similar_neuron.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  {detail.similar_neuron.department} · {detail.similar_neuron.invocations} invocations · utility: {detail.similar_neuron.avg_utility.toFixed(2)}
                </div>
                {detail.similar_neuron.summary && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                    {detail.similar_neuron.summary}
                  </div>
                )}
              </div>
            )}

            {/* Evaluation results */}
            {detail.eval_json && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    LLM Evaluation
                  </h4>
                  {detail.eval_model && (
                    <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: '0.6rem', background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                      {detail.eval_model}
                    </span>
                  )}
                  {(() => {
                    const ac = ACTION_COLORS[detail.eval_json!.action] || ACTION_COLORS.dismiss;
                    return (
                      <span style={{
                        padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 600,
                        textTransform: 'uppercase', background: ac.bg, color: ac.color,
                      }}>
                        {detail.eval_json!.action}
                      </span>
                    );
                  })()}
                  {detail.eval_input_tokens > 0 && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                      {detail.eval_input_tokens + detail.eval_output_tokens} tokens
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                <div className="result-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    {detail.eval_json.reasoning}
                  </div>
                </div>

                {/* Update proposals */}
                {detail.eval_json.updates.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Updates</div>
                    {detail.eval_json.updates.map((u: NeuronUpdateSuggestion, i: number) => (
                      <div key={i} className="result-card" style={{ padding: '8px 12px', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {detail.status === 'evaluated' && (
                          <input
                            type="checkbox"
                            checked={checkedUpdates.has(i)}
                            onChange={() => {
                              setCheckedUpdates(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              });
                            }}
                            style={{ marginTop: 2 }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text)' }}>
                            <strong>Neuron #{u.neuron_id}</strong> · {u.field}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2 }}>
                            <span style={{ color: 'var(--impact)' }}>- {u.old_value.substring(0, 200)}</span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                            <span style={{ color: 'var(--precision)' }}>+ {u.new_value.substring(0, 200)}</span>
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 2, fontStyle: 'italic' }}>
                            {u.reason}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New neuron proposals */}
                {detail.eval_json.new_neurons.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>New Neurons</div>
                    {detail.eval_json.new_neurons.map((n: NewNeuronSuggestion, i: number) => (
                      <div key={i} className="result-card" style={{ padding: '8px 12px', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {detail.status === 'evaluated' && (
                          <input
                            type="checkbox"
                            checked={checkedNewNeurons.has(i)}
                            onChange={() => {
                              setCheckedNewNeurons(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              });
                            }}
                            style={{ marginTop: 2 }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text)' }}>
                            <strong>L{n.layer}</strong> {n.label}
                            {n.parent_id && <span style={{ color: 'var(--text-dim)' }}> (parent: #{n.parent_id})</span>}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2 }}>
                            {n.department} · {n.role_key} · {n.node_type}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text)', marginTop: 4, lineHeight: 1.4 }}>
                            {n.content.substring(0, 300)}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 2, fontStyle: 'italic' }}>
                            {n.reason}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Merge proposal */}
                {detail.eval_json.action === 'merge' && detail.eval_json.merge_target_id && (
                  <div className="result-card" style={{ padding: '8px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a855f7', marginBottom: 4 }}>
                      Merge into Neuron #{detail.eval_json.merge_target_id}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text)', lineHeight: 1.4 }}>
                      {detail.eval_json.merge_content_delta}
                    </div>
                  </div>
                )}

                {/* Dismiss reasoning */}
                {detail.eval_json.action === 'dismiss' && (
                  <div className="result-card" style={{ padding: '8px 12px', marginBottom: 10, borderLeft: '2px solid var(--text-dim)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      LLM recommends dismissing this observation.
                    </div>
                  </div>
                )}

                {/* Apply bar */}
                {detail.status === 'evaluated' && detail.eval_json.action !== 'dismiss' && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px',
                    background: 'rgba(34,197,94,0.06)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.15)',
                  }}>
                    <button
                      className="btn"
                      onClick={handleApply}
                      disabled={applyLoading || (checkedUpdates.size === 0 && checkedNewNeurons.size === 0 && detail.eval_json.action !== 'merge')}
                      style={{ fontSize: '0.7rem', padding: '4px 16px' }}
                    >
                      {applyLoading ? 'Applying...' : 'Apply Selected'}
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                      {checkedUpdates.size} update(s), {checkedNewNeurons.size} new neuron(s)
                      {detail.eval_json.action === 'merge' && ', 1 merge'}
                    </span>
                  </div>
                )}

                {/* Approved: show result */}
                {detail.status === 'approved' && detail.created_neuron_id && (
                  <div style={{
                    padding: '8px 14px', borderRadius: 6,
                    background: 'rgba(34,197,94,0.08)', fontSize: '0.75rem', color: 'var(--precision)',
                  }}>
                    Applied — created neuron #{detail.created_neuron_id}
                  </div>
                )}
              </div>
            )}

            {/* If queued and not yet evaluated, show the evaluate CTA */}
            {detail.status === 'queued' && !detail.eval_json && (
              <div style={{
                padding: 20, textAlign: 'center', borderRadius: 8,
                background: 'rgba(56,189,248,0.04)', border: '1px dashed rgba(56,189,248,0.15)',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                  Click "Evaluate" to have the LLM analyze this observation and propose actions.
                </div>
              </div>
            )}

            {/* Nearby neurons (collapsible) */}
            {detail.nearby_neurons.length > 0 && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ fontSize: '0.75rem', color: 'var(--text-dim)', cursor: 'pointer', marginBottom: 6 }}>
                  Nearby Neurons ({detail.nearby_neurons.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.nearby_neurons.map(n => (
                    <div key={n.id} style={{ padding: '6px 10px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text)' }}>[{n.id}] L{n.layer} {n.label}</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                        inv:{n.invocations} · util:{n.avg_utility.toFixed(2)}
                      </span>
                      {n.summary && (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 2 }}>
                          {n.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
