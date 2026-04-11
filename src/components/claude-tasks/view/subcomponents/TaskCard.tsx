import { useState } from 'react';
import { ChevronDown, ChevronRight, Link, AlertCircle } from 'lucide-react';
import type { ClaudeTask } from '../../types/claude-tasks';

type TaskCardProps = {
  task: ClaudeTask;
  allTasks: ClaudeTask[];
};

export default function TaskCard({ task, allTasks }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isBlocked = (task.blockedBy ?? []).some((id) => {
    const blocker = allTasks.find((t) => t.id === id && t.sessionId === task.sessionId);
    return !blocker || blocker.status !== 'completed';
  });

  const statusColor = task.status === 'completed'
    ? 'border-l-green-500'
    : task.status === 'in_progress'
      ? 'border-l-primary'
      : 'border-l-muted-foreground/30';

  return (
    <div className={`rounded-lg border border-border bg-card ${statusColor} border-l-[3px] ${isBlocked ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
      >
        {expanded ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {task.subject}
          </p>
          {task.status === 'in_progress' && task.activeForm && (
            <p className="mt-0.5 text-xs text-primary">{task.activeForm}</p>
          )}
          {isBlocked && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Bloccato
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2">
          {task.description && (
            <p className="mb-2 whitespace-pre-wrap text-xs text-muted-foreground">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            {task.sessionName && (
              <span className="rounded bg-muted px-1.5 py-0.5">{task.sessionName}</span>
            )}
            {(task.blocks ?? []).length > 0 && (
              <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5">
                <Link className="h-2.5 w-2.5" /> Blocca: {task.blocks!.join(', ')}
              </span>
            )}
            {(task.blockedBy ?? []).length > 0 && (
              <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5">
                <AlertCircle className="h-2.5 w-2.5" /> Bloccato da: {task.blockedBy!.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
