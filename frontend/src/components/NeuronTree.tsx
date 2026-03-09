import { useState, useCallback } from 'react'
import type { TreeNode } from '../types'
import { fetchChildren } from '../api'

interface Props {
  nodes: TreeNode[];
  search: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChildrenLoaded?: (parentId: number, children: TreeNode[]) => void;
}

function matchesSearch(node: TreeNode, term: string): boolean {
  if (!term) return true;
  // Support id search (e.g. "#2576" or "2576")
  const idMatch = term.match(/^#?(\d+)$/);
  if (idMatch) {
    const targetId = Number(idMatch[1]);
    if (node.id === targetId) return true;
    return (node.children ?? []).some(c => matchesSearch(c, term));
  }
  const lower = term.toLowerCase();
  if (node.label.toLowerCase().includes(lower)) return true;
  return (node.children ?? []).some(c => matchesSearch(c, term));
}

function TreeNodeRow({
  node,
  search,
  selectedId,
  onSelect,
  onExpand,
  depth,
}: {
  node: TreeNode;
  search: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onExpand: (id: number) => Promise<void>;
  depth: number;
}) {
  const children = node.children ?? [];
  const childCount = node.child_count ?? children.length;
  const hasChildren = childCount > 0;
  const childrenLoaded = node.children !== undefined;
  const searchMatch = search && matchesSearch(node, search);
  const [open, setOpen] = useState(depth < 1);
  const [loading, setLoading] = useState(false);

  // Auto-expand when a search matches a descendant
  const shouldAutoExpand = !!(search && searchMatch && hasChildren && childrenLoaded);
  const effectiveOpen = open || shouldAutoExpand;

  if (search && !searchMatch) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && hasChildren && !childrenLoaded) {
      setLoading(true);
      await onExpand(node.id);
      setLoading(false);
    }
    setOpen(!open);
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-row layer-${node.layer}${selectedId === node.id ? ' selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(node.id)}
      >
        <span className="tree-toggle" onClick={handleToggle}>
          {hasChildren ? (loading ? '\u23F3' : effectiveOpen ? '\u25BC' : '\u25B6') : ''}
        </span>
        <span className="tree-label">{node.label}</span>
        {node.invocations > 0 && <span className="tree-badge">{node.invocations}</span>}
      </div>
      {hasChildren && effectiveOpen && childrenLoaded && (
        <div className="tree-children">
          {children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              search={search}
              selectedId={selectedId}
              onSelect={onSelect}
              onExpand={onExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NeuronTree({ nodes, search, selectedId, onSelect, onChildrenLoaded }: Props) {
  const handleExpand = useCallback(async (parentId: number) => {
    if (!onChildrenLoaded) return;
    try {
      const childNodes = await fetchChildren(parentId);
      const treeChildren: TreeNode[] = childNodes.map(c => ({
        id: c.id,
        layer: c.layer,
        node_type: c.node_type,
        label: c.label,
        department: c.department,
        role_key: c.role_key,
        invocations: c.invocations,
        avg_utility: c.avg_utility,
        child_count: c.child_count,
        // children left undefined until this node is expanded
      }));
      onChildrenLoaded(parentId, treeChildren);
    } catch (err) {
      console.error('Failed to load children:', err);
    }
  }, [onChildrenLoaded]);

  return (
    <div className="tree-scroll">
      {nodes.map(node => (
        <TreeNodeRow
          key={node.id}
          node={node}
          search={search}
          selectedId={selectedId}
          onSelect={onSelect}
          onExpand={handleExpand}
          depth={0}
        />
      ))}
    </div>
  );
}
