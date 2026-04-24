import { useEffect, useState } from 'react';
import { X, Pencil, FileText, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';
import MarkdownPreview from '../../../code-editor/view/subcomponents/markdown/MarkdownPreview';

type ClaudeMdScope = 'user' | 'ancestor' | 'project' | 'local';

type ClaudeMdFile = {
  scope: ClaudeMdScope;
  path: string;
  size: number;
  content: string;
  modifiedAt: string;
};

interface ClaudeMdViewerDialogProps {
  projectName: string;
  projectDisplayName: string;
  onClose: () => void;
}

const SCOPE_LABEL: Record<ClaudeMdScope, string> = {
  user: 'user',
  ancestor: 'ancestor',
  project: 'project',
  local: 'local',
};

const SCOPE_COLOR: Record<ClaudeMdScope, string> = {
  user: 'bg-[color:var(--heritage-a,#F5D000)]/20 text-[color:var(--heritage-a,#F5D000)]',
  ancestor: 'bg-muted text-muted-foreground',
  project: 'bg-[color:var(--heritage-b,#E30613)]/15 text-[color:var(--heritage-b,#E30613)]',
  local: 'bg-primary/15 text-primary',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClaudeMdViewerDialog({ projectName, projectDisplayName, onClose }: ClaudeMdViewerDialogProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [files, setFiles] = useState<ClaudeMdFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch(`/api/projects/${encodeURIComponent(projectName)}/claude-md`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { files: ClaudeMdFile[] };
        if (cancelled) return;
        setFiles(data.files ?? []);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Errore');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="truncate text-sm font-semibold">
              Contesto CLAUDE.md — {projectDisplayName}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent" aria-label="Chiudi">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Caricamento…
            </div>
          )}
          {status === 'error' && (
            <div className="py-8 text-center text-sm text-[color:var(--heritage-b,#E30613)]">
              Errore nel caricamento: {errorMsg}
            </div>
          )}
          {status === 'ready' && files.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nessun file CLAUDE.md trovato per questo progetto.
            </div>
          )}
          {status === 'ready' && files.length > 0 && (
            <div className="space-y-4">
              {files.map((file) => (
                <section
                  key={file.path}
                  className="group relative rounded-lg border border-border bg-background"
                >
                  <header className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SCOPE_COLOR[file.scope]}`}>
                      {SCOPE_LABEL[file.scope]}
                    </span>
                    <code className="flex-1 truncate text-xs text-muted-foreground" title={file.path}>
                      {file.path}
                    </code>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatSize(file.size)}</span>
                  </header>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-10 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    aria-label="Modifica (prossimamente)"
                    title="Modifica (prossimamente)"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <div className="prose prose-sm max-w-none px-4 py-3 text-sm dark:prose-invert">
                    <MarkdownPreview content={file.content} />
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
