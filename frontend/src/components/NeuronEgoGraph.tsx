import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchNeuronEdges } from '../api'
import type { EgoGraphResponse } from '../types'
import { DEPT_COLORS } from '../constants'

interface Props {
  neuronId: number;
  onSelectNeuron?: (id: number) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  label: string;
  department: string | null;
  layer: number;
  isCenter: boolean;
  weight?: number;
  co_fire_count?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  co_fire_count: number;
}

export default function NeuronEgoGraph({ neuronId, onSelectNeuron }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<EgoGraphResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    fetchNeuronEdges(neuronId)
      .then(setData)
      .catch(e => setError(e.message));
  }, [neuronId]);

  useEffect(() => {
    if (!data || !svgRef.current || data.neighbors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 500;
    const height = 320;
    const cx = width / 2;
    const cy = height / 2;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = [
      { id: data.center.id, label: data.center.label, department: data.center.department, layer: data.center.layer, isCenter: true, fx: cx, fy: cy },
      ...data.neighbors.map(n => ({
        id: n.id, label: n.label, department: n.department, layer: n.layer,
        isCenter: false, weight: n.weight, co_fire_count: n.co_fire_count,
      })),
    ];

    const links: SimLink[] = data.neighbors.map(n => ({
      source: data.center.id,
      target: n.id,
      weight: n.weight,
      co_fire_count: n.co_fire_count,
    }));

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(120))
      .force('radial', d3.forceRadial(120, cx, cy).strength(0.8))
      .force('collide', d3.forceCollide(20))
      .stop();

    for (let i = 0; i < 100; i++) sim.tick();

    const weightScale = d3.scaleLinear()
      .domain([0, d3.max(links, l => l.weight) || 1])
      .range([1, 5]);

    // Tooltip
    const tooltip = d3.select(svgRef.current.parentElement!)
      .selectAll<HTMLDivElement, unknown>('.ego-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'ego-tooltip')
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
      .attr('x1', d => (nodeById.get((d.source as SimNode).id)?.x ?? cx))
      .attr('y1', d => (nodeById.get((d.source as SimNode).id)?.y ?? cy))
      .attr('x2', d => (nodeById.get((d.target as SimNode).id)?.x ?? cx))
      .attr('y2', d => (nodeById.get((d.target as SimNode).id)?.y ?? cy))
      .attr('stroke', '#334155')
      .attr('stroke-width', d => weightScale(d.weight));

    // Nodes
    const nodeG = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', d => d.isCenter ? 'default' : 'pointer')
      .on('click', (_e, d) => {
        if (!d.isCenter && onSelectNeuron) onSelectNeuron(d.id);
      })
      .on('mouseenter', (event, d) => {
        const label = d.isCenter ? d.label : `${d.label}\n${d.department ?? ''}\nWeight: ${d.weight?.toFixed(3)}\nCo-fires: ${d.co_fire_count}`;
        tooltip.html(label.replace(/\n/g, '<br>'))
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    nodeG.append('circle')
      .attr('r', d => d.isCenter ? 16 : 8)
      .attr('fill', d => DEPT_COLORS[d.department ?? ''] ?? '#8892a8')
      .attr('stroke', d => d.isCenter ? 'var(--accent)' : 'transparent')
      .attr('stroke-width', d => d.isCenter ? 2 : 0);

    nodeG.filter(d => d.isCenter)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 30)
      .attr('fill', 'var(--text)')
      .attr('font-size', '0.7rem')
      .text(d => d.label.length > 25 ? d.label.slice(0, 22) + '...' : d.label);

    return () => { tooltip.remove(); };
  }, [data, onSelectNeuron]);

  if (error) return <div className="error-msg">{error}</div>;
  if (!data || data.neighbors.length === 0) return null;

  return (
    <div className="detail-section" style={{ position: 'relative' }}>
      <h3>Co-Firing Neighbors</h3>
      <svg ref={svgRef} width="100%" height="320" />
    </div>
  );
}
