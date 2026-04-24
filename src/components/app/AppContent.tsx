import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation as useRouterLocation } from 'react-router-dom';
import MainContent from '../main-content/view/MainContent';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { useSessionProtection } from '../../hooks/useSessionProtection';
import { useProjectsState } from '../../hooks/useProjectsState';
import { useDashboardApi } from '../dashboard/hooks/useDashboardApi';
import CommandPalette from '../command-palette/CommandPalette';
import UnifiedShell from '../unified-sidebar/view/UnifiedShell';
import { useWorkspace } from '../unified-sidebar/state/useWorkspace';
import { parsePath } from '../unified-sidebar/state/useUnifiedLocation';
import { authenticatedFetch } from '../../utils/api';
import type { Project, SessionProvider } from '../../types/app';
import Settings from '../settings/view/Settings';

export default function AppContent() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const params = useParams<{
    sessionId?: string;
    projectName?: string;
    provider?: SessionProvider;
  }>();
  const { sessionId: legacySessionId, projectName: routeProjectName } = params;
  const { isMobile } = useDeviceSettings({ trackPWA: false });
  const { ws, sendMessage, latestMessage, isConnected } = useWebSocket();
  const wasConnectedRef = useRef(false);

  const {
    activeSessions,
    processingSessions,
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    replaceTemporarySession,
  } = useSessionProtection();

  const {
    projects,
    selectedProject,
    selectedSession,
    isNewSession,
    activeTab,
    sidebarOpen,
    isLoadingProjects,
    externalMessageUpdate,
    setActiveTab,
    setSidebarOpen,
    setIsInputFocused,
    showSettings,
    setShowSettings,
    settingsInitialTab,
    openSettings,
    refreshProjectsSilently,
    handleNewSession,
    handleBackToKanban,
    handleSessionDelete,
    setSelectedProject,
    setSelectedSession,
    setIsNewSession,
  } = useProjectsState({
    sessionId: legacySessionId,
    navigate,
    latestMessage,
    isMobile,
    activeSessions,
  });

  const dashboardApi = useDashboardApi();
  const { workspace, reload: reloadWorkspace } = useWorkspace(true);

  // Select project (sets state, picks latest session, no navigate — URL already set by UnifiedShell)
  const handleProjectSelectFromShell = useCallback((project: Project) => {
    setSelectedProject(project);
    const allSessions = [
      ...(project.sessions ?? []),
      ...(project.cursorSessions ?? []),
      ...(project.codexSessions ?? []),
      ...(project.geminiSessions ?? []),
    ];
    const latest = allSessions
      .map((s) => {
        const raw = s.updated_at || s.createdAt;
        const t = raw ? new Date(raw).getTime() : NaN;
        return { s, t };
      })
      .filter((x) => !isNaN(x.t))
      .sort((a, b) => b.t - a.t)[0]?.s;
    if (latest) {
      setSelectedSession(latest);
      setIsNewSession(false);
    } else {
      setSelectedSession(null);
      setIsNewSession(true);
    }
    setActiveTab('chat');
  }, [setSelectedProject, setSelectedSession, setIsNewSession, setActiveTab]);

  const handleSessionSelectFromShell = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider) => {
      const pool =
        provider === 'claude' ? project.sessions :
        provider === 'cursor' ? project.cursorSessions :
        provider === 'codex' ? project.codexSessions :
        project.geminiSessions;
      const session = pool?.find((s) => s.id === sessionId);
      if (!session) return;
      setSelectedProject(project);
      setSelectedSession({ ...session, __provider: provider });
      setIsNewSession(false);
      setActiveTab('chat');
    },
    [setSelectedProject, setSelectedSession, setIsNewSession, setActiveTab],
  );

  // Clear selected project/session when navigating to a preset or folder URL
  useEffect(() => {
    const parsed = parsePath(routerLocation.pathname);
    if (!parsed) return;
    if (parsed.kind === 'preset' || parsed.kind === 'folder') {
      if (selectedProject || selectedSession) {
        setSelectedProject(null);
        setSelectedSession(null);
        setIsNewSession(false);
      }
    }
  }, [routerLocation.pathname, selectedProject, selectedSession, setSelectedProject, setSelectedSession, setIsNewSession]);

  // Sync route params (/p/:projectName, /p/:projectName/s/:provider/:sessionId) with state on mount/direct URL load
  useEffect(() => {
    if (!routeProjectName) return;
    const decoded = decodeURIComponent(routeProjectName);
    if (selectedProject?.name === decoded) return;
    const match = projects.find((p) => p.name === decoded);
    if (!match) return;
    const provider = params.provider;
    const sessionId = params.sessionId;
    if (provider && sessionId) {
      handleSessionSelectFromShell(match, decodeURIComponent(sessionId), provider);
    } else {
      handleProjectSelectFromShell(match);
    }
  }, [routeProjectName, params.provider, params.sessionId, projects, selectedProject, handleProjectSelectFromShell, handleSessionSelectFromShell]);

  const handleCreateDashboard = useCallback(async () => {
    const name = window.prompt('Nome della nuova dashboard?');
    if (!name?.trim()) return;
    try {
      await dashboardApi.createDashboard(name.trim());
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore creazione dashboard');
    }
  }, [dashboardApi, reloadWorkspace]);

  const handleDeleteProjectFromTree = useCallback(async (projectName: string, displayName?: string) => {
    if (!window.confirm(`Eliminare il progetto "${displayName ?? projectName}"? Vengono rimosse anche tutte le sessioni associate.`)) return;
    try {
      const res = await authenticatedFetch(
        `/api/projects/${encodeURIComponent(projectName)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Eliminazione fallita');
      }
      if (selectedProject?.name === projectName) {
        setSelectedProject(null);
        setSelectedSession(null);
        setIsNewSession(false);
      }
      await refreshProjectsSilently();
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore eliminazione progetto');
    }
  }, [selectedProject, setSelectedProject, setSelectedSession, setIsNewSession, refreshProjectsSilently, reloadWorkspace]);

  const handleDeleteSessionFromTree = useCallback(async (project: Project, sessionId: string, provider: SessionProvider) => {
    if (provider === 'cursor') {
      alert('Eliminazione sessioni Cursor non supportata dal provider.');
      return;
    }
    if (!window.confirm('Eliminare la sessione?')) return;
    const url = provider === 'claude'
      ? `/api/projects/${encodeURIComponent(project.name)}/sessions/${encodeURIComponent(sessionId)}`
      : provider === 'codex'
        ? `/api/codex/sessions/${encodeURIComponent(sessionId)}`
        : `/api/gemini/sessions/${encodeURIComponent(sessionId)}`;
    try {
      const res = await authenticatedFetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Eliminazione fallita');
      }
      handleSessionDelete(sessionId);
      await refreshProjectsSilently();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore eliminazione sessione');
    }
  }, [handleSessionDelete, refreshProjectsSilently]);

  const handleRenameFolder = useCallback(async (folderId: number, currentName: string) => {
    const racc = workspace?.raccoglitori.find((r) => r.id === folderId);
    if (!racc) return;
    const next = window.prompt('Nuovo nome cartella:', currentName);
    if (!next || !next.trim() || next.trim() === currentName) return;
    try {
      await dashboardApi.updateRaccoglitore(racc.dashboard_id, folderId, { name: next.trim() });
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore rinomina cartella');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  const handleDeleteFolder = useCallback(async (folderId: number, currentName: string) => {
    const racc = workspace?.raccoglitori.find((r) => r.id === folderId);
    if (!racc) return;
    const hasChildren = workspace?.raccoglitori.some((r) => r.parent_id === folderId) ?? false;
    const assignments = workspace?.assignments.filter((a) => a.raccoglitore_id === folderId) ?? [];
    const msg = hasChildren || assignments.length > 0
      ? `Eliminare "${currentName}"? Contiene ${assignments.length} progetti e sottocartelle. Gli elementi verranno scollegati.`
      : `Eliminare "${currentName}"?`;
    if (!window.confirm(msg)) return;
    try {
      await dashboardApi.deleteRaccoglitore(racc.dashboard_id, folderId);
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore eliminazione cartella');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  const handleCreateFolder = useCallback(async (dashboardId: number, parentFolderId: number | null) => {
    const name = window.prompt(parentFolderId ? 'Nome della nuova sotto-cartella?' : 'Nome della nuova cartella?');
    if (!name?.trim()) return;
    try {
      await dashboardApi.createRaccoglitore(dashboardId, { name: name.trim(), parent_id: parentFolderId });
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore creazione cartella');
    }
  }, [dashboardApi, reloadWorkspace]);

  const handleRenameProject = useCallback(async (projectName: string, currentDisplayName?: string) => {
    const next = window.prompt('Nuovo nome del progetto:', currentDisplayName ?? projectName);
    if (!next || !next.trim() || next.trim() === currentDisplayName) return;
    try {
      const res = await authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/rename`, {
        method: 'PUT',
        body: JSON.stringify({ displayName: next.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Rename fallito');
      }
      await refreshProjectsSilently();
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore rinomina progetto');
    }
  }, [refreshProjectsSilently, reloadWorkspace]);

  const handleAssignProjectToFolder = useCallback(async (projectName: string, targetRaccoglitoreId: number) => {
    try {
      const targetRacc = workspace?.raccoglitori.find((r) => r.id === targetRaccoglitoreId);
      if (!targetRacc) throw new Error('Cartella destinazione non trovata');
      const already = workspace?.assignments.some(
        (a) => a.project_name === projectName && a.raccoglitore_id === targetRaccoglitoreId,
      );
      if (already) {
        // toggle off — remove this single assignment
        await dashboardApi.removeProject(targetRacc.dashboard_id, targetRaccoglitoreId, projectName);
      } else {
        await dashboardApi.assignProject(targetRacc.dashboard_id, targetRaccoglitoreId, projectName);
      }
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore assegnazione progetto');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  const handleMoveProject = useCallback(async (projectName: string, targetRaccoglitoreId: number) => {
    try {
      const current = workspace?.assignments.find((a) => a.project_name === projectName);
      // Resolve target dashboard from raccoglitore_id
      const targetRacc = workspace?.raccoglitori.find((r) => r.id === targetRaccoglitoreId);
      if (!targetRacc) throw new Error('Cartella destinazione non trovata');
      if (current && current.raccoglitore_id === targetRaccoglitoreId) return;
      if (current) {
        await dashboardApi.removeProject(current.dashboard_id, current.raccoglitore_id, projectName);
      }
      await dashboardApi.assignProject(targetRacc.dashboard_id, targetRaccoglitoreId, projectName);
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore spostamento progetto');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  const handleMoveFolder = useCallback(async (folderId: number, targetParentId: number | null, targetDashboardId: number) => {
    try {
      const racc = workspace?.raccoglitori.find((r) => r.id === folderId);
      if (!racc) return;
      if (racc.dashboard_id !== targetDashboardId) {
        alert('Sposta tra dashboard diverse non supportato');
        return;
      }
      await dashboardApi.moveRaccoglitore(racc.dashboard_id, folderId, { parent_id: targetParentId });
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore spostamento cartella');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  const handleToggleFavorite = useCallback(async (projectName: string, nextFavorite: boolean) => {
    try {
      // Prefer per-assignment favorite if project has one; fallback to orphan favorite
      const assignment = workspace?.assignments.find((a) => a.project_name === projectName);
      if (assignment) {
        await dashboardApi.setAssignmentFavorite(
          assignment.dashboard_id,
          assignment.raccoglitore_id,
          projectName,
          nextFavorite,
        );
      } else {
        await dashboardApi.setProjectFavorite(projectName, nextFavorite);
      }
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore toggle preferito');
    }
  }, [workspace, dashboardApi, reloadWorkspace]);

  // One-time migration: move localStorage 'starredProjects' into backend favorites
  useEffect(() => {
    const MIGRATED_KEY = 'ui:starred:migrated';
    if (localStorage.getItem(MIGRATED_KEY) === 'true') return;
    let raw: string | null = null;
    try { raw = localStorage.getItem('starredProjects'); } catch { /* ignore */ }
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, 'true');
      return;
    }
    let names: string[] = [];
    try { names = JSON.parse(raw) as string[]; } catch { names = []; }
    if (!Array.isArray(names) || names.length === 0) {
      localStorage.setItem(MIGRATED_KEY, 'true');
      localStorage.removeItem('starredProjects');
      return;
    }
    (async () => {
      for (const name of names) {
        try { await dashboardApi.setProjectFavorite(name, true); } catch { /* best-effort */ }
      }
      localStorage.setItem(MIGRATED_KEY, 'true');
      localStorage.removeItem('starredProjects');
      await reloadWorkspace();
    })();
  }, [dashboardApi, reloadWorkspace]);

  useEffect(() => {
    window.refreshProjects = refreshProjectsSilently;
    return () => {
      if (window.refreshProjects === refreshProjectsSilently) {
        delete window.refreshProjects;
      }
    };
  }, [refreshProjectsSilently]);

  useEffect(() => {
    window.openSettings = openSettings;
    return () => {
      if (window.openSettings === openSettings) {
        delete window.openSettings;
      }
    };
  }, [openSettings]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.type !== 'notification:navigate') return;
      if (typeof message.provider === 'string' && message.provider.trim()) {
        localStorage.setItem('selected-provider', message.provider);
      }
      setActiveTab('chat');
      setSidebarOpen(false);
      void refreshProjectsSilently();
      if (typeof message.sessionId === 'string' && message.sessionId) {
        navigate(`/session/${message.sessionId}`);
        return;
      }
      navigate('/');
    };
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [navigate, refreshProjectsSilently, setActiveTab, setSidebarOpen]);

  useEffect(() => {
    const isReconnect = isConnected && !wasConnectedRef.current;
    if (isReconnect) {
      wasConnectedRef.current = true;
    } else if (!isConnected) {
      wasConnectedRef.current = false;
    }
    if (isConnected && selectedSession?.id) {
      sendMessage({
        type: 'get-pending-permissions',
        sessionId: selectedSession.id,
      });
    }
  }, [isConnected, selectedSession?.id, sendMessage]);

  useEffect(() => {
    const parts: string[] = [];
    const sessionName = (
      (selectedSession?.title as string | undefined)
      || (selectedSession?.summary as string | undefined)
      || (selectedSession?.name as string | undefined)
      || ''
    ).toString().trim();
    if (sessionName) parts.push(sessionName);
    const projectName = selectedProject?.displayName?.trim();
    if (projectName) parts.push(projectName);
    parts.push('CloudCLI UI');
    document.title = parts.join(' - ');
  }, [selectedProject, selectedSession]);

  const selectedSessionTitle = useMemo(() => {
    if (!selectedSession) return null;
    const title =
      (selectedSession.title as string | undefined) ||
      selectedSession.summary ||
      selectedSession.name ||
      '';
    return title || null;
  }, [selectedSession]);

  const projectContent = useMemo(
    () => (
      <MainContent
        key={`${selectedProject?.name ?? 'none'}::${selectedSession?.id ?? 'none'}`}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        isNewSession={isNewSession}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ws={ws}
        sendMessage={sendMessage}
        latestMessage={latestMessage}
        isMobile={isMobile}
        onMenuClick={() => setSidebarOpen(true)}
        isLoading={isLoadingProjects}
        onInputFocusChange={setIsInputFocused}
        onSessionActive={markSessionAsActive}
        onSessionInactive={markSessionAsInactive}
        onSessionProcessing={markSessionAsProcessing}
        onSessionNotProcessing={markSessionAsNotProcessing}
        processingSessions={processingSessions}
        onReplaceTemporarySession={replaceTemporarySession}
        onNavigateToSession={(targetSessionId: string) => navigate(`/session/${targetSessionId}`)}
        onNewSession={() => selectedProject && handleNewSession(selectedProject)}
        onBackToKanban={handleBackToKanban}
        onSessionUpdated={() => { void refreshProjectsSilently(); }}
        onSessionDeleted={(sessionId) => { handleSessionDelete(sessionId); void refreshProjectsSilently(); }}
        onShowSettings={() => setShowSettings(true)}
        externalMessageUpdate={externalMessageUpdate}
        projects={projects}
        onRenameProject={handleRenameProject}
      />
    ),
    [
      selectedProject, selectedSession, isNewSession, activeTab, setActiveTab,
      ws, sendMessage, latestMessage, isMobile, setSidebarOpen, isLoadingProjects,
      setIsInputFocused, markSessionAsActive, markSessionAsInactive,
      markSessionAsProcessing, markSessionAsNotProcessing, processingSessions,
      replaceTemporarySession, navigate, handleNewSession, handleBackToKanban,
      refreshProjectsSilently, handleSessionDelete, setShowSettings,
      externalMessageUpdate, projects, handleProjectSelectFromShell,
    ],
  );

  // Also wire WS reconnect side-effect that used to sit here (kept pre-existing behavior).
  void sidebarOpen; // kept to suppress unused warning; sidebar open state is still used by mobile drawer hooks.

  return (
    <>
      <UnifiedShell
        workspace={workspace}
        projects={projects}
        selectedSessionTitle={selectedSessionTitle}
        onSelectProject={handleProjectSelectFromShell}
        onSelectSession={handleSessionSelectFromShell}
        onCreateDashboard={handleCreateDashboard}
        onCreateFolder={handleCreateFolder}
        onMoveProject={handleMoveProject}
        onAssignProjectToFolder={handleAssignProjectToFolder}
        onMoveFolder={handleMoveFolder}
        onToggleFavorite={handleToggleFavorite}
        onRenameProject={handleRenameProject}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteSession={handleDeleteSessionFromTree}
        onDeleteProject={handleDeleteProjectFromTree}
        onOpenSettings={() => setShowSettings(true)}
        projectContent={projectContent}
      />
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        projects={projects}
        initialTab={settingsInitialTab}
      />
      <CommandPalette
        projects={projects}
        onProjectSelect={handleProjectSelectFromShell}
        onSessionSelect={(session) => {
          navigate(`/session/${session.id}`);
        }}
      />
    </>
  );
}
