import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchLayerFlow, type LayerFlowNode, type LayerFlowLink } from '../api';
import { DEPT_COLORS } from '../constants';

const LAYER_LABELS = ['L0 Department', 'L1 Role', 'L2 Task', 'L3 System', 'L4 Decision', 'L5 Output'];

interface SankeyNode extends LayerFlowNode {
  x: number;
  y: number;
  height: number;
  totalFlow: number;
}

interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  total_weight: number;
  edge_count: number;
  width: number;
  sy: number; // source y offset
  ty: number; // target y offset
}

export default function LayerSankey() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minWeight, setMinWeight] = useState(0.15);
  const [flowMode, setFlowMode] = useState<'cross' | 'all'>('all');
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 1000, height: 600 });

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height: Math.max(height, 400) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    setLoading(true);
    setError(null);

    fetchLayerFlow(minWeight).then(data => {
      setLoading(false);
      if (!data.nodes.length) {
        setError('No co-firing data found at this threshold.');
        return;
      }
      drawSankey(svg, data.nodes, data.links);
    }).catch(e => {
      setLoading(false);
      setError(e instanceof Error ? e.message : 'Failed to load flow data');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWeight, flowMode, dims, hoverNode, hoverLink]);

  function drawSankey(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    rawNodes: LayerFlowNode[],
    rawLinks: LayerFlowLink[],
  ) {
    const margin = { top: 40, right: 20, bottom: 20, left: 20 };
    const W = dims.width - margin.left - margin.right;
    const H = dims.height - margin.top - margin.bottom;
    const nodeWidth = 18;
    const nodePadding = 6;

    // Filter links: cross-layer only or all
    const links = flowMode === 'cross'
      ? rawLinks.filter(l => {
          const sn = rawNodes.find(n => n.key === l.source);
          const tn = rawNodes.find(n => n.key === l.target);
          return sn && tn && sn.layer !== tn.layer;
        })
      : rawLinks;

    // Compute total flow per node (sum of all connected links)
    const flowMap = new Map<string, number>();
    for (const l of links) {
      flowMap.set(l.source, (flowMap.get(l.source) || 0) + l.total_weight);
      flowMap.set(l.target, (flowMap.get(l.target) || 0) + l.total_weight);
    }

    // Only include nodes that have flow
    const activeNodes = rawNodes.filter(n => flowMap.has(n.key));

    // Group nodes by layer
    const layerGroups = new Map<number, LayerFlowNode[]>();
    for (const n of activeNodes) {
      if (!layerGroups.has(n.layer)) layerGroups.set(n.layer, []);
      layerGroups.get(n.layer)!.push(n);
    }

    // Sort nodes within each layer by department for consistent positioning
    for (const [, group] of layerGroups) {
      group.sort((a, b) => (a.department || '').localeCompare(b.department || ''));
    }

    // Layer x positions
    const layers = [...layerGroups.keys()].sort();
    const layerX = new Map<number, number>();
    if (layers.length <= 1) {
      layers.forEach(l => layerX.set(l, W / 2));
    } else {
      layers.forEach((l, i) => layerX.set(l, (i / (layers.length - 1)) * (W - nodeWidth)));
    }

    // Scale node heights — total available height per layer column
    const maxLayerFlow = Math.max(...[...layerGroups.entries()].map(([, group]) => {
      return group.reduce((sum, n) => sum + (flowMap.get(n.key) || 0), 0);
    }));

    // Build positioned nodes
    const nodeMap = new Map<string, SankeyNode>();
    for (const [layer, group] of layerGroups) {
      const x = layerX.get(layer) || 0;
      const totalLayerFlow = group.reduce((sum, n) => sum + (flowMap.get(n.key) || 0), 0);
      const availableH = H - (group.length - 1) * nodePadding;
      const scale = maxLayerFlow > 0 ? availableH / maxLayerFlow : 1;
      let y = (H - (totalLayerFlow * scale + (group.length - 1) * nodePadding)) / 2;
      if (y < 0) y = 0;

      for (const n of group) {
        const flow = flowMap.get(n.key) || 0;
        const h = Math.max(3, flow * scale);
        nodeMap.set(n.key, {
          ...n,
          x,
          y,
          height: h,
          totalFlow: flow,
        });
        y += h + nodePadding;
      }
    }

    // Build positioned links with bandwidth allocation
    const sankeyLinks: SankeyLink[] = [];
    // Track allocated bandwidth per node side (source right, target left)
    const sourceOffset = new Map<string, number>();
    const targetOffset = new Map<string, number>();

    // Sort links by weight descending for better visual stacking
    const sortedLinks = [...links].sort((a, b) => b.total_weight - a.total_weight);

    for (const l of sortedLinks) {
      const sn = nodeMap.get(l.source);
      const tn = nodeMap.get(l.target);
      if (!sn || !tn) continue;

      const sFlow = sn.totalFlow || 1;
      const tFlow = tn.totalFlow || 1;
      const linkWidth = Math.max(1, (l.total_weight / Math.max(sFlow, tFlow)) * Math.min(sn.height, tn.height));

      const sy = sourceOffset.get(l.source) || 0;
      const ty = targetOffset.get(l.target) || 0;
      sourceOffset.set(l.source, sy + linkWidth);
      targetOffset.set(l.target, ty + linkWidth);

      sankeyLinks.push({
        source: sn,
        target: tn,
        total_weight: l.total_weight,
        edge_count: l.edge_count,
        width: linkWidth,
        sy,
        ty,
      });
    }

    // Draw
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Layer column labels
    for (const [layer] of layerGroups) {
      const x = layerX.get(layer) || 0;
      g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', -14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#c8d0dc')
        .attr('font-size', '0.7rem')
        .attr('font-weight', 600)
        .text(LAYER_LABELS[layer] || `L${layer}`);
    }

    // Links
    const linkGroup = g.append('g').attr('fill', 'none');

    for (const link of sankeyLinks) {
      const x0 = link.source.x + nodeWidth;
      const x1 = link.target.x;
      const y0 = link.source.y + link.sy + link.width / 2;
      const y1 = link.target.y + link.ty + link.width / 2;

      // Same-layer links curve upward
      const sameLayer = link.source.layer === link.target.layer;
      let pathD: string;
      if (sameLayer) {
        const cx = link.source.x + nodeWidth + 40;
        const cy = Math.min(link.source.y, link.target.y) - 30 - link.width;
        pathD = `M${link.source.x + nodeWidth},${y0} Q${cx},${cy} ${link.target.x},${y1}`;
      } else {
        const midX = (x0 + x1) / 2;
        pathD = `M${x0},${y0} C${midX},${y0} ${midX},${y1} ${x1},${y1}`;
      }

      const linkKey = `${link.source.key}→${link.target.key}`;
      const isHovered = hoverLink === linkKey;
      const isNodeHovered = hoverNode && (link.source.key === hoverNode || link.target.key === hoverNode);
      const isFaded = (hoverNode || hoverLink) && !isHovered && !isNodeHovered;

      const color = DEPT_COLORS[link.source.department] || '#c8d0dc';

      linkGroup.append('path')
        .attr('d', pathD)
        .attr('stroke', color)
        .attr('stroke-width', Math.max(1, link.width))
        .attr('stroke-opacity', isFaded ? 0.05 : isHovered || isNodeHovered ? 0.7 : 0.25)
        .attr('cursor', 'pointer')
        .on('mouseenter', () => setHoverLink(linkKey))
        .on('mouseleave', () => setHoverLink(null));
    }

    // Nodes
    const nodeGroup = g.append('g');

    for (const [, node] of nodeMap) {
      const isHovered = hoverNode === node.key;
      const isConnected = hoverNode && sankeyLinks.some(
        l => (l.source.key === hoverNode && l.target.key === node.key) ||
             (l.target.key === hoverNode && l.source.key === node.key)
      );
      const isFaded = (hoverNode || hoverLink) && !isHovered && !isConnected;
      const color = DEPT_COLORS[node.department] || '#c8d0dc';

      const ng = nodeGroup.append('g')
        .attr('cursor', 'pointer')
        .on('mouseenter', () => setHoverNode(node.key))
        .on('mouseleave', () => setHoverNode(null));

      ng.append('rect')
        .attr('x', node.x)
        .attr('y', node.y)
        .attr('width', nodeWidth)
        .attr('height', node.height)
        .attr('fill', color)
        .attr('opacity', isFaded ? 0.15 : isHovered ? 1 : 0.8)
        .attr('rx', 2);

      // Label — position depends on which half of the chart
      const midX = W / 2;
      const labelOnRight = node.x < midX;
      const labelX = labelOnRight ? node.x + nodeWidth + 6 : node.x - 6;
      const anchor = labelOnRight ? 'start' : 'end';

      // Only show label if node is tall enough or hovered
      if (node.height > 12 || isHovered || isConnected) {
        const dept = node.department || 'Unknown';
        const deptAbbrev = dept.length > 16
          ? dept.split(/[\s&]+/).map(w => w[0]).join('').toUpperCase()
          : dept;

        ng.append('text')
          .attr('x', labelX)
          .attr('y', node.y + node.height / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', anchor)
          .attr('fill', isFaded ? '#c8d0dc22' : '#ffffff')
          .attr('font-size', isHovered ? '0.75rem' : '0.65rem')
          .attr('font-weight', isHovered ? 600 : 400)
          .text(deptAbbrev);
      }
    }
  }

  // Tooltip for hovered elements
  const hoveredLinkData = hoverLink ? (() => {
    const [src, tgt] = hoverLink.split('→');
    return { source: src, target: tgt };
  })() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
          Co-Firing Layer Flow
        </h3>
        <label style={{ fontSize: '0.75rem', color: '#c8d0dc', display: 'flex', alignItems: 'center', gap: 6 }}>
          Min Weight:
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={minWeight}
            onChange={e => setMinWeight(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ color: 'var(--text)', minWidth: 32 }}>{minWeight.toFixed(2)}</span>
        </label>
        <label style={{ fontSize: '0.75rem', color: '#c8d0dc', display: 'flex', alignItems: 'center', gap: 6 }}>
          Flow:
          <select
            value={flowMode}
            onChange={e => setFlowMode(e.target.value as 'cross' | 'all')}
            style={{
              background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem',
            }}
          >
            <option value="all">All co-firing</option>
            <option value="cross">Cross-layer only</option>
          </select>
        </label>
        {loading && <span style={{ fontSize: '0.75rem', color: '#fb923c' }}>Loading...</span>}
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: 8 }}>{error}</div>
      )}

      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          ref={svgRef}
          width={dims.width}
          height={dims.height}
          style={{ display: 'block' }}
        />
        {hoveredLinkData && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', fontSize: '0.75rem',
            pointerEvents: 'none',
          }}>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {hoveredLinkData.source.replace(/^L\d:/, '')}
            </div>
            <div style={{ color: '#c8d0dc' }}>↓</div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {hoveredLinkData.target.replace(/^L\d:/, '')}
            </div>
          </div>
        )}
        {hoverNode && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', fontSize: '0.75rem',
            pointerEvents: 'none',
          }}>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {hoverNode.replace(/^L\d:/, '')}
            </div>
            <div style={{ color: '#c8d0dc' }}>
              {LAYER_LABELS[Number(hoverNode[1])] || hoverNode.slice(0, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
