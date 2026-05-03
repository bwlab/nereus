import { useEffect, useMemo, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, Puzzle, Store, Plus, Trash2, Check } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';

interface MarketplacePlugin {
  name: string;
  description: string | null;
  author: string | null;
  category: string | null;
  homepage: string | null;
  source: unknown;
}

interface MarketplaceEntry {
  name: string;
  description: string | null;
  owner: string | null;
  plugins: MarketplacePlugin[];
}

interface ProjectSettings {
  file: string;
  enabledPlugins: Record<string, boolean>;
  extraKnownMarketplaces: Record<string, { source: { source: string; repo?: string; url?: string } }>;
}

interface ProjectPluginsDialogProps {
  projectName: string;
  projectDisplayName: string;
  onClose: () => void;
}

type Tab = 'global' | 'plugins' | 'marketplaces';

interface InstalledPlugin {
  fullName: string;
  name: string;
  marketplace: string | null;
  scope: string | null;
  description: string | null;
  enabled?: boolean;
}

export default function ProjectPluginsDialog({ projectName, projectDisplayName, onClose }: ProjectPluginsDialogProps) {
  const [tab, setTab] = useState<Tab>('global');
  const [marketplaces, setMarketplaces] = useState<MarketplaceEntry[] | null>(null);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [installed, setInstalled] = useState<InstalledPlugin[] | null>(null);
  const [installedSet, setInstalledSet] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [newMpName, setNewMpName] = useState('');
  const [newMpRepo, setNewMpRepo] = useState('');

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        authenticatedFetch('/api/claude-plugins/marketplaces'),
        authenticatedFetch(`/api/claude-plugins/project/${encodeURIComponent(projectName)}/settings`),
        authenticatedFetch('/api/claude-plugins/catalog'),
      ]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      const j3 = await r3.json();
      if (!r1.ok) throw new Error(j1.error || 'Errore caricamento marketplaces');
      if (!r2.ok) throw new Error(j2.error || 'Errore caricamento settings');
      if (!r3.ok) throw new Error(j3.error || 'Errore caricamento catalog');
      setMarketplaces(j1.marketplaces || []);
      setSettings({
        file: j2.file,
        enabledPlugins: j2.enabledPlugins || {},
        extraKnownMarketplaces: j2.extraKnownMarketplaces || {},
      });
      const list: InstalledPlugin[] = (j3.plugins || []).map((p: InstalledPlugin) => p);
      setInstalled(list);
      setInstalledSet(new Set<string>(list.map((p) => p.fullName)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectName]);

  useEffect(() => { reload(); }, [reload]);

  const allPlugins = useMemo(() => {
    if (!marketplaces) return [] as Array<MarketplacePlugin & { marketplace: string; fullName: string }>;
    const out: Array<MarketplacePlugin & { marketplace: string; fullName: string }> = [];
    for (const m of marketplaces) for (const p of m.plugins) {
      out.push({ ...p, marketplace: m.name, fullName: `${p.name}@${m.name}` });
    }
    return out;
  }, [marketplaces]);

  const browsable = useMemo(() => {
    if (!installedSet) return allPlugins;
    return allPlugins.filter((p) => !installedSet.has(p.fullName));
  }, [allPlugins, installedSet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return browsable.filter((p) => {
      if (marketFilter !== 'all' && p.marketplace !== marketFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || (p.description?.toLowerCase().includes(q) ?? false)
        || (p.category?.toLowerCase().includes(q) ?? false);
    });
  }, [browsable, query, marketFilter]);

  const setPluginValue = useCallback(async (fullName: string, value: boolean | null) => {
    setBusy(fullName);
    setError(null);
    try {
      const r = await authenticatedFetch(`/api/claude-plugins/project/${encodeURIComponent(projectName)}/plugin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSettings((prev) => prev ? { ...prev, enabledPlugins: j.enabledPlugins } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [projectName]);

  const togglePlugin = useCallback((fullName: string, enabled: boolean) => {
    return setPluginValue(fullName, enabled ? true : null);
  }, [setPluginValue]);

  const addMarketplace = useCallback(async () => {
    if (!newMpName.trim() || !newMpRepo.trim()) return;
    setBusy('add-mp');
    setError(null);
    try {
      const repo = newMpRepo.trim();
      const isUrl = repo.includes('://') || repo.startsWith('git@');
      const source = isUrl
        ? { source: 'git', url: repo }
        : { source: 'github', repo };
      const r = await authenticatedFetch(`/api/claude-plugins/project/${encodeURIComponent(projectName)}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMpName.trim(), source }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSettings((prev) => prev ? { ...prev, extraKnownMarketplaces: j.extraKnownMarketplaces } : prev);
      setNewMpName(''); setNewMpRepo('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [projectName, newMpName, newMpRepo]);

  const removeMarketplace = useCallback(async (name: string) => {
    if (!confirm(`Rimuovere marketplace "${name}" dal progetto?`)) return;
    setBusy(`del-${name}`);
    setError(null);
    try {
      const r = await authenticatedFetch(`/api/claude-plugins/project/${encodeURIComponent(projectName)}/marketplace/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSettings((prev) => prev ? { ...prev, extraKnownMarketplaces: j.extraKnownMarketplaces } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [projectName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Puzzle className="h-5 w-5 shrink-0 text-[color:var(--heritage-a,#F5D000)]" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Plugin progetto · {projectDisplayName}</div>
              {settings && (
                <div className="truncate font-mono text-[10px] text-muted-foreground">{settings.file}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-border bg-muted/20 px-2">
          {([['global', 'Globali'], ['plugins', 'Sfoglia'], ['marketplaces', 'Marketplace']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm transition ${
                tab === k
                  ? 'border-b-2 border-[color:var(--heritage-a,#F5D000)] font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {!marketplaces || !settings || !installed ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : tab === 'global' ? (
          <GlobalTab
            installed={installed}
            projectSettings={settings.enabledPlugins}
            onSetValue={setPluginValue}
            busy={busy}
          />
        ) : tab === 'plugins' ? (
          <PluginsTab
            filtered={filtered}
            allCount={browsable.length}
            marketplaces={marketplaces}
            marketFilter={marketFilter}
            setMarketFilter={setMarketFilter}
            query={query}
            setQuery={setQuery}
            enabled={settings.enabledPlugins}
            onToggle={togglePlugin}
            busy={busy}
          />
        ) : (
          <MarketplacesTab
            marketplaces={marketplaces}
            extra={settings.extraKnownMarketplaces}
            newMpName={newMpName}
            newMpRepo={newMpRepo}
            setNewMpName={setNewMpName}
            setNewMpRepo={setNewMpRepo}
            onAdd={addMarketplace}
            onRemove={removeMarketplace}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}

function GlobalTab({
  installed, projectSettings, onSetValue, busy,
}: {
  installed: InstalledPlugin[];
  projectSettings: Record<string, boolean>;
  onSetValue: (fullName: string, value: boolean | null) => void;
  busy: string | null;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return installed.filter((p) => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || (p.description?.toLowerCase().includes(q) ?? false);
    });
  }, [installed, query]);

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border/40 bg-muted/20 px-4 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca tra i plugin globali installati…"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-[10px] text-muted-foreground">
          Plugin user-scope. Disabilitarli scrive <code>false</code> in <code>.claude/settings.json</code> del progetto (override locale, l'installazione globale resta).
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {installed.length === 0 ? 'Nessun plugin installato globalmente' : 'Nessun risultato'}
          </div>
        ) : (
          filtered.map((p) => {
            const explicit = Object.prototype.hasOwnProperty.call(projectSettings, p.fullName)
              ? projectSettings[p.fullName]
              : undefined;
            const active = explicit !== false;
            const isBusy = busy === p.fullName;
            return (
              <div key={p.fullName} className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-border/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    {explicit === false && (
                      <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px text-[10px] text-destructive">
                        disabilitato per progetto
                      </span>
                    )}
                    {explicit === true && (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-px text-[10px] text-emerald-700 dark:text-emerald-300">
                        forzato per progetto
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSetValue(p.fullName, active ? false : null)}
                    className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition disabled:opacity-50 ${
                      active
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700 hover:bg-emerald-400/20 dark:text-emerald-300'
                        : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
                    }`}
                    title={active ? 'Disabilita per progetto' : 'Riabilita (rimuovi override)'}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {active ? 'Attivo' : 'Disabilitato'}
                  </button>
                  {explicit !== undefined && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onSetValue(p.fullName, null)}
                      className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
                      title="Rimuovi override (eredita da user)"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function PluginsTab({
  filtered, allCount, marketplaces, marketFilter, setMarketFilter, query, setQuery, enabled, onToggle, busy,
}: {
  filtered: Array<MarketplacePlugin & { marketplace: string; fullName: string }>;
  allCount: number;
  marketplaces: MarketplaceEntry[];
  marketFilter: string;
  setMarketFilter: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  enabled: Record<string, boolean>;
  onToggle: (fullName: string, enabled: boolean) => void;
  busy: string | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/20 px-4 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca plugin…"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setMarketFilter('all')}
            className={`rounded-full border px-2 py-0.5 ${marketFilter === 'all' ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)]/15 font-semibold' : 'border-border/60 text-muted-foreground'}`}
          >
            Tutti <span className="opacity-70">{allCount}</span>
          </button>
          {marketplaces.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setMarketFilter(m.name)}
              className={`rounded-full border px-2 py-0.5 ${marketFilter === m.name ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)]/15 font-semibold' : 'border-border/60 text-muted-foreground'}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nessun plugin</div>
        ) : (
          filtered.map((p) => {
            const isOn = !!enabled[p.fullName];
            const isBusy = busy === p.fullName;
            return (
              <div key={p.fullName} className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-border/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    <span className="rounded-full border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground">
                      <Store className="mr-0.5 inline h-2.5 w-2.5" />{p.marketplace}
                    </span>
                    {p.category && (
                      <span className="rounded-full border border-border/60 bg-muted/30 px-1.5 py-px text-[10px] text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                  {p.author && <p className="mt-0.5 text-[10px] text-muted-foreground/70">by {p.author}</p>}
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onToggle(p.fullName, !isOn)}
                  className={`flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    isOn
                      ? 'border-[color:var(--heritage-a,#F5D000)] bg-[color:var(--heritage-a,#F5D000)] text-black'
                      : 'border-border bg-background hover:bg-muted'
                  } ${isBusy ? 'opacity-50' : ''}`}
                >
                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : isOn ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {isOn ? 'Abilitato' : 'Abilita'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function MarketplacesTab({
  marketplaces, extra, newMpName, newMpRepo, setNewMpName, setNewMpRepo, onAdd, onRemove, busy,
}: {
  marketplaces: MarketplaceEntry[];
  extra: ProjectSettings['extraKnownMarketplaces'];
  newMpName: string;
  newMpRepo: string;
  setNewMpName: (v: string) => void;
  setNewMpRepo: (v: string) => void;
  onAdd: () => void;
  onRemove: (name: string) => void;
  busy: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/20 px-4 py-3">
        <div className="text-xs font-semibold text-foreground">Aggiungi marketplace al progetto</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newMpName}
            onChange={(e) => setNewMpName(e.target.value)}
            placeholder="nome (es. obsidian-skills)"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            value={newMpRepo}
            onChange={(e) => setNewMpRepo(e.target.value)}
            placeholder="org/repo o URL git"
            className="flex-[2] rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            disabled={busy === 'add-mp' || !newMpName.trim() || !newMpRepo.trim()}
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md border border-border bg-[color:var(--heritage-a,#F5D000)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
          >
            {busy === 'add-mp' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Aggiungi
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Schema: `org/repo` → github source. URL completa → git source. Salvato in <code>.claude/settings.json</code> sotto <code>extraKnownMarketplaces</code>.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.keys(extra).length > 0 && (
          <div className="border-b border-border/40">
            <div className="bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Marketplace progetto
            </div>
            {Object.entries(extra).map(([name, val]) => (
              <div key={name} className="flex items-center justify-between border-b border-border/30 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold">{name}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {val.source.source}: {val.source.repo || val.source.url}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === `del-${name}`}
                  onClick={() => onRemove(name)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label="Rimuovi"
                >
                  {busy === `del-${name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Marketplace globali ({marketplaces.length})
        </div>
        {marketplaces.map((m) => (
          <div key={m.name} className="border-b border-border/30 px-4 py-2 text-sm">
            <div className="font-semibold">{m.name}</div>
            {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">{m.plugins.length} plugin disponibili</div>
          </div>
        ))}
      </div>
    </div>
  );
}
