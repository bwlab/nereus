import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Terminal, Wrench, Plug, FolderOpen, Code } from 'lucide-react';
import type { Project, ProjectSession } from '../../../types/app';
import { authenticatedFetch } from '../../../utils/api';
import { useKanbanState } from '../hooks/useKanbanState';
import KanbanBoard from './subcomponents/KanbanBoard';
import ProjectSettingsPanel, { type ProjectSettingsTab } from '../../project-settings/view/ProjectSettingsPanel';

type SessionKanbanProps = {
  project: Project;
  onSessionClick: (session: ProjectSession) => void;
  onNewSession: () => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
};

export default function SessionKanban({ project, onSessionClick, onNewSession, onSessionUpdated, onSessionDeleted }: SessionKanbanProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [settingsTab, setSettingsTab] = useState<ProjectSettingsTab | null>(null);

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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await authenticatedFetch(`/api/project-open/${encodeURIComponent(project.name)}/in-ide`, { method: 'POST' });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  alert(data.error || "Impossibile aprire l'IDE");
                }
              } catch (err) {
                alert((err as Error).message);
              }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Apri nell'IDE"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('commands')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Comandi di progetto"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('skills')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Skills"
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('mcp')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="MCP Tools"
          >
            <Plug className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
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
        />
      </div>

      <ProjectSettingsPanel
        isOpen={settingsTab !== null}
        onClose={() => setSettingsTab(null)}
        projectName={project.name}
        projectDisplayName={project.displayName}
        activeTab={settingsTab ?? 'commands'}
        onChangeTab={(tab) => setSettingsTab(tab)}
      />
    </div>
  );
}
