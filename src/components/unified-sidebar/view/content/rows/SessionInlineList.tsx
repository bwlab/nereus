import { MessageSquare, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project, ProjectSession, SessionProvider } from '../../../../../types/app';
import { CLAUDE_MODELS } from '../../../../../../shared/modelConstants';
import TerminalLauncher from '../../../../chat/view/subcomponents/TerminalLauncher';

interface SessionInlineListProps {
  project: Project;
  onSelectSession: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onDeleteSession?: (project: Project, sessionId: string, provider: SessionProvider) => void;
}

interface SessionRow {
  sessionId: string;
  provider: SessionProvider;
  session: ProjectSession;
}

const PROVIDER_LABEL: Record<SessionProvider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
  gemini: 'Gemini',
};

function collect(project: Project): SessionRow[] {
  const out: SessionRow[] = [];
  const push = (list: ProjectSession[] | undefined, provider: SessionProvider) => {
    if (!list) return;
    for (const s of list) out.push({ sessionId: s.id, provider, session: s });
  };
  push(project.sessions, 'claude');
  push(project.codexSessions, 'codex');
  push(project.cursorSessions, 'cursor');
  push(project.geminiSessions, 'gemini');
  return out;
}

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'ora';
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}g`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}m`;
  const y = Math.round(mo / 12);
  return `${y}a`;
}

export default function SessionInlineList({ project, onSelectSession, onDeleteSession }: SessionInlineListProps) {
  const { t } = useTranslation('sidebar');
  const sessions = collect(project);
  if (sessions.length === 0) {
    return <div className="px-14 py-2 text-xs text-muted-foreground">{t('session.noSessions')}</div>;
  }
  sessions.sort((a, b) => {
    const ta = Date.parse(a.session.updated_at || a.session.createdAt || '') || 0;
    const tb = Date.parse(b.session.updated_at || b.session.createdAt || '') || 0;
    return tb - ta;
  });
  return (
    <ul className="flex flex-col border-t border-border/30 bg-muted/20">
      {sessions.map((row) => {
        const title =
          (row.session.title as string | undefined) ||
          row.session.summary ||
          row.session.name ||
          row.sessionId.slice(0, 8);
        const when = formatRelative(row.session.updated_at || row.session.createdAt);
        return (
          <li key={`${row.provider}:${row.sessionId}`} className="group flex items-center gap-1 pr-2 hover:bg-muted/40">
            <button
              type="button"
              onClick={() => onSelectSession(project, row.sessionId, row.provider)}
              className="flex flex-1 items-center gap-3 px-14 py-2 text-left text-sm transition"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{title}</span>
              <span className="shrink-0 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {PROVIDER_LABEL[row.provider]}
              </span>
              {when && <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>}
            </button>
            {row.provider === 'claude' && (
              <div className="opacity-0 transition group-hover:opacity-100">
                <TerminalLauncher
                  projectName={project.name}
                  currentSessionId={row.sessionId}
                  currentModel={CLAUDE_MODELS.DEFAULT}
                  currentPermissionMode="default"
                />
              </div>
            )}
            {onDeleteSession && row.provider !== 'cursor' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(project, row.sessionId, row.provider);
                }}
                className="hover:bg-[color:var(--heritage-b,#E30613)]/10 flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:text-[color:var(--heritage-b,#E30613)] group-hover:opacity-100"
                aria-label={t('session.deleteSession')}
                title={t('session.deleteSession')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
