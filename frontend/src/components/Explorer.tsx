import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchTree, createCheckpoint } from '../api'
import type { TreeNode } from '../types'
import NeuronTree from './NeuronTree'
import NeuronDetail from './NeuronDetail'

function collectDepartments(nodes: TreeNode[]): string[] {
  const depts = new Set<string>();
  function walk(n: TreeNode) {
    if (n.department) depts.add(n.department);
    (n.children ?? []).forEach(walk);
  }
  nodes.forEach(walk);
  return Array.from(depts).sort();
}

/** Recursively find a node and set its children. Returns a new tree (immutable update). */
function setChildrenForNode(nodes: TreeNode[], parentId: number, children: TreeNode[]): TreeNode[] {
  return nodes.map(n => {
    if (n.id === parentId) {
      return { ...n, children };
    }
    if (n.children) {
      const updated = setChildrenForNode(n.children, parentId, children);
      if (updated !== n.children) return { ...n, children: updated };
    }
    return n;
  });
}

export default function Explorer({ navigateToNeuronId, onNavigateHandled }: {
  navigateToNeuronId?: number | null;
  onNavigateHandled?: () => void;
} = {}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [leftWidth, setLeftWidth] = useState(380);
  const [checkpointing, setCheckpointing] = useState(false);
  const [checkpointMsg, setCheckpointMsg] = useState('');
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.max(240, Math.min(e.clientX, 800));
      setLeftWidth(newWidth);
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Initial load: first 2 layers only
  useEffect(() => {
    fetchTree(undefined, 2)
      .then(data => { setTree(data); setDepartments(collectDepartments(data)); })
      .catch(e => setError(e.message));
  }, []);

  // Handle cross-tab navigation to a specific neuron
  useEffect(() => {
    if (navigateToNeuronId != null) {
      setSelectedId(navigateToNeuronId);
      // For deep navigation, load full tree so search can find it
      const dept = deptFilter || undefined;
      fetchTree(dept)
        .then(data => {
          setTree(data);
          setSearch(`#${navigateToNeuronId}`);
        })
        .catch(() => {});
      onNavigateHandled?.();
    }
  }, [navigateToNeuronId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Department filter change: reload with depth limit
  useEffect(() => {
    const dept = deptFilter || undefined;
    fetchTree(dept, 2)
      .then(setTree)
      .catch(e => setError(e.message));
  }, [deptFilter]);

  // When search is active and non-trivial, load full tree for that department
  // so recursive matchesSearch can find deep nodes
  useEffect(() => {
    if (search.length >= 2) {
      const dept = deptFilter || undefined;
      fetchTree(dept)
        .then(setTree)
        .catch(() => {});
    }
  }, [search, deptFilter]);

  const handleChildrenLoaded = useCallback((parentId: number, children: TreeNode[]) => {
    setTree(prev => setChildrenForNode(prev, parentId, children));
  }, []);

  const handleCheckpoint = useCallback(async () => {
    setCheckpointing(true);
    setCheckpointMsg('');
    try {
      const res = await createCheckpoint();
      setCheckpointMsg(`Saved ${res.neuron_count} neurons`);
      setTimeout(() => setCheckpointMsg(''), 3000);
    } catch (e: any) {
      setCheckpointMsg(`Error: ${e.message}`);
    } finally {
      setCheckpointing(false);
    }
  }, []);

  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="explorer">
      <div className="explorer-left" style={{ width: leftWidth, minWidth: leftWidth }}>
        <div className="explorer-controls">
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search neurons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className="btn btn-sm"
            onClick={handleCheckpoint}
            disabled={checkpointing}
          >
            {checkpointing ? 'Saving...' : 'Checkpoint'}
          </button>
          {checkpointMsg && <span className="checkpoint-msg">{checkpointMsg}</span>}
        </div>
        <NeuronTree
          nodes={tree}
          search={search}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChildrenLoaded={handleChildrenLoaded}
        />
      </div>
      <div className="explorer-resize-handle" onMouseDown={onMouseDown} />
      <div className="explorer-right">
        {selectedId ? (
          <NeuronDetail neuronId={selectedId} onSelectNeuron={setSelectedId} />
        ) : (
          <div className="detail-empty">Select a neuron to view details</div>
        )}
      </div>
    </div>
  );
}
