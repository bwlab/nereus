import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, FolderOpen, Archive } from 'lucide-react';
import type { Project, ProjectSession } from '../../../types/app';
import { authenticatedFetch } from '../../../utils/api';
import { useKanbanState } from '../hooks/useKanbanState';
import KanbanBoard from './subcomponents/KanbanBoard';
import KanbanAccordionView from './subcomponents/KanbanAccordionView';
import KanbanTabsView from './subcomponents/KanbanTabsView';
import KanbanGridView from './subcomponents/KanbanGridView';
import ViewModeSwitcher, { type ViewMode } from './subcomponents/ViewModeSwitcher';
import ArchivedSessionsDrawer from './ArchivedSessionsDrawer';

type SessionKanbanProps = {
  project: Project;
  onSessionClick: (session: ProjectSession) => void;
  onNewSession: () => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: Project[];
};

export default function SessionKanban({ project, onSessionClick, onNewSession, onSessionUpdated, onSessionDeleted, allProjects }: SessionKanbanProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [archiveDrawerOpen, setArchiveDrawerOpen] = useState(false);
  const viewModeKey = `session-kanban-view-${project.name}`;
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(viewModeKey);
    if (stored === 'kanban' || stored === 'accordion' || stored === 'tabs' || stored === 'grid') return stored;
    return 'kanban';
  });
  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem(viewModeKey, mode);
    setViewModeState(mode);
  }, [viewModeKey]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const allSessions = useMemo(() => {
    const sessions: ProjectSession[] = [];
    if (project.sessions) sessions.push(...project.sessions.map((s) => ({ ...s, __provider: 'claude' as const })));
    if (project.cursorSessions) sessions.push(...project.cursorSessions.map((s) => ({ ...s, __provider: 'cursor' as const })));
    if (project.codexSessions) sessions.push(...project.codexSessions.map((s) => ({ ...s, __provider: 'codex' as const })));
    if (project.geminiSessions) sessions.push(...project.geminiSessions.map((s) => ({ ...s, __provider: 'gemini' as const })));
    return sessions;
  }, [project.sessions, project.cursorSessions, project.codexSessions, project.geminiSessions]);

  const kanban = useKanbanState(project.name, allSessions);

  const handleSessionClick = useCallback(
    (session: ProjectSession) => {
      onSessionClick(session);
    },
    [onSessionClick],
  );

  if (kanban.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sessionsByColumn = kanban.getSessionsByColumn();
  const archivedSessions = kanban.getArchivedSessionsList();
  const archivedCount = kanban.archivedIds.size;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Sessioni — {project.displayName || project.name}</h2>
          {(project.fullPath || project.path) && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await authenticatedFetch(`/api/project-open/${encodeURIComponent(project.name)}/in-file-manager`, { method: 'POST' });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    alert(data.error || 'Impossibile aprire il file manager');
                  }
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
              className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
              title="Apri nel file manager"
            >
              <FolderOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">{project.fullPath || project.path}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ViewModeSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
          <button
            type="button"
            onClick={() => setArchiveDrawerOpen(true)}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors ${
              archivedCount > 0
                ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
                : 'text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground'
            }`}
            title="Sessioni archiviate"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archivio{archivedCount > 0 ? ` (${archivedCount})` : ''}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' && (
          <KanbanBoard
            columns={kanban.columns}
            sessionsByColumn={sessionsByColumn}
            labels={kanban.labels}
            currentTime={currentTime}
            getNoteForSession={kanban.getNoteForSession}
            getLabelsForSession={kanban.getLabelsForSession}
            onAddColumn={kanban.addColumn}
            onRenameColumn={kanban.renameColumn}
            onDeleteColumn={kanban.removeColumn}
            onMoveColumn={kanban.moveColumn}
            onMoveSession={kanban.moveSession}
            onSessionClick={handleSessionClick}
            onNoteChange={kanban.setSessionNote}
            onToggleLabel={kanban.toggleSessionLabel}
            onCreateLabel={kanban.addLabel}
            onEditLabel={kanban.editLabel}
            onDeleteLabel={kanban.removeLabel}
            onNewSession={onNewSession}
            projectName={project.name}
            onSessionUpdated={onSessionUpdated}
            onSessionDeleted={onSessionDeleted}
            allProjects={allProjects}
            onArchive={kanban.archiveSession}
          />
        )}
        {viewMode === 'accordion' && (
          <KanbanAccordionView
            columns={kanban.columns}
            sessionsByColumn={sessionsByColumn}
            currentTime={currentTime}
            projectName={project.name}
            getLabelsForSession={kanban.getLabelsForSession}
            onSessionClick={handleSessionClick}
            onSessionUpdated={onSessionUpdated}
            onSessionDeleted={onSessionDeleted}
            onMoveColumn={kanban.moveColumn}
            allProjects={allProjects}
          />
        )}
        {viewMode === 'tabs' && (
          <KanbanTabsView
            columns={kanban.columns}
            sessionsByColumn={sessionsByColumn}
            currentTime={currentTime}
            projectName={project.name}
            getLabelsForSession={kanban.getLabelsForSession}
            onSessionClick={handleSessionClick}
            onSessionUpdated={onSessionUpdated}
            onSessionDeleted={onSessionDeleted}
            allProjects={allProjects}
          />
        )}
        {viewMode === 'grid' && (
          <KanbanGridView
            columns={kanban.columns}
            sessionsByColumn={sessionsByColumn}
            currentTime={currentTime}
            projectName={project.name}
            getLabelsForSession={kanban.getLabelsForSession}
            onSessionClick={handleSessionClick}
            onSessionUpdated={onSessionUpdated}
            onSessionDeleted={onSessionDeleted}
            allProjects={allProjects}
          />
        )}
      </div>

      <ArchivedSessionsDrawer
        isOpen={archiveDrawerOpen}
        onClose={() => setArchiveDrawerOpen(false)}
        projectName={project.name}
        archivedSessions={archivedSessions}
        onUnarchive={kanban.unarchiveSession}
        onDeleted={(sid) => {
          kanban.unarchiveSession(sid);
          onSessionDeleted(sid);
        }}
      />
    </div>
  );
}
