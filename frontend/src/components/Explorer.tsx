import { useEffect, useState } from 'react'
import { fetchTree } from '../api'
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

export default function Explorer() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTree()
      .then(data => { setTree(data); setDepartments(collectDepartments(data)); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    const dept = deptFilter || undefined;
    fetchTree(dept)
      .then(setTree)
      .catch(e => setError(e.message));
  }, [deptFilter]);

  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="explorer">
      <div className="explorer-left">
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
        </div>
        <NeuronTree
          nodes={tree}
          search={search}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="explorer-right">
        {selectedId ? (
          <NeuronDetail neuronId={selectedId} />
        ) : (
          <div className="detail-empty">Select a neuron to view details</div>
        )}
      </div>
    </div>
  );
}
