import { useState } from 'react'
import type { TreeNode } from '../types'

interface Props {
  nodes: TreeNode[];
  search: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function matchesSearch(node: TreeNode, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  if (node.label.toLowerCase().includes(lower)) return true;
  return (node.children ?? []).some(c => matchesSearch(c, term));
}

function TreeNodeRow({
  node,
  search,
  selectedId,
  onSelect,
  depth,
}: {
  node: TreeNode;
  search: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  if (search && !matchesSearch(node, search)) return null;

  return (
    <div className="tree-node">
      <div
        className={`tree-row layer-${node.layer}${selectedId === node.id ? ' selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(node.id)}
      >
        <span
          className="tree-toggle"
          onClick={e => { e.stopPropagation(); setOpen(!open); }}
        >
          {hasChildren ? (open ? '\u25BC' : '\u25B6') : ''}
        </span>
        <span className="tree-label">{node.label}</span>
        {node.invocations > 0 && <span className="tree-badge">{node.invocations}</span>}
      </div>
      {hasChildren && open && (
        <div className="tree-children">
          {children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              search={search}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NeuronTree({ nodes, search, selectedId, onSelect }: Props) {
  return (
    <div className="tree-scroll">
      {nodes.map(node => (
        <TreeNodeRow
          key={node.id}
          node={node}
          search={search}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}
