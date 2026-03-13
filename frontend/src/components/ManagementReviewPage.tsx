import { useState, useEffect, useCallback } from 'react';
import {
  fetchReviews, createReview, updateReview, fetchReviewCadence,
  fetchSnapshots, type ManagementReviewOut, type ReviewCadenceItem,
  type ComplianceSnapshotSummary,
} from '../api';

const REVIEW_TYPES = [
  'pii_audit', 'scoring_health', 'governance_review',
  'incident_review', 'compliance_audit', 'neuron_expansion', 'model_change',
];

const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function ManagementReviewPage() {
  const [cadence, setCadence] = useState<ReviewCadenceItem[]>([]);
  const [reviews, setReviews] = useState<ManagementReviewOut[]>([]);
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState<ComplianceSnapshotSummary[]>([]);

  // Form state
  const [formType, setFormType] = useState('compliance_audit');
  const [formReviewer, setFormReviewer] = useState('System Owner');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formFindings, setFormFindings] = useState('');
  const [formDecisions, setFormDecisions] = useState('');
  const [formStatus, setFormStatus] = useState('completed');
  const [formActions, setFormActions] = useState<{ description: string; due_date: string; completed: boolean }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, s] = await Promise.all([
        fetchReviewCadence(),
        fetchReviews(filterType || undefined),
        fetchSnapshots(5),
      ]);
      setCadence(c);
      setReviews(r);
      setSnapshots(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createReview({
        review_type: formType,
        reviewer: formReviewer,
        review_date: formDate,
        findings: formFindings,
        decisions: formDecisions,
        action_items: formActions.length > 0 ? formActions : undefined,
        status: formStatus,
      });
      setShowForm(false);
      setFormFindings('');
      setFormDecisions('');
      setFormActions([]);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActionComplete = async (reviewId: number, review: ManagementReviewOut, idx: number) => {
    const updated = [...review.action_items];
    updated[idx] = { ...updated[idx], completed: !updated[idx].completed };
    const allDone = updated.every(a => a.completed);
    try {
      await updateReview(reviewId, {
        action_items: updated,
        status: allDone ? 'completed' : 'action_required',
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const prefillFromSnapshot = () => {
    if (!snapshots.length) return;
    const s = snapshots[0];
    setFormFindings(
      `Compliance snapshot taken ${s.snapshot_date?.split('T')[0] || 'today'}:\n` +
      `- Total neurons: ${s.total_neurons}\n` +
      `- PII clean: ${s.pii_clean ? 'Yes' : 'No'}\n` +
      `- Coverage CV: ${s.coverage_cv.toFixed(3)}\n` +
      `- Fairness pass: ${s.fairness_pass ? 'Yes' : 'No'}\n` +
      `- Missing citations: ${s.missing_citations_count}\n` +
      `- Stale neurons: ${s.stale_neurons_count}`
    );
    setFormType('compliance_audit');
  };

  if (error) return <div className="error-msg">{error}</div>;
  if (loading) return <div className="loading">Loading reviews...</div>;

  return (
    <div className="security-page">
      <h2>Management Reviews</h2>
      <p className="security-intro">
        Track management reviews per ISO 42001 9.3, NIST GOV-1.5, and AIUC-1 E008.
        Cadence dashboard shows due dates for each review type. Create reviews to document
        findings, decisions, and action items.
      </p>

      {/* Cadence Dashboard */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        {cadence.map(c => (
          <div key={c.review_type} className="stat-card" style={{
            borderLeft: `3px solid ${c.is_overdue ? '#ef4444' : c.days_until_due !== null && c.days_until_due < 7 ? '#fb923c' : '#22c55e'}`,
          }}>
            <div className="card-label" style={{ fontSize: '0.7rem', marginBottom: 4 }}>
              {typeLabel(c.review_type)}
            </div>
            <div className="card-value" style={{
              fontSize: '0.9rem',
              color: c.is_overdue ? '#ef4444' : c.days_until_due !== null && c.days_until_due < 7 ? '#fb923c' : '#22c55e',
            }}>
              {c.is_overdue ? 'OVERDUE' : c.days_until_due !== null ? `${c.days_until_due}d` : 'Never'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
              {c.last_review_date ? `Last: ${c.last_review_date}` : 'No reviews yet'}
              {' | '}{c.cadence_days}d cadence
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem' }}
        >
          <option value="">All Types</option>
          {REVIEW_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(f => !f)}
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '0.8rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ New Review'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <section className="security-section" style={{ marginBottom: 24 }}>
          <h3>Create Review</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem' }}>
              Type
              <select value={formType} onChange={e => setFormType(e.target.value)} style={inputStyle}>
                {REVIEW_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem' }}>
              Reviewer
              <input value={formReviewer} onChange={e => setFormReviewer(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: '0.8rem' }}>
              Date
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="completed">Completed</option>
              <option value="action_required">Action Required</option>
              <option value="escalated">Escalated</option>
            </select>
            {snapshots.length > 0 && (
              <button onClick={prefillFromSnapshot} style={{ ...btnStyle, background: '#1e293b' }}>
                Pre-populate from Latest Snapshot
              </button>
            )}
          </div>

          <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 8 }}>
            Findings
            <textarea value={formFindings} onChange={e => setFormFindings(e.target.value)} rows={4} style={{ ...inputStyle, width: '100%' }} />
          </label>
          <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 8 }}>
            Decisions
            <textarea value={formDecisions} onChange={e => setFormDecisions(e.target.value)} rows={3} style={{ ...inputStyle, width: '100%' }} />
          </label>

          {/* Action Items */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Action Items</span>
              <button onClick={() => setFormActions([...formActions, { description: '', due_date: '', completed: false }])}
                style={{ ...btnStyle, padding: '2px 8px', fontSize: '0.7rem' }}>+ Add</button>
            </div>
            {formActions.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                <input value={a.description} placeholder="Description"
                  onChange={e => { const u = [...formActions]; u[i] = { ...a, description: e.target.value }; setFormActions(u); }}
                  style={{ ...inputStyle, flex: 1 }} />
                <input type="date" value={a.due_date}
                  onChange={e => { const u = [...formActions]; u[i] = { ...a, due_date: e.target.value }; setFormActions(u); }}
                  style={{ ...inputStyle, width: 140 }} />
                <button onClick={() => setFormActions(formActions.filter((_, j) => j !== i))}
                  style={{ ...btnStyle, padding: '2px 6px', color: '#ef4444', background: 'transparent' }}>x</button>
              </div>
            ))}
          </div>

          <button onClick={handleCreate} disabled={saving || !formFindings.trim()}
            style={{ ...btnStyle, background: '#22c55e', color: '#000', padding: '6px 16px', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Create Review'}
          </button>
        </section>
      )}

      {/* Reviews List */}
      <section className="security-section">
        <h3>Review History ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No reviews yet. Create one above.</p>
        ) : (
          <div className="security-items">
            {reviews.map(r => (
              <div key={r.id} className="security-item">
                <div className="security-item-header">
                  <code className="security-item-id">{r.review_date}</code>
                  <strong className="security-item-title">{typeLabel(r.review_type)}</strong>
                  <span className="security-badge" style={{
                    background: r.status === 'completed' ? '#22c55e' : r.status === 'escalated' ? '#ef4444' : '#fb923c',
                  }}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="security-item-detail" style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Reviewer:</strong> {r.reviewer}<br />
                  <strong>Findings:</strong> {r.findings}
                </p>
                {r.decisions && (
                  <p className="security-item-detail" style={{ marginTop: 4 }}>
                    <strong>Decisions:</strong> {r.decisions}
                  </p>
                )}
                {r.action_items.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Action Items:</strong>
                    {r.action_items.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginTop: 2 }}>
                        <input type="checkbox" checked={a.completed || false}
                          onChange={() => toggleActionComplete(r.id, r, i)} />
                        <span style={{ textDecoration: a.completed ? 'line-through' : 'none', color: a.completed ? '#64748b' : 'var(--text)' }}>
                          {a.description}
                        </span>
                        {a.due_date && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>due {a.due_date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem',
  marginTop: 2,
};

const btnStyle: React.CSSProperties = {
  background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4,
  padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer',
};
