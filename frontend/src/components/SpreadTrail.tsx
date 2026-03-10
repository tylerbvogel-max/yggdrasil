import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchSpreadTrail } from '../api'
import type { NeuronScoreResponse, SpreadTrailResponse } from '../types'
import { DEPT_COLORS } from '../constants'

const LAYER_LABELS = ['Dept', 'Role', 'Task', 'System', 'Decision', 'Output'];

interface Props {
  queryId: number;
  neuronScores?: NeuronScoreResponse[];
}

export default function SpreadTrail({ queryId, neuronScores }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<SpreadTrailResponse['edges']>([]);

  // Fetch spread edges
  useEffect(() => {
    fetchSpreadTrail(queryId)
      .then(d => setEdges(d.edges))
      .catch(() => setEdges([]));
  }, [queryId]);

  // Use neuronScores prop (all scored neurons with dept/label/layer)
  const neurons = neuronScores ?? [];

  useEffect(() => {
    if (!svgRef.current || neurons.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 600;
    const height = 420;
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(cx, cy) - 50;
    const innerRadius = 30;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Group neurons by department
    const deptMap = new Map<string, NeuronScoreResponse[]>();
    for (const n of neurons) {
      const dept = n.department ?? 'Unknown';
      if (!deptMap.has(dept)) deptMap.set(dept, []);
      deptMap.get(dept)!.push(n);
    }
    const depts = Array.from(deptMap.keys()).sort();
    const deptCount = depts.length;
    if (deptCount === 0) return;

    // Angular position per department
    const angleScale = (i: number) => (i / deptCount) * 2 * Math.PI - Math.PI / 2;

    // Radial position: layer 0 near center, layer 5 at edge
    const maxLayer = Math.max(...neurons.map(n => n.layer), 5);
    const radiusScale = d3.scaleLinear()
      .domain([0, maxLayer])
      .range([innerRadius + 20, maxRadius]);

    // Size scale by combined score
    const maxCombined = Math.max(...neurons.map(n => n.combined), 0.001);
    const rScale = d3.scaleSqrt()
      .domain([0, maxCombined])
      .range([3, 14]);

    // Build positioned node map
    interface PosNode {
      id: number;
      x: number;
      y: number;
      r: number;
      label: string;
      department: string;
      layer: number;
      combined: number;
      spread_boost: number;
    }
    const nodeMap = new Map<number, PosNode>();

    depts.forEach((dept, di) => {
      const angle = angleScale(di);
      const deptNeurons = deptMap.get(dept)!;

      // Sort by layer then combined score descending
      deptNeurons.sort((a, b) => a.layer - b.layer || b.combined - a.combined);

      // Spread neurons along the spoke with slight angular jitter to avoid overlap
      const layerGroups = new Map<number, NeuronScoreResponse[]>();
      for (const n of deptNeurons) {
        if (!layerGroups.has(n.layer)) layerGroups.set(n.layer, []);
        layerGroups.get(n.layer)!.push(n);
      }

      for (const [layer, group] of layerGroups) {
        const baseR = radiusScale(layer);
        const spreadAngle = Math.min(0.15, 0.4 / deptCount); // angular spread within spoke
        group.forEach((n, gi) => {
          const jitter = group.length <= 1 ? 0 :
            (gi / (group.length - 1) - 0.5) * spreadAngle * 2;
          const a = angle + jitter;
          const rJitter = (gi % 2 === 0 ? 0 : 8); // slight radial stagger
          const r = baseR + rJitter;
          nodeMap.set(n.neuron_id, {
            id: n.neuron_id,
            x: cx + r * Math.cos(a),
            y: cy + r * Math.sin(a),
            r: rScale(n.combined),
            label: n.label ?? `#${n.neuron_id}`,
            department: n.department ?? 'Unknown',
            layer: n.layer,
            combined: n.combined,
            spread_boost: n.spread_boost,
          });
        });
      }
    });

    // Draw layer rings (subtle)
    const ringG = svg.append('g');
    for (let layer = 0; layer <= maxLayer; layer++) {
      const r = radiusScale(layer);
      ringG.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#1e2d4a')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '3,4');
    }

    // Draw spoke lines
    const spokeG = svg.append('g');
    depts.forEach((dept, di) => {
      const angle = angleScale(di);
      spokeG.append('line')
        .attr('x1', cx + innerRadius * Math.cos(angle))
        .attr('y1', cy + innerRadius * Math.sin(angle))
        .attr('x2', cx + maxRadius * Math.cos(angle))
        .attr('y2', cy + maxRadius * Math.sin(angle))
        .attr('stroke', DEPT_COLORS[dept] ?? '#c8d0dc')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.25);
    });

    // Draw department labels
    const labelG = svg.append('g');
    depts.forEach((dept, di) => {
      const angle = angleScale(di);
      const lr = maxRadius + 20;
      const lx = cx + lr * Math.cos(angle);
      const ly = cy + lr * Math.sin(angle);
      const degrees = (angle * 180) / Math.PI;
      // Flip text on bottom half so it reads left-to-right
      const flip = degrees > 90 || degrees < -90;
      const textAngle = flip ? degrees + 180 : degrees;
      // Abbreviate long department names
      const shortName = dept.replace('Administrative & Support', 'Admin')
        .replace('Manufacturing & Operations', 'Mfg & Ops')
        .replace('Contracts & Compliance', 'Contracts')
        .replace('Business Development', 'BD')
        .replace('Executive Leadership', 'Executive')
        .replace('Program Management', 'Program Mgmt');
      labelG.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('transform', `rotate(${textAngle}, ${lx}, ${ly})`)
        .attr('fill', DEPT_COLORS[dept] ?? '#c8d0dc')
        .attr('font-size', '0.65rem')
        .attr('font-weight', 600)
        .text(shortName);
    });

    // Draw spread activation arcs
    if (edges.length > 0) {
      const arcG = svg.append('g');
      const maxWeight = Math.max(...edges.map(e => e.weight), 1);
      const wScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 2.5]);

      for (const edge of edges) {
        const src = nodeMap.get(edge.source_id);
        const tgt = nodeMap.get(edge.target_id);
        if (!src || !tgt) continue;

        // Quadratic bezier through center-ish point for curved arcs
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        // Pull control point toward center for curvature
        const ctrlX = midX + (cx - midX) * 0.5;
        const ctrlY = midY + (cy - midY) * 0.5;

        arcG.append('path')
          .attr('d', `M${src.x},${src.y} Q${ctrlX},${ctrlY} ${tgt.x},${tgt.y}`)
          .attr('fill', 'none')
          .attr('stroke', '#e8a735')
          .attr('stroke-width', wScale(edge.weight))
          .attr('stroke-opacity', 0.7);
      }
    }

    // Tooltip
    const tooltip = d3.select(containerRef.current!)
      .selectAll<HTMLDivElement, unknown>('.spread-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'spread-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'var(--bg-card)')
      .style('border', '1px solid var(--border)')
      .style('border-radius', '6px')
      .style('padding', '6px 10px')
      .style('font-size', '0.75rem')
      .style('color', 'var(--text)')
      .style('opacity', 0)
      .style('z-index', '10')
      .style('max-width', '220px');

    // Draw nodes
    const nodeG = svg.append('g');
    const allNodes = Array.from(nodeMap.values());

    // Spread-boosted ring (gold)
    nodeG.selectAll<SVGCircleElement, PosNode>('.spread-ring')
      .data(allNodes.filter(n => n.spread_boost > 0))
      .join('circle')
      .attr('class', 'spread-ring')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r', d => d.r + 4)
      .attr('fill', 'none')
      .attr('stroke', '#e8a735')
      .attr('stroke-width', 2.5);

    // Main circles
    nodeG.selectAll<SVGCircleElement, PosNode>('.node')
      .data(allNodes)
      .join('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => DEPT_COLORS[d.department] ?? '#c8d0dc')
      .attr('stroke', '#0a0e17')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const layerLabel = LAYER_LABELS[d.layer] ?? `L${d.layer}`;
        tooltip.html(
          `<strong>${d.label}</strong><br>` +
          `<span style="color:${DEPT_COLORS[d.department] ?? '#c8d0dc'}">${d.department}</span> · ${layerLabel}<br>` +
          `Score: ${d.combined.toFixed(3)}` +
          (d.spread_boost > 0 ? `<br><span style="color:#e8a735">Spread: +${d.spread_boost.toFixed(3)}</span>` : '')
        )
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    // Center label
    svg.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--text-dim)')
      .attr('font-size', '0.6rem')
      .text(`${neurons.length} neurons`);

    return () => { tooltip.remove(); };
  }, [neurons, edges]);

  const hasSpread = neurons.some(n => n.spread_boost > 0);

  if (neurons.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="spread-radial-legend">
        {hasSpread && (
          <>
            <span className="spread-legend-item"><span className="spread-legend-dot" style={{ background: '#e8a735' }} /> Spread arc</span>
            <span className="spread-legend-item"><span className="spread-legend-ring" /> Spread-boosted</span>
          </>
        )}
        {LAYER_LABELS.map((l, i) => (
          <span key={i} className="spread-legend-item" style={{ color: 'var(--text-dim)' }}>
            <span className="spread-legend-label">L{i}</span> {l}
          </span>
        ))}
      </div>
      <svg ref={svgRef} width="100%" height="420" />
    </div>
  );
}
