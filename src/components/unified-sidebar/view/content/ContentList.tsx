import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder as FolderIcon, FileCode2, Star, ChevronDown, ChevronRight, Terminal, Wrench, Plug, Pencil, Trash2, FolderInput } from 'lucide-react';
import type { Project, SessionProvider } from '../../../../types/app';
import type { FullWorkspace } from '../../../dashboard/types/dashboard';
import type { Location, PresetKind } from '../../types/location';
import type { FolderNode, ProjectNode } from '../../types/tree';
import {
  buildUnifiedTree,
  flattenAllProjects,
  resolveFolderPath,
} from '../../utils/buildUnifiedTree';
import ContentToolbar, { type SortMode } from './ContentToolbar';
import SessionInlineList from './rows/SessionInlineList';
import ProjectSettingsPanel, { type ProjectSettingsTab } from '../../../project-settings/view/ProjectSettingsPanel';
import FolderPickerDialog from '../dialogs/FolderPickerDialog';

interface ContentListProps {
  location: Location;
  workspace: FullWorkspace | null;
  projects: Project[];
  searchQuery?: string;
  onSelectFolder: (dashboardId: number, folderIds: number[]) => void;
  onSelectProject: (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onSelectSession: (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onToggleFavorite?: (projectName: string, nextFavorite: boolean) => void;
  onRenameProject?: (projectName: string, currentDisplayName?: string) => void;
  onDeleteProject?: (projectName: string, displayName?: string) => void;
  onDeleteSession?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onMoveProject?: (projectName: string, targetRaccoglitoreId: number) => void;
  onAssignProjectToFolder?: (projectName: string, targetRaccoglitoreId: number) => void;
  assignments?: FullWorkspace['assignments'];
}

const RECENT_LIMIT = 100;
const SORT_KEY = 'ui:sort';

function loadSort(): SortMode {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw === 'manual' || raw === 'alpha' || raw === 'recent' || raw === 'old') return raw;
  } catch { /* ignore */ }
  return 'manual';
}
function persistSort(s: SortMode) {
  try { localStorage.setItem(SORT_KEY, s); } catch { /* ignore */ }
}

