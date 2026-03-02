import type { NeuronScores } from '../types'

const signals: { key: keyof Omit<NeuronScores, 'neuron_id'>; label: string; color: string }[] = [
  { key: 'burst', label: 'Burst', color: 'var(--burst)' },
  { key: 'impact', label: 'Impact', color: 'var(--impact)' },
  { key: 'precision', label: 'Precision', color: 'var(--precision)' },
  { key: 'novelty', label: 'Novelty', color: 'var(--novelty)' },
  { key: 'recency', label: 'Recency', color: 'var(--recency)' },
  { key: 'relevance', label: 'Relevance', color: 'var(--relevance)' },
  { key: 'combined', label: 'Combined', color: 'var(--accent)' },
]

export default function ScoreBars({ scores }: { scores: NeuronScores }) {
  return (
    <div className="score-bars">
      {signals.map(s => (
        <div key={s.key} className="score-row">
          <span className="score-label" style={{ color: s.color }}>{s.label}</span>
          <div className="score-track">
            <div
              className="score-fill"
              style={{ width: `${(scores[s.key] * 100).toFixed(0)}%`, background: s.color }}
            />
          </div>
          <span className="score-value">{scores[s.key].toFixed(3)}</span>
        </div>
      ))}
    </div>
  )
}
