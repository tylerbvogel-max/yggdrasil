import { useEffect, useRef, useState } from 'react'
import { fetchStats, fetchCostReport } from '../api'
import type { NeuronStats, CostReport } from '../types'
import { Chart, BarController, BarElement, BubbleController, PointElement, CategoryScale, LinearScale, LogarithmicScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, BubbleController, PointElement, CategoryScale, LinearScale, LogarithmicScale, Tooltip, Legend);

const layerColors = [
  '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
];

const roleColors = [
  '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6',
  '#fb923c', '#facc15', '#22c55e', '#ef4444',
  '#38bdf8', '#c084fc', '#f87171', '#34d399',
  '#fbbf24', '#818cf8', '#fb7185', '#a3e635',
  '#e879f9', '#67e8f9', '#fdba74', '#86efac',
  '#c4b5fd', '#fca5a1', '#6ee7b7', '#93c5fd',
  '#d8b4fe', '#fda4af', '#5eead4', '#bef264',
  '#f0abfc', '#7dd3fc', '#fcd34d', '#a5b4fc',
];

export default function Dashboard() {
  const [stats, setStats] = useState<NeuronStats | null>(null);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [error, setError] = useState('');
  const [bubbleLogX, setBubbleLogX] = useState(true);
  const [bubbleLogY, setBubbleLogY] = useState(true);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const deptRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const layerChart = useRef<Chart | null>(null);
  const deptChart = useRef<Chart | null>(null);
  const bubbleChart = useRef<Chart | null>(null);

  useEffect(() => {
    Promise.all([fetchStats(), fetchCostReport()])
      .then(([s, c]) => { setStats(s); setCost(c); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!stats) return;

    // Layer chart
    if (layerRef.current) {
      layerChart.current?.destroy();
      const layerLabels = Object.keys(stats.by_layer).map((_, i) => `L${i}`);
      const layerData = Object.values(stats.by_layer);
      layerChart.current = new Chart(layerRef.current, {
        type: 'bar',
        data: {
          labels: layerLabels,
          datasets: [{
            data: layerData,
            backgroundColor: layerColors,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          plugins: { tooltip: { enabled: true } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#8892a8' }, grid: { color: '#1e2d4a' } },
            x: { ticks: { color: '#8892a8' }, grid: { display: false } },
          },
        },
      });
    }

    // Department chart — stacked by L1 roles
    if (deptRef.current) {
      deptChart.current?.destroy();
      const deptLabels = Object.keys(stats.by_department_roles);
      // Collect all unique role labels across departments
      const allRoles = new Set<string>();
      for (const roles of Object.values(stats.by_department_roles)) {
        for (const role of Object.keys(roles)) allRoles.add(role);
      }
      const roleList = Array.from(allRoles);
      // One dataset per role
      const datasets = roleList.map((role, i) => ({
        label: role,
        data: deptLabels.map(dept => stats.by_department_roles[dept]?.[role] ?? 0),
        backgroundColor: roleColors[i % roleColors.length],
        borderRadius: 2,
      }));
      deptChart.current = new Chart(deptRef.current, {
        type: 'bar',
        data: { labels: deptLabels, datasets },
        options: {
          responsive: true,
          plugins: {
            tooltip: { enabled: true },
            legend: { display: false },
          },
          scales: {
            y: { stacked: true, beginAtZero: true, ticks: { color: '#8892a8' }, grid: { color: '#1e2d4a' } },
            x: { stacked: true, ticks: { color: '#8892a8', maxRotation: 45 }, grid: { display: false } },
          },
        },
      });
    }

    // Bubble chart — role health: neuron count vs invocations, bubble size = avg utility
    if (bubbleRef.current) {
      bubbleChart.current?.destroy();
      const departments = [...new Set(stats.role_bubbles.map(b => b.department))];
      const deptColorMap: Record<string, string> = {};
      departments.forEach((d, i) => { deptColorMap[d] = roleColors[i % roleColors.length]; });

      const datasets = departments.map(dept => {
        const roles = stats.role_bubbles.filter(b => b.department === dept);
        return {
          label: dept,
          data: roles.map(r => ({
            x: r.neuron_count,
            y: r.total_invocations,
            r: Math.max(4, r.avg_utility * 20),
            _role: r.role,
            _dept: r.department,
            _utility: r.avg_utility,
          })),
          backgroundColor: deptColorMap[dept] + '99',
          borderColor: deptColorMap[dept],
          borderWidth: 1,
        };
      });

      bubbleChart.current = new Chart(bubbleRef.current, {
        type: 'bubble',
        data: { datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: '#8892a8', boxWidth: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const raw = ctx.raw as { _role: string; x: number; y: number; _utility: number };
                  return `${raw._role}: ${raw.x} neurons, ${raw.y} invocations, utility ${raw._utility}`;
                },
              },
            },
          },
          scales: {
            x: { type: bubbleLogX ? 'logarithmic' as const : 'linear' as const, title: { display: true, text: 'Neuron Count', color: '#8892a8' }, ticks: { color: '#8892a8' }, grid: { color: '#1e2d4a' } },
            y: { type: bubbleLogY ? 'logarithmic' as const : 'linear' as const, title: { display: true, text: 'Total Invocations', color: '#8892a8' }, beginAtZero: !bubbleLogY, ticks: { color: '#8892a8' }, grid: { color: '#1e2d4a' } },
          },
        },
      });
    }

    return () => {
      layerChart.current?.destroy();
      deptChart.current?.destroy();
      bubbleChart.current?.destroy();
    };
  }, [stats, bubbleLogX, bubbleLogY]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!stats || !cost) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="card-value">${cost.total_cost_usd.toFixed(4)}</div>
          <div className="card-label">Total Cost</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{cost.total_queries}</div>
          <div className="card-label">Queries</div>
        </div>
        <div className="stat-card">
          <div className="card-value">${cost.avg_cost_per_query.toFixed(6)}</div>
          <div className="card-label">Avg / Query</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{cost.total_input_tokens.toLocaleString()}</div>
          <div className="card-label">Input Tokens</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{cost.total_output_tokens.toLocaleString()}</div>
          <div className="card-label">Output Tokens</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{stats.total_neurons}</div>
          <div className="card-label">Neurons</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{stats.total_firings.toLocaleString()}</div>
          <div className="card-label">Firings</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Neurons by Layer</h3>
          <canvas ref={layerRef} />
        </div>
        <div className="chart-card">
          <h3>Neurons by Department</h3>
          <canvas ref={deptRef} />
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Role Health — Neurons vs Invocations (bubble = utility)</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setBubbleLogX(v => !v)}
              style={{
                padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer',
                border: '1px solid ' + (bubbleLogX ? '#60a5fa' : '#334155'),
                background: bubbleLogX ? '#1e3a5f' : 'transparent',
                color: bubbleLogX ? '#60a5fa' : '#8892a8',
              }}
            >
              X: {bubbleLogX ? 'Log' : 'Linear'}
            </button>
            <button
              onClick={() => setBubbleLogY(v => !v)}
              style={{
                padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer',
                border: '1px solid ' + (bubbleLogY ? '#60a5fa' : '#334155'),
                background: bubbleLogY ? '#1e3a5f' : 'transparent',
                color: bubbleLogY ? '#60a5fa' : '#8892a8',
              }}
            >
              Y: {bubbleLogY ? 'Log' : 'Linear'}
            </button>
          </div>
        </div>
        <canvas ref={bubbleRef} />
      </div>

    </div>
  );
}
