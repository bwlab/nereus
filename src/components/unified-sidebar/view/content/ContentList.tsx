import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder as FolderIcon, FileCode2, FileText, FolderOpen, Star, ChevronDown, ChevronRight, Terminal, TerminalSquare, Wrench, Plug, Pencil, Trash2, FolderInput, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authenticatedFetch } from '../../../../utils/api';
import type { Project, SessionProvider } from '../../../../types/app';
import type { FullWorkspace } from '../../../dashboard/types/dashboard';
import type { Location, PresetKind } from '../../types/location';
import type { FolderNode, ProjectNode } from '../../types/tree';
import {
  buildUnifiedTree,
  flattenAllProjects,
  resolveFolderPath,
} from '../../utils/buildUnifiedTree';
import ProjectSettingsPanel, { type ProjectSettingsTab } from '../../../project-settings/view/ProjectSettingsPanel';
import FolderPickerDialog from '../dialogs/FolderPickerDialog';
import ClaudeMdViewerDialog from '../dialogs/ClaudeMdViewerDialog';
import ContentToolbar, { type SortMode } from './ContentToolbar';
import SessionInlineList from './rows/SessionInlineList';
import AgentViewer from '../../../agents/view/AgentViewer';
import OpenTabsView from './OpenTabsView';
import SkillsView from './SkillsView';
import type { Tab } from '../../../../stores/tabsStore';

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
  onOpenProjectShell?: (project: Project) => void;
  onSelectAgent?: (scope: 'global' | 'project', agentName: string, projectName?: string) => void;
  assignments?: FullWorkspace['assignments'];
  /** Tabs whose underlying session is currently processing (used by OpenTabsView). */
  processingTabIds?: Set<string>;
  /** Activate a tab from OpenTabsView (parent navigates to its URL). */
  onActivateTab?: (tab: Tab) => void;
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
  const { t } = useTranslation('sidebar');
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
          title={t('folderPicker.assignToProject', { project: pickerProjectName })}
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
        <div className="flex min-h-0 flex-1 flex-col">
          <ContentToolbar sort={sort} onSortChange={setSort} counter={t('toolbar.projectsCount', { count: matches.length })} />
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <EmptyState label={t('content.noResultsFor', { query: searchQuery.trim() })} />
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
                onOpenProjectShell={props.onOpenProjectShell}
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
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyState label={t('content.loading')} />
      </div>
    );
  }

  if (location.kind === 'agent') {
    return (
      <AgentViewer
        scope={location.scope}
        agentName={location.agentName}
        projectName={location.projectName}
      />
    );
  }

  if (location.kind === 'preset' && location.preset === 'global-agents') {
    return (
      <GlobalAgentsView
        onSelectAgent={(name) => props.onSelectAgent?.('global', name)}
      />
    );
  }

  if (location.kind === 'preset' && location.preset === 'skills') {
    return <SkillsView />;
  }

  if (location.kind === 'preset' && location.preset === 'open-tabs') {
    return (
      <OpenTabsView
        projects={props.projects}
        processingTabIds={props.processingTabIds}
        onActivate={(tab) => props.onActivateTab?.(tab)}
      />
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
                onOpenProjectShell={props.onOpenProjectShell}
        />
        {renderPanel()}
      </>
    );
  }

  if (location.kind === 'folder') {
    const { folder, dashboard } = resolveFolderPath(built.dashboards, location.dashboardId, location.folderIds);

    if (!folder && dashboard) {
      const counter = t('toolbar.foldersAndProjects', { folders: dashboard.folders.length, projects: dashboard.totalProjectsCount });
      return (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <ContentToolbar sort={sort} onSortChange={setSort} counter={counter} />
            <div className="flex-1 overflow-y-auto">
              {dashboard.folders.length === 0 ? (
                <EmptyState label={t('content.emptyDashboard')} />
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
      const counter = t('toolbar.foldersAndProjects', { folders: folder.children.length, projects: folder.projects.length });
      const projNodes = folder.projects;
      const sortedProjNodes = sortProjectNodes(projNodes, sort);
      return (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
          <ContentToolbar sort={sort} onSortChange={setSort} counter={counter} />
          <div className="flex-1 overflow-y-auto">
            {folder.children.length === 0 && folder.projects.length === 0 ? (
              <EmptyState label={t('content.emptyFolder')} />
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
                onOpenProjectShell={props.onOpenProjectShell}
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

    return <EmptyState label={t('content.folderNotFound')} />;
  }

  return <EmptyState label={t('content.selectItem')} />;
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
  onOpenProjectShell,
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
  onOpenProjectShell?: ContentListProps['onOpenProjectShell'];
}) {
  const { t } = useTranslation('sidebar');
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ContentToolbar sort={sort} onSortChange={onSortChange} counter={t('toolbar.projectsCount', { count: list.length })} />
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <EmptyState label={t('content.noProjects')} />
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
              onOpenProjectShell={onOpenProjectShell}
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
  const { t } = useTranslation('sidebar');
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-border/30 px-6 py-3.5 text-left transition hover:bg-muted/40"
    >
      <div className="border-[color:var(--heritage-a,#F5D000)]/50 bg-[color:var(--heritage-a,#F5D000)]/10 flex h-12 w-12 items-center justify-center rounded-lg border">
        <FolderIcon className="fill-[color:var(--heritage-a,#F5D000)]/30 h-6 w-6 text-[color:var(--heritage-a,#F5D000)]" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-[color:var(--heritage-b,#E30613)]">
          {folder.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {t('content.subProjectsCount', { projects: folder.totalProjectsCount, subfolders: folder.children.length })}
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
  onOpenProjectShell?: (project: Project) => void;
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
  onOpenProjectShell,
  highlightQuery,
}: ProjectRowProps) {
  const { t } = useTranslation('sidebar');
  const title = project.displayName || project.name;
  const sessionCount =
    (project.sessions?.length ?? 0) +
    (project.codexSessions?.length ?? 0) +
    (project.cursorSessions?.length ?? 0) +
    (project.geminiSessions?.length ?? 0);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
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
          aria-label={expanded ? t('content.collapse') : t('content.expand')}
          disabled={sessionCount === 0}
        >
          {sessionCount === 0 ? null : expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-muted/40"
          aria-label={t('content.openProject')}
        >
          <FileCode2 className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex min-w-0 flex-col items-start text-left">
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-2"
          >
            <span className="truncate text-sm font-medium">
              {highlightQuery ? highlightMatches(title, highlightQuery) : title}
            </span>
          </button>
          <div className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
            <span className="shrink-0">{t('content.sessionsCount', { count: sessionCount })}</span>
            {project.fullPath ? (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await authenticatedFetch(
                      `/api/project-open/${encodeURIComponent(project.name)}/in-file-manager`,
                      { method: 'POST' },
                    );
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      alert(data.error || t('content.openInFileManagerError'));
                    }
                  } catch (err) {
                    alert((err as Error).message);
                  }
                }}
                className="flex min-w-0 items-center gap-1 truncate transition-colors hover:text-primary hover:underline"
                title={t('content.openInFileManager')}
              >
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.fullPath}</span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await authenticatedFetch(
                      `/api/project-open/${encodeURIComponent(project.name)}/in-terminal-with-claude`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ permissionMode: 'bypassPermissions' }),
                      },
                    );
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      alert(data.error || t('content.openShell'));
                    }
                  } catch (err) {
                    alert((err as Error).message);
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={t('content.openShell')}
                title={t('content.shell')}
              >
                <TerminalSquare className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await authenticatedFetch(
                      `/api/project-open/${encodeURIComponent(project.name)}/in-ide`,
                      { method: 'POST' },
                    );
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      alert(data.error || t('content.openInIde'));
                    }
                  } catch (err) {
                    alert((err as Error).message);
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={t('content.openInIde')}
                title={t('content.openInIde')}
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
                aria-label={t('content.skillsLabel')}
                title={t('content.skillsLabel')}
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
                aria-label={t('content.mcpTools')}
                title={t('content.mcpTools')}
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
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label={t('content.assignToFolder')}
              title={t('content.assignToFolder')}
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowClaudeMd(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label={t('content.showClaudeMd')}
            title={t('content.showClaudeMd')}
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          {onRenameProject && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenameProject(project.name, project.displayName);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label={t('folders.renameProject')}
              title={t('folders.renameProject')}
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
              className="hover:bg-[color:var(--heritage-b,#E30613)]/10 flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:text-[color:var(--heritage-b,#E30613)] group-hover:opacity-100"
              aria-label={t('folders.deleteProject')}
              title={t('folders.deleteProject')}
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
                  : 'text-muted-foreground opacity-0 hover:text-[color:var(--heritage-a,#F5D000)] group-hover:opacity-100'
              }`}
              aria-label={isFavorite ? t('content.removeFromFavorites') : t('content.addToFavorites')}
              title={isFavorite ? t('content.removeFavoriteShort') : t('content.favoriteShort')}
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
      {showClaudeMd && (
        <ClaudeMdViewerDialog
          projectName={project.name}
          projectDisplayName={project.displayName || project.name}
          onClose={() => setShowClaudeMd(false)}
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

interface GlobalAgentEntry {
  name: string;
  description: string | null;
  model: string | null;
  filePath: string;
}

function GlobalAgentsView({ onSelectAgent }: { onSelectAgent: (agentName: string) => void }) {
  const { t } = useTranslation('sidebar');
  const [agents, setAgents] = useState<GlobalAgentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch('/api/project-agents/global/list')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setAgents(json.agents || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <EmptyState label={t('content.errorPrefix', { message: error })} />;
  }
  if (!agents) {
    return <EmptyState label={t('content.loading')} />;
  }
  if (agents.length === 0) {
    return <EmptyState label={t('content.noGlobalAgents')} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/40 bg-muted/20 px-6 py-2 text-xs text-muted-foreground">
        {t('content.agentsCount', { count: agents.length })}
      </div>
      <div className="flex-1 overflow-y-auto">
        {agents.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => onSelectAgent(a.name)}
            className="group grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-border/30 px-6 py-3.5 text-left transition hover:bg-muted/40"
          >
            <div className="border-[color:var(--heritage-a,#F5D000)]/50 bg-[color:var(--heritage-a,#F5D000)]/10 flex h-12 w-12 items-center justify-center rounded-lg border">
              <Bot className="h-6 w-6 text-[color:var(--heritage-a,#F5D000)]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{a.name}</div>
              {a.description && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{a.description}</div>
              )}
            </div>
            {a.model && (
              <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {a.model}
              </span>
            )}
          </button>
        ))}
      </div>
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
      <mark className="bg-[color:var(--heritage-a,#F5D000)]/40 rounded px-0.5 font-semibold text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
