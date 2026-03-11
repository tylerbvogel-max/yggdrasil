import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { fetchGraph3D, type Graph3DNode, type Graph3DEdge } from '../api';
import { DEPT_COLORS } from '../constants';
import * as THREE from 'three';

interface GraphNode extends Graph3DNode {
  x?: number; y?: number; z?: number;
  __threeObj?: THREE.Object3D;
}

interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  weight: number;
  co_fire_count: number;
  _phantom?: boolean;  // gravity-only links: affect layout but never rendered
}

const LAYER_LABELS = ['Department', 'Role', 'Task', 'System', 'Decision', 'Output'];
const CONCEPT_COLOR = '#e879f9';

// Cross-department affinity (mirrors backend DEPT_AFFINITY). Used for phantom gravity links.
const DEPT_AFFINITY: Record<string, Record<string, number>> = {
  'Engineering': { 'Manufacturing & Operations': 0.70, 'Regulatory': 0.55, 'Program Management': 0.50, 'Contracts & Compliance': 0.35, 'Business Development': 0.30, 'Finance': 0.20, 'Executive Leadership': 0.20 },
  'Manufacturing & Operations': { 'Regulatory': 0.65, 'Program Management': 0.45, 'Contracts & Compliance': 0.30, 'Finance': 0.25, 'Executive Leadership': 0.20 },
  'Contracts & Compliance': { 'Finance': 0.60, 'Program Management': 0.55, 'Business Development': 0.50, 'Regulatory': 0.45, 'Executive Leadership': 0.35 },
  'Finance': { 'Program Management': 0.50, 'Executive Leadership': 0.45, 'Business Development': 0.35, 'Regulatory': 0.25 },
  'Program Management': { 'Business Development': 0.45, 'Executive Leadership': 0.50, 'Regulatory': 0.40 },
  'Business Development': { 'Executive Leadership': 0.50, 'Regulatory': 0.20 },
  'Regulatory': { 'Executive Leadership': 0.30 },
};

function getDeptAffinity(a: string, b: string): number {
  return DEPT_AFFINITY[a]?.[b] ?? DEPT_AFFINITY[b]?.[a] ?? 0;
}

