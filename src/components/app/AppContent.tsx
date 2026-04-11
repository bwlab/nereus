import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '../sidebar/view/Sidebar';
import MainContent from '../main-content/view/MainContent';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { useSessionProtection } from '../../hooks/useSessionProtection';
import { useProjectsState } from '../../hooks/useProjectsState';
import { useDashboardApi } from '../dashboard/hooks/useDashboardApi';
import CommandPalette from '../command-palette/CommandPalette';

export default function AppContent() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { t } = useTranslation('common');
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
    setShowSettings,
    openSettings,
    refreshProjectsSilently,
    handleNewSession,
    handleBackToKanban,
    handleProjectSelect,
    sidebarSharedProps,
  } = useProjectsState({
    sessionId,
    navigate,
    latestMessage,
    isMobile,
    activeSessions,
  });

  // Dashboard state
  const dashboardApi = useDashboardApi();
  const [activeDashboardId, setActiveDashboardId] = useState<number | null>(null);
  const [dashboardChecked, setDashboardChecked] = useState(false);
  const [singleProjectMode, setSingleProjectMode] = useState(false);

  useEffect(() => {
    dashboardApi.getDefaultDashboardId().then((id) => {
      if (id) setActiveDashboardId(id);
      setDashboardChecked(true);
    });
  }, [dashboardApi]);

  const handleDashboardSelect = useCallback((id: number | null) => {
    setActiveDashboardId(id);
    if (id !== null) {
      // When entering a dashboard, clear session state
      handleBackToKanban();
    }
  }, [handleBackToKanban]);

  useEffect(() => {
    // Expose a non-blocking refresh for chat/session flows.
    // Full loading refreshes are still available through direct fetchProjects calls.
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
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.type !== 'notification:navigate') {
        return;
      }

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

  // Permission recovery: query pending permissions on WebSocket reconnect or session change
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
        sessionId: selectedSession.id
      });
    }
  }, [isConnected, selectedSession?.id, sendMessage]);

  const filteredSidebarProps = useMemo(() => {
    if (!singleProjectMode || !selectedProject) return sidebarSharedProps;
    return {
      ...sidebarSharedProps,
      projects: projects.filter((p) => p.name === selectedProject.name),
    };
  }, [singleProjectMode, selectedProject, sidebarSharedProps, projects]);

  return (
    <div className="fixed inset-0 flex bg-background">
      {!isMobile && !activeDashboardId ? (
        <div className="h-full flex-shrink-0 border-r border-border/50">
          <Sidebar {...filteredSidebarProps} singleProjectMode={singleProjectMode} onToggleAllProjects={() => setSingleProjectMode(false)} />
        </div>
      ) : !activeDashboardId && (
        <div
          className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
        >
          <button
            className="fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-150 ease-out"
            onClick={(event) => {
              event.stopPropagation();
              setSidebarOpen(false);
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSidebarOpen(false);
            }}
            aria-label={t('versionUpdate.ariaLabels.closeSidebar')}
          />
          <div
            className={`relative h-full w-[85vw] max-w-sm transform border-r border-border/40 bg-card transition-transform duration-150 ease-out sm:w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <Sidebar {...filteredSidebarProps} singleProjectMode={singleProjectMode} onToggleAllProjects={() => setSingleProjectMode(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <MainContent
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
          onShowSettings={() => setShowSettings(true)}
          externalMessageUpdate={externalMessageUpdate}
          activeDashboardId={activeDashboardId}
          dashboardChecked={dashboardChecked}
          onDashboardSelect={handleDashboardSelect}
          projects={projects}
          onProjectSelect={(project) => { setActiveDashboardId(null); setSingleProjectMode(true); handleProjectSelect(project); }}
        />
      </div>

      <CommandPalette
        projects={projects}
        onProjectSelect={(project) => { setActiveDashboardId(null); setSingleProjectMode(true); handleProjectSelect(project); }}
        onSessionSelect={(session) => { setActiveDashboardId(null); setSingleProjectMode(true); navigate(`/session/${session.id}`); }}
      />
    </div>
  );
}
