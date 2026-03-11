import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchSpreadTrail } from '../api'
import type { NeuronScoreResponse, SpreadTrailResponse } from '../types'
import { DEPT_COLORS } from '../constants'

const LAYER_LABELS = ['Dept', 'Role', 'Task', 'System', 'Decision', 'Output'];

interface Props {
  queryId: number;
  neuronScores?: NeuronScoreResponse[];
  onNavigateToNeuron?: (id: number) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  label: string;
  department: string;
  layer: number;
  combined: number;
  spread_boost: number;
  hasEdge: boolean; // part of the co-firing network
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

export default function SpreadTrail({ queryId, neuronScores, onNavigateToNeuron }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trailData, setTrailData] = useState<SpreadTrailResponse | null>(null);

  const neurons = neuronScores ?? [];

  useEffect(() => {
    fetchSpreadTrail(queryId)
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, [queryId]);

  useEffect(() => {
    if (!svgRef.current || neurons.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 700;
    const height = 320;
    const cx = width / 2;
    const cy = height / 2;

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    // SVG filters
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'spread-node-glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    glowFilter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', d => d);

    const wireGlow = defs.append('filter').attr('id', 'spread-wire-glow');
    wireGlow.append('feGaussianBlur').attr('stdDeviation', '1.5').attr('result', 'blur');
    wireGlow.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', d => d);

    // Build edge list from trail data
    const edges = trailData?.edges ?? [];
    const edgeNodeIds = new Set<number>();
    for (const e of edges) {
      edgeNodeIds.add(e.source_id);
      edgeNodeIds.add(e.target_id);
    }

    // Build simulation nodes — all scored neurons
    const nodes: SimNode[] = neurons.map(n => ({
      id: n.neuron_id,
      label: n.label ?? `#${n.neuron_id}`,
      department: n.department ?? 'Unknown',
      layer: n.layer,
      combined: n.combined,
      spread_boost: n.spread_boost,
      hasEdge: edgeNodeIds.has(n.neuron_id),
    }));

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // Build simulation links
    const links: SimLink[] = edges
      .filter(e => nodeById.has(e.source_id) && nodeById.has(e.target_id))
      .map(e => ({
        source: e.source_id,
        target: e.target_id,
        weight: e.weight,
      }));

    // Separate connected nodes (part of network) from isolated ones
    const connectedNodes = nodes.filter(n => n.hasEdge);
    const isolatedNodes = nodes.filter(n => !n.hasEdge);

    // Score-based sizing — smaller dots
    const maxCombined = Math.max(...neurons.map(n => n.combined), 0.001);
    const rScale = d3.scaleSqrt().domain([0, maxCombined]).range([2, 7]);

    // Force simulation for connected nodes — stretch horizontally to fill width
    if (connectedNodes.length > 0 && links.length > 0) {
      const sim = d3.forceSimulation(connectedNodes)
        .force('link', d3.forceLink<SimNode, SimLink>(links)
          .id(d => d.id)
          .distance(d => 100 + (1 - d.weight) * 80)
          .strength(d => 0.2 + d.weight * 0.4))
        .force('charge', d3.forceManyBody().strength(-250))
        .force('collide', d3.forceCollide<SimNode>(d => rScale(d.combined) + 6))
        // Weak X pull keeps it centered but lets charge push nodes apart horizontally
        .force('x', d3.forceX(cx).strength(0.01))
        // Stronger Y pull compresses vertically → nodes spread horizontally instead
        .force('y', d3.forceY(cy).strength(0.08))
        .stop();

      for (let i = 0; i < 300; i++) sim.tick();

      // Rescale X positions to fill available width
      const pad = 20;
      const xs = connectedNodes.map(n => n.x!);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const rangeX = maxX - minX || 1;
      for (const n of connectedNodes) {
        n.x = pad + ((n.x! - minX) / rangeX) * (width - pad * 2);
        n.y = Math.max(pad, Math.min(height - pad, n.y!));
      }
    }

    // Position isolated nodes in a ring around the perimeter
    if (isolatedNodes.length > 0) {
      // Group by department for angular clustering
      const deptGroups = new Map<string, SimNode[]>();
      for (const n of isolatedNodes) {
        if (!deptGroups.has(n.department)) deptGroups.set(n.department, []);
        deptGroups.get(n.department)!.push(n);
      }
      const depts = Array.from(deptGroups.keys()).sort();
      let idx = 0;
      const total = isolatedNodes.length;
      const ringRx = cx - 15;  // horizontal radius — fills width
      const ringRy = cy - 15;  // vertical radius — fills height
      for (const dept of depts) {
        const group = deptGroups.get(dept)!;
        for (const n of group) {
          const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
          n.x = cx + ringRx * Math.cos(angle);
          n.y = cy + ringRy * Math.sin(angle);
          idx++;
        }
      }
    }

    // Edge rendering
    const maxWeight = Math.max(...links.map(l => l.weight), 0.01);
    const weightScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 3]);
    const opacityScale = d3.scaleLinear().domain([0, maxWeight]).range([0.2, 0.7]);

    function wirePath(d: SimLink, i: number): string {
      const s = d.source as SimNode;
      const t = d.target as SimNode;
      const x1 = s.x!, y1 = s.y!;
      const x2 = t.x!, y2 = t.y!;
      const dx = x2 - x1, dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const curvature = dist * 0.12 * (i % 2 === 0 ? 1 : -1);
      const mx = (x1 + x2) / 2 + (-dy / dist) * curvature;
      const my = (y1 + y2) / 2 + (dx / dist) * curvature;
      return `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`;
    }

    // Draw wire glow layer
    const edgeG = svg.append('g');
    edgeG.selectAll('path.wire-glow')
      .data(links)
      .join('path')
      .attr('class', 'wire-glow')
      .attr('d', (d, i) => wirePath(d, i))
      .attr('fill', 'none')
      .attr('stroke', d => {
        const s = d.source as SimNode;
        return DEPT_COLORS[s.department] ?? '#e8a735';
      })
      .attr('stroke-width', d => weightScale(d.weight) + 2)
      .attr('stroke-opacity', d => opacityScale(d.weight) * 0.15)
      .attr('filter', 'url(#spread-wire-glow)');

    // Draw wire core layer
    edgeG.selectAll('path.wire-core')
      .data(links)
      .join('path')
      .attr('class', 'wire-core')
      .attr('d', (d, i) => wirePath(d, i))
      .attr('fill', 'none')
      .attr('stroke', d => {
        const s = d.source as SimNode;
        return DEPT_COLORS[s.department] ?? '#e8a735';
      })
      .attr('stroke-width', d => weightScale(d.weight))
      .attr('stroke-opacity', d => opacityScale(d.weight) + 0.1);

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
      .style('max-width', '240px');

    // Draw nodes
    const allNodes = [...connectedNodes, ...isolatedNodes];
    const nodeG = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(allNodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_e, d) => { if (onNavigateToNeuron) onNavigateToNeuron(d.id); })
      .on('mouseenter', (event, d) => {
        const layerLabel = LAYER_LABELS[d.layer] ?? `L${d.layer}`;
        tooltip.html(
          `<strong>${d.label}</strong><br>` +
          `<span style="color:${DEPT_COLORS[d.department] ?? '#c8d0dc'}">${d.department}</span> · ${layerLabel}<br>` +
          `Score: ${d.combined.toFixed(3)}` +
          (d.spread_boost > 0 ? `<br><span style="color:#e8a735">Spread: +${d.spread_boost.toFixed(3)}</span>` : '') +
          (d.hasEdge ? '' : '<br><span style="color:var(--text-dim)">No co-firing edges</span>')
        )
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    // Glow halo
    nodeG.append('circle')
      .attr('r', d => rScale(d.combined) + (d.hasEdge ? 3 : 2))
      .attr('fill', d => {
        const color = DEPT_COLORS[d.department] ?? '#c8d0dc';
        return color + '18';
      })
      .attr('filter', 'url(#spread-node-glow)');

    // Spread-boost ring (gold)
    nodeG.filter(d => d.spread_boost > 0)
      .append('circle')
      .attr('r', d => rScale(d.combined) + 3)
      .attr('fill', 'none')
      .attr('stroke', '#e8a735')
      .attr('stroke-width', 1.5);

    // Main circle
    nodeG.append('circle')
      .attr('r', d => rScale(d.combined))
      .attr('fill', d => {
        const color = DEPT_COLORS[d.department] ?? '#c8d0dc';
        return d.hasEdge ? color : color + '88';
      })
      .attr('stroke', d => {
        const color = DEPT_COLORS[d.department] ?? '#c8d0dc';
        return d.hasEdge ? color + '80' : color + '40';
      })
      .attr('stroke-width', d => d.hasEdge ? 1 : 0.5);

    // Stats label
    const spreadCount = neurons.filter(n => n.spread_boost > 0).length;
    svg.append('text')
      .attr('x', 8).attr('y', height - 8)
      .attr('fill', 'var(--text-dim)')
      .attr('font-size', '0.6rem')
      .text(`${neurons.length} neurons · ${links.length} edges · ${spreadCount} spread-boosted`);

    return () => { tooltip.remove(); };
  }, [neurons, trailData, onNavigateToNeuron]);

  const hasSpread = neurons.some(n => n.spread_boost > 0);

  if (neurons.length === 0) return null;

  // Department summary for legend
  const deptCounts = new Map<string, number>();
  for (const n of neurons) {
    const dept = n.department ?? 'Unknown';
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="spread-radial-legend">
        {hasSpread && (
          <>
            <span className="spread-legend-item"><span className="spread-legend-ring" /> Spread-boosted</span>
          </>
        )}
        {Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
          <span key={dept} className="spread-legend-item">
            <span className="spread-legend-dot" style={{ background: DEPT_COLORS[dept] ?? '#c8d0dc' }} />
            {dept.replace('Administrative & Support', 'Admin')
              .replace('Manufacturing & Operations', 'Mfg & Ops')
              .replace('Contracts & Compliance', 'Contracts')
              .replace('Business Development', 'BD')
              .replace('Executive Leadership', 'Executive')
              .replace('Program Management', 'Program Mgmt')} ({count})
          </span>
        ))}
      </div>
      <svg ref={svgRef} width="100%" height="320" style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8 }} />
    </div>
  );
}