export default function ContentList(props: ContentListProps) {
  const { location, workspace, projects, searchQuery } = props;
  const [sort, setSort] = useState<SortMode>(() => loadSort());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [settingsTarget, setSettingsTarget] = useState<{
    projectName: string;
    projectDisplayName?: string;
    tab: ProjectSettingsTab;
  } | null>(null);
  const [pickerProjectName, setPickerProjectName] = useState<string | null>(null);

  useEffect(() => { persistSort(sort); }, [sort]);

  const openSettings = useCallback((project: Project, tab: ProjectSettingsTab) => {
    setSettingsTarget({
      projectName: project.name,
      projectDisplayName: project.displayName,
      tab,
    });
  }, []);

  const renderPanel = () => (
    <>
      {settingsTarget && (
        <ProjectSettingsPanel
          isOpen
          onClose={() => setSettingsTarget(null)}
          projectName={settingsTarget.projectName}
          projectDisplayName={settingsTarget.projectDisplayName}
          activeTab={settingsTarget.tab}
          onChangeTab={(tab) => setSettingsTarget((prev) => (prev ? { ...prev, tab } : prev))}
        />
      )}
      {pickerProjectName && props.onAssignProjectToFolder && (
        <FolderPickerDialog
          title={`Assegna "${pickerProjectName}" a cartella`}
          workspace={workspace}
          assignedIds={
            new Set(
              (props.assignments ?? [])
                .filter((a) => a.project_name === pickerProjectName)
                .map((a) => a.raccoglitore_id),
            )
          }
          multi
          onPick={(rid) => {
            props.onAssignProjectToFolder?.(pickerProjectName, rid);
          }}
          onClose={() => setPickerProjectName(null)}
        />
      )}
    </>
  );

  const openPicker = useCallback((projectName: string) => setPickerProjectName(projectName), []);

  const toggleProject = useCallback((name: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const built = useMemo(() => {
    if (!workspace) return null;
    return buildUnifiedTree(workspace, projects);
  }, [workspace, projects]);

  const sortProjects = useCallback((list: Project[]): Project[] => {
    const arr = [...list];
    switch (sort) {
      case 'alpha':
        return arr.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
      case 'recent':
        return arr.sort((a, b) => lastActivity(b) - lastActivity(a));
      case 'old':
        return arr.sort((a, b) => lastActivity(a) - lastActivity(b));
      case 'manual':
      default:
        return arr;
    }
  }, [sort]);

  // Search state
  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.trim().toLowerCase();
    const matches = projects.filter(
      (p) => (p.displayName || p.name).toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    );
    const sorted = sortProjects(matches);
    return (
      <>
        <div className="flex flex-1 min-h-0 flex-col">
          <ContentToolbar sort={sort} onSortChange={setSort} counter={`${matches.length} progetti`} />
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <EmptyState label={`Nessun risultato per "${searchQuery.trim()}"`} />
            ) : (
              sorted.map((p) => (
                <ProjectRow
                  key={p.name}
                  project={p}
                  isFavorite={isProjectFavorite(built, p.name)}
                  expanded={expandedProjects.has(p.name)}
                  onToggle={() => toggleProject(p.name)}
                  onOpen={() => props.onSelectProject(p)}
                  onSelectSession={props.onSelectSession}
                  onToggleFavorite={props.onToggleFavorite}
                  onOpenSettings={openSettings}
                onRenameProject={props.onRenameProject}
                onDeleteSession={props.onDeleteSession}
                onDeleteProject={props.onDeleteProject}
                onAssignClick={props.onAssignProjectToFolder ? openPicker : undefined}
                  highlightQuery={q}
                />
              ))
            )}
          </div>
        </div>
        {renderPanel()}
      </>
    );
  }

  if (!built) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <EmptyState label="Caricamento…" />
      </div>
    );
  }

  if (location.kind === 'preset') {
    return (
      <>
        <PresetView
          built={built}
          preset={location.preset}
          sort={sort}
          onSortChange={setSort}
          sortProjects={sortProjects}
          expandedProjects={expandedProjects}
          onToggleProject={toggleProject}
          onOpenProject={(p) => props.onSelectProject(p)}
          onSelectSession={props.onSelectSession}
          onToggleFavorite={props.onToggleFavorite}
          onOpenSettings={openSettings}
                onRenameProject={props.onRenameProject}
                onDeleteSession={props.onDeleteSession}
                onDeleteProject={props.onDeleteProject}
                onAssignClick={props.onAssignProjectToFolder ? openPicker : undefined}
        />
        {renderPanel()}
      </>
    );
  }

  if (location.kind === 'folder') {
    const { folder, dashboard } = resolveFolderPath(built.dashboards, location.dashboardId, location.folderIds);

    if (!folder && dashboard) {
      const counter = `${dashboard.folders.length} cartelle · ${dashboard.totalProjectsCount} progetti`;
      return (
        <>
          <div className="flex flex-1 min-h-0 flex-col">
            <ContentToolbar sort={sort} onSortChange={setSort} counter={counter} />
            <div className="flex-1 overflow-y-auto">
              {dashboard.folders.length === 0 ? (
                <EmptyState label="Dashboard vuota" />
              ) : (
                dashboard.folders.map((f) => (
                  <FolderRow key={f.id} folder={f} onClick={() => props.onSelectFolder(dashboard.id, [f.id])} />
                ))
              )}
            </div>
          </div>
          {renderPanel()}
        </>
      );
    }

    if (folder) {
      const counter = `${folder.children.length} cartelle · ${folder.projects.length} progetti`;
      const projNodes = folder.projects;
      const sortedProjNodes = sortProjectNodes(projNodes, sort);
      return (
        <>
          <div className="flex flex-1 min-h-0 flex-col">
          <ContentToolbar sort={sort} onSortChange={setSort} counter={counter} />
          <div className="flex-1 overflow-y-auto">
            {folder.children.length === 0 && folder.projects.length === 0 ? (
              <EmptyState label="Cartella vuota" />
            ) : (
              <>
                {folder.children.map((c) => (
                  <FolderRow
                    key={c.id}
                    folder={c}
                    onClick={() => props.onSelectFolder(location.dashboardId, [...location.folderIds, c.id])}
                  />
                ))}
                {sortedProjNodes.map((pn) => (
                  <ProjectRow
                    key={pn.projectName}
                    project={pn.project}
                    isFavorite={pn.isFavorite}
                    expanded={expandedProjects.has(pn.projectName)}
                    onToggle={() => toggleProject(pn.projectName)}
                    onOpen={() =>
                      props.onSelectProject(pn.project, {
                        dashboardId: location.dashboardId,
                        folderIds: location.folderIds,
                      })
                    }
                    onSelectSession={(pr, sid, prov) =>
                      props.onSelectSession(pr, sid, prov, {
                        dashboardId: location.dashboardId,
                        folderIds: location.folderIds,
                      })
                    }
                    onToggleFavorite={props.onToggleFavorite}
                    onOpenSettings={openSettings}
                onRenameProject={props.onRenameProject}
                onDeleteSession={props.onDeleteSession}
                onDeleteProject={props.onDeleteProject}
                onAssignClick={props.onAssignProjectToFolder ? openPicker : undefined}
                  />
                ))}
              </>
            )}
          </div>
          </div>
          {renderPanel()}
        </>
      );
    }

    return <EmptyState label="Cartella non trovata" />;
  }

  return <EmptyState label="Seleziona un elemento" />;
}

