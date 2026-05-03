import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Save, Eye, Pencil, Sparkles, Check } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';
import MarkdownPreview from '../../../code-editor/view/subcomponents/markdown/MarkdownPreview';

interface SkillEditorDialogProps {
  skillName: string;
  skillDir: string;
  scope: 'global' | 'project';
  onClose: () => void;
}

type Mode = 'view' | 'edit';

export default function SkillEditorDialog({ skillName, skillDir, scope, onClose }: SkillEditorDialogProps) {
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/project-skills/skill-file?dir=${encodeURIComponent(skillDir)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as { content: string; modifiedAt: string };
      })
      .then((j) => {
        if (cancelled) return;
        setContent(j.content);
        setOriginal(j.content);
        setSavedAt(j.modifiedAt);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [skillDir]);

  const dirty = content !== null && content !== original;

  const save = async () => {
    if (content === null) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authenticatedFetch('/api/project-skills/skill-file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: skillDir, content }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setOriginal(content);
      setSavedAt(j.modifiedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-[90vw] max-w-[1280px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-[color:var(--heritage-a,#F5D000)]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{skillName}</span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[10px] ${
                    scope === 'global'
                      ? 'border-blue-400/40 bg-blue-400/10 text-blue-600 dark:text-blue-300'
                      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300'
                  }`}
                >
                  {scope === 'global' ? 'globale' : 'per-progetto'}
                </span>
                {dirty && (
                  <span className="rounded-full bg-[color:var(--heritage-b,#E30613)]/15 px-1.5 py-px text-[10px] text-[color:var(--heritage-b,#E30613)]">
                    non salvato
                  </span>
                )}
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">{skillDir}/SKILL.md</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="mr-1 flex rounded-md border border-border bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('view')}
                className={`flex items-center gap-1 rounded px-2 py-1 ${mode === 'view' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Eye className="h-3.5 w-3.5" /> Anteprima
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`flex items-center gap-1 rounded px-2 py-1 ${mode === 'edit' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Pencil className="h-3.5 w-3.5" /> Modifica
              </button>
            </div>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="flex items-center gap-1 rounded-md border border-border bg-[color:var(--heritage-a,#F5D000)] px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : dirty ? <Save className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {saving ? 'Salvataggio…' : dirty ? 'Salva' : 'Salvato'}
            </button>
            <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Chiudi">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {content === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : mode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-background p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
          />
        ) : (
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="prose prose-base mx-auto max-w-5xl px-10 py-8 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mb-4 prose-h1:mt-2 prose-h1:text-2xl prose-h2:mb-3 prose-h2:mt-6 prose-h2:text-xl prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-1 prose-h3:mb-2 prose-h3:mt-4 prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-li:my-0.5 prose-hr:my-6 prose-blockquote:not-italic prose-img:rounded-lg">
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
          <span>{content?.length ?? 0} caratteri</span>
          {savedAt && <span>Ultima modifica: {new Date(savedAt).toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}
