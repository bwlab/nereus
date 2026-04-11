import { Clock, MessageSquare, Folder, PlayCircle, CheckCircle2, CircleDot } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { ClaudeTaskSummary } from '../../../claude-tasks/types/claude-tasks';

type DashboardProjectCardProps = {
  project: Project;
  onClick: (project: Project) => void;
  taskSummary?: ClaudeTaskSummary;
};

function getSessionCount(project: Project): number {
  return (project.sessions?.length ?? 0)
    + (project.cursorSessions?.length ?? 0)
    + (project.codexSessions?.length ?? 0)
    + (project.geminiSessions?.length ?? 0);
}

function getLastActivity(project: Project): string | null {
  const allSessions = [
    ...(project.sessions ?? []),
    ...(project.cursorSessions ?? []),
    ...(project.codexSessions ?? []),
    ...(project.geminiSessions ?? []),
  ];
  if (allSessions.length === 0) return null;

  const dates = allSessions
    .map((s) => s.updated_at || s.lastActivity || s.createdAt || s.created_at)
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((t) => !isNaN(t));

  if (dates.length === 0) return null;
  const latest = new Date(Math.max(...dates));
  const now = new Date();
  const diffMs = now.getTime() - latest.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'adesso';
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}g fa`;
}

function getProviders(project: Project): string[] {
  const providers: string[] = [];
  if (project.sessions?.length) providers.push('Claude');
  if (project.cursorSessions?.length) providers.push('Cursor');
  if (project.codexSessions?.length) providers.push('Codex');
  if (project.geminiSessions?.length) providers.push('Gemini');
  return providers;
}

export default function DashboardProjectCard({ project, onClick, taskSummary }: DashboardProjectCardProps) {
  const sessionCount = getSessionCount(project);
  const lastActivity = getLastActivity(project);
  const providers = getProviders(project);

  return (
    <button
      type="button"
      onClick={() => onClick(project)}
      className="w-full rounded-lg border border-border/60 bg-card p-3 text-left transition-all hover:border-border hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        <Folder className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {project.displayName || project.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {project.path || project.fullPath}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {sessionCount}
        </span>
        {lastActivity && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {lastActivity}
          </span>
        )}
      </div>

      {providers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {providers.map((p) => (
            <span
              key={p}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {taskSummary && (taskSummary.pending + taskSummary.inProgress + taskSummary.completed > 0) && (
        <div className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2">
          {taskSummary.inProgress > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
              <PlayCircle className="h-3 w-3" /> {taskSummary.inProgress}
            </span>
          )}
          {taskSummary.pending > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <CircleDot className="h-3 w-3" /> {taskSummary.pending}
            </span>
          )}
          {taskSummary.completed > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" /> {taskSummary.completed}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
