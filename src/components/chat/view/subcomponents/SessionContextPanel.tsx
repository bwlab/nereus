import { useState, useEffect } from 'react';
import { X, FileText, ChevronDown, ChevronRight, Loader2, AlertCircle, User, Folder, Lock, Info, MessageSquare } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';
import { Markdown } from './Markdown';

type ClaudeMdFile = {
  scope: 'user' | 'project' | 'local';
  path: string;
  size: number;
  content: string | null;
  modifiedAt: string | null;
  exists: boolean;
};

type UserMessage = {
  role: string;
  text: string;
  createdAt: string | null;
};

type SessionContextData = {
  sessionId: string;
  projectPath: string | null;
  jsonlPath: string | null;
  claudeMdFiles: ClaudeMdFile[];
  firstUserMessage: UserMessage | null;
};

type SessionContextPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  projectPath: string | null;
};

function formatBytes(n: number): string {
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const scopeMeta: Record<ClaudeMdFile['scope'], { label: string; icon: typeof User; color: string }> = {
  user: { label: 'User', icon: User, color: 'text-primary' },
  project: { label: 'Project', icon: Folder, color: 'text-green-500' },
  local: { label: 'Local', icon: Lock, color: 'text-amber-500' },
};

export default function SessionContextPanel({ isOpen, onClose, sessionId, projectPath }: SessionContextPanelProps) {
  const [data, setData] = useState<SessionContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(true);
  const [userMsgExpanded, setUserMsgExpanded] = useState(true);

  useEffect(() => {
    if (!isOpen || !sessionId) return;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const url = `/api/session-context/${sessionId}?${params.toString()}`;

    authenticatedFetch(url)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result);
        } else {
          setError(result.error || 'Errore sconosciuto');
        }
      })
      .catch((err) => {
        console.error('Failed to load session context:', err);
        setError(err?.message || 'Errore di rete');
      })
      .finally(() => setLoading(false));
  }, [isOpen, sessionId, projectPath]);

  const toggleScope = (scope: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Contesto sessione</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* System prompt (ricostruito) */}
              <section>
                <button
                  type="button"
                  onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {systemPromptExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <h3 className="text-sm font-semibold text-foreground">System prompt (ricostruito)</h3>
                </button>

                {systemPromptExpanded && (
                  <>
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        Il <strong>system prompt preset di Claude Code</strong> (~5-10 kB di istruzioni tool) non è leggibile direttamente.
                        Mostriamo i file <strong>CLAUDE.md</strong> concatenati a quel preset dall&apos;SDK secondo <code className="rounded bg-muted px-1 py-0.5 text-[10px]">settingSources: [project, user, local]</code>.
                      </span>
                    </div>

                    <div className="space-y-2">
                      {data.claudeMdFiles.map((file) => {
                        const meta = scopeMeta[file.scope];
                        const ScopeIcon = meta.icon;
                        const isExpanded = expandedScopes.has(file.scope);

                        return (
                          <div key={file.scope} className={`rounded-lg border ${file.exists ? 'border-border bg-card' : 'border-dashed border-border/50 bg-muted/10'}`}>
                            <button
                              type="button"
                              onClick={() => file.exists && toggleScope(file.scope)}
                              disabled={!file.exists}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left"
                            >
                              {file.exists && (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
                              <ScopeIcon className={`h-4 w-4 ${meta.color}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{meta.label}</span>
                                  {file.exists ? (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      {formatBytes(file.size)}
                                    </span>
                                  ) : (
                                    <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      non presente
                                    </span>
                                  )}
                                </div>
                                <p className="truncate font-mono text-[10px] text-muted-foreground">{file.path}</p>
                              </div>
                            </button>

                            {file.exists && isExpanded && file.content && (
                              <div className="max-h-96 overflow-auto border-t border-border/50 bg-background p-3 text-sm">
                                <Markdown>{file.content}</Markdown>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              {/* First user message */}
              <section>
                <button
                  type="button"
                  onClick={() => setUserMsgExpanded(!userMsgExpanded)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {userMsgExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Primo messaggio della sessione</h3>
                  {data.firstUserMessage && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {data.firstUserMessage.role}
                    </span>
                  )}
                </button>

                {userMsgExpanded && (
                  data.firstUserMessage && typeof data.firstUserMessage.text === 'string' ? (
                    <div className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-3 text-sm">
                      <Markdown>{data.firstUserMessage.text}</Markdown>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                      Nessun messaggio iniziale trovato nel log
                    </p>
                  )
                )}
              </section>

              {/* Metadata footer */}
              <section className="rounded-lg border border-border/50 bg-muted/20 p-3 text-[10px] font-mono text-muted-foreground">
                {data.jsonlPath && <p className="truncate">log: {data.jsonlPath}</p>}
                {data.projectPath && <p className="truncate">cwd: {data.projectPath}</p>}
                <p className="truncate">sid: {data.sessionId}</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