function PresetView({
  built,
  preset,
  sort,
  onSortChange,
  sortProjects,
  expandedProjects,
  onToggleProject,
  onOpenProject,
  onSelectSession,
  onToggleFavorite,
  onOpenSettings,
  onRenameProject,
  onDeleteProject,
  onDeleteSession,
  onAssignClick,
}: {
  built: NonNullable<ReturnType<typeof buildUnifiedTree>>;
  preset: PresetKind;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  sortProjects: (list: Project[]) => Project[];
  expandedProjects: Set<string>;
  onToggleProject: (name: string) => void;
  onOpenProject: (p: Project) => void;
  onSelectSession: ContentListProps['onSelectSession'];
  onToggleFavorite?: ContentListProps['onToggleFavorite'];
  onOpenSettings?: (project: Project, tab: ProjectSettingsTab) => void;
  onRenameProject?: ContentListProps['onRenameProject'];
  onDeleteProject?: ContentListProps['onDeleteProject'];
  onDeleteSession?: ContentListProps['onDeleteSession'];
  onAssignClick?: (projectName: string) => void;
}) {
  const allProjects = [...built.projectsByName.values()];
  const favoriteSet = new Set<string>();
  for (const n of flattenAllProjects(built.dashboards)) if (n.isFavorite) favoriteSet.add(n.projectName);
  let list: Project[] = [];

  if (preset === 'all') list = allProjects;
  else if (preset === 'unassigned') list = allProjects.filter((p) => !built.assignedProjectNames.has(p.name));
  else if (preset === 'recent') {
    const sorted = [...allProjects].sort((a, b) => lastActivity(b) - lastActivity(a));
    list = sorted.slice(0, RECENT_LIMIT);
  } else if (preset === 'favorites') {
    list = allProjects.filter((p) => favoriteSet.has(p.name));
  }

  const sorted = preset === 'recent' ? list : sortProjects(list);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <ContentToolbar sort={sort} onSortChange={onSortChange} counter={`${list.length} progetti`} />
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <EmptyState label="Nessun progetto" />
        ) : (
          sorted.map((p) => (
            <ProjectRow
              key={p.name}
              project={p}
              isFavorite={favoriteSet.has(p.name)}
              expanded={expandedProjects.has(p.name)}
              onToggle={() => onToggleProject(p.name)}
              onOpen={() => onOpenProject(p)}
              onSelectSession={onSelectSession}
              onToggleFavorite={onToggleFavorite}
              onOpenSettings={onOpenSettings}
              onRenameProject={onRenameProject}
              onDeleteProject={onDeleteProject}
              onDeleteSession={onDeleteSession}
              onAssignClick={onAssignClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

function isProjectFavorite(built: ReturnType<typeof buildUnifiedTree> | null, projectName: string): boolean {
  if (!built) return false;
  for (const n of flattenAllProjects(built.dashboards)) {
    if (n.projectName === projectName && n.isFavorite) return true;
  }
  return false;
}

function sortProjectNodes(list: ProjectNode[], sort: SortMode): ProjectNode[] {
  const arr = [...list];
  switch (sort) {
    case 'alpha':
      return arr.sort((a, b) =>
        (a.project.displayName || a.projectName).localeCompare(b.project.displayName || b.projectName),
      );
    case 'recent':
      return arr.sort((a, b) => lastActivity(b.project) - lastActivity(a.project));
    case 'old':
      return arr.sort((a, b) => lastActivity(a.project) - lastActivity(b.project));
    case 'manual':
    default:
      return arr;
  }
}

function lastActivity(p: Project): number {
  let max = 0;
  const pools = [p.sessions, p.codexSessions, p.cursorSessions, p.geminiSessions];
  for (const pool of pools) {
    if (!pool) continue;
    for (const s of pool) {
      const ts = parseTs(s.updated_at) || parseTs(s.createdAt);
      if (ts > max) max = ts;
    }
  }
  return max;
}

function parseTs(v: string | undefined): number {
  if (!v) return 0;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

function FolderRow({ folder, onClick }: { folder: FolderNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-border/30 px-6 py-3.5 text-left transition hover:bg-muted/40"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[color:var(--heritage-a,#F5D000)]/50 bg-[color:var(--heritage-a,#F5D000)]/10">
        <FolderIcon className="h-6 w-6 fill-[color:var(--heritage-a,#F5D000)]/30 text-[color:var(--heritage-a,#F5D000)]" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-[color:var(--heritage-b,#E30613)]">
          {folder.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {folder.totalProjectsCount} progetti · {folder.children.length} sotto-cartelle
        </div>
      </div>
    </button>
  );
}

interface ProjectRowProps {
  project: Project;
  isFavorite?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSelectSession: ContentListProps['onSelectSession'];
  onToggleFavorite?: ContentListProps['onToggleFavorite'];
  onOpenSettings?: (project: Project, tab: ProjectSettingsTab) => void;
  onRenameProject?: ContentListProps['onRenameProject'];
  onDeleteProject?: ContentListProps['onDeleteProject'];
  onDeleteSession?: ContentListProps['onDeleteSession'];
  onAssignClick?: (projectName: string) => void;
  highlightQuery?: string;
}

function ProjectRow({
  project,
  isFavorite = false,
  expanded,
  onToggle,
  onOpen,
  onSelectSession,
  onToggleFavorite,
  onOpenSettings,
  onRenameProject,
  onDeleteProject,
  onDeleteSession,
  onAssignClick,
  highlightQuery,
}: ProjectRowProps) {
  const title = project.displayName || project.name;
  const sessionCount =
    (project.sessions?.length ?? 0) +
    (project.codexSessions?.length ?? 0) +
    (project.cursorSessions?.length ?? 0) +
    (project.geminiSessions?.length ?? 0);
  const handleDragStart = (e: React.DragEvent) => {
    try {
      e.dataTransfer.setData('application/x-bwlab-node', JSON.stringify({ kind: 'project', projectName: project.name }));
      e.dataTransfer.effectAllowed = 'move';
    } catch { /* ignore */ }
  };

  return (
    <div className="group border-b border-border/30">
      <div
        className="grid w-full grid-cols-[32px_56px_1fr_auto] items-center gap-2 px-4 py-3 transition hover:bg-muted/40"
        draggable
        onDragStart={handleDragStart}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={expanded ? 'Collassa sessioni' : 'Espandi sessioni'}
          disabled={sessionCount === 0}
        >
          {sessionCount === 0 ? null : expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-muted/40"
          aria-label="Apri progetto"
        >
          <FileCode2 className="h-5 w-5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-col items-start text-left"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {highlightQuery ? highlightMatches(title, highlightQuery) : title}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {sessionCount} sessioni · {project.fullPath}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(project, 'commands');
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Comandi di progetto"
                title="Comandi di progetto"
              >
                <Terminal className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(project, 'skills');
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Skills"
                title="Skills"
              >
                <Wrench className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(project, 'mcp');
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="MCP Tools"
                title="MCP Tools"
              >
                <Plug className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {onAssignClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAssignClick(project.name);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-foreground"
              aria-label="Assegna a cartella"
              title="Assegna a cartella"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
          )}
          {onRenameProject && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenameProject(project.name, project.displayName);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-foreground"
              aria-label="Rinomina progetto"
              title="Rinomina progetto"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDeleteProject && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(project.name, project.displayName);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-[color:var(--heritage-b,#E30613)]/10 hover:text-[color:var(--heritage-b,#E30613)]"
              aria-label="Elimina progetto"
              title="Elimina progetto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(project.name, !isFavorite);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded transition ${
                isFavorite
                  ? 'text-[color:var(--heritage-a,#F5D000)]'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-[color:var(--heritage-a,#F5D000)]'
              }`}
              aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              title={isFavorite ? 'Rimuovi preferito' : 'Preferito'}
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {sessionCount}
          </span>
        </div>
      </div>
      {expanded && sessionCount > 0 && (
        <SessionInlineList
          project={project}
          onSelectSession={(pr, sid, prov) => onSelectSession(pr, sid, prov)}
          onDeleteSession={onDeleteSession}
        />
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function highlightMatches(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[color:var(--heritage-a,#F5D000)]/40 px-0.5 font-semibold text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
