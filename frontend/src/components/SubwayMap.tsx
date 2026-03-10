import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { fetchLayerFlow, type LayerFlowNode, type LayerFlowLink } from '../api';
import { DEPT_COLORS } from '../constants';

const LAYER_LABELS = ['L0 Dept', 'L1 Role', 'L2 Task', 'L3 System', 'L4 Decision', 'L5 Output'];

/** A route is a chain of node keys across layers with metadata */
interface Route {
  id: number;
  nodes: string[];           // ordered node keys e.g. ["L0:Engineering", "L1:Engineering", ...]
  links: LayerFlowLink[];    // the links forming this chain
  avgWeight: number;
  totalWeight: number;
  department: string;        // department of first node
  color: string;
}

/** Position of a station dot in SVG coordinates */
interface StationPos {
  x: number;
  y: number;
  nodeKey: string;
  department: string;
  layer: number;
}

/**
 * Build routes by greedily following the strongest link chains through the layer hierarchy.
 */
function buildRoutes(
  nodes: LayerFlowNode[],
  links: LayerFlowLink[],
  maxRoutes: number,
): Route[] {
  const nodeMap = new Map<string, LayerFlowNode>();
  for (const n of nodes) nodeMap.set(n.key, n);

  // Adjacency: for each node key, list of links sorted by weight desc
  const adj = new Map<string, LayerFlowLink[]>();
  for (const l of links) {
    if (!adj.has(l.source)) adj.set(l.source, []);
    if (!adj.has(l.target)) adj.set(l.target, []);
    adj.get(l.source)!.push(l);
    adj.get(l.target)!.push(l);
  }
  for (const [, arr] of adj) arr.sort((a, b) => b.total_weight - a.total_weight);

  const usedLinks = new Set<string>();
  const linkKey = (l: LayerFlowLink) => `${l.source}|${l.target}`;

  const sorted = [...links].sort((a, b) => b.total_weight - a.total_weight);
  const routes: Route[] = [];

  for (const seed of sorted) {
    if (routes.length >= maxRoutes) break;
    if (usedLinks.has(linkKey(seed))) continue;

    const sn = nodeMap.get(seed.source);
    const tn = nodeMap.get(seed.target);
    if (!sn || !tn) continue;

    // Ensure source has lower/equal layer than target
    const [lo, hi] = sn.layer <= tn.layer ? [seed.source, seed.target] : [seed.target, seed.source];

    const chain: string[] = [lo, hi];
    const chainLinks: LayerFlowLink[] = [seed];
    usedLinks.add(linkKey(seed));

    // Extend forward (toward higher layers) from the last node
    let extending = true;
    while (extending) {
      extending = false;
      const tail = chain[chain.length - 1];
      const tailNode = nodeMap.get(tail);
      if (!tailNode) break;
      const candidates = adj.get(tail) || [];
      for (const cl of candidates) {
        if (usedLinks.has(linkKey(cl))) continue;
        const other = cl.source === tail ? cl.target : cl.source;
        const otherNode = nodeMap.get(other);
        if (!otherNode || otherNode.layer <= tailNode.layer) continue;
        if (chain.includes(other)) continue;
        chain.push(other);
        chainLinks.push(cl);
        usedLinks.add(linkKey(cl));
        extending = true;
        break;
      }
    }

    // Extend backward (toward lower layers) from the first node
    extending = true;
    while (extending) {
      extending = false;
      const head = chain[0];
      const headNode = nodeMap.get(head);
      if (!headNode) break;
      const candidates = adj.get(head) || [];
      for (const cl of candidates) {
        if (usedLinks.has(linkKey(cl))) continue;
        const other = cl.source === head ? cl.target : cl.source;
        const otherNode = nodeMap.get(other);
        if (!otherNode || otherNode.layer >= headNode.layer) continue;
        if (chain.includes(other)) continue;
        chain.unshift(other);
        chainLinks.push(cl);
        usedLinks.add(linkKey(cl));
        extending = true;
        break;
      }
    }

    // Only keep routes with at least 2 nodes
    if (chain.length < 2) continue;

    const totalW = chainLinks.reduce((s, l) => s + l.total_weight, 0);
    const firstNode = nodeMap.get(chain[0]);
    const dept = firstNode?.department || 'Unknown';

    routes.push({
      id: routes.length,
      nodes: chain,
      links: chainLinks,
      avgWeight: totalW / chainLinks.length,
      totalWeight: totalW,
      department: dept,
      color: DEPT_COLORS[dept] || '#c8d0dc',
    });
  }

  return routes;
}

