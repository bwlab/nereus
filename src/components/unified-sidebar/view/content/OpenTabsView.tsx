import { useCallback, useMemo } from 'react';
import { Activity, MessageSquare, TerminalSquare, X, ArrowRight, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useTabsStore,
  closeTab,
  closeAllTabs,
  type Tab,
} from '../../../../stores/tabsStore';
import type { Project, SessionProvider } from '../../../../types/app';

interface OpenTabsViewProps {
  projects: Project[];
  /** Tabs whose underlying session is currently processing. */
  processingTabIds?: Set<string>;
  /** Activate a tab (typically navigates to its URL). */
  onActivate: (tab: Tab) => void;
}

interface RowData {
  tab: Tab;
  project: Project | null;
  /** ISO timestamp of the most recent activity on this session, if known. */
  updatedAt: string | null;
  isProcessing: boolean;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'adesso';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min fa`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h fa`;
  return `${Math.floor(diff / 86_400_000)} g fa`;
}

function findSession(project: Project, sessionId: string, provider: SessionProvider) {
  const pool =
    provider === 'claude' ? project.sessions :
    provider === 'cursor' ? project.cursorSessions :
    provider === 'codex' ? project.codexSessions :
    project.geminiSessions;
  return pool?.find((s) => s.id === sessionId) ?? null;
}

export default function OpenTabsView({ projects, processingTabIds, onActivate }: OpenTabsViewProps) {
  const { t } = useTranslation('sidebar');
  const { tabs, activeTabId } = useTabsStore();

  const rows: RowData[] = useMemo(() => {
    return tabs.map((tab) => {
      const project = projects.find((p) => p.name === tab.projectName) ?? null;
      let updatedAt: string | null = null;
      if (project && tab.sessionId && tab.provider) {
        const s = findSession(project, tab.sessionId, tab.provider);
        const raw = s?.updated_at || s?.createdAt;
        updatedAt = typeof raw === 'string' ? raw : null;
      }
      return {
        tab,
        project,
        updatedAt,
        isProcessing: processingTabIds?.has(tab.id) ?? false,
      };
    });
  }, [tabs, projects, processingTabIds]);

  const processingCount = rows.filter((r) => r.isProcessing).length;

  const handleClose = useCallback((id: string) => closeTab(id), []);

  if (tabs.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <Activity className="mb-4 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">{t('openTabs.empty')}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {t('openTabs.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {t('openTabs.count', { count: tabs.length })}
          </span>
          {processingCount > 0 && (
            <span className="rounded-full bg-[color:var(--heritage-a,#F5D000)]/20 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--heritage-a,#F5D000)]">
              {t('openTabs.runningCount', { count: processingCount })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('openTabs.closeAllConfirm'))) closeAllTabs();
          }}
          className="rounded px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {t('openTabs.closeAll')}
        </button>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/30 overflow-y-auto">
        {rows.map(({ tab, project, updatedAt, isProcessing }) => {
          const isActive = tab.id === activeTabId;
          const KindIcon = tab.viewTab === 'shell' || tab.kind === 'shell' ? TerminalSquare : MessageSquare;
          const projectTitle = project?.displayName || project?.name || tab.projectName;
          const sessionLabel = tab.sessionId
            ? tab.title.split(' • ').slice(1).join(' • ') || tab.sessionId.slice(0, 8)
            : t('openTabs.newSession');

          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onActivate(tab)}
                className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40 ${
                  isActive ? 'bg-muted/20' : ''
                }`}
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                  <KindIcon className="h-4 w-4 text-muted-foreground" />
                  {isProcessing && (
                    <span
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--heritage-a,#F5D000)] ring-2 ring-background"
                      aria-label={t('openTabs.running')}
                    />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{projectTitle}</span>
                    {tab.kind === 'shell' && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        shell
                      </span>
                    )}
                    {tab.provider && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {tab.provider}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{sessionLabel}</span>
                    <span>·</span>
                    <span className="shrink-0 tabular-nums">{formatRelative(updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:text-foreground" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose(tab.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={t('openTabs.closeTab')}
                    title={t('openTabs.close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
