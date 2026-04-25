import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project, SessionProvider } from '../../../types/app';
import type { FullWorkspace } from '../../dashboard/types/dashboard';
import { useDeviceSettings } from '../../../hooks/useDeviceSettings';
import { useUnifiedLocation } from '../state/useUnifiedLocation';
import type { Location, PresetKind } from '../types/location';
import { buildUnifiedTree, flattenAllProjects } from '../utils/buildUnifiedTree';
import UnifiedHeader from './UnifiedHeader';
import UnifiedSidebar from './UnifiedSidebar';
import UnifiedBreadcrumb from './content/UnifiedBreadcrumb';
import ContentList from './content/ContentList';
import FooterHint from './FooterHint';

interface UnifiedShellProps {
  workspace: FullWorkspace | null;
  projects: Project[];
  selectedSessionTitle?: string | null;
  onSelectProject: (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onSelectSession: (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onCreateDashboard: () => void;
  onCreateFolder?: (dashboardId: number, parentFolderId: number | null) => void;
  onMoveProject?: (projectName: string, targetRaccoglitoreId: number) => void;
  onAssignProjectToFolder?: (projectName: string, targetRaccoglitoreId: number) => void;
  onMoveFolder?: (folderId: number, targetParentId: number | null, targetDashboardId: number) => void;
  onToggleFavorite?: (projectName: string, nextFavorite: boolean) => void;
  onRenameProject?: (projectName: string, currentDisplayName?: string) => void;
  onRenameFolder?: (folderId: number, currentName: string) => void;
  onDeleteFolder?: (folderId: number, currentName: string) => void;
  onDeleteSession?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onDeleteProject?: (projectName: string, displayName?: string) => void;
  onOpenTerminal?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onOpenProjectShell?: (project: Project) => void;
  onOpenSettings?: () => void;
  onCreateProject?: () => void;
  /** When Location is project|session, the parent passes MainContent here. Otherwise ignored. */
  projectContent?: ReactNode;
  /** Tab bar rendered above the breadcrumb so tabs stay visible across folder/preset views. */
  tabBarNode?: ReactNode;
  /** Number of open tabs (drives the "Sessioni aperte" preset badge). */
  openTabsCount?: number;
  /** Tabs whose underlying session is currently processing (forwarded to OpenTabsView). */
  processingTabIds?: Set<string>;
  /** Activate a tab from OpenTabsView (parent navigates to its URL). */
  onActivateTab?: (tab: import('../../../stores/tabsStore').Tab) => void;
}

export default function UnifiedShell(props: UnifiedShellProps) {
  const { t } = useTranslation('sidebar');
  const { workspace, projects, projectContent, tabBarNode } = props;
  const { location, setLocation, goToPreset, goHome } = useUnifiedLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const { isMobile } = useDeviceSettings({ trackPWA: false });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);

  const handleSelectPreset = useCallback((preset: PresetKind) => {
    goToPreset(preset);
  }, [goToPreset]);

  const handleSelectFolder = useCallback((dashboardId: number, folderIds: number[]) => {
    setLocation({ kind: 'folder', dashboardId, folderIds });
  }, [setLocation]);

  const handleSelectDashboard = useCallback((dashboardId: number) => {
    setLocation({ kind: 'folder', dashboardId, folderIds: [] });
  }, [setLocation]);

  const handleSelectProjectFromTree = useCallback(
    (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      setLocation({ kind: 'project', projectName: project.name, folderContext });
      props.onSelectProject(project, folderContext);
    },
    [setLocation, props],
  );

  const handleSelectSessionFromTree = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      setLocation({ kind: 'session', projectName: project.name, sessionId, provider, folderContext });
      props.onSelectSession(project, sessionId, provider, folderContext);
    },
    [setLocation, props],
  );

  const handleSelectAgent = useCallback(
    (scope: 'global' | 'project', agentName: string, projectName?: string) => {
      setLocation({ kind: 'agent', scope, agentName, projectName });
    },
    [setLocation],
  );

  const handleOpenProjectShellFromTree = useCallback(
    (project: Project) => {
      setLocation({ kind: 'project', projectName: project.name });
      props.onOpenProjectShell?.(project);
    },
    [setLocation, props],
  );

  const handleGoToProject = useCallback(
    (projectName: string, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      const project = projects.find((p) => p.name === projectName);
      if (project) handleSelectProjectFromTree(project, folderContext);
    },
    [projects, handleSelectProjectFromTree],
  );

  const presetCounts = useMemo<Partial<Record<PresetKind, number>>>(() => {
    if (!workspace) return { 'open-tabs': props.openTabsCount };
    const built = buildUnifiedTree(workspace, projects);
    const nodes = flattenAllProjects(built.dashboards);
    const favoriteCount = nodes.reduce((acc, n) => acc + (n.isFavorite ? 1 : 0), 0);
    const unassignedCount = projects.filter((p) => !built.assignedProjectNames.has(p.name)).length;
    return {
      all: projects.length,
      unassigned: unassignedCount,
      favorites: favoriteCount,
      'open-tabs': props.openTabsCount,
    };
  }, [workspace, projects, props.openTabsCount]);

  const showProjectContent =
    (location.kind === 'project' || location.kind === 'session') && !!projectContent;

  // Close mobile sidebar when user picks a location
  const handleSelectPresetMobile = useCallback((preset: PresetKind) => {
    handleSelectPreset(preset);
    if (isMobile) closeMobileSidebar();
  }, [handleSelectPreset, isMobile, closeMobileSidebar]);

  const handleSelectFolderMobile = useCallback((dashboardId: number, folderIds: number[]) => {
    handleSelectFolder(dashboardId, folderIds);
    if (isMobile) closeMobileSidebar();
  }, [handleSelectFolder, isMobile, closeMobileSidebar]);

  const handleSelectProjectMobile = useCallback(
    (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      handleSelectProjectFromTree(project, folderContext);
      if (isMobile) closeMobileSidebar();
    },
    [handleSelectProjectFromTree, isMobile, closeMobileSidebar],
  );

  const handleSelectSessionMobile = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      handleSelectSessionFromTree(project, sessionId, provider, folderContext);
      if (isMobile) closeMobileSidebar();
    },
    [handleSelectSessionFromTree, isMobile, closeMobileSidebar],
  );

  const sidebarNode = (
    <UnifiedSidebar
      workspace={workspace}
      projects={projects}
      location={location}
      onSelectPreset={handleSelectPresetMobile}
      onSelectFolder={handleSelectFolderMobile}
      onSelectDashboard={(id) => { handleSelectDashboard(id); if (isMobile) closeMobileSidebar(); }}
      onSelectProject={handleSelectProjectMobile}
      onSelectSession={handleSelectSessionMobile}
      onCreateDashboard={props.onCreateDashboard}
      onCreateFolder={props.onCreateFolder}
      onMoveProject={props.onMoveProject}
      onMoveFolder={props.onMoveFolder}
      onRenameProject={props.onRenameProject}
      onRenameFolder={props.onRenameFolder}
      onDeleteFolder={props.onDeleteFolder}
      onDeleteSession={props.onDeleteSession}
      onDeleteProject={props.onDeleteProject}
      onOpenTerminal={props.onOpenTerminal}
      onSelectAgent={handleSelectAgent}
      presetCounts={presetCounts}
      searchQuery={searchQuery}
    />
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <UnifiedHeader
        projects={projects}
        workspace={workspace}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isMobile={isMobile}
        onMenuClick={openMobileSidebar}
        onOpenSettings={props.onOpenSettings}
        onCreateProject={props.onCreateProject}
      />

      <div className="relative flex min-h-0 flex-1">
        {!isMobile && sidebarNode}
        {isMobile && (
          <div
            className={`fixed inset-0 z-50 transition-all duration-150 ease-out ${
              mobileSidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
          >
            <button
              type="button"
              onClick={closeMobileSidebar}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              aria-label={t('header.closeMenu')}
            />
            <div
              className={`relative h-full w-[85vw] max-w-sm transform border-r border-border/40 bg-card transition-transform duration-150 ease-out ${
                mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              {sidebarNode}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {tabBarNode}
          <UnifiedBreadcrumb
            location={location}
            workspace={workspace}
            projects={projects}
            searchQuery={searchQuery}
            selectedSessionTitle={props.selectedSessionTitle}
            onGoHome={goHome}
            onGoToFolder={handleSelectFolder}
            onGoToProject={handleGoToProject}
          />

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Tabs area is always mounted (display:none when sidebar location is folder/preset)
                so per-tab MainContent state — chat scroll, shell PTY — survives across navigations. */}
            {projectContent && (
              <div className={`min-h-0 flex-1 flex-col ${showProjectContent ? 'flex' : 'hidden'}`}>
                {projectContent}
              </div>
            )}
            {!showProjectContent && (
              <ContentList
                location={location}
                workspace={workspace}
                projects={projects}
                searchQuery={searchQuery}
                onSelectFolder={handleSelectFolder}
                onSelectProject={handleSelectProjectFromTree}
                onSelectSession={handleSelectSessionFromTree}
                onToggleFavorite={props.onToggleFavorite}
                onRenameProject={props.onRenameProject}
                onDeleteProject={props.onDeleteProject}
                onDeleteSession={props.onDeleteSession}
                onOpenProjectShell={handleOpenProjectShellFromTree}
                onMoveProject={props.onMoveProject}
                onAssignProjectToFolder={props.onAssignProjectToFolder}
                onSelectAgent={handleSelectAgent}
                assignments={workspace?.assignments}
                processingTabIds={props.processingTabIds}
                onActivateTab={props.onActivateTab}
              />
            )}
          </div>
        </div>
      </div>

      <FooterHint />
    </div>
  );
}

export type { Location };
