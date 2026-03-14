import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchSpreadTrail } from '../api';
import type { NeuronScoreResponse, SpreadTrailResponse } from '../types';
import { DEPT_COLORS } from '../constants';

/**
 * Organic radial tree visualization of neuron firing.
 *
 * Each department is a single branch curve radiating from center.
 * Neurons sit along their branch like leaves, spaced by layer.
 * Spread activation shown as gold arcs hopping between branches.
 * No structural edges — the branch shape IS the hierarchy.
 */

const LAYER_LABELS = ['Dept', 'Role', 'Task', 'System', 'Decision', 'Output'];

interface PlacedNeuron {
  id: number;
  x: number;
  y: number;
  r: number;
  neuron: NeuronScoreResponse;
  department: string;
  layer: number;
  branchAngle: number;
  distFromCenter: number;
  rank: number;
}

interface Props {
  queryId: number;
  neuronScores: NeuronScoreResponse[];
  neuronsActivated: number;
  onNavigateToNeuron?: (id: number) => void;
}

export default function NeuronFiringViz({ queryId, neuronScores, neuronsActivated, onNavigateToNeuron }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trailData, setTrailData] = useState<SpreadTrailResponse | null>(null);
  const [animPhase, setAnimPhase] = useState<'growing' | 'blooming' | 'spreading' | 'done'>('growing');
  const [growProgress, setGrowProgress] = useState(0);

  const neurons = neuronScores;
  const maxScore = Math.max(...neurons.map(s => s.combined), 0.001);

  useEffect(() => {
    fetchSpreadTrail(queryId).then(setTrailData).catch(() => setTrailData(null));
  }, [queryId]);

  // Growth animation via requestAnimationFrame
  useEffect(() => {
    if (neurons.length === 0) return;
    setGrowProgress(0);
    setAnimPhase('growing');

    const duration = 2200;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setGrowProgress(eased);

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setAnimPhase('done');
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [neuronScores]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update phase based on progress
  useEffect(() => {
    if (growProgress < 0.4) setAnimPhase('growing');
    else if (growProgress < 0.85) setAnimPhase('blooming');
    else if (growProgress < 1) setAnimPhase('spreading');
    else setAnimPhase('done');
  }, [growProgress]);

  // D3 rendering — static layout, animated via growProgress
  useEffect(() => {
    if (!svgRef.current || neurons.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 700;
    const height = 420;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(cx, cy) - 20;

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    // Filters
    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'ygg-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).join('feMergeNode').attr('in', d => d);

    // Group neurons by department
    const deptGroups = new Map<string, NeuronScoreResponse[]>();
    for (const n of neurons) {
      const dept = n.department || 'Unknown';
      if (!deptGroups.has(dept)) deptGroups.set(dept, []);
      deptGroups.get(dept)!.push(n);
    }

    // Sort departments by total score
    const sortedDepts = Array.from(deptGroups.entries())
      .map(([dept, ns]) => ({ dept, neurons: ns, total: ns.reduce((s, n) => s + n.combined, 0) }))
      .sort((a, b) => b.total - a.total);

    const numDepts = sortedDepts.length;

    // Assign each department a branch angle (evenly spaced, start from top)
    const deptAngles = new Map<string, number>();
    sortedDepts.forEach((d, i) => {
      deptAngles.set(d.dept, (i / numDepts) * Math.PI * 2 - Math.PI / 2);
    });

    // Place neurons along their department's branch
    const placedNeurons: PlacedNeuron[] = [];
    const rScale = d3.scaleSqrt().domain([0, maxScore]).range([2.5, 7]);
    let globalRank = 0;

    for (const { dept, neurons: deptNeurons } of sortedDepts) {
      const angle = deptAngles.get(dept)!;

      // Sort by layer then score within layer
      const sorted = [...deptNeurons].sort((a, b) => a.layer - b.layer || b.combined - a.combined);

      // Group by layer for sub-branching
      const layerGroups = new Map<number, NeuronScoreResponse[]>();
      for (const n of sorted) {
        if (!layerGroups.has(n.layer)) layerGroups.set(n.layer, []);
        layerGroups.get(n.layer)!.push(n);
      }

      const layers = Array.from(layerGroups.entries()).sort(([a], [b]) => a - b);

      for (const [layer, layerNeurons] of layers) {
        // Distance from center: layers further out go further along branch
        const layerFraction = 0.2 + (layer / 5) * 0.75; // 20% to 95% of maxR
        const baseR = layerFraction * maxR;

        for (let j = 0; j < layerNeurons.length; j++) {
          const n = layerNeurons[j];

          // Spread neurons perpendicular to branch direction
          const spreadAngle = layerNeurons.length > 1
            ? (j / (layerNeurons.length - 1) - 0.5) * 0.25 // ±0.125 radians spread
            : 0;

          // Add slight radial jitter so neurons don't stack
          const jitterR = (j % 2 === 0 ? 1 : -1) * (j * 3);

          const finalAngle = angle + spreadAngle;
          const finalR = baseR + jitterR;

          const x = cx + finalR * Math.cos(finalAngle);
          const y = cy + finalR * Math.sin(finalAngle);

          placedNeurons.push({
            id: n.neuron_id,
            x, y,
            r: rScale(n.combined),
            neuron: n,
            department: dept,
            layer: n.layer,
            branchAngle: angle,
            distFromCenter: finalR,
            rank: globalRank++,
          });
        }
      }
    }

    // --- Draw branch trunks ---
    const branchG = svg.append('g').attr('class', 'branches');

    for (const { dept } of sortedDepts) {
      const angle = deptAngles.get(dept)!;
      const color = DEPT_COLORS[dept] || '#4a5568';

      // Find the furthest neuron along this branch
      const deptPlaced = placedNeurons.filter(p => p.department === dept);
      const maxDist = Math.max(...deptPlaced.map(p => p.distFromCenter), maxR * 0.3);

      // Draw branch as a tapering path from center to tip
      // Use multiple segments for organic taper
      const segments = 4;
      for (let s = 0; s < segments; s++) {
        const r0 = (s / segments) * maxDist;
        const r1 = ((s + 1) / segments) * maxDist;
        const thickness = 3.5 * (1 - s / segments) + 0.5; // taper from 4 to 0.5

        // Slight organic curve via control point offset
        const wobble = (s % 2 === 0 ? 1 : -1) * 4;
        const midR = (r0 + r1) / 2;
        const perpAngle = angle + Math.PI / 2;

        const x0 = cx + r0 * Math.cos(angle);
        const y0 = cy + r0 * Math.sin(angle);
        const x1 = cx + r1 * Math.cos(angle);
        const y1 = cy + r1 * Math.sin(angle);
        const cpx = cx + midR * Math.cos(angle) + wobble * Math.cos(perpAngle);
        const cpy = cy + midR * Math.sin(angle) + wobble * Math.sin(perpAngle);

        // Glow
        branchG.append('path')
          .attr('d', `M ${x0},${y0} Q ${cpx},${cpy} ${x1},${y1}`)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', thickness + 3)
          .attr('stroke-opacity', 0.06)
          .attr('stroke-linecap', 'round')
          .attr('filter', 'url(#ygg-glow)')
          .attr('data-dept', dept)
          .attr('data-seg', s);

        // Core
        branchG.append('path')
          .attr('d', `M ${x0},${y0} Q ${cpx},${cpy} ${x1},${y1}`)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', thickness)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-linecap', 'round')
          .attr('data-dept', dept)
          .attr('data-seg', s);
      }

      // Sub-branches: thin lines from main branch to neurons that are offset
      for (const p of deptPlaced) {
        const bx = cx + p.distFromCenter * Math.cos(angle); // point on main branch
        const by = cy + p.distFromCenter * Math.sin(angle);
        const dist = Math.sqrt((p.x - bx) ** 2 + (p.y - by) ** 2);
        if (dist > 5) { // only draw twig if neuron is offset from branch
          branchG.append('line')
            .attr('x1', bx).attr('y1', by)
            .attr('x2', p.x).attr('y2', p.y)
            .attr('stroke', color)
            .attr('stroke-width', 0.6)
            .attr('stroke-opacity', 0.25)
            .attr('data-dept', dept)
            .attr('data-leaf', 'true');
        }
      }
    }

    // --- Department labels ---
    for (const { dept } of sortedDepts) {
      const angle = deptAngles.get(dept)!;
      const color = DEPT_COLORS[dept] || '#c8d0dc';
      const labelR = maxR + 14;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);

      const deg = (angle * 180) / Math.PI;
      const flip = deg > 90 || deg < -90;

      svg.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', flip ? 'end' : 'start')
        .attr('dominant-baseline', 'middle')
        .attr('transform', `rotate(${flip ? deg + 180 : deg}, ${lx}, ${ly})`)
        .attr('fill', color)
        .attr('font-size', '0.58rem')
        .attr('font-weight', '600')
        .attr('opacity', 0)
        .attr('class', 'dept-label')
        .text(dept.replace('Manufacturing & Operations', 'Mfg & Ops')
          .replace('Contracts & Compliance', 'Contracts')
          .replace('Business Development', 'BD')
          .replace('Executive Leadership', 'Executive')
          .replace('Administrative & Support', 'Admin')
          .replace('Program Management', 'Program Mgmt'));
    }

    // --- Spread activation arcs (cross-branch hops) ---
    const edges = trailData?.edges ?? [];
    const nodePos = new Map(placedNeurons.map(n => [n.id, n]));

    // Show cross-department hops + strongest same-department
    const spreadEdges = edges
      .filter(e => nodePos.has(e.source_id) && nodePos.has(e.target_id))
      .map(e => ({
        ...e,
        crossDept: nodePos.get(e.source_id)!.department !== nodePos.get(e.target_id)!.department,
      }))
      .sort((a, b) => {
        if (a.crossDept !== b.crossDept) return a.crossDept ? -1 : 1;
        return b.weight - a.weight;
      })
      .slice(0, 12);

    const spreadG = svg.append('g').attr('class', 'spread-arcs');
    for (const edge of spreadEdges) {
      const s = nodePos.get(edge.source_id)!;
      const t = nodePos.get(edge.target_id)!;

      // Arc curves toward center for organic feel
      const pull = edge.crossDept ? 0.25 : 0.6;
      const mx = cx + ((s.x + t.x) / 2 - cx) * pull;
      const my = cy + ((s.y + t.y) / 2 - cy) * pull;

      spreadG.append('path')
        .attr('d', `M ${s.x},${s.y} Q ${mx},${my} ${t.x},${t.y}`)
        .attr('fill', 'none')
        .attr('stroke', '#e8a735')
        .attr('stroke-width', 0.8 + edge.weight * 1.5)
        .attr('stroke-opacity', 0)
        .attr('stroke-dasharray', '4 3')
        .attr('class', 'spread-arc');
    }

    // --- Tooltip ---
    const tooltip = d3.select(containerRef.current!)
      .selectAll<HTMLDivElement, unknown>('.tree-tooltip')
      .data([null]).join('div').attr('class', 'tree-tooltip')
      .style('position', 'absolute').style('pointer-events', 'none')
      .style('background', 'var(--bg-card)').style('border', '1px solid var(--border)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('font-size', '0.75rem').style('color', 'var(--text)')
      .style('opacity', 0).style('z-index', '20').style('max-width', '280px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.5)');

    // --- Neuron dots ---
    const nodeG = svg.append('g').attr('class', 'neurons')
      .selectAll<SVGGElement, PlacedNeuron>('g')
      .data(placedNeurons).join('g')
      .attr('transform', d => `translate(${d.x},${d.y}) scale(0)`)
      .style('opacity', 0)
      .style('cursor', 'pointer')
      .on('click', (_e, d) => { if (onNavigateToNeuron) onNavigateToNeuron(d.id); })
      .on('mouseenter', (event, d) => {
        const n = d.neuron;
        const ll = LAYER_LABELS[d.layer] ?? `L${d.layer}`;
        tooltip.html(
          `<strong style="font-size:0.82rem">${n.label || '#' + n.neuron_id}</strong><br>` +
          `<span style="color:${DEPT_COLORS[d.department] ?? '#c8d0dc'}">${d.department}</span> · ${ll}<br>` +
          `Combined: <strong>${n.combined.toFixed(3)}</strong>` +
          (n.spread_boost > 0 ? `<br><span style="color:#e8a735">Spread: +${n.spread_boost.toFixed(3)}</span>` : '') +
          `<br><span style="font-size:0.65rem;color:var(--text-dim)">` +
          `Burst:${n.burst.toFixed(2)} Impact:${n.impact.toFixed(2)} Prec:${n.precision.toFixed(2)} ` +
          `Nov:${n.novelty.toFixed(2)} Rec:${n.recency.toFixed(2)} Rel:${n.relevance.toFixed(2)}</span>`
        )
          .style('opacity', 1)
          .style('left', `${event.offsetX + 14}px`)
          .style('top', `${event.offsetY - 10}px`);

        d3.select(event.currentTarget).select('.leaf')
          .transition().duration(120)
          .attr('r', d.r + 3).attr('stroke-width', 2);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', (event, d) => {
        tooltip.style('opacity', 0);
        d3.select(event.currentTarget).select('.leaf')
          .transition().duration(120)
          .attr('r', d.r).attr('stroke-width', 1);
      });

    // Spread ring
    nodeG.filter(d => d.neuron.spread_boost > 0)
      .append('circle')
      .attr('r', d => d.r + 3)
      .attr('fill', 'none')
      .attr('stroke', '#e8a735')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7);

    // Main dot
    nodeG.append('circle').attr('class', 'leaf')
      .attr('r', d => d.r)
      .attr('fill', d => DEPT_COLORS[d.department] ?? '#c8d0dc')
      .attr('stroke', d => (DEPT_COLORS[d.department] ?? '#c8d0dc') + '80')
      .attr('stroke-width', 1);

    // Center root
    const rootG = svg.append('g').attr('class', 'root');
    rootG.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', 8)
      .attr('fill', '#3b82f6').attr('stroke', '#3b82f644').attr('stroke-width', 10)
      .attr('filter', 'url(#ygg-glow)');
    rootG.append('text')
      .attr('x', cx).attr('y', cy + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b').attr('font-size', '0.55rem')
      .text('Query');

    // Stats line
    const spreadCount = neurons.filter(n => n.spread_boost > 0).length;
    svg.append('text')
      .attr('x', 8).attr('y', height - 6)
      .attr('fill', 'var(--text-dim)').attr('font-size', '0.55rem')
      .text(`${neurons.length} neurons · ${edges.length} edges · ${spreadCount} spread-boosted`);

    // Store for animation
    const el = svgRef.current as unknown as Record<string, unknown>;
    el.__placed = placedNeurons;
    el.__maxR = maxR;

    return () => { tooltip.remove(); };
  }, [neurons, trailData, maxScore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate based on growProgress
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const el = svgRef.current as unknown as Record<string, unknown>;
    const placed = el.__placed as PlacedNeuron[] | undefined;
    const mR = (el.__maxR as number) || 200;
    if (!placed) return;

    const p = growProgress;

    // Branches: reveal via stroke-dasharray, staggered by segment index
    svg.selectAll<SVGPathElement, unknown>('.branches path').each(function () {
      const path = d3.select(this);
      const seg = parseInt(path.attr('data-seg') || '0');
      const totalSegs = 4;
      const segStart = (seg / totalSegs) * 0.6; // branches grow 0-60% of timeline
      const segEnd = segStart + 0.2;
      const localP = Math.max(0, Math.min(1, (p - segStart) / (segEnd - segStart)));
      const len = (this as SVGPathElement).getTotalLength?.() || 100;
      path.attr('stroke-dasharray', `${len * localP} ${len}`);
    });

    // Twigs
    svg.selectAll<SVGLineElement, unknown>('.branches line').each(function () {
      d3.select(this).attr('stroke-opacity', p > 0.5 ? Math.min(0.25, (p - 0.5) * 0.5) : 0);
    });

    // Dept labels
    svg.selectAll('.dept-label').attr('opacity', p > 0.3 ? Math.min(0.8, (p - 0.3) * 2) : 0);

    // Neurons: appear when growth reaches their distance
    svg.selectAll<SVGGElement, PlacedNeuron>('.neurons g').each(function (d) {
      const threshold = (d.distFromCenter / mR) * 0.6 + 0.25;
      const visible = p >= threshold;
      const localP = visible ? Math.min(1, (p - threshold) / 0.15) : 0;
      d3.select(this)
        .style('opacity', localP)
        .attr('transform', `translate(${d.x},${d.y}) scale(${localP})`);
    });

    // Spread arcs: appear at the end
    svg.selectAll('.spread-arc')
      .attr('stroke-opacity', p > 0.8 ? (p - 0.8) * 1.5 : 0);

  }, [growProgress]);

  if (neurons.length === 0) return null;

  const deptCounts = new Map<string, number>();
  for (const n of neurons) deptCounts.set(n.department || 'Unknown', (deptCounts.get(n.department || 'Unknown') || 0) + 1);
  const spreadCount = neurons.filter(n => n.spread_boost > 0).length;
  const edgeCount = trailData?.edges?.length ?? 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Neuron Firing</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          {neuronsActivated} activated &middot; {edgeCount} edges &middot; {spreadCount} spread-boosted
        </span>
        <span style={{
          fontSize: '0.6rem', padding: '2px 6px', borderRadius: 3,
          background: animPhase === 'done' ? 'rgba(34,197,94,0.15)' : animPhase === 'spreading' ? 'rgba(232,167,53,0.15)' : 'rgba(59,130,246,0.15)',
          color: animPhase === 'done' ? '#22c55e' : animPhase === 'spreading' ? '#e8a735' : '#3b82f6',
          transition: 'all 0.3s',
        }}>
          {animPhase === 'growing' ? 'Growing...' : animPhase === 'blooming' ? 'Blooming...' : animPhase === 'spreading' ? 'Spreading...' : 'Complete'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div ref={containerRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="420" style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.03) 0%, rgba(0,0,0,0.18) 70%)',
            borderRadius: 8,
          }} />
        </div>

        <div style={{ width: 175, flexShrink: 0, fontSize: '0.78rem' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branches</div>
            {Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: DEPT_COLORS[dept] || '#c8d0dc' }} />
                <span style={{ fontSize: '0.66rem', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dept.replace('Manufacturing & Operations', 'Mfg & Ops').replace('Contracts & Compliance', 'Contracts').replace('Business Development', 'BD').replace('Executive Leadership', 'Executive').replace('Administrative & Support', 'Admin').replace('Program Management', 'Program Mgmt')}
                </span>
                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{count}</span>
              </div>
            ))}
            {spreadCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #e8a735', flexShrink: 0 }} />
                <span style={{ fontSize: '0.66rem', color: '#e8a735' }}>Spread ({spreadCount})</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layers</div>
            {LAYER_LABELS.map((lbl, layer) => {
              const count = neurons.filter(s => s.layer === layer).length;
              const pct = neurons.length > 0 ? (count / neurons.length) * 100 : 0;
              return (
                <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: '0.58rem', color: '#64748b', width: 46 }}>L{layer} {lbl}</span>
                  <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#3b82f6', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.58rem', color: count > 0 ? 'var(--text)' : '#334155', width: 14, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Strongest</div>
            {neurons.slice(0, 5).map((n, i) => (
              <div key={n.neuron_id} style={{
                padding: '3px 6px', marginBottom: 2, borderRadius: 4,
                background: i === 0 ? 'rgba(59,130,246,0.08)' : 'transparent',
                border: i === 0 ? '1px solid rgba(59,130,246,0.15)' : '1px solid transparent',
                cursor: onNavigateToNeuron ? 'pointer' : 'default',
              }} onClick={() => onNavigateToNeuron?.(n.neuron_id)}>
                <div style={{ fontSize: '0.68rem', fontWeight: i === 0 ? 600 : 400, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.label || `#${n.neuron_id}`}
                </div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', display: 'flex', gap: 6 }}>
                  <span>{n.combined.toFixed(3)}</span>
                  <span style={{ color: DEPT_COLORS[n.department || ''] || '#64748b' }}>{(n.department || '').replace('Manufacturing & Operations', 'Mfg & Ops')}</span>
                  {n.spread_boost > 0 && <span style={{ color: '#e8a735' }}>+{n.spread_boost.toFixed(3)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
