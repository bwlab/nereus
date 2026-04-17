import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArchiveRestore, Trash2, Clock } from 'lucide-react';
import type { ProjectSession, SessionProvider } from '../../../types/app';
import { api } from '../../../utils/api';
import { formatTimeAgo } from '../../../utils/dateUtils';
import SessionProviderLogo from '../../llm-logo-provider/SessionProviderLogo';

type ArchivedSessionsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  archivedSessions: ProjectSession[];
  onUnarchive: (sessionId: string) => void | Promise<void>;
  onDeleted: (sessionId: string) => void;
};

export default function ArchivedSessionsDrawer({
  isOpen,
  onClose,
  projectName,
  archivedSessions,
  onUnarchive,
  onDeleted,
}: ArchivedSessionsDrawerProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDelete = async (session: ProjectSession) => {
    const title = String(session.summary || session.title || session.name || session.id);
    if (!window.confirm(`Eliminare definitivamente "${title}"? Questa azione non è reversibile.`)) return;
    const provider = (session.__provider || 'claude') as SessionProvider;
    try {
      let res;
      if (provider === 'codex') res = await api.deleteCodexSession(session.id);
      else if (provider === 'gemini') res = await api.deleteGeminiSession(session.id);
      else res = await api.deleteSession(projectName, session.id);
      if (res.ok) onDeleted(session.id);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Chiudi"
        className="flex-1 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sessioni archiviate</h3>
            <p className="text-xs text-muted-foreground">
              {archivedSessions.length} {archivedSessions.length === 1 ? 'sessione' : 'sessioni'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {archivedSessions.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">Nessuna sessione archiviata.</p>
          ) : (
            <ul className="space-y-2">
              {archivedSessions.map((session) => {
                const title = String(session.summary || session.title || session.name || session.id);
                const timestamp = session.lastActivity || session.updated_at || session.createdAt || session.created_at;
                const provider = (session.__provider || 'claude') as SessionProvider;
                return (
                  <li
                    key={session.id}
                    className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-card/80"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <SessionProviderLogo provider={provider} className="mt-0.5 h-4 w-4 shrink-0" />
                      <h4 className="flex-1 truncate text-sm font-medium text-foreground">{title}</h4>
                    </div>
                    {timestamp && (
                      <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(String(timestamp), now, t)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onUnarchive(session.id)}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="Ripristina nel kanban"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        <span>Ripristina</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(session)}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
                        title="Elimina definitivamente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Elimina</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
