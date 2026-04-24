import type {
  DashboardProjectAssignment,
  Raccoglitore,
  RaccoglitoreNode,
} from '../types/dashboard';

export function buildTree(
  raccoglitori: Raccoglitore[],
  assignments: DashboardProjectAssignment[],
): RaccoglitoreNode[] {
  const assignmentsByRaccoglitore = new Map<number, DashboardProjectAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByRaccoglitore.get(a.raccoglitore_id) ?? [];
    list.push(a);
    assignmentsByRaccoglitore.set(a.raccoglitore_id, list);
  }
  for (const list of assignmentsByRaccoglitore.values()) {
    list.sort((x, y) => x.position - y.position);
  }

  const nodesById = new Map<number, RaccoglitoreNode>();
  for (const r of raccoglitori) {
    const direct = assignmentsByRaccoglitore.get(r.id) ?? [];
    nodesById.set(r.id, {
      ...r,
      children: [],
      directAssignments: direct,
      directProjectsCount: direct.length,
      totalProjectsCount: 0,
      descendantsCount: 0,
    });
  }

  const roots: RaccoglitoreNode[] = [];
  for (const node of nodesById.values()) {
    if (node.parent_id != null && nodesById.has(node.parent_id)) {
      nodesById.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByPosition = (a: RaccoglitoreNode, b: RaccoglitoreNode) => a.position - b.position;
  const finalize = (node: RaccoglitoreNode): void => {
    node.children.sort(sortByPosition);
    let total = node.directProjectsCount;
    let descendants = 0;
    for (const child of node.children) {
      finalize(child);
      total += child.totalProjectsCount;
      descendants += 1 + child.descendantsCount;
    }
    node.totalProjectsCount = total;
    node.descendantsCount = descendants;
  };
  roots.sort(sortByPosition);
  for (const root of roots) finalize(root);
  return roots;
}

export function findNodeByPath(
  roots: RaccoglitoreNode[],
  path: number[],
): RaccoglitoreNode | null {
  let current: RaccoglitoreNode | null = null;
  let level: RaccoglitoreNode[] = roots;
  for (const id of path) {
    const found = level.find(n => n.id === id);
    if (!found) return null;
    current = found;
    level = found.children;
  }
  return current;
}

export function getChildrenAtPath(
  roots: RaccoglitoreNode[],
  path: number[],
): RaccoglitoreNode[] {
  if (path.length === 0) return roots;
  const node = findNodeByPath(roots, path);
  return node ? node.children : [];
}

export function validatePath(
  roots: RaccoglitoreNode[],
  path: number[],
): number[] {
  const valid: number[] = [];
  let level: RaccoglitoreNode[] = roots;
  for (const id of path) {
    const found = level.find(n => n.id === id);
    if (!found) break;
    valid.push(id);
    level = found.children;
  }
  return valid;
}

export function flattenTree(roots: RaccoglitoreNode[]): RaccoglitoreNode[] {
  const out: RaccoglitoreNode[] = [];
  const walk = (node: RaccoglitoreNode) => {
    out.push(node);
    for (const c of node.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}

export interface MoveTarget {
  id: number | null;
  label: string;
  depth: number;
}

export function getAvailableMoveTargets(
  roots: RaccoglitoreNode[],
  nodeId: number,
): MoveTarget[] {
  const node = findNode(roots, nodeId);
  if (!node) return [];
  const forbidden = new Set<number>();
  collectIds(node, forbidden);

  const targets: MoveTarget[] = [
    { id: null, label: 'Livello principale', depth: -1 },
  ];

  const walk = (nodes: RaccoglitoreNode[], prefix: string) => {
    for (const n of nodes) {
      if (forbidden.has(n.id)) continue;
      targets.push({
        id: n.id,
        label: prefix ? `${prefix} / ${n.name}` : n.name,
        depth: n.depth,
      });
      walk(n.children, prefix ? `${prefix} / ${n.name}` : n.name);
    }
  };
  walk(roots, '');
  return targets;
}

function findNode(roots: RaccoglitoreNode[], id: number): RaccoglitoreNode | null {
  for (const r of roots) {
    if (r.id === id) return r;
    const found = findNode(r.children, id);
    if (found) return found;
  }
  return null;
}

function collectIds(node: RaccoglitoreNode, set: Set<number>): void {
  set.add(node.id);
  for (const c of node.children) collectIds(c, set);
}

export function getPathToNode(
  roots: RaccoglitoreNode[],
  targetId: number,
): number[] | null {
  const walk = (nodes: RaccoglitoreNode[], acc: number[]): number[] | null => {
    for (const n of nodes) {
      const next = [...acc, n.id];
      if (n.id === targetId) return next;
      const found = walk(n.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(roots, []);
}
