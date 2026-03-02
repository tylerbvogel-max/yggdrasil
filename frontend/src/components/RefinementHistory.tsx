import { useState, useEffect } from 'react';
import { fetchRefinementHistory } from '../api';
import type { NeuronRefinementEntry } from '../types';

export default function RefinementHistory() {
  const [entries, setEntries] = useState<NeuronRefinementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRefinementHistory()
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading refinement history...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="dashboard" style={{ maxWidth: 1400 }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.25rem' }}>Refinement History</h2>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>No refinements applied yet. Use Query Lab to refine and apply neuron changes.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="score-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Query</th>
                <th>Neuron</th>
                <th>Action</th>
                <th>Field</th>
                <th>Old → New</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                    {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>#{e.query_id}</span>
                    {e.query_snippet && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.query_snippet}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem' }}>#{e.neuron_id}</span>
                    {e.neuron_label && (
                      <div style={{ fontSize: '0.75rem' }}>{e.neuron_label}</div>
                    )}
                  </td>
                  <td>
                    <span className={`action-badge action-${e.action}`}>{e.action}</span>
                  </td>
                  <td>
                    {e.field ? <span className="refine-field">{e.field}</span> : '—'}
                  </td>
                  <td>
                    {e.action === 'update' ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', maxWidth: 400 }}>
                        <span className="diff-old">{e.old_value}</span>
                        <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>→</span>
                        <span className="diff-new">{e.new_value}</span>
                      </div>
                    ) : (
                      <span className="diff-new">{e.new_value}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', maxWidth: 200 }}>
                    {e.reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
