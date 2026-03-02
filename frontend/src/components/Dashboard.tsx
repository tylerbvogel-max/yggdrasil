import { useEffect, useRef, useState } from 'react'
import { fetchStats, fetchCostReport } from '../api'
import type { NeuronStats, CostReport } from '../types'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const layerColors = [
  '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
];

const deptColors = [
  '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6',
  '#fb923c', '#facc15', '#22c55e', '#ef4444',
];

export default function Dashboard() {
  const [stats, setStats] = useState<NeuronStats | null>(null);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [error, setError] = useState('');
  const layerRef = useRef<HTMLCanvasElement>(null);
  const deptRef = useRef<HTMLCanvasElement>(null);
  const layerChart = useRef<Chart | null>(null);
  const deptChart = useRef<Chart | null>(null);

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

    // Department chart
    if (deptRef.current) {
      deptChart.current?.destroy();
      const deptLabels = Object.keys(stats.by_department);
      const deptData = Object.values(stats.by_department);
      deptChart.current = new Chart(deptRef.current, {
        type: 'bar',
        data: {
          labels: deptLabels,
          datasets: [{
            data: deptData,
            backgroundColor: deptColors.slice(0, deptLabels.length),
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          plugins: { tooltip: { enabled: true } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#8892a8' }, grid: { color: '#1e2d4a' } },
            x: { ticks: { color: '#8892a8', maxRotation: 45 }, grid: { display: false } },
          },
        },
      });
    }

    return () => {
      layerChart.current?.destroy();
      deptChart.current?.destroy();
    };
  }, [stats]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!stats || !cost) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="card-value">{stats.total_neurons}</div>
          <div className="card-label">Total Neurons</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{stats.total_firings.toLocaleString()}</div>
          <div className="card-label">Total Firings</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{cost.total_queries}</div>
          <div className="card-label">Total Queries</div>
        </div>
        <div className="stat-card">
          <div className="card-value">${cost.total_cost_usd.toFixed(4)}</div>
          <div className="card-label">Total Cost</div>
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

      <div className="cost-section">
        <h3>Cost Report</h3>
        <div className="cost-grid">
          <div className="cost-item">
            <div className="cost-value">${cost.total_cost_usd.toFixed(6)}</div>
            <div className="cost-label">Total Cost</div>
          </div>
          <div className="cost-item">
            <div className="cost-value">${cost.avg_cost_per_query.toFixed(6)}</div>
            <div className="cost-label">Avg / Query</div>
          </div>
          <div className="cost-item">
            <div className="cost-value">{cost.total_queries}</div>
            <div className="cost-label">Queries</div>
          </div>
          <div className="cost-item">
            <div className="cost-value">{cost.total_input_tokens.toLocaleString()}</div>
            <div className="cost-label">Input Tokens</div>
          </div>
          <div className="cost-item">
            <div className="cost-value">{cost.total_output_tokens.toLocaleString()}</div>
            <div className="cost-label">Output Tokens</div>
          </div>
        </div>
      </div>
    </div>
  );
}
