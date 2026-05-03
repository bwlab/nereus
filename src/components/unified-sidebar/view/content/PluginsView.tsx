import { useEffect, useMemo, useState } from 'react';
import { Puzzle, Search, X, Loader2, AlertCircle, Store, FolderTree, ExternalLink, Bot, Terminal, Sparkles, Webhook, Plug, Power, Trash2 } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';

interface ClaudePlugin {
  fullName: string;
  name: string;
  marketplace: string | null;
  scope: string | null;
  version: string | null;
  installPath: string | null;
  installedAt: string | null;
  lastUpdated: string | null;
  gitCommitSha: string | null;
  description: string | null;
  author: string | null;
  authorEmail: string | null;
  homepage: string | null;
  license: string | null;
  keywords?: string[];
  manifestFile: string | null;
  counts?: { agents: number; commands: number; skills: number; hooks: number; mcp: number };
  enabled?: boolean;
  exists: boolean;
}

interface ClaudeMarketplace {
  name: string;
  source: { source?: string; repo?: string } | null;
  installLocation: string | null;
  lastUpdated: string | null;
  exists: boolean;
}

interface Catalog {
  dir: string;
  exists: boolean;
  marketplacesDir: string;
  plugins: ClaudePlugin[];
  marketplaces: ClaudeMarketplace[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function PluginsView() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [marketplace, setMarketplace] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    try {
      const r = await authenticatedFetch('/api/claude-plugins/catalog');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCatalog(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { reload(); }, []);

  const runAction = async (action: 'enable' | 'disable' | 'uninstall', fullName: string, scope?: string | null) => {
    if (action === 'uninstall' && !confirm(`Disinstallare "${fullName}"?`)) return;
    setBusy(`${action}:${fullName}`);
    setError(null);
    try {
      const r = await authenticatedFetch('/api/claude-plugins/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, fullName, scope: scope || 'user' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.details || j.error || `HTTP ${r.status}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const marketplaceOptions = useMemo(() => {
    if (!catalog) return [] as string[];
    const set = new Set<string>();
    for (const p of catalog.plugins) if (p.marketplace) set.add(p.marketplace);
    return Array.from(set).sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [] as ClaudePlugin[];
    const q = query.trim().toLowerCase();
    return catalog.plugins.filter((p) => {
      if (marketplace !== 'all' && p.marketplace !== marketplace) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q)
        || (p.description?.toLowerCase().includes(q) ?? false)
        || (p.marketplace?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [catalog, query, marketplace]);

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
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento…
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
            placeholder="Cerca plugin per nome, descrizione o marketplace…"
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
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setMarketplace('all')}
            className={`rounded-full border px-2.5 py-0.5 transition ${
              marketplace === 'all'
                ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)]/15 font-semibold text-foreground'
                : 'border-border/60 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            Tutti
            <span className="ml-1 tabular-nums opacity-70">{catalog.plugins.length}</span>
          </button>
          {marketplaceOptions.map((m) => {
            const c = catalog.plugins.filter((p) => p.marketplace === m).length;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMarketplace(m)}
                className={`rounded-full border px-2.5 py-0.5 transition ${
                  marketplace === m
                    ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)]/15 font-semibold text-foreground'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {m}
                <span className="ml-1 tabular-nums opacity-70">{c}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderTree className="h-3 w-3" />
            <code className="truncate font-mono">{catalog.dir}</code>
            {!catalog.exists && <span className="text-destructive">(dir non trovata)</span>}
          </span>
          {catalog.marketplaces.length > 0 && (
            <span className="flex items-center gap-1">
              <Store className="h-3 w-3" />
              <span>
                {catalog.marketplaces.length} marketplace:
                {' '}
                {catalog.marketplaces.map((m) => m.name).join(', ')}
              </span>
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-sm text-muted-foreground">
          {query ? `Nessun risultato per "${query}"` : 'Nessun plugin installato'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={`${p.fullName}:${p.installPath}`}
              className="grid w-full grid-cols-[44px_1fr_auto] items-start gap-3 border-b border-border/30 px-4 py-3 text-left sm:px-6"
            >
              <div className="border-[color:var(--heritage-a,#F5D000)]/40 bg-[color:var(--heritage-a,#F5D000)]/10 flex h-10 w-10 items-center justify-center rounded-lg border">
                <Puzzle className="h-5 w-5 text-[color:var(--heritage-a,#F5D000)]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  {p.version && (
                    <span className="rounded border border-border/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                      v{p.version}
                    </span>
                  )}
                  {p.license && (
                    <span className="rounded border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground">
                      {p.license}
                    </span>
                  )}
                  {!p.exists && (
                    <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-px text-[10px] text-destructive">
                      mancante
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                )}
                {p.counts && (p.counts.agents + p.counts.commands + p.counts.skills + p.counts.hooks + p.counts.mcp) > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {p.counts.agents > 0 && (
                      <span className="flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-px">
                        <Bot className="h-3 w-3" /> {p.counts.agents} agent{p.counts.agents > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.counts.commands > 0 && (
                      <span className="flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-px">
                        <Terminal className="h-3 w-3" /> {p.counts.commands} cmd
                      </span>
                    )}
                    {p.counts.skills > 0 && (
                      <span className="flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-px">
                        <Sparkles className="h-3 w-3" /> {p.counts.skills} skill{p.counts.skills > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.counts.hooks > 0 && (
                      <span className="flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-px">
                        <Webhook className="h-3 w-3" /> {p.counts.hooks} hook{p.counts.hooks > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.counts.mcp > 0 && (
                      <span className="flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-px">
                        <Plug className="h-3 w-3" /> mcp
                      </span>
                    )}
                  </div>
                )}
                {p.keywords && p.keywords.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {p.keywords.slice(0, 8).map((k) => (
                      <span key={k} className="rounded-full bg-muted/40 px-1.5 py-px text-muted-foreground">#{k}</span>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/80">
                  {p.marketplace && (
                    <span className="flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      {p.marketplace}
                    </span>
                  )}
                  {p.scope && <span>scope: {p.scope}</span>}
                  {p.author && (
                    <span title={p.authorEmail || undefined}>autore: {p.author}</span>
                  )}
                  <span>installato: {formatDate(p.installedAt)}</span>
                  {p.lastUpdated && p.lastUpdated !== p.installedAt && (
                    <span>aggiornato: {formatDate(p.lastUpdated)}</span>
                  )}
                  {p.homepage && (
                    <a
                      href={p.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      homepage
                    </a>
                  )}
                </div>
                {p.installPath && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70" title={p.manifestFile ? `manifest: ${p.manifestFile}` : undefined}>
                    {p.installPath}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy === `${p.enabled ? 'disable' : 'enable'}:${p.fullName}`}
                    onClick={() => runAction(p.enabled ? 'disable' : 'enable', p.fullName, p.scope)}
                    title={p.enabled ? 'Disabilita' : 'Abilita'}
                    className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition disabled:opacity-50 ${
                      p.enabled
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700 hover:bg-emerald-400/20 dark:text-emerald-300'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {busy === `${p.enabled ? 'disable' : 'enable'}:${p.fullName}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Power className="h-3 w-3" />
                    )}
                    {p.enabled ? 'On' : 'Off'}
                  </button>
                  {p.marketplace !== 'claude-plugins-official' && (
                    <button
                      type="button"
                      disabled={busy === `uninstall:${p.fullName}`}
                      onClick={() => runAction('uninstall', p.fullName, p.scope)}
                      title="Disinstalla"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {busy === `uninstall:${p.fullName}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                {p.gitCommitSha && (
                  <span
                    className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    title={p.gitCommitSha}
                  >
                    {p.gitCommitSha.slice(0, 7)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
