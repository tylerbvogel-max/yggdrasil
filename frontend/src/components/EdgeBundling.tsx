import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { fetchLayerFlow } from '../api';
import type { LayerFlowResponse, LayerFlowNode } from '../api';
import { DEPT_COLORS } from '../constants';

const LAYER_LABELS = ['L0 Department', 'L1 Role', 'L2 Task', 'L3 System', 'L4 Decision', 'L5 Output'];

interface TooltipInfo {
  department: string;
  layerLabel: string;
  key: string;
  connectionCount: number;
}

export default function EdgeBundling() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<LayerFlowResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [minWeight, setMinWeight] = useState(0.15);
  const [bundleTension, setBundleTension] = useState(0.85);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Store tension in a ref so the draw closure can read the latest value
  const tensionRef = useRef(bundleTension);
  tensionRef.current = bundleTension;

  useEffect(() => {
    setError('');
    setLoading(true);
    fetchLayerFlow(minWeight)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [minWeight]);

  const draw = useCallback(() => {
    if (!data || !containerRef.current || !svgRef.current) return;
    const { nodes, links } = data;
    if (nodes.length === 0) {
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }

    const el = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = el.clientWidth;
    const h = el.clientHeight > 200 ? el.clientHeight : w;
    const size = Math.min(w, h);
    if (size < 100) return;

    svg
      .attr('viewBox', `0 0 ${size} ${size}`)
      .style('width', '100%')
      .style('height', '100%')
      .style('max-width', `${size}px`)
      .style('max-height', `${size}px`)
      .style('display', 'block')
      .style('margin', '0 auto')
      .style('overflow', 'visible');

    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const labelMargin = 100;
    const radius = (size / 2) - labelMargin;
    if (radius < 40) return;

    // ── Group nodes by department ──
    const departments = [...new Set(nodes.map(n => n.department))].sort();
    const deptNodes = new Map<string, LayerFlowNode[]>();
    for (const dept of departments) {
      const dns = nodes
        .filter(n => n.department === dept)
        .sort((a, b) => a.layer - b.layer);
      deptNodes.set(dept, dns);
    }

    // ── Assign angular positions ──
    const totalNodes = nodes.length;
    const deptPadAngle = 0.06; // gap between departments
    const totalPad = deptPadAngle * departments.length;
    const availableAngle = 2 * Math.PI - totalPad;

    interface LayoutNode extends LayerFlowNode {
      angle: number;
      x: number;
      y: number;
    }

    const layoutNodes: LayoutNode[] = [];
    const nodeByKey = new Map<string, LayoutNode>();
    let currentAngle = 0;

    // Track department arc spans for labels
    const deptArcs: { dept: string; startAngle: number; endAngle: number }[] = [];

    for (const dept of departments) {
      const dns = deptNodes.get(dept)!;
      const deptArcLen = (dns.length / totalNodes) * availableAngle;
      const startAngle = currentAngle;

      for (let i = 0; i < dns.length; i++) {
        const fraction = dns.length === 1 ? 0.5 : i / (dns.length - 1);
        const angle = currentAngle + fraction * deptArcLen;
        const x = Math.cos(angle - Math.PI / 2) * radius;
        const y = Math.sin(angle - Math.PI / 2) * radius;
        const ln: LayoutNode = { ...dns[i], angle, x, y };
        layoutNodes.push(ln);
        nodeByKey.set(ln.key, ln);
      }

      deptArcs.push({ dept, startAngle, endAngle: currentAngle + deptArcLen });
      currentAngle += deptArcLen + deptPadAngle;
    }

    // ── Build adjacency for hover highlighting ──
    const nodeLinks = new Map<string, Set<string>>();
    for (const n of layoutNodes) nodeLinks.set(n.key, new Set());
    for (const link of links) {
      nodeLinks.get(link.source)?.add(link.target);
      nodeLinks.get(link.target)?.add(link.source);
    }

    // ── Weight scale for edge opacity ──
    const weightExtent = d3.extent(links, l => l.total_weight) as [number, number];
    const opacityScale = d3.scaleLinear()
      .domain([weightExtent[0] || 0, weightExtent[1] || 1])
      .range([0.08, 0.6])
      .clamp(true);

    // ── Node size scale ──
    const neuronCounts = layoutNodes.map(n => n.neuron_count ?? 1);
    const countExtent = d3.extent(neuronCounts) as [number, number];
    const sizeScale = d3.scaleLinear()
      .domain([countExtent[0] || 1, countExtent[1] || 10])
      .range([3, 8])
      .clamp(true);

    // ── Draw edges ──
    const beta = tensionRef.current;
    const lineGen = d3.lineRadial<[number, number]>()
      .angle(d => d[0])
      .radius(d => d[1])
      .curve(d3.curveBundle.beta(beta));

    const edgesGroup = g.append('g').attr('class', 'edges');

    const edgePaths = edgesGroup.selectAll('path')
      .data(links)
      .join('path')
      .attr('d', link => {
        const src = nodeByKey.get(link.source);
        const tgt = nodeByKey.get(link.target);
        if (!src || !tgt) return null;
        // Three-point path: source on rim -> center (0,0) -> target on rim
        const points: [number, number][] = [
          [src.angle, radius],
          [(src.angle + tgt.angle) / 2, 0], // bundle through center
          [tgt.angle, radius],
        ];
        return lineGen(points);
      })
      .attr('fill', 'none')
      .attr('stroke', link => {
        const src = nodeByKey.get(link.source);
        return src ? (DEPT_COLORS[src.department] ?? '#c8d0dc') : '#c8d0dc';
      })
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', link => opacityScale(link.total_weight));

    // ── Draw department arc labels ──
    const labelRadius = radius + 30;
    const deptLabelsGroup = g.append('g').attr('class', 'dept-labels');

    deptLabelsGroup.selectAll('text')
      .data(deptArcs)
      .join('text')
      .attr('transform', d => {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const x = Math.cos(midAngle - Math.PI / 2) * (labelRadius + 20);
        const y = Math.sin(midAngle - Math.PI / 2) * (labelRadius + 20);
        return `translate(${x},${y})`;
      })
      .attr('text-anchor', d => {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        return midAngle > Math.PI ? 'end' : 'start';
      })
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => DEPT_COLORS[d.dept] ?? 'var(--text-dim)')
      .attr('font-size', '10px')
      .attr('font-weight', 600)
      .style('cursor', 'pointer')
      .text(d => d.dept)
      .on('mouseenter', (_event, d) => {
        // Highlight all edges from/to this department
        const deptNodeKeys = new Set(
          layoutNodes.filter(n => n.department === d.dept).map(n => n.key)
        );
        edgePaths.attr('stroke-opacity', link =>
          deptNodeKeys.has(link.source) || deptNodeKeys.has(link.target)
            ? 0.8
            : 0.02
        );
        nodeDots.attr('opacity', n =>
          n.department === d.dept || nodeLinks.get(n.key)!.size > 0 && layoutNodes.some(
            ln => ln.department === d.dept && (nodeLinks.get(ln.key)?.has(n.key) ?? false)
          ) ? 1 : 0.15
        );
      })
      .on('mouseleave', () => {
        edgePaths.attr('stroke-opacity', link => opacityScale(link.total_weight));
        nodeDots.attr('opacity', 1);
      });

    // ── Draw small department arc indicators ──
    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(radius + 4)
      .outerRadius(radius + 8);

    g.append('g').attr('class', 'dept-arcs')
      .selectAll('path')
      .data(deptArcs)
      .join('path')
      .attr('d', d => arcGen(d as any))
      .attr('fill', d => DEPT_COLORS[d.dept] ?? '#c8d0dc')
      .attr('opacity', 0.5);

    // ── Draw node dots ──
    const nodesGroup = g.append('g').attr('class', 'nodes');

    const nodeDots = nodesGroup.selectAll<SVGCircleElement, LayoutNode>('circle')
      .data(layoutNodes)
      .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => sizeScale(d.neuron_count ?? 1))
      .attr('fill', d => DEPT_COLORS[d.department] ?? '#c8d0dc')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        // Highlight connected edges, fade everything else
        const connected = nodeLinks.get(d.key)!;
        edgePaths.attr('stroke-opacity', link =>
          link.source === d.key || link.target === d.key
            ? 0.8
            : 0.02
        );
        nodeDots.attr('opacity', n =>
          n.key === d.key || connected.has(n.key) ? 1 : 0.15
        );
        const connCount = connected.size;
        setTooltip({
          department: d.department,
          layerLabel: d.layer >= 0 && d.layer < LAYER_LABELS.length ? LAYER_LABELS[d.layer] : `L${d.layer}`,
          key: d.key,
          connectionCount: connCount,
        });
      })
      .on('mouseleave', () => {
        edgePaths.attr('stroke-opacity', link => opacityScale(link.total_weight));
        nodeDots.attr('opacity', 1);
        setTooltip(null);
      });
  }, [data]);

  // Redraw when data changes
  useEffect(() => {
    draw();

    if (!containerRef.current) return;
    const ro = new ResizeObserver(draw);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw when tension changes (without refetching data)
  useEffect(() => {
    draw();
  }, [bundleTension, draw]);

  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 8px', flexShrink: 0, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Min Weight:</label>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={minWeight}
          onChange={e => setMinWeight(Number(e.target.value))}
          style={{ width: 100, accentColor: 'var(--accent, #60a5fa)' }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace', minWidth: 32 }}>
          {minWeight.toFixed(2)}
        </span>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: 12 }}>Bundle Tension:</label>
        <input
          type="range"
          min={0.5}
          max={1.0}
          step={0.01}
          value={bundleTension}
          onChange={e => setBundleTension(Number(e.target.value))}
          style={{ width: 100, accentColor: 'var(--accent, #60a5fa)' }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace', minWidth: 32 }}>
          {bundleTension.toFixed(2)}
        </span>

        {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Loading...</span>}
        {data && !loading && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {data.nodes.length} nodes, {data.links.length} edges
          </span>
        )}
      </div>

      {/* Main visualization area */}
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 300 }}>
        <div ref={containerRef} style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {loading && <div className="loading">Loading...</div>}
          {!loading && data && data.nodes.length === 0 && (
            <div style={{ color: 'var(--text-dim)', padding: 16 }}>No co-firing edges above threshold</div>
          )}
          <svg ref={svgRef} style={{ display: 'block' }} />
        </div>

        {/* Tooltip card */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: 'var(--text)',
            pointerEvents: 'none',
            minWidth: 180,
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: DEPT_COLORS[tooltip.department] ?? '#c8d0dc',
                flexShrink: 0,
              }} />
              {tooltip.key}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: 2 }}>
              {tooltip.department}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: 2 }}>
              {tooltip.layerLabel}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {tooltip.connectionCount} connection{tooltip.connectionCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
