import { LayoutGrid } from 'lucide-react';
import DashboardSelector from '../../../dashboard/view/DashboardSelector';
import type { MainContentHeaderProps } from '../../types/types';
import MobileMenuButton from './MobileMenuButton';
import MainContentTabSwitcher from './MainContentTabSwitcher';
import MainContentTitle from './MainContentTitle';

export default function MainContentHeader({
  activeTab,
  setActiveTab,
  selectedProject,
  selectedSession,
  shouldShowTasksTab,
  isMobile,
  onMenuClick,
  onBackToKanban,
  activeDashboardId,
  onDashboardSelect,
}: MainContentHeaderProps) {
  return (
    <div className="pwa-header-safe flex-shrink-0 border-b border-border/60 bg-background px-3 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isMobile && <MobileMenuButton onMenuClick={onMenuClick} />}
          {selectedProject && (
            <MainContentTitle
              activeTab={activeTab}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              shouldShowTasksTab={shouldShowTasksTab}
            />
          )}
        </div>

        <DashboardSelector activeDashboardId={activeDashboardId} onDashboardSelect={onDashboardSelect} />

        {onBackToKanban && (
          <button
            type="button"
            onClick={onBackToKanban}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        )}

        {selectedProject && (
          <div className="scrollbar-hide min-w-0 flex-shrink overflow-x-auto sm:flex-shrink-0">
            <MainContentTabSwitcher
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              shouldShowTasksTab={shouldShowTasksTab}
            />
          </div>
        )}
      </div>
    </div>
  );
}
