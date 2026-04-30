import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Globe, FolderTree, Search, X, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjectSettingsApi, type SkillsCatalog, type CatalogSkill } from '../../../project-settings/hooks/useProjectSettingsApi';

type Scope = 'global' | 'project';

type FlatSkill = CatalogSkill & { scope: Scope };

export default function SkillsView() {
  const { t } = useTranslation('sidebar');
  const api = useProjectSettingsApi();
  const [catalog, setCatalog] = useState<SkillsCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | Scope>('all');

  useEffect(() => {
    let cancelled = false;
    api.getSkillsCatalog()
      .then((data) => { if (!cancelled) setCatalog(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [api]);

  const flat: FlatSkill[] = useMemo(() => {
    if (!catalog) return [];
    return [
      ...catalog.global.skills.map((s) => ({ ...s, scope: 'global' as Scope })),
      ...catalog.project.skills.map((s) => ({ ...s, scope: 'project' as Scope })),
    ];
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flat.filter((s) => {
      if (scope !== 'all' && s.scope !== scope) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q)
        || (s.description?.toLowerCase().includes(q) ?? false);
    });
  }, [flat, query, scope]);

  const counts = useMemo(() => ({
    all: flat.length,
    global: flat.filter((s) => s.scope === 'global').length,
    project: flat.filter((s) => s.scope === 'project').length,
  }), [flat]);

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-sm text-destructive">
        <AlertCircle className="mr-2 h-4 w-4" /> {error}
      </div>
    );
  }
  if (!catalog) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('content.loading', { defaultValue: 'Caricamento…' })}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-border/40 bg-muted/20 px-4 py-3 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca skill per nome o descrizione…"
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Pulisci"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'global', 'project'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-full border px-2.5 py-0.5 transition ${
                scope === s
                  ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)]/15 font-semibold text-foreground'
                  : 'border-border/60 text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {s === 'all' ? 'Tutte' : s === 'global' ? 'Globali' : 'Per progetto'}
              <span className="ml-1 tabular-nums opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <code className="truncate font-mono">{catalog.global.dir}</code>
            {!catalog.global.exists && <span className="text-destructive">(dir non trovata)</span>}
          </span>
          <span className="flex items-center gap-1">
            <FolderTree className="h-3 w-3" />
            <code className="truncate font-mono">{catalog.project.dir}</code>
            {!catalog.project.exists && <span className="text-destructive">(dir non trovata)</span>}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-sm text-muted-foreground">
          {query ? `Nessun risultato per "${query}"` : 'Nessuna skill trovata'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map((s) => (
            <div
              key={`${s.scope}:${s.name}`}
              className="grid w-full grid-cols-[44px_1fr_auto] items-start gap-3 border-b border-border/30 px-4 py-3 text-left sm:px-6"
            >
              <div className="border-[color:var(--heritage-a,#F5D000)]/40 bg-[color:var(--heritage-a,#F5D000)]/10 flex h-10 w-10 items-center justify-center rounded-lg border">
                <Sparkles className="h-5 w-5 text-[color:var(--heritage-a,#F5D000)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                </div>
                {s.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">{s.fullPath}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                  s.scope === 'global'
                    ? 'border-blue-400/40 bg-blue-400/10 text-blue-600 dark:text-blue-300'
                    : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {s.scope === 'global' ? 'globale' : 'per-progetto'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