export default function NeuronUniverse() {
  const [neurons, setNeurons] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<Graph3DEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [minWeight, setMinWeight] = useState(0.3);
  const [maxEdges, setMaxEdges] = useState(5000);
  const [colorBy, setColorBy] = useState<'department' | 'layer'>('department');
  const [showEdges, setShowEdges] = useState(false);
  const [hideDisconnected, setHideDisconnected] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setDimensions(prev => (prev?.width === w && prev?.height === h) ? prev : { width: w, height: h });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Delay initial to let layout settle
    requestAnimationFrame(measure);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchGraph3D(minWeight, maxEdges);
      setNeurons(data.neurons);
      setEdges(data.edges);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [minWeight, maxEdges]);

  useEffect(() => { load(); }, [load]);

  // Available departments for filter (derived from loaded neurons)
  const departments = useMemo(() => {
    const depts = new Set<string>();
    neurons.forEach(n => { if (n.department) depts.add(n.department); });
    return Array.from(depts).sort();
  }, [neurons]);

  // Build graph data for force-graph (applies dept filter + connectivity filter + dept gravity)
  const graphData = useMemo(() => {
    if (!neurons.length) return { nodes: [], links: [] };

    // Apply department filter: keep matching neurons + concept neurons (always visible)
    const filtered = deptFilter
      ? neurons.filter(n => n.department === deptFilter || (n.node_type === 'concept' && n.layer === -1))
      : neurons;
    const nodeIds = new Set(filtered.map(n => n.id));

    const links: GraphLink[] = edges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target, weight: e.weight, co_fire_count: e.co_fire_count, _phantom: false }));

    // Inject phantom gravity links between departments based on affinity.
    // Connect multiple anchor nodes (L0 + all L1 role-level) per department pair
    // with strong invisible links to create real gravitational clustering.
    if (!deptFilter) {
      const deptAnchors: Record<string, number[]> = {};
      for (const n of filtered) {
        if ((n.layer === 0 || n.layer === 1) && n.department && nodeIds.has(n.id)) {
          (deptAnchors[n.department] ??= []).push(n.id);
        }
      }
      const anchorDepts = Object.keys(deptAnchors);
      for (let i = 0; i < anchorDepts.length; i++) {
        for (let j = i + 1; j < anchorDepts.length; j++) {
          const affinity = getDeptAffinity(anchorDepts[i], anchorDepts[j]);
          if (affinity < 0.20) continue;
          // Cross-connect all anchors from dept A to all anchors from dept B
          const anchorsA = deptAnchors[anchorDepts[i]];
          const anchorsB = deptAnchors[anchorDepts[j]];
          for (const a of anchorsA) {
            for (const b of anchorsB) {
              links.push({
                source: a,
                target: b,
                weight: affinity * 1.5,  // amplified so gravity is tangible
                co_fire_count: 0,
                _phantom: true,
              });
            }
          }
        }
      }
    }

    if (!hideDisconnected) return { nodes: filtered as GraphNode[], links };
    const connectedIds = new Set<number>();
    links.forEach(l => {
      connectedIds.add(typeof l.source === 'number' ? l.source : l.source.id);
      connectedIds.add(typeof l.target === 'number' ? l.target : l.target.id);
    });
    return { nodes: filtered.filter(n => connectedIds.has(n.id)) as GraphNode[], links };
  }, [neurons, edges, hideDisconnected, deptFilter]);

  const layerColors = ['#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];

  const isConcept = (node: GraphNode) => node.node_type === 'concept' && node.layer === -1;

  const getNodeColor = useCallback((node: GraphNode) => {
    if (isConcept(node)) return CONCEPT_COLOR;
    if (colorBy === 'department') {
      return DEPT_COLORS[node.department] || '#c8d0dc';
    }
    return layerColors[node.layer] || '#c8d0dc';
  }, [colorBy]);

  const getNodeSize = useCallback((node: GraphNode) => {
    // Concept neurons: largest in the graph (hub nodes)
    if (isConcept(node)) {
      const edgeBoost = Math.min(node.invocations * 0.12, 4);
      return 10 + edgeBoost;
    }
    // Size by layer: departments large, outputs small. Boost by invocations.
    const baseSize = [8, 6, 4, 3, 2.5, 2][node.layer] || 2;
    const invoBoost = Math.min(node.invocations * 0.3, 4);
    return baseSize + invoBoost;
  }, []);

  // Custom node rendering with glow
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const color = getNodeColor(node);
    const size = getNodeSize(node);
    const isC = node.node_type === 'concept' && node.layer === -1;

    const group = new THREE.Group();

    if (isC) {
      // ── Black hole effect for concept neurons ──
      // Dark core — nearly black with faint purple tint
      const coreGeo = new THREE.SphereGeometry(size, 32, 24);
      const coreMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color('#08050e'),
        emissive: new THREE.Color('#1a0a2e'),
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.97,
      });
      group.add(new THREE.Mesh(coreGeo, coreMat));

      // Event horizon glow — thin bright ring at the surface
      const horizonGeo = new THREE.RingGeometry(size * 0.95, size * 1.15, 64);
      const horizonMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(CONCEPT_COLOR),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const horizon = new THREE.Mesh(horizonGeo, horizonMat);
      group.add(horizon);

      // Second ring rotated perpendicular — accretion disk effect
      const diskGeo = new THREE.RingGeometry(size * 1.3, size * 1.7, 64);
      const diskMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(CONCEPT_COLOR),
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.rotation.x = Math.PI / 2;
      group.add(disk);

      // Outer diffuse glow
      const glowGeo = new THREE.SphereGeometry(size * 2.2, 16, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(CONCEPT_COLOR),
        transparent: true,
        opacity: 0.06,
      });
      group.add(new THREE.Mesh(glowGeo, glowMat));
    } else {
      // ── Standard neuron rendering ──
      const geometry = new THREE.SphereGeometry(size, 16, 12);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9,
      });
      group.add(new THREE.Mesh(geometry, material));

      // Outer glow
      const glowGeometry = new THREE.SphereGeometry(size * 1.6, 12, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.08,
      });
      group.add(new THREE.Mesh(glowGeometry, glowMaterial));
    }

    return group;
  }, [getNodeColor, getNodeSize]);

  // Tooltip
  const nodeLabel = useCallback((node: GraphNode) => {
    const isConceptNode = node.node_type === 'concept' && node.layer === -1;
    const typeLabel = isConceptNode
      ? `<span style="color:#e879f9;font-weight:600">Concept</span>`
      : `<span style="color:${DEPT_COLORS[node.department] || '#c8d0dc'}">${node.department || 'Unknown'}</span>
         &middot; L${node.layer} ${LAYER_LABELS[node.layer] || ''}`;
    return `<div style="background:#131926;border:1px solid ${isConceptNode ? '#e879f944' : '#1e2d4a'};border-radius:6px;padding:8px 12px;font-size:0.8rem;max-width:300px;color:#f8fafc;font-family:Inter,sans-serif">
      <div style="font-weight:600;margin-bottom:4px">${node.label}</div>
      <div style="color:#c8d0dc;font-size:0.75rem">
        ${typeLabel}
        ${node.role_key ? `&middot; ${node.role_key}` : ''}
      </div>
      <div style="color:#c8d0dc;font-size:0.7rem;margin-top:4px">
        Invocations: ${node.invocations} &middot; Utility: ${node.avg_utility.toFixed(3)}
      </div>
    </div>`;
  }, []);

  // Zoom to fit on first load
  useEffect(() => {
    if (!loading && fgRef.current && neurons.length > 0) {
      setTimeout(() => {
        fgRef.current?.zoomToFit?.(800, 60);
      }, 2000);
    }
  }, [loading, neurons.length]);

  // Stats
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let conceptCount = 0;
    neurons.forEach(n => {
      if (n.node_type === 'concept' && n.layer === -1) { conceptCount++; return; }
      const dept = n.department || 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (conceptCount > 0) entries.push(['Concepts', conceptCount]);
    return entries;
  }, [neurons]);

  const ready = !loading && !error && dimensions;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} ref={containerRef}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#c8d0dc', position: 'absolute', inset: 0, zIndex: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>Loading neuron universe...</div>
            <div style={{ fontSize: '0.8rem' }}>Fetching {'>'}2,000 neurons and co-firing edges</div>
          </div>
        </div>
      )}
      {error && (
        <div style={{ color: '#ef4444', padding: 20, position: 'absolute', inset: 0, zIndex: 10 }}>{error}</div>
      )}
      {/* 3D Graph */}
      {ready && <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeLabel={nodeLabel as any}
        nodeThreeObject={nodeThreeObject as any}
        nodeThreeObjectExtend={false}
        linkSource="source"
        linkTarget="target"
        linkWidth={(link: any) => Math.max(0.2, link.weight * 2)}
        linkOpacity={0.15}
        linkColor={() => '#334155'}
        linkVisibility={(link: any) => link._phantom ? false : showEdges}
        linkDirectionalParticles={0}
        onNodeHover={() => {}}
        onNodeClick={(node: any) => setSelectedNode(node?.id === selectedNode?.id ? null : node)}
        backgroundColor="#0a0e17"
        showNavInfo={false}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={80}
        cooldownTicks={200}
      />}

      {/* Controls overlay */}
      {ready && <>
      <div style={{
        position: 'absolute', top: 12, left: 12, background: '#131926dd',
        border: '1px solid #1e2d4a', borderRadius: 8, padding: '12px 16px',
        backdropFilter: 'blur(8px)', fontSize: '0.8rem', minWidth: 200,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>
          Neuron Universe
        </div>
        <div style={{ color: '#c8d0dc', marginBottom: 10, fontSize: '0.75rem' }}>
          {graphData.nodes.length.toLocaleString()} neurons &middot; {graphData.links.filter((l: any) => !l._phantom).length.toLocaleString()} edges
          {hideDisconnected && <span style={{ color: '#fb923c' }}> (of {neurons.length.toLocaleString()})</span>}
        </div>

        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          Color by
          <select
            value={colorBy}
            onChange={e => setColorBy(e.target.value as 'department' | 'layer')}
            style={{
              marginLeft: 8, background: '#1a2136', color: '#f8fafc',
              border: '1px solid #1e2d4a', borderRadius: 3, padding: '2px 6px', fontSize: '0.75rem',
            }}
          >
            <option value="department">Department</option>
            <option value="layer">Layer</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          Department
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{
              marginLeft: 8, background: '#1a2136', color: '#f8fafc',
              border: '1px solid #1e2d4a', borderRadius: 3, padding: '2px 6px', fontSize: '0.75rem',
            }}
          >
            <option value="">All</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          <input type="checkbox" checked={showEdges} onChange={e => setShowEdges(e.target.checked)} />
          Show edges
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          <input type="checkbox" checked={hideDisconnected} onChange={e => setHideDisconnected(e.target.checked)} />
          Connected only
        </label>

        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          Min weight: {minWeight.toFixed(2)}
          <input
            type="range" min={0.1} max={0.8} step={0.05} value={minWeight}
            onChange={e => setMinWeight(parseFloat(e.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.75rem', color: '#c8d0dc' }}>
          Max edges: {maxEdges}
          <input
            type="range" min={500} max={25000} step={500} value={maxEdges}
            onChange={e => setMaxEdges(parseInt(e.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <button
          onClick={() => fgRef.current?.zoomToFit?.(600, 40)}
          style={{
            width: '100%', background: '#60a5fa22', border: '1px solid #60a5fa44',
            borderRadius: 4, color: '#60a5fa', padding: '4px 0', fontSize: '0.75rem',
            cursor: 'pointer', marginBottom: 4,
          }}
        >
          Reset View
        </button>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, background: '#131926dd',
        border: '1px solid #1e2d4a', borderRadius: 8, padding: '10px 14px',
        backdropFilter: 'blur(8px)', fontSize: '0.7rem',
      }}>
        {colorBy === 'department' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', maxWidth: 400 }}>
            {deptCounts.map(([dept, count]) => (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: DEPT_COLORS[dept] || '#c8d0dc', display: 'inline-block',
                }} />
                <span style={{ color: '#c8d0dc' }}>{dept} ({count})</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {LAYER_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: layerColors[i], display: 'inline-block',
                }} />
                <span style={{ color: '#c8d0dc' }}>L{i} {label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 12, right: 12, background: '#131926dd',
          border: '1px solid #1e2d4a', borderRadius: 8, padding: '14px 18px',
          backdropFilter: 'blur(8px)', fontSize: '0.8rem', maxWidth: 320, minWidth: 240,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
              {selectedNode.label}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{ background: 'none', border: 'none', color: '#c8d0dc', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
            >
              x
            </button>
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: '0.75rem' }}>
            {selectedNode.node_type === 'concept' && selectedNode.layer === -1 ? (
              <div>
                <span style={{ color: '#c8d0dc' }}>Type: </span>
                <span style={{ color: CONCEPT_COLOR, fontWeight: 600 }}>Concept</span>
              </div>
            ) : (<>
              <div>
                <span style={{ color: '#c8d0dc' }}>Department: </span>
                <span style={{ color: DEPT_COLORS[selectedNode.department] || '#f8fafc' }}>{selectedNode.department}</span>
              </div>
              <div>
                <span style={{ color: '#c8d0dc' }}>Layer: </span>
                <span>L{selectedNode.layer} {LAYER_LABELS[selectedNode.layer]}</span>
              </div>
            </>)}
            {selectedNode.role_key && (
              <div>
                <span style={{ color: '#c8d0dc' }}>Role: </span>
                <span>{selectedNode.role_key}</span>
              </div>
            )}
            <div>
              <span style={{ color: '#c8d0dc' }}>Type: </span>
              <span>{selectedNode.node_type}</span>
            </div>
            <div>
              <span style={{ color: '#c8d0dc' }}>Invocations: </span>
              <span>{selectedNode.invocations}</span>
            </div>
            <div>
              <span style={{ color: '#c8d0dc' }}>Avg Utility: </span>
              <span>{selectedNode.avg_utility.toFixed(4)}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#c8d0dc', marginTop: 4 }}>
              ID: {selectedNode.id}
              {selectedNode.parent_id && ` · Parent: ${selectedNode.parent_id}`}
            </div>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12, color: '#c8d0dc44',
        fontSize: '0.65rem', textAlign: 'right',
      }}>
        Left-drag: rotate · Right-drag: pan · Scroll: zoom · Click: select
      </div>
      </>}
    </div>
  );
}
