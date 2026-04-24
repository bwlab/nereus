import type { Project, ProjectSession, SessionProvider } from '../../../types/app';
import type { Dashboard, WorkspaceAssignment } from '../../dashboard/types/dashboard';

/** Unified node union used by the sidebar tree and content list. */
export type UnifiedNode = DashboardNode | FolderNode | ProjectNode | SessionNode | AgentNode;

export interface AgentNode {
  kind: 'agent';
  scope: 'global' | 'project';
  agentName: string;
  description?: string | null;
  projectName?: string;
}

export interface DashboardNode {
  kind: 'dashboard';
  id: number;
  dashboard: Dashboard;
  folders: FolderNode[];
  directProjects: ProjectNode[]; // projects assigned to root-level folders flattened? kept empty for now
  totalProjectsCount: number;
  totalSessionsCount: number;
}

export interface FolderNode {
  kind: 'folder';
  id: number;
  dashboardId: number;
  parentId: number | null;
  depth: number;
  name: string;
  color: string;
  icon: string;
  notes: string;
  position: number;
  children: FolderNode[];
  projects: ProjectNode[];
  totalProjectsCount: number; // recursive
  descendantsCount: number;
}

export interface ProjectNode {
  kind: 'project';
  projectName: string;
  project: Project;
  isFavorite: boolean;
  /** assignment id + raccoglitore_id if this node is rendered inside a folder; null when unassigned */
  assignment: WorkspaceAssignment | null;
  sessions: SessionNode[];
  agents: AgentNode[];
}

export interface SessionNode {
  kind: 'session';
  sessionId: string;
  provider: SessionProvider;
  projectName: string;
  session: ProjectSession;
}
