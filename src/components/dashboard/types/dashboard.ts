export type DashboardViewMode = 'kanban' | 'accordion' | 'tabs' | 'grid' | 'tree';
export type DashboardSortMode = 'alpha' | 'last_activity' | 'manual';

export interface Dashboard {
  id: number;
  user_id: number;
  name: string;
  position: number;
  is_default: number; // SQLite boolean: 0 | 1
  sort_mode: DashboardSortMode;
  view_mode: DashboardViewMode;
}

export interface Raccoglitore {
  id: number;
  dashboard_id: number;
  parent_id: number | null;
  depth: number;
  name: string;
  color: string;
  icon: string;
  notes: string;
  position: number;
}

export interface RaccoglitoreNode extends Raccoglitore {
  children: RaccoglitoreNode[];
  directAssignments: DashboardProjectAssignment[];
  directProjectsCount: number;
  totalProjectsCount: number;
  descendantsCount: number;
}

export interface DashboardProjectAssignment {
  id: number;
  raccoglitore_id: number;
  project_name: string;
  position: number;
  is_favorite: number; // SQLite boolean: 0 | 1
}

export interface FullDashboard {
  dashboard: Dashboard;
  raccoglitori: Raccoglitore[];
  assignments: DashboardProjectAssignment[];
}

export interface WorkspaceAssignment extends DashboardProjectAssignment {
  dashboard_id: number;
}

export interface FullWorkspace {
  dashboards: Dashboard[];
  raccoglitori: Raccoglitore[];
  assignments: WorkspaceAssignment[];
  favoriteProjectNames: string[];
}
