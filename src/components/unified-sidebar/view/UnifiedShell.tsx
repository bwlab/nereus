import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Project, SessionProvider } from '../../../types/app';
import type { FullWorkspace } from '../../dashboard/types/dashboard';
import { useDeviceSettings } from '../../../hooks/useDeviceSettings';
import { useUnifiedLocation } from '../state/useUnifiedLocation';
import type { Location, PresetKind } from '../types/location';
import UnifiedHeader from './UnifiedHeader';
import UnifiedSidebar from './UnifiedSidebar';
import UnifiedBreadcrumb from './content/UnifiedBreadcrumb';
import ContentList from './content/ContentList';
import FooterHint from './FooterHint';
import { buildUnifiedTree, flattenAllProjects } from '../utils/buildUnifiedTree';

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
  onOpenSettings?: () => void;
  /** When Location is project|session, the parent passes MainContent here. Otherwise ignored. */
  projectContent?: ReactNode;
}

export default function UnifiedShell(props: UnifiedShellProps) {
  const { workspace, projects, projectContent } = props;
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

  const handleGoToProject = useCallback(
    (projectName: string, folderContext?: { dashboardId: number; folderIds: number[] }) => {
      const project = projects.find((p) => p.name === projectName);
      if (project) handleSelectProjectFromTree(project, folderContext);
    },
    [projects, handleSelectProjectFromTree],
  );

  const presetCounts = useMemo<Partial<Record<PresetKind, number>>>(() => {
    if (!workspace) return {};
    const built = buildUnifiedTree(workspace, projects);
    const nodes = flattenAllProjects(built.dashboards);
    const favoriteCount = nodes.reduce((acc, n) => acc + (n.isFavorite ? 1 : 0), 0);
    const unassignedCount = projects.filter((p) => !built.assignedProjectNames.has(p.name)).length;
    return {
      all: projects.length,
      unassigned: unassignedCount,
      favorites: favoriteCount,
    };
  }, [workspace, projects]);

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
              aria-label="Chiudi menu"
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

          <div className="flex flex-1 min-h-0 flex-col">
            {showProjectContent ? (
              projectContent
            ) : (
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
                onMoveProject={props.onMoveProject}
                onAssignProjectToFolder={props.onAssignProjectToFolder}
                assignments={workspace?.assignments}
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
