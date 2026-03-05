import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchSpreadTrail } from '../api'
import type { SpreadTrailResponse } from '../types'
import { DEPT_COLORS } from '../constants'

interface Props {
  queryId: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  label: string;
  department: string | null;
  layer: number;
  combined: number;
  spread_boost: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

export default function SpreadTrail({ queryId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<SpreadTrailResponse | null>(null);

  useEffect(() => {
    fetchSpreadTrail(queryId)
      .then(setData)
      .catch(() => setData({ nodes: [], edges: [] }));
  }, [queryId]);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 500;
    const height = 280;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'spread-arrow')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 12)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3L6,0L0,3')
      .attr('fill', '#e8a735');

    const nodes: SimNode[] = data.nodes.map(n => ({ ...n }));
    const links: SimLink[] = data.edges.map(e => ({
      source: e.source_id,
      target: e.target_id,
      weight: e.weight,
    }));

    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, n => n.combined) || 1])
      .range([5, 18]);

    const wScale = d3.scaleLinear()
      .domain([0, d3.max(links, l => l.weight) || 1])
      .range([1, 4]);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(20))
      .stop();

    for (let i = 0; i < 120; i++) sim.tick();

    // Tooltip
    const tooltip = d3.select(svgRef.current.parentElement!)
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
      .style('z-index', '10');

    // Edges
    svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => (d.source as SimNode).x!)
      .attr('y1', d => (d.source as SimNode).y!)
      .attr('x2', d => (d.target as SimNode).x!)
      .attr('y2', d => (d.target as SimNode).y!)
      .attr('stroke', '#e8a735')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => wScale(d.weight))
      .attr('marker-end', 'url(#spread-arrow)');

    // Nodes
    const nodeG = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .on('mouseenter', (event, d) => {
        tooltip.html(`${d.label}<br>${d.department ?? ''}<br>Combined: ${d.combined.toFixed(3)}<br>Spread: ${d.spread_boost > 0 ? d.spread_boost.toFixed(3) : 'none'}`)
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    // Spread-boosted ring
    nodeG.filter(d => d.spread_boost > 0)
      .append('circle')
      .attr('r', d => rScale(d.combined) + 3)
      .attr('fill', 'none')
      .attr('stroke', '#e8a735')
      .attr('stroke-width', 2);

    // Main circle
    nodeG.append('circle')
      .attr('r', d => rScale(d.combined))
      .attr('fill', d => DEPT_COLORS[d.department ?? ''] ?? '#8892a8');

    return () => { tooltip.remove(); };
  }, [data]);

  if (!data || data.nodes.length === 0) return null;

  return (
    <div className="result-card" style={{ position: 'relative' }}>
      <h3 style={{ color: '#e8a735', marginBottom: 8 }}>Spread Activation Trail</h3>
      <svg ref={svgRef} width="100%" height="280" />
    </div>
  );
}
