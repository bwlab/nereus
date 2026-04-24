import type { Project, ProjectSession, SessionProvider } from '../../../types/app';
import type {
  Dashboard,
  FullWorkspace,
  Raccoglitore,
  WorkspaceAssignment,
} from '../../dashboard/types/dashboard';
import type {
  DashboardNode,
  FolderNode,
  ProjectNode,
  SessionNode,
  UnifiedNode,
} from '../types/tree';

/** Sessions collected from a Project across all providers. */
function collectSessions(project: Project): SessionNode[] {
  const out: SessionNode[] = [];
  const push = (list: ProjectSession[] | undefined, provider: SessionProvider) => {
    if (!list) return;
    for (const s of list) {
      out.push({
        kind: 'session',
        sessionId: s.id,
        provider,
        projectName: project.name,
        session: s,
      });
    }
  };
  push(project.sessions, 'claude');
  push(project.codexSessions, 'codex');
  push(project.cursorSessions, 'cursor');
  push(project.geminiSessions, 'gemini');
  return out;
}

function makeProjectNode(
  project: Project,
  assignment: WorkspaceAssignment | null,
  favorites: Set<string>,
): ProjectNode {
  const assignedFavorite = !!assignment && assignment.is_favorite === 1;
  return {
    kind: 'project',
    projectName: project.name,
    project,
    isFavorite: assignedFavorite || favorites.has(project.name),
    assignment,
    sessions: collectSessions(project),
    agents: [],
  };
}

function makeFolderNode(r: Raccoglitore): FolderNode {
  return {
    kind: 'folder',
    id: r.id,
    dashboardId: r.dashboard_id,
    parentId: r.parent_id,
    depth: r.depth,
    name: r.name,
    color: r.color,
    icon: r.icon,
    notes: r.notes,
    position: r.position,
    children: [],
    projects: [],
    totalProjectsCount: 0,
    descendantsCount: 0,
  };
}

function finalizeFolder(node: FolderNode): void {
  node.children.sort((a, b) => a.position - b.position);
  let total = node.projects.length;
  let descendants = 0;
  for (const child of node.children) {
    finalizeFolder(child);
    total += child.totalProjectsCount;
    descendants += 1 + child.descendantsCount;
  }
  node.totalProjectsCount = total;
  node.descendantsCount = descendants;
}

export interface UnifiedTreeResult {
  dashboards: DashboardNode[];
  assignedProjectNames: Set<string>;
  projectsByName: Map<string, Project>;
}

export function buildUnifiedTree(
  workspace: FullWorkspace,
  projects: Project[],
): UnifiedTreeResult {
  const projectsByName = new Map<string, Project>();
  for (const p of projects) projectsByName.set(p.name, p);

  const favorites = new Set(workspace.favoriteProjectNames);
  const assignedProjectNames = new Set<string>();

  // Map folder id -> node
  const folderById = new Map<number, FolderNode>();
  const foldersByDashboard = new Map<number, FolderNode[]>();
  for (const r of workspace.raccoglitori) {
    const node = makeFolderNode(r);
    folderById.set(r.id, node);
    const list = foldersByDashboard.get(r.dashboard_id) ?? [];
    list.push(node);
    foldersByDashboard.set(r.dashboard_id, list);
  }

  // Attach folders to parents
  const rootFoldersByDashboard = new Map<number, FolderNode[]>();
  for (const node of folderById.values()) {
    if (node.parentId != null && folderById.has(node.parentId)) {
      folderById.get(node.parentId)!.children.push(node);
    } else {
      const roots = rootFoldersByDashboard.get(node.dashboardId) ?? [];
      roots.push(node);
      rootFoldersByDashboard.set(node.dashboardId, roots);
    }
  }

  // Attach project assignments to folders
  for (const a of workspace.assignments) {
    const folder = folderById.get(a.raccoglitore_id);
    if (!folder) continue;
    const project = projectsByName.get(a.project_name);
    if (!project) continue; // dangling assignment — skip
    folder.projects.push(makeProjectNode(project, a, favorites));
    assignedProjectNames.add(a.project_name);
  }

  // Sort assignments by position inside each folder
  for (const folder of folderById.values()) {
    folder.projects.sort((x, y) => {
      const ax = x.assignment?.position ?? 0;
      const ay = y.assignment?.position ?? 0;
      return ax - ay;
    });
  }

  // Build dashboard nodes
  const dashboardsSorted = [...workspace.dashboards].sort((a, b) => a.position - b.position);
  const dashboardNodes: DashboardNode[] = dashboardsSorted.map((d: Dashboard) => {
    const roots = rootFoldersByDashboard.get(d.id) ?? [];
    roots.sort((a, b) => a.position - b.position);
    for (const r of roots) finalizeFolder(r);
    const totalProjects = roots.reduce((sum, r) => sum + r.totalProjectsCount, 0);
    const totalSessions = roots.reduce(
      (sum, r) => sum + sumSessions(r),
      0,
    );
    return {
      kind: 'dashboard',
      id: d.id,
      dashboard: d,
      folders: roots,
      directProjects: [],
      totalProjectsCount: totalProjects,
      totalSessionsCount: totalSessions,
    };
  });

  return { dashboards: dashboardNodes, assignedProjectNames, projectsByName };
}

function sumSessions(folder: FolderNode): number {
  let total = 0;
  for (const p of folder.projects) total += p.sessions.length;
  for (const c of folder.children) total += sumSessions(c);
  return total;
}

/**
 * Resolve a folder by dashboardId + folderIds path (sequence of nested ids).
 * Returns { dashboard, folder, crumbs } where crumbs is the ordered list of folders from root.
 */
export function resolveFolderPath(
  tree: DashboardNode[],
  dashboardId: number,
  folderIds: number[],
): { dashboard: DashboardNode | null; folder: FolderNode | null; crumbs: FolderNode[] } {
  const dashboard = tree.find((d) => d.id === dashboardId) ?? null;
  if (!dashboard) return { dashboard: null, folder: null, crumbs: [] };
  if (folderIds.length === 0) return { dashboard, folder: null, crumbs: [] };

  const crumbs: FolderNode[] = [];
  let level: FolderNode[] = dashboard.folders;
  let current: FolderNode | null = null;
  for (const id of folderIds) {
    const found = level.find((f) => f.id === id) ?? null;
    if (!found) return { dashboard, folder: null, crumbs };
    crumbs.push(found);
    current = found;
    level = found.children;
  }
  return { dashboard, folder: current, crumbs };
}

export function flattenAllProjects(tree: DashboardNode[]): ProjectNode[] {
  const out: ProjectNode[] = [];
  const walk = (folder: FolderNode) => {
    out.push(...folder.projects);
    for (const c of folder.children) walk(c);
  };
  for (const d of tree) {
    for (const r of d.folders) walk(r);
  }
  return out;
}

export type { UnifiedNode };
