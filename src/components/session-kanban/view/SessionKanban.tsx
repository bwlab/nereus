import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Project, ProjectSession } from '../../../types/app';
import { useKanbanState } from '../hooks/useKanbanState';
import KanbanBoard from './subcomponents/KanbanBoard';

type SessionKanbanProps = {
  project: Project;
  onSessionClick: (session: ProjectSession) => void;
  onNewSession: () => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
};

export default function SessionKanban({ project, onSessionClick, onNewSession, onSessionUpdated, onSessionDeleted }: SessionKanbanProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Sessioni — {project.displayName || project.name}</h2>
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
    </div>
  );
}
