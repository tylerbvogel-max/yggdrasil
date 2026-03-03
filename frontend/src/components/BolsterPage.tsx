import { useState, useEffect } from 'react';
import { fetchStats, submitBolster, applyBolster } from '../api';
import type { BolsterResponse, NeuronStats } from '../types';

export default function BolsterPage() {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BolsterResponse | null>(null);

  const [checkedUpdates, setCheckedUpdates] = useState<Set<number>>(new Set());
  const [checkedNewNeurons, setCheckedNewNeurons] = useState<Set<number>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number; created: number } | null>(null);

  useEffect(() => {
    fetchStats().then((s: NeuronStats) => {
      setDepartments(Object.keys(s.by_department).sort());
    }).catch(() => {});
  }, []);

  async function handleAnalyze() {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setApplyResult(null);
    try {
      const res = await submitBolster(message, model as 'haiku' | 'sonnet' | 'opus', department || undefined);
      setResult(res);
      setCheckedUpdates(new Set(res.updates.map((_, i) => i)));
      setCheckedNewNeurons(new Set(res.new_neurons.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bolster analysis failed');
    } finally {
      setLoading(false);
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
    if (!result) return;
    setApplyLoading(true);
    setError('');
    try {
      const res = await applyBolster(result.session_id, Array.from(checkedUpdates), Array.from(checkedNewNeurons));
      setApplyResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplyLoading(false);
    }
  }

  const totalChecked = checkedUpdates.size + checkedNewNeurons.size;

  return (
    <div className="query-lab">
      <div className="query-form">
        <textarea
          placeholder="Describe what to add, review, or change — e.g. Add more info about NADCAP requirements..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAnalyze(); }}
        />
        <div className="query-controls">
          <div className="mode-toggles">
            <select className="baseline-select" value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="baseline-select" value={model} onChange={e => setModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}>
              <option value="haiku">Haiku</option>
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
            </select>
          </div>
          <button className="btn" onClick={handleAnalyze} disabled={loading || !message.trim()}>
            {loading ? 'Analyzing...' : result ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

      {result && (
        <div className="result-card refine-card" style={{ marginTop: 16 }}>
          <div className="refine-reasoning">
            <div className="eval-model-tag">Analysis by {result.model} | {result.neurons_scanned} neurons scanned</div>
            <div className="response-text" style={{ marginBottom: 12 }}>{result.reasoning}</div>
            <div className="token-breakdown">
              <div className="breakdown-item"><div className="bd-value">{result.input_tokens}</div><div className="bd-label">In</div></div>
              <div className="breakdown-item"><div className="bd-value">{result.output_tokens}</div><div className="bd-label">Out</div></div>
            </div>
          </div>

          {result.updates.length > 0 && (
            <div className="refine-section">
              <h4>Neuron Updates ({result.updates.length})</h4>
              {result.updates.map((u, i) => (
                <label key={i} className={`refine-row${checkedUpdates.has(i) ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checkedUpdates.has(i)} onChange={() => toggleUpdate(i)} />
                  <div className="refine-row-content">
                    <div className="refine-row-header">
                      <span className="refine-neuron-id">#{u.neuron_id}</span>
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

          {result.new_neurons.length > 0 && (
            <div className="refine-section">
              <h4>New Neurons ({result.new_neurons.length})</h4>
              {result.new_neurons.map((n, i) => (
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

          {(result.updates.length > 0 || result.new_neurons.length > 0) && (
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

          {result.updates.length === 0 && result.new_neurons.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 12 }}>
              No changes suggested for this request.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
