import { Loader2, Clock, PlayCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Project } from '../../../types/app';
import { useClaudeTasksState } from '../hooks/useClaudeTasksState';
import TaskCard from './subcomponents/TaskCard';

type ClaudeTasksPanelProps = {
  project: Project;
  isVisible: boolean;
};

export default function ClaudeTasksPanel({ project, isVisible }: ClaudeTasksPanelProps) {
  const projectPath = project.path || project.fullPath || null;
  const { loading, tasksByStatus, allTasks, sessions, reload } = useClaudeTasksState(
    isVisible ? projectPath : null,
  );

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allTasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">Nessun task</p>
        <p className="mt-1 text-xs">I task appariranno qui quando Claude Code li crea durante le sessioni.</p>
      </div>
    );
  }

  const columns = [
    { key: 'in_progress' as const, label: 'In corso', icon: PlayCircle, color: 'text-primary', tasks: tasksByStatus.in_progress },
    { key: 'pending' as const, label: 'In attesa', icon: Clock, color: 'text-muted-foreground', tasks: tasksByStatus.pending },
    { key: 'completed' as const, label: 'Completati', icon: CheckCircle2, color: 'text-green-500', tasks: tasksByStatus.completed },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Claude Tasks</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <PlayCircle className="h-3 w-3 text-primary" /> {tasksByStatus.in_progress.length}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {tasksByStatus.pending.length}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> {tasksByStatus.completed.length}
            </span>
          </div>
          {sessions.length > 1 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {sessions.length} sessioni
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => reload()}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Aggiorna"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columns.map(({ key, label, icon: Icon, color, tasks }) => (
          <div key={key} className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-2 px-3 py-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <h3 className="flex-1 text-sm font-semibold text-foreground">{label}</h3>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {tasks.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: '100px' }}>
              {tasks.map((task) => (
                <TaskCard key={`${task.sessionId}-${task.id}`} task={task} allTasks={allTasks} />
              ))}
              {tasks.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Nessun task</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
