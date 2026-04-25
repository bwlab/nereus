import { useEffect, useMemo, useState } from 'react';
import { X, Search, Folder, LayoutDashboard, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FullWorkspace } from '../../../dashboard/types/dashboard';

interface FolderOption {
  raccoglitoreId: number;
  dashboardId: number;
  dashboardName: string;
  path: string[]; // ordered folder names from root to leaf
  depth: number;
}

interface FolderPickerDialogProps {
  title?: string;
  workspace: FullWorkspace | null;
  onPick: (raccoglitoreId: number) => void;
  onClose: () => void;
  /** Folder ids to which the subject is already assigned (shown with checkmark). */
  assignedIds?: Set<number>;
  /** Multi-select mode: clicking a row toggles assignment and keeps dialog open. */
  multi?: boolean;
}

function buildFolderOptions(workspace: FullWorkspace | null): FolderOption[] {
  if (!workspace) return [];
  const { dashboards, raccoglitori } = workspace;
  const byId = new Map<number, typeof raccoglitori[number]>();
  for (const r of raccoglitori) byId.set(r.id, r);
  const pathCache = new Map<number, string[]>();
  const resolvePath = (id: number, visited: Set<number> = new Set()): string[] => {
    const cached = pathCache.get(id);
    if (cached) return cached;
    if (visited.has(id)) return []; // cycle guard
    visited.add(id);
    const r = byId.get(id);
    if (!r) return [];
    const parent = r.parent_id != null ? resolvePath(r.parent_id, visited) : [];
    const out = [...parent, r.name];
    pathCache.set(id, out);
    return out;
  };
  const dashboardName = new Map<number, string>(dashboards.map((d) => [d.id, d.name]));
  const options: FolderOption[] = raccoglitori.map((r) => ({
    raccoglitoreId: r.id,
    dashboardId: r.dashboard_id,
    dashboardName: dashboardName.get(r.dashboard_id) ?? `#${r.dashboard_id}`,
    path: resolvePath(r.id),
    depth: r.depth,
  }));
  options.sort((a, b) => {
    if (a.dashboardName !== b.dashboardName) return a.dashboardName.localeCompare(b.dashboardName);
    const ap = a.path.join(' / ');
    const bp = b.path.join(' / ');
    return ap.localeCompare(bp);
  });
  return options;
}

export default function FolderPickerDialog({ title, workspace, onPick, onClose, assignedIds, multi = false }: FolderPickerDialogProps) {
  const { t } = useTranslation('sidebar');
  const dialogTitle = title ?? t('folderPicker.title');
  const [query, setQuery] = useState('');
  const options = useMemo(() => buildFolderOptions(workspace), [workspace]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.dashboardName.toLowerCase().includes(q) ||
      o.path.some((p) => p.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const map = new Map<string, FolderOption[]>();
    for (const o of filtered) {
      const list = map.get(o.dashboardName) ?? [];
      list.push(o);
      map.set(o.dashboardName, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label={t('folderPicker.close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{dialogTitle}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('folderPicker.search')}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {multi && (
          <p className="border-b border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            {t('folderPicker.multiHint')}
          </p>
        )}
        <div className="max-h-96 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('folderPicker.empty')}</p>
          ) : (
            groups.map(([dashName, items]) => (
              <div key={dashName} className="mb-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <LayoutDashboard className="h-3 w-3 text-[color:var(--heritage-a,#F5D000)]" />
                  {dashName}
                </div>
                {items.map((o) => {
                  const isAssigned = assignedIds?.has(o.raccoglitoreId) ?? false;
                  return (
                    <button
                      key={o.raccoglitoreId}
                      type="button"
                      onClick={() => {
                        onPick(o.raccoglitoreId);
                        if (!multi) onClose();
                      }}
                      className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm transition hover:bg-accent/50"
                      style={{ paddingLeft: `${12 + o.depth * 12}px` }}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isAssigned ? 'border-[color:var(--heritage-b,#E30613)] bg-[color:var(--heritage-b,#E30613)] text-white' : 'border-border'}`}>
                        {isAssigned && <Check className="h-3 w-3" />}
                      </span>
                      <Folder className="h-4 w-4 shrink-0 text-[color:var(--heritage-a,#F5D000)]" />
                      <span className="truncate">{o.path.join(' / ')}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        {multi && (
          <div className="border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('folderPicker.done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
