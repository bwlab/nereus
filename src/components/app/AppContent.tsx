import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation as useRouterLocation } from 'react-router-dom';
import MainContent from '../main-content/view/MainContent';
import TabBar from '../main-content/view/TabBar';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { useSessionProtection } from '../../hooks/useSessionProtection';
import { useProjectsState } from '../../hooks/useProjectsState';
import { useDashboardApi } from '../dashboard/hooks/useDashboardApi';
import CommandPalette from '../command-palette/CommandPalette';
import UnifiedShell from '../unified-sidebar/view/UnifiedShell';
import { useWorkspace } from '../unified-sidebar/state/useWorkspace';
import type { AppTab, Project, ProjectSession, SessionProvider } from '../../types/app';
import Settings from '../settings/view/Settings';
import ProjectCreationWizard from '../project-creation-wizard';
import { providerLaunchCommand } from '../project-creation-wizard/utils/providerLaunch';
import {
  useTabsStore,
  openTab,
  activateTab,
  setTabView,
  setTabTitle,
  updateTabSession,
  closeTab as closeTabAction,
  getTabsState,
  tabToUrl,
  type Tab,
} from '../../stores/tabsStore';

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
    sidebarOpen,
    isLoadingProjects,
    externalMessageUpdate,
    setSidebarOpen,
    setIsInputFocused,
    showSettings,
    setShowSettings,
    settingsInitialTab,
    openSettings,
    refreshProjectsSilently,
    handleSessionDelete: handleSessionDeleteFromState,
  } = useProjectsState({
    // Pass undefined to disable the legacy /session/:id auto-selection effect:
    // tabs system now owns selection. Legacy /session/:id is handled below.
    sessionId: undefined,
    navigate,
    latestMessage,
    isMobile,
    activeSessions,
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const { tabs, activeTabId } = useTabsStore();

  /** Find a session inside a project by id+provider, attaching __provider for downstream consumers. */
  const findSession = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider): ProjectSession | null => {
      const pool =
        provider === 'claude' ? project.sessions :
        provider === 'cursor' ? project.cursorSessions :
        provider === 'codex' ? project.codexSessions :
        project.geminiSessions;
      const found = pool?.find((s) => s.id === sessionId);
      return found ? ({ ...found, __provider: provider } as ProjectSession) : null;
    },
    [],
  );

  /** Compute initial title for a tab. */
  const computeTabTitle = useCallback(
    (project: Project, opts: { sessionId?: string; provider?: SessionProvider; kind: 'chat' | 'shell' }): string => {
      const projectTitle = project.displayName || project.name;
      if (opts.kind === 'shell' && !opts.sessionId) return `${projectTitle} • shell`;
      if (opts.sessionId && opts.provider) {
        const session = findSession(project, opts.sessionId, opts.provider);
        const title = (session?.title as string | undefined)
          || session?.summary
          || session?.name
          || opts.sessionId.slice(0, 8);
        const prefix = opts.kind === 'shell' ? '⌘ ' : '';
        return `${projectTitle} • ${prefix}${title}`;
      }
      return `${projectTitle} • nuova`;
    },
    [findSession],
  );

  /** Resolve a tab to renderable MainContent inputs. Returns null if its project no longer exists. */
  type TabContent = {
    tab: Tab;
    project: Project;
    session: ProjectSession | null;
    isNewSession: boolean;
  };
  const tabContents: TabContent[] = useMemo(() => {
    return tabs
      .map((tab): TabContent | null => {
        const project = projects.find((p) => p.name === tab.projectName);
        if (!project) return null;
        let session: ProjectSession | null = null;
        if (tab.sessionId && tab.provider) {
          session = findSession(project, tab.sessionId, tab.provider);
        }
        const isNewSession = tab.kind === 'chat' && !session;
        return { tab, project, session, isNewSession };
      })
      .filter((x): x is TabContent => x !== null);
  }, [tabs, projects, findSession]);

  const activeTabContent = useMemo(
    () => tabContents.find((t) => t.tab.id === activeTabId) ?? null,
    [tabContents, activeTabId],
  );

  // Active selection mirrors active tab — used by document.title, WS reconnect, SW notifications.
  const selectedProject = activeTabContent?.project ?? null;
  const selectedSession = activeTabContent?.session ?? null;

  const dashboardApi = useDashboardApi();
  const { workspace, reload: reloadWorkspace } = useWorkspace(true);

  // ── Tab handlers (sidebar → openTab + navigate) ───────────────────────────
  const navigateToTab = useCallback(
    (tab: Pick<Tab, 'projectName' | 'sessionId' | 'provider'>) => {
      const url = tabToUrl({
        id: '',
        kind: 'chat',
        projectName: tab.projectName,
        sessionId: tab.sessionId,
        provider: tab.provider,
        title: '',
        viewTab: 'chat',
      });
      if (routerLocation.pathname !== url) navigate(url);
    },
    [navigate, routerLocation.pathname],
  );

  const handleProjectSelectFromShell = useCallback(
    (project: Project) => {
      const title = computeTabTitle(project, { kind: 'chat' });
      try {
        openTab({ kind: 'chat', projectName: project.name, title });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName: project.name });
    },
    [computeTabTitle, navigateToTab],
  );

  const handleSessionSelectFromShell = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider) => {
      const title = computeTabTitle(project, { sessionId, provider, kind: 'chat' });
      try {
        openTab({ kind: 'chat', projectName: project.name, sessionId, provider, title });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName: project.name, sessionId, provider });
    },
    [computeTabTitle, navigateToTab],
  );

  const handleOpenShellForProject = useCallback(
    (project: Project) => {
      const title = computeTabTitle(project, { kind: 'shell' });
      try {
        openTab({ kind: 'shell', projectName: project.name, title });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName: project.name });
    },
    [computeTabTitle, navigateToTab],
  );

  const handleOpenTerminalForSession = useCallback(
    (project: Project, sessionId: string, provider: SessionProvider) => {
      const title = computeTabTitle(project, { sessionId, provider, kind: 'shell' });
      try {
        openTab({ kind: 'shell', projectName: project.name, sessionId, provider, title });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName: project.name, sessionId, provider });
    },
    [computeTabTitle, navigateToTab],
  );

  // Sync URL → tabs: arriving at /p/:name (refresh, back/forward, command palette)
  // ensures the matching tab exists and is active.
  useEffect(() => {
    if (!routeProjectName) return;
    const decoded = decodeURIComponent(routeProjectName);
    const project = projects.find((p) => p.name === decoded);
    if (!project) return;
    const provider = params.provider as SessionProvider | undefined;
    const sessionId = params.sessionId ? decodeURIComponent(params.sessionId) : undefined;
    // If the URL has no provider, any tab on the project (with same sessionId)
    // is an acceptable match — otherwise opening a project-only URL while a
    // shell tab with provider is active would spawn a duplicate chat tab.
    const providerMatches = (t: Tab) => provider === undefined || t.provider === provider;
    const active = tabs.find((t) => t.id === activeTabId);
    if (
      active &&
      active.projectName === decoded &&
      active.sessionId === sessionId &&
      providerMatches(active)
    ) {
      return;
    }
    const existing = tabs.find(
      (t) =>
        t.projectName === decoded &&
        t.sessionId === sessionId &&
        providerMatches(t),
    );
    if (existing) {
      activateTab(existing.id);
      return;
    }
    const title = computeTabTitle(project, { sessionId, provider, kind: 'chat' });
    try {
      openTab({ kind: 'chat', projectName: decoded, sessionId, provider, title });
    } catch {
      /* tab limit reached — silently ignore on URL load */
    }
  }, [routeProjectName, params.provider, params.sessionId, projects, tabs, activeTabId, computeTabTitle]);

  // Legacy /session/:id URL: locate the project and open a tab.
  useEffect(() => {
    if (!legacySessionId || projects.length === 0) return;
    const sid = legacySessionId;
    const providers: SessionProvider[] = ['claude', 'cursor', 'codex', 'gemini'];
    for (const project of projects) {
      for (const provider of providers) {
        const session = findSession(project, sid, provider);
        if (session) {
          const title = computeTabTitle(project, { sessionId: sid, provider, kind: 'chat' });
          try {
            openTab({ kind: 'chat', projectName: project.name, sessionId: sid, provider, title });
          } catch {
            /* tab limit — bail silently */
          }
          navigate(
            tabToUrl({
              id: '',
              kind: 'chat',
              projectName: project.name,
              sessionId: sid,
              provider,
              title,
              viewTab: 'chat',
            }),
            { replace: true },
          );
          return;
        }
      }
    }
  }, [legacySessionId, projects, findSession, computeTabTitle, navigate]);

  // Tab bar handlers
  const handleTabActivate = useCallback(
    (tab: Tab) => {
      navigateToTab(tab);
    },
    [navigateToTab],
  );

  const handleTabClose = useCallback(() => {
    // TabBar.onClose is called after the store has been mutated by closeTab.
    const next = getTabsState();
    if (next.tabs.length === 0) {
      navigate('/');
      return;
    }
    const active = next.tabs.find((t) => t.id === next.activeTabId);
    if (active) {
      const url = tabToUrl(active);
      if (routerLocation.pathname !== url) navigate(url);
    }
  }, [navigate, routerLocation.pathname]);

  const handleSessionDelete = useCallback(
    (sessionIdToDelete: string) => {
      handleSessionDeleteFromState(sessionIdToDelete);
      tabs
        .filter((t) => t.sessionId === sessionIdToDelete)
        .forEach((t) => closeTabAction(t.id));
    },
    [handleSessionDeleteFromState, tabs],
  );

  const handleNewSession = useCallback(
    (project: Project) => {
      const title = computeTabTitle(project, { kind: 'chat' });
      try {
        openTab({ kind: 'chat', projectName: project.name, title });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName: project.name });
      if (isMobile) setSidebarOpen(false);
    },
    [computeTabTitle, navigateToTab, isMobile, setSidebarOpen],
  );

  const handleBackToKanban = useCallback(() => {
    if (!activeTabId) return;
    closeTabAction(activeTabId);
    handleTabClose();
  }, [activeTabId, handleTabClose]);

  // ── Project creation wizard ───────────────────────────────────────────────
  const [showProjectWizard, setShowProjectWizard] = useState(false);

  const handleOpenProjectWizard = useCallback(() => {
    setShowProjectWizard(true);
  }, []);

  const handleProjectCreated = useCallback(
    async (project: Record<string, unknown> | undefined, provider: SessionProvider) => {
      const projectName =
        project && typeof project.name === 'string' ? (project.name as string) : null;
      // Refresh project lists so the new project is visible everywhere.
      await refreshProjectsSilently();
      await reloadWorkspace();

      if (!projectName) return;

      const command = providerLaunchCommand(provider);
      const titleBase = (project?.displayName as string) || projectName;
      try {
        openTab({
          kind: 'shell',
          projectName,
          provider,
          title: `${titleBase} • ⌘ ${command}`,
          initialCommand: command,
        });
      } catch (e) {
        alert((e as Error).message);
        return;
      }
      navigateToTab({ projectName });
    },
    [navigateToTab, refreshProjectsSilently, reloadWorkspace],
  );

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
      await dashboardApi.deleteProject(projectName);
      tabs.filter((t) => t.projectName === projectName).forEach((t) => closeTabAction(t.id));
      await refreshProjectsSilently();
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore eliminazione progetto');
    }
  }, [dashboardApi, tabs, refreshProjectsSilently, reloadWorkspace]);

  const handleDeleteSessionFromTree = useCallback(async (project: Project, sessionId: string, provider: SessionProvider) => {
    if (provider === 'cursor') {
      alert('Eliminazione sessioni Cursor non supportata dal provider.');
      return;
    }
    if (!window.confirm('Eliminare la sessione?')) return;
    try {
      await dashboardApi.deleteSession(project.name, sessionId, provider);
      handleSessionDelete(sessionId);
      await refreshProjectsSilently();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore eliminazione sessione');
    }
  }, [dashboardApi, handleSessionDelete, refreshProjectsSilently]);

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
      await dashboardApi.renameProject(projectName, next.trim());
      await refreshProjectsSilently();
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore rinomina progetto');
    }
  }, [dashboardApi, refreshProjectsSilently, reloadWorkspace]);

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
    const current = workspace?.assignments.find((a) => a.project_name === projectName);
    const targetRacc = workspace?.raccoglitori.find((r) => r.id === targetRaccoglitoreId);
    if (!targetRacc) { alert('Cartella destinazione non trovata'); return; }
    if (current && current.raccoglitore_id === targetRaccoglitoreId) return;
    try {
      // Assign first: se fallisce, origine intatta. INSERT OR UPDATE è idempotente.
      await dashboardApi.assignProject(targetRacc.dashboard_id, targetRaccoglitoreId, projectName);
      if (current) {
        try {
          await dashboardApi.removeProject(current.dashboard_id, current.raccoglitore_id, projectName);
        } catch (removeErr) {
          // Rollback del nuovo assignment per non lasciare duplicati
          try { await dashboardApi.removeProject(targetRacc.dashboard_id, targetRaccoglitoreId, projectName); } catch { /* best-effort */ }
          throw removeErr;
        }
      }
      await reloadWorkspace();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Errore spostamento progetto');
      await reloadWorkspace();
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
  }, [navigate, refreshProjectsSilently, setSidebarOpen]);

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

  // Keep each tab's title in sync with the session/project metadata (which may load
  // after the tab was opened, or change when the session is renamed elsewhere).
  useEffect(() => {
    for (const { tab, project, session } of tabContents) {
      const expected = computeTabTitle(project, {
        sessionId: tab.sessionId,
        provider: tab.provider,
        kind: tab.kind,
      });
      if (expected !== tab.title) setTabTitle(tab.id, expected);
      // Avoid unused-variable warnings for `session` — already consumed by computeTabTitle.
      void session;
    }
  }, [tabContents, computeTabTitle]);

  // Tabs whose underlying session is currently processing — shown as pulsing dot in TabBar.
  const processingTabIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tab of tabs) {
      if (tab.sessionId && processingSessions?.has(tab.sessionId)) {
        ids.add(tab.id);
      }
    }
    return ids;
  }, [tabs, processingSessions]);

  // Per-tab setActiveTab factory: writes the chosen MainContent inner view into the tab.
  // Accepts both a direct value and an updater function (matches React's Dispatch<SetStateAction>).
  const makeSetActiveTab = useCallback(
    (tabId: string) =>
      (value: AppTab | ((prev: AppTab) => AppTab)) => {
        const current = getTabsState().tabs.find((t) => t.id === tabId);
        const prev = (current?.viewTab as AppTab | undefined) ?? 'chat';
        const next = typeof value === 'function' ? (value as (p: AppTab) => AppTab)(prev) : value;
        setTabView(tabId, next);
      },
    [],
  );

  // Wrap MainContent's `onReplaceTemporarySession` to also upgrade the tab spec
  // (so deduplication after first message points to the real sessionId).
  const wrapReplaceTemporary = useCallback(
    (tabId: string, projectName: string) =>
      (newSessionId?: string | null) => {
        replaceTemporarySession?.(newSessionId ?? undefined);
        if (!newSessionId) return;
        const stored = (() => {
          try {
            return localStorage.getItem('selected-provider');
          } catch {
            return null;
          }
        })();
        const provider = (stored as SessionProvider | null) || 'claude';
        const project = projects.find((p) => p.name === projectName);
        const title = project
          ? computeTabTitle(project, { sessionId: newSessionId, provider, kind: 'chat' })
          : undefined;
        updateTabSession(tabId, {
          sessionId: newSessionId,
          provider,
          ...(title ? { title } : {}),
        });
      },
    [replaceTemporarySession, projects, computeTabTitle],
  );

  const tabBarNode = useMemo(
    () => (
      <TabBar
        onActivate={handleTabActivate}
        onClose={handleTabClose}
        processingTabIds={processingTabIds}
      />
    ),
    [handleTabActivate, handleTabClose, processingTabIds],
  );

  const projectContent = useMemo(
    () => {
      if (tabContents.length === 0) return null;
      return (
        <div className="flex h-full flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            {tabContents.map(({ tab, project, session, isNewSession }) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'} flex-col`}
                >
                  <MainContent
                    selectedProject={project}
                    selectedSession={session}
                    isNewSession={isNewSession}
                    activeTab={tab.viewTab}
                    shellCommand={tab.initialCommand ?? null}
                    setActiveTab={makeSetActiveTab(tab.id)}
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
                    onReplaceTemporarySession={wrapReplaceTemporary(tab.id, project.name)}
                    onNavigateToSession={(targetSessionId: string) => navigate(`/session/${targetSessionId}`)}
                    onNewSession={() => handleNewSession(project)}
                    onBackToKanban={handleBackToKanban}
                    onSessionUpdated={() => { void refreshProjectsSilently(); }}
                    onSessionDeleted={(sessionId) => { handleSessionDelete(sessionId); void refreshProjectsSilently(); }}
                    onShowSettings={() => setShowSettings(true)}
                    externalMessageUpdate={externalMessageUpdate}
                    projects={projects}
                    onRenameProject={handleRenameProject}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [
      tabContents, activeTabId, makeSetActiveTab,
      ws, sendMessage, latestMessage, isMobile, setSidebarOpen, isLoadingProjects,
      setIsInputFocused, markSessionAsActive, markSessionAsInactive,
      markSessionAsProcessing, markSessionAsNotProcessing, processingSessions,
      wrapReplaceTemporary, navigate, handleNewSession, handleBackToKanban,
      refreshProjectsSilently, handleSessionDelete, setShowSettings,
      externalMessageUpdate, projects, handleRenameProject,
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
        onOpenTerminal={handleOpenTerminalForSession}
        onOpenProjectShell={handleOpenShellForProject}
        onOpenSettings={() => setShowSettings(true)}
        onCreateProject={handleOpenProjectWizard}
        projectContent={projectContent}
        tabBarNode={tabBarNode}
        openTabsCount={tabs.length}
        processingTabIds={processingTabIds}
        onActivateTab={handleTabActivate}
      />
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        projects={projects}
        initialTab={settingsInitialTab}
      />
      {showProjectWizard && (
        <ProjectCreationWizard
          onClose={() => setShowProjectWizard(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
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
