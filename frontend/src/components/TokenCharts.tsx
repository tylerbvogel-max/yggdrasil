import { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface ModelTokens {
  label: string;
  mode: string;
  color: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  neurons: boolean;
  tokenBudget: number | null;
}

export default function TokenCharts({ models, baseline }: { models: ModelTokens[]; baseline: string }) {
  const inputRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const inputChart = useRef<Chart | null>(null);
  const outputChart = useRef<Chart | null>(null);

  useEffect(() => {
    const labels = models.map(m => m.label);
    const colors = models.map(m => m.color);

    if (inputRef.current) {
      inputChart.current?.destroy();
      inputChart.current = new Chart(inputRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Input Tokens',
            data: models.map(m => m.inputTokens),
            backgroundColor: colors.map(c => c + '99'),
            borderColor: colors,
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString()} tokens`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Input Tokens', color: '#c8d0dc', font: { size: 11 } },
              ticks: { color: '#c8d0dc' },
              grid: { color: '#1e2d4a' },
            },
            x: {
              ticks: { color: '#ffffff', font: { weight: 'bold' }, maxRotation: 45, minRotation: 0 },
              grid: { display: false },
            },
          },
        },
      });
    }

    if (outputRef.current) {
      outputChart.current?.destroy();
      outputChart.current = new Chart(outputRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Output Tokens',
            data: models.map(m => m.outputTokens),
            backgroundColor: colors.map(c => c + '99'),
            borderColor: colors,
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString()} tokens`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Output Tokens', color: '#c8d0dc', font: { size: 11 } },
              ticks: { color: '#c8d0dc' },
              grid: { color: '#1e2d4a' },
            },
            x: {
              ticks: { color: '#ffffff', font: { weight: 'bold' }, maxRotation: 45, minRotation: 0 },
              grid: { display: false },
            },
          },
        },
      });
    }

    return () => {
      inputChart.current?.destroy();
      outputChart.current?.destroy();
    };
  }, [models]);

  const totalCost = models.reduce((sum, m) => sum + m.cost, 0);

  // Baseline comparison: find baseline slot, compare all others against it
  const baselineSlot = models.find(m => m.mode === baseline);
  const comparisons = baselineSlot && models.length >= 2
    ? models.filter(m => m !== baselineSlot).map(m => {
        const diff = m.cost - baselineSlot.cost;
        const pct = baselineSlot.cost > 0 ? (diff / baselineSlot.cost) * 100 : 0;
        const totalTokens = m.inputTokens + m.outputTokens;
        const tokensPerDollar = m.cost > 0 ? totalTokens / m.cost : 0;
        return { label: m.label, color: m.color, cost: m.cost, baselineCost: baselineSlot.cost, diff, pct, tokensPerDollar };
      })
    : [];

  // Baseline tokens/$
  const baselineTokensPerDollar = baselineSlot && baselineSlot.cost > 0
    ? (baselineSlot.inputTokens + baselineSlot.outputTokens) / baselineSlot.cost
    : 0;

  return (
    <div className="token-charts">
      <div className="token-charts-grid">
        <div className="token-chart-box">
          <div className="token-chart-title">Input Tokens</div>
          <div className="token-chart-canvas"><canvas ref={inputRef} /></div>
        </div>
        <div className="token-chart-box">
          <div className="token-chart-title">Output Tokens</div>
          <div className="token-chart-canvas"><canvas ref={outputRef} /></div>
        </div>
      </div>
      <div className="token-cost-row">
        {models.map((m, i) => {
          const totalTokens = m.inputTokens + m.outputTokens;
          const tokensPerDollar = m.cost > 0 ? totalTokens / m.cost : 0;
          return (
            <div key={i} className="token-cost-item">
              <div className="token-cost-color" style={{ background: m.color }} />
              <div className="token-cost-info">
                <div className="token-cost-label">{m.label}</div>
                <div className="token-cost-value">${m.cost.toFixed(6)}</div>
                <div className="token-cost-detail">{m.inputTokens.toLocaleString()} in / {m.outputTokens.toLocaleString()} out</div>
                <div className="token-cost-efficiency">{formatTokensPerDollar(tokensPerDollar)} tokens/$</div>
              </div>
            </div>
          );
        })}
        <div className="token-cost-item token-cost-total">
          <div className="token-cost-info">
            <div className="token-cost-label">Total</div>
            <div className="token-cost-value">${totalCost.toFixed(6)}</div>
          </div>
        </div>
      </div>
      {comparisons.length > 0 && (
        <div className="cost-savings">
          <div className="cost-savings-title">Cost vs {baselineSlot!.label}</div>
          <div className="cost-savings-rows">
            {comparisons.map((c, i) => {
              const cheaper = c.diff < 0;
              return (
                <div key={i} className="cost-savings-row">
                  <div className="cost-savings-color" style={{ background: c.color }} />
                  <div className="cost-savings-label">{c.label}</div>
                  <div className="cost-savings-detail">
                    <span className="cost-savings-actual">${c.cost.toFixed(6)}</span>
                    <span className="cost-savings-vs">vs</span>
                    <span className="cost-savings-opus">${c.baselineCost.toFixed(6)}</span>
                  </div>
                  <div className="cost-savings-amount">
                    <span className="cost-savings-saved" style={{ color: cheaper ? '#22c55e' : '#fb923c' }}>
                      {cheaper ? '-' : '+'}${Math.abs(c.diff).toFixed(6)}
                    </span>
                    <span className="cost-savings-pct">
                      ({Math.abs(c.pct).toFixed(0)}% {cheaper ? 'cheaper' : 'more'})
                    </span>
                  </div>
                  <div className="cost-savings-tpd">
                    <span className="cost-savings-tpd-value">{formatTokensPerDollar(c.tokensPerDollar)}</span>
                    <span className="cost-savings-tpd-label"> tokens/$</span>
                    {baselineTokensPerDollar > 0 && (
                      <span className="cost-savings-tpd-ratio" style={{ color: c.tokensPerDollar > baselineTokensPerDollar ? '#22c55e' : '#fb923c' }}>
                        {' '}({(c.tokensPerDollar / baselineTokensPerDollar).toFixed(1)}x)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTokensPerDollar(val: number): string {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K';
  return val.toFixed(0);
}
