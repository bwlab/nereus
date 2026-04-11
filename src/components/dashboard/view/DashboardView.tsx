import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Project } from '../../../types/app';
import { useDashboardState } from '../hooks/useDashboardState';
import { useClaudeTasksApi } from '../../claude-tasks/hooks/useClaudeTasksApi';
import type { ClaudeTaskSummaryByProject } from '../../claude-tasks/types/claude-tasks';
import DashboardKanbanView from './subcomponents/DashboardKanbanView';
import DashboardAccordionView from './subcomponents/DashboardAccordionView';
import DashboardTabsView from './subcomponents/DashboardTabsView';
import DashboardGridView from './subcomponents/DashboardGridView';
import ViewModeSwitcher from './subcomponents/ViewModeSwitcher';

type DashboardViewProps = {
  dashboardId: number;
  projects: Project[];
  onProjectClick: (project: Project) => void;
};

export default function DashboardView({ dashboardId, projects, onProjectClick }: DashboardViewProps) {
  const state = useDashboardState(dashboardId, projects);
  const tasksApi = useClaudeTasksApi();
  const [taskSummary, setTaskSummary] = useState<ClaudeTaskSummaryByProject>({});

  useEffect(() => {
    tasksApi.getSummary().then(setTaskSummary);
  }, [tasksApi]);

  if (state.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.dashboard) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Dashboard non trovata
      </div>
    );
  }

  const viewProps = {
    raccoglitori: state.raccoglitori,
    projectsByRaccoglitore: state.projectsByRaccoglitore,
    onProjectClick,
    onAddRaccoglitore: state.addRaccoglitore,
    onUpdateRaccoglitore: state.updateRaccoglitore,
    onDeleteRaccoglitore: state.deleteRaccoglitore,
    onAssignProject: state.assignProject,
    onRemoveProject: state.removeProject,
    allProjects: projects,
    taskSummary,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">{state.dashboard.name}</h2>
        <ViewModeSwitcher
          viewMode={state.dashboard.view_mode}
          onViewModeChange={(mode) => state.updateViewMode(mode)}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        {state.dashboard.view_mode === 'kanban' && <DashboardKanbanView {...viewProps} />}
        {state.dashboard.view_mode === 'accordion' && <DashboardAccordionView {...viewProps} />}
        {state.dashboard.view_mode === 'tabs' && <DashboardTabsView {...viewProps} />}
        {state.dashboard.view_mode === 'grid' && <DashboardGridView {...viewProps} />}
      </div>
    </div>
  );
}
