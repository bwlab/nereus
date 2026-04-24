import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';
import type { AppTab, Project, ProjectSession } from '../../../../types/app';
import { usePlugins } from '../../../../contexts/PluginsContext';

type MainContentTitleProps = {
  activeTab: AppTab;
  selectedProject: Project;
  selectedSession: ProjectSession | null;
  shouldShowTasksTab: boolean;
  onRenameProject?: (projectName: string, currentDisplayName?: string) => void;
};

function getTabTitle(activeTab: AppTab, shouldShowTasksTab: boolean, t: (key: string) => string, pluginDisplayName?: string) {
  if (activeTab.startsWith('plugin:') && pluginDisplayName) {
    return pluginDisplayName;
  }

  if (activeTab === 'files') {
    return t('mainContent.projectFiles');
  }

  if (activeTab === 'git') {
    return t('tabs.git');
  }

  if (activeTab === 'tasks' && shouldShowTasksTab) {
    return 'TaskMaster';
  }

  return 'Project';
}

function getSessionTitle(session: ProjectSession): string {
  if (session.__provider === 'cursor') {
    return (session.name as string) || 'Untitled Session';
  }

  return (session.summary as string) || 'New Session';
}

export default function MainContentTitle({
  activeTab,
  selectedProject,
  selectedSession,
  shouldShowTasksTab,
  onRenameProject,
}: MainContentTitleProps) {
  const renamePencil = onRenameProject ? (
    <button
      type="button"
      onClick={() => onRenameProject(selectedProject.name, selectedProject.displayName)}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label="Rinomina progetto"
      title="Rinomina progetto"
    >
      <Pencil className="h-3 w-3" />
    </button>
  ) : null;
  const { t } = useTranslation();
  const { plugins } = usePlugins();

  const pluginDisplayName = activeTab.startsWith('plugin:')
    ? plugins.find((p) => p.name === activeTab.replace('plugin:', ''))?.displayName
    : undefined;

  const showSessionIcon = activeTab === 'chat' && Boolean(selectedSession);
  const showChatNewSession = activeTab === 'chat' && !selectedSession;

  return (
    <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
      {showSessionIcon && (
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
          <SessionProviderLogo provider={selectedSession?.__provider} className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {activeTab === 'chat' && selectedSession ? (
          <div className="min-w-0">
            <h2 className="scrollbar-hide flex items-center overflow-x-auto whitespace-nowrap text-sm font-semibold leading-tight text-foreground">
              <span>{selectedProject.displayName}</span>
              {renamePencil}
            </h2>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">{getSessionTitle(selectedSession)}</div>
          </div>
        ) : showChatNewSession ? (
          <div className="min-w-0">
            <h2 className="flex items-center text-base font-semibold leading-tight text-foreground">
              <span>{selectedProject.displayName}</span>
              {renamePencil}
            </h2>
            <div className="truncate text-xs leading-tight text-muted-foreground">{t('mainContent.newSession')}</div>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-foreground">
              {getTabTitle(activeTab, shouldShowTasksTab, t, pluginDisplayName)}
            </h2>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">{selectedProject.displayName}</div>
          </div>
        )}
      </div>
    </div>
  );
}
