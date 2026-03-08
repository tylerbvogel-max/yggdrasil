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
  hop: number;
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
    const height = 400;
    const cx = width / 2;
    const cy = height / 2;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = [
      { id: data.center.id, label: data.center.label, department: data.center.department, layer: data.center.layer, isCenter: true, hop: 0, fx: cx, fy: cy },
      ...data.neighbors.map(n => ({
        id: n.id, label: n.label, department: n.department, layer: n.layer,
        isCenter: false, hop: n.hop, weight: n.weight, co_fire_count: n.co_fire_count,
      })),
    ];

    // Use real edge list from backend if available, otherwise fall back to star topology
    const links: SimLink[] = data.edges
      ? data.edges.map(e => ({ source: e.source, target: e.target, weight: e.weight, co_fire_count: e.co_fire_count }))
      : data.neighbors.map(n => ({ source: data.center.id, target: n.id, weight: n.weight, co_fire_count: n.co_fire_count }));

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // Concentric radial layout: hop-1 closer, hop-2 further out
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(d => {
        const s = nodeById.get((d.source as SimNode).id);
        const t = nodeById.get((d.target as SimNode).id);
        if (s?.isCenter || t?.isCenter) return 100;
        return 70;
      }))
      .force('radial', d3.forceRadial<SimNode>(d => d.isCenter ? 0 : d.hop === 1 ? 110 : 190, cx, cy).strength(0.7))
      .force('collide', d3.forceCollide(18))
      .force('charge', d3.forceManyBody().strength(-30))
      .stop();

    for (let i = 0; i < 150; i++) sim.tick();

    const maxWeight = d3.max(links, l => l.weight) || 1;
    const weightScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);

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

    // Determine if a link connects to center
    function linkTouchesCenter(d: SimLink): boolean {
      const sId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source;
      const tId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
      return sId === data!.center.id || tId === data!.center.id;
    }

    // Edges
    svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => (nodeById.get((d.source as SimNode).id)?.x ?? cx))
      .attr('y1', d => (nodeById.get((d.source as SimNode).id)?.y ?? cy))
      .attr('x2', d => (nodeById.get((d.target as SimNode).id)?.x ?? cx))
      .attr('y2', d => (nodeById.get((d.target as SimNode).id)?.y ?? cy))
      .attr('stroke', d => linkTouchesCenter(d) ? '#475569' : '#334155')
      .attr('stroke-width', d => weightScale(d.weight))
      .attr('stroke-dasharray', d => linkTouchesCenter(d) ? 'none' : '4,3')
      .attr('stroke-opacity', d => linkTouchesCenter(d) ? 0.8 : 0.5);

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
        const parts = [d.label];
        if (d.department) parts.push(d.department);
        if (!d.isCenter) {
          parts.push(`Hop: ${d.hop}`);
          if (d.weight != null) parts.push(`Weight: ${d.weight.toFixed(3)}`);
          if (d.co_fire_count != null) parts.push(`Co-fires: ${d.co_fire_count}`);
        }
        tooltip.html(parts.join('<br>'))
          .style('opacity', 1)
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    // Node circles — hop-1 solid, hop-2 with dashed stroke ring
    nodeG.append('circle')
      .attr('r', d => d.isCenter ? 16 : d.hop === 1 ? 9 : 6)
      .attr('fill', d => {
        const color = DEPT_COLORS[d.department ?? ''] ?? '#8892a8';
        return d.hop >= 2 ? color + 'aa' : color;  // slightly transparent for hop-2
      })
      .attr('stroke', d => {
        if (d.isCenter) return 'var(--accent)';
        if (d.hop >= 2) return DEPT_COLORS[d.department ?? ''] ?? '#8892a8';
        return 'transparent';
      })
      .attr('stroke-width', d => d.isCenter ? 2 : d.hop >= 2 ? 1.5 : 0)
      .attr('stroke-dasharray', d => d.hop >= 2 ? '2,2' : 'none');

    // Center label
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

  const hop1Count = data.neighbors.filter(n => n.hop === 1).length;
  const hop2Count = data.neighbors.filter(n => n.hop >= 2).length;

  return (
    <div className="detail-section" style={{ position: 'relative' }}>
      <h3>Co-Firing Neighbors</h3>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>
        <span style={{ marginRight: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8892a8', marginRight: 4, verticalAlign: 'middle' }} />
          Direct ({hop1Count})
        </span>
        {hop2Count > 0 && (
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8892a8aa', border: '1px dashed #8892a8', marginRight: 4, verticalAlign: 'middle' }} />
            Multi-hop ({hop2Count})
          </span>
        )}
      </div>
      <svg ref={svgRef} width="100%" height="400" />
    </div>
  );
}