export default function SubwayMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minWeight, setMinWeight] = useState(0.15);
  const [routeCount, setRouteCount] = useState(15);
  const [hoverRoute, setHoverRoute] = useState<number | null>(null);
  const [hoverStation, setHoverStation] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
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

  const drawMap = useCallback((
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    routes: Route[],
    allNodes: LayerFlowNode[],
  ) => {
    const margin = { top: 44, right: 30, bottom: 20, left: 30 };
    const W = dims.width - margin.left - margin.right;
    const H = dims.height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Layer x positions (6 columns)
    const layerX = new Map<number, number>();
    for (let i = 0; i < 6; i++) {
      layerX.set(i, (i / 5) * W);
    }

    // Draw layer column guides and labels
    for (let i = 0; i < 6; i++) {
      const x = layerX.get(i)!;
      g.append('line')
        .attr('x1', x).attr('y1', -8)
        .attr('x2', x).attr('y2', H)
        .attr('stroke', 'var(--border)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,4')
        .attr('opacity', 0.4);

      g.append('text')
        .attr('x', x)
        .attr('y', -18)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-dim)')
        .attr('font-size', '0.7rem')
        .attr('font-weight', 600)
        .text(LAYER_LABELS[i]);
    }

    if (!routes.length) return;

    // Compute weight range for line width scaling
    const minAvg = Math.min(...routes.map(r => r.avgWeight));
    const maxAvg = Math.max(...routes.map(r => r.avgWeight));
    const widthScale = maxAvg > minAvg
      ? d3.scaleLinear().domain([minAvg, maxAvg]).range([2, 6])
      : () => 4;

    // Collect all unique node keys used across all routes
    const nodeKeysUsed = new Set<string>();
    for (const r of routes) for (const k of r.nodes) nodeKeysUsed.add(k);

    // For each layer, list which node keys appear, sorted by department
    const layerNodeKeys = new Map<number, string[]>();
    for (const key of nodeKeysUsed) {
      const n = allNodes.find(nd => nd.key === key);
      if (!n) continue;
      if (!layerNodeKeys.has(n.layer)) layerNodeKeys.set(n.layer, []);
      layerNodeKeys.get(n.layer)!.push(key);
    }
    for (const [, arr] of layerNodeKeys) {
      arr.sort((a, b) => a.localeCompare(b));
    }

    // Assign a y position for each unique node key within its layer
    const stationY = new Map<string, number>();
    for (const [, arr] of layerNodeKeys) {
      const count = arr.length;
      const spacing = Math.min(40, (H - 20) / Math.max(count, 1));
      const totalH = (count - 1) * spacing;
      const startY = (H - totalH) / 2;
      arr.forEach((key, idx) => {
        stationY.set(key, startY + idx * spacing);
      });
    }

    // For multiple routes through the same node, compute lateral offsets
    const routesPerStation = new Map<string, number[]>(); // nodeKey -> routeIds
    for (const r of routes) {
      for (const k of r.nodes) {
        if (!routesPerStation.has(k)) routesPerStation.set(k, []);
        routesPerStation.get(k)!.push(r.id);
      }
    }

    // Compute offset for a given route at a given station
    const routeOffset = (nodeKey: string, routeId: number): number => {
      const ids = routesPerStation.get(nodeKey) || [];
      if (ids.length <= 1) return 0;
      const idx = ids.indexOf(routeId);
      const spacing = 4;
      const total = (ids.length - 1) * spacing;
      return -total / 2 + idx * spacing;
    };

    // Build station positions
    const stations = new Map<string, StationPos>();
    for (const key of nodeKeysUsed) {
      const n = allNodes.find(nd => nd.key === key);
      if (!n) continue;
      const x = layerX.get(n.layer) ?? 0;
      const y = stationY.get(key) ?? H / 2;
      stations.set(key, { x, y, nodeKey: key, department: n.department, layer: n.layer });
    }

    // Draw route lines
    const routeGroup = g.append('g');

    for (const route of routes) {
      const isRouteHovered = hoverRoute === route.id;
      const isStationHovered = hoverStation && route.nodes.includes(hoverStation);
      const anyHover = hoverRoute !== null || hoverStation !== null;
      const highlighted = isRouteHovered || isStationHovered;
      const faded = anyHover && !highlighted;

      const lw = widthScale(route.avgWeight) as number;

      // Build points for the polyline with offsets
      const points: [number, number][] = [];
      for (const key of route.nodes) {
        const st = stations.get(key);
        if (!st) continue;
        const off = routeOffset(key, route.id);
        points.push([st.x, st.y + off]);
      }

      if (points.length < 2) continue;

      // Build a smooth path with rounded corners using cardinal curve
      const lineGen = d3.line<[number, number]>()
        .x(d => d[0])
        .y(d => d[1])
        .curve(d3.curveMonotoneX);

      const pathD = lineGen(points);
      if (!pathD) continue;

      routeGroup.append('path')
        .attr('d', pathD)
        .attr('fill', 'none')
        .attr('stroke', route.color)
        .attr('stroke-width', faded ? lw * 0.6 : highlighted ? lw + 1.5 : lw)
        .attr('stroke-opacity', faded ? 0.08 : highlighted ? 0.95 : 0.55)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent) => {
          setHoverRoute(route.id);
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (svgRect) {
            setTooltip({
              text: `${route.department} — ${route.nodes.length} stations, weight ${route.totalWeight.toFixed(2)}`,
              x: event.clientX - svgRect.left,
              y: event.clientY - svgRect.top - 20,
            });
          }
        })
        .on('mousemove', (event: MouseEvent) => {
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (svgRect) {
            setTooltip({
              text: `${route.department} — ${route.nodes.length} stations, weight ${route.totalWeight.toFixed(2)}`,
              x: event.clientX - svgRect.left,
              y: event.clientY - svgRect.top - 20,
            });
          }
        })
        .on('mouseleave', () => {
          setHoverRoute(null);
          setTooltip(null);
        });
    }

    // Draw station dots and labels
    const stationGroup = g.append('g');

    for (const [key, st] of stations) {
      const routeIds = routesPerStation.get(key) || [];
      const isHovered = hoverStation === key;
      const connectedToRoute = hoverRoute !== null && routeIds.includes(hoverRoute);
      const anyHover = hoverRoute !== null || hoverStation !== null;
      const highlighted = isHovered || connectedToRoute;
      const faded = anyHover && !highlighted;

      // Pick color from first route passing through, or department color
      const primaryRoute = routes.find(r => r.nodes.includes(key));
      const color = DEPT_COLORS[st.department] || primaryRoute?.color || '#c8d0dc';

      // Draw all offset positions for multi-route stations
      const uniqueOffsets = routeIds.map(rid => routeOffset(key, rid));
      const offsets = [...new Set(uniqueOffsets)];
      if (offsets.length === 0) offsets.push(0);

      for (const off of offsets) {
        stationGroup.append('circle')
          .attr('cx', st.x)
          .attr('cy', st.y + off)
          .attr('r', isHovered ? 6 : 4.5)
          .attr('fill', faded ? '#1a1a2e' : '#0f0f1a')
          .attr('stroke', color)
          .attr('stroke-width', isHovered ? 2.5 : 1.8)
          .attr('opacity', faded ? 0.2 : highlighted ? 1 : 0.85)
          .attr('cursor', 'pointer')
          .on('mouseenter', (event: MouseEvent) => {
            setHoverStation(key);
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (svgRect) {
              setTooltip({
                text: `${st.department} (${LAYER_LABELS[st.layer]}) — ${routeIds.length} route${routeIds.length !== 1 ? 's' : ''}`,
                x: event.clientX - svgRect.left,
                y: event.clientY - svgRect.top - 20,
              });
            }
          })
          .on('mouseleave', () => {
            setHoverStation(null);
            setTooltip(null);
          });
      }

      // Label — show abbreviated department name next to the station
      const dept = st.department || 'Unknown';
      const abbrev = dept.length > 14
        ? dept.split(/[\s&]+/).filter(w => w.length > 0).map(w => w[0]).join('').toUpperCase()
        : dept;

      // Only show labels when not too crowded, or when hovered
      const showLabel = isHovered || highlighted || !anyHover;

      if (showLabel) {
        stationGroup.append('text')
          .attr('x', st.x + 9)
          .attr('y', st.y)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'start')
          .attr('fill', faded ? 'var(--text-dim)' : 'var(--text)')
          .attr('font-size', isHovered ? '0.7rem' : '0.6rem')
          .attr('font-weight', isHovered ? 600 : 400)
          .attr('opacity', faded ? 0.12 : highlighted ? 1 : 0.7)
          .attr('pointer-events', 'none')
          .text(abbrev);
      }
    }
  }, [dims, hoverRoute, hoverStation]);

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

      const routes = buildRoutes(data.nodes, data.links, routeCount);
      if (!routes.length) {
        setError('No routes could be built from current data. Try lowering min weight.');
        return;
      }

      drawMap(svg, routes, data.nodes);
    }).catch(e => {
      setLoading(false);
      setError(e instanceof Error ? e.message : 'Failed to load flow data');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWeight, routeCount, dims, hoverRoute, hoverStation, drawMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
          Subway Map — Strongest Co-Firing Routes
        </h3>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Routes:
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={routeCount}
            onChange={e => setRouteCount(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ color: 'var(--text)', minWidth: 20 }}>{routeCount}</span>
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
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: '0.72rem',
            color: 'var(--text)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8,
        fontSize: '0.65rem', color: 'var(--text-dim)',
      }}>
        {Object.entries(DEPT_COLORS).map(([dept, color]) => (
          <span key={dept} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#0f0f1a', border: `2px solid ${color}`,
              display: 'inline-block',
            }} />
            {dept}
          </span>
        ))}
      </div>
    </div>
  );
}
