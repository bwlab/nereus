import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, FolderOpen, LayoutDashboard, FileCode2, FileText, MessageSquare, Plus, Pencil, Trash2, Terminal, Bot } from 'lucide-react';
import type { Project, SessionProvider } from '../../../../types/app';
import type { FullWorkspace } from '../../../dashboard/types/dashboard';
import type { Location } from '../../types/location';
import type { DashboardNode, FolderNode, ProjectNode, SessionNode } from '../../types/tree';
import { buildUnifiedTree } from '../../utils/buildUnifiedTree';
import TreeRow from '../tree/TreeRow';
import ClaudeMdViewerDialog from '../dialogs/ClaudeMdViewerDialog';
import { authenticatedFetch } from '../../../../utils/api';
import { useTabsStore } from '../../../../stores/tabsStore';

type ExpandedSet = Set<string>;

interface FoldersSectionProps {
  workspace: FullWorkspace | null;
  projects: Project[];
  location: Location;
  onSelectFolder: (dashboardId: number, folderIds: number[]) => void;
  onSelectDashboard: (dashboardId: number) => void;
  onSelectProject: (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onSelectSession: (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onDeleteSession?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onDeleteProject?: (projectName: string, displayName?: string) => void;
  onOpenTerminal?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onCreateDashboard: () => void;
  onCreateFolder?: (dashboardId: number, parentFolderId: number | null) => void;
  onMoveProject?: (projectName: string, targetRaccoglitoreId: number) => void;
  onMoveFolder?: (folderId: number, targetParentId: number | null, targetDashboardId: number) => void;
  onRenameProject?: (projectName: string, currentDisplayName?: string) => void;
  onRenameFolder?: (folderId: number, currentName: string) => void;
  onDeleteFolder?: (folderId: number, currentName: string) => void;
  onSelectAgent?: (scope: 'global' | 'project', agentName: string, projectName?: string) => void;
  expanded: ExpandedSet;
  onToggleExpanded: (key: string) => void;
  searchQuery?: string;
}

/** DnD dataTransfer payload types */
type DragPayload =
  | { kind: 'project'; projectName: string }
  | { kind: 'folder'; folderId: number; dashboardId: number };

const DRAG_MIME = 'application/x-bwlab-node';

function readPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function writePayload(e: React.DragEvent, p: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(p));
  e.dataTransfer.effectAllowed = 'move';
}

const LOCATION_STORAGE_KEY = 'ui:tree:expanded';

export function loadExpanded(): ExpandedSet {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function persistExpanded(set: ExpandedSet): void {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function nodeKey(prefix: string, id: number | string): string {
  return `${prefix}:${id}`;
}

export default function FoldersSection(props: FoldersSectionProps) {
  const { workspace, projects, location, expanded, onToggleExpanded, onCreateDashboard, searchQuery } = props;
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const treeData = useMemo(() => {
    if (!workspace) return null;
    return buildUnifiedTree(workspace, projects);
  }, [workspace, projects]);

  const query = (searchQuery ?? '').trim().toLowerCase();

  const dndHandlers = useMemo(() => ({
    dropTargetKey,
    setDropTargetKey,
    onMoveProject: props.onMoveProject,
    onMoveFolder: props.onMoveFolder,
  }), [dropTargetKey, props.onMoveProject, props.onMoveFolder]);

  const filteredDashboards = useMemo<DashboardNode[]>(() => {
    if (!treeData) return [];
    if (!query) return treeData.dashboards;
    return treeData.dashboards
      .map((d) => filterDashboard(d, query))
      .filter((d): d is DashboardNode => d !== null);
  }, [treeData, query]);

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Cartelle
        </span>
        <button
          type="button"
          onClick={onCreateDashboard}
          className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Nuova dashboard"
        >
          <Plus className="h-3 w-3" /> nuova
        </button>
      </div>

      {!workspace ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">Caricamento…</div>
      ) : filteredDashboards.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">Nessuna dashboard</div>
      ) : (
        <div role="tree" className="flex flex-col gap-0.5">
          {filteredDashboards.map((d) => (
            <DashboardRow
              key={d.id}
              dashboard={d}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              location={location}
              onSelectFolder={props.onSelectFolder}
              onSelectDashboard={props.onSelectDashboard}
              onSelectProject={props.onSelectProject}
              onSelectSession={props.onSelectSession}
              onCreateFolder={props.onCreateFolder}
              onRenameProject={props.onRenameProject}
              onRenameFolder={props.onRenameFolder}
              onDeleteFolder={props.onDeleteFolder}
              onDeleteSession={props.onDeleteSession}
              onDeleteProject={props.onDeleteProject}
              onOpenTerminal={props.onOpenTerminal}
              onSelectAgent={props.onSelectAgent}
              dnd={dndHandlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DndHandlers {
  dropTargetKey: string | null;
  setDropTargetKey: (k: string | null) => void;
  onMoveProject?: FoldersSectionProps['onMoveProject'];
  onMoveFolder?: FoldersSectionProps['onMoveFolder'];
}

function DashboardRow({
  dashboard,
  expanded,
  onToggleExpanded,
  location,
  onSelectFolder,
  onSelectDashboard,
  onSelectProject,
  onSelectSession,
  onCreateFolder,
  onRenameProject,
  onRenameFolder,
  onDeleteFolder,
  onDeleteSession,
  onDeleteProject,
  onOpenTerminal,
  onSelectAgent,
  dnd,
}: {
  dashboard: DashboardNode;
  expanded: ExpandedSet;
  onToggleExpanded: (k: string) => void;
  location: Location;
  onSelectFolder: FoldersSectionProps['onSelectFolder'];
  onSelectDashboard: FoldersSectionProps['onSelectDashboard'];
  onSelectProject: FoldersSectionProps['onSelectProject'];
  onSelectSession: FoldersSectionProps['onSelectSession'];
  onCreateFolder?: FoldersSectionProps['onCreateFolder'];
  onRenameProject?: FoldersSectionProps['onRenameProject'];
  onRenameFolder?: FoldersSectionProps['onRenameFolder'];
  onDeleteFolder?: FoldersSectionProps['onDeleteFolder'];
  onDeleteSession?: FoldersSectionProps['onDeleteSession'];
  onDeleteProject?: FoldersSectionProps['onDeleteProject'];
  onOpenTerminal?: FoldersSectionProps['onOpenTerminal'];
  onSelectAgent?: FoldersSectionProps['onSelectAgent'];
  dnd: DndHandlers;
}) {
  const key = nodeKey('d', dashboard.id);
  const isExpanded = expanded.has(key);
  const isSelected =
    (location.kind === 'folder' && location.dashboardId === dashboard.id && location.folderIds.length === 0);
  const hasChildren = dashboard.folders.length > 0;

  const toggle = useCallback(() => onToggleExpanded(key), [onToggleExpanded, key]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (!types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dnd.setDropTargetKey(key);
  }, [dnd, key]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const payload = readPayload(e);
    dnd.setDropTargetKey(null);
    if (!payload) return;
    // Only folder drops on dashboard root are supported (move to root)
    if (payload.kind === 'folder' && dnd.onMoveFolder) {
      dnd.onMoveFolder(payload.folderId, null, dashboard.id);
    }
    // Projects cannot be dropped on dashboard root (no raccoglitore); ignore
  }, [dnd, dashboard.id]);

  const handleDragLeave = useCallback(() => {
    if (dnd.dropTargetKey === key) dnd.setDropTargetKey(null);
  }, [dnd, key]);

  return (
    <div>
      <TreeRow
        depth={0}
        isSelected={isSelected}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggleExpand={toggle}
        onClick={() => onSelectDashboard(dashboard.id)}
        icon={<LayoutDashboard className="h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />}
        label={dashboard.dashboard.name}
        count={dashboard.totalProjectsCount}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDropTarget={dnd.dropTargetKey === key}
        actions={
          onCreateFolder ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(dashboard.id, null);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Nuova cartella"
              title="Nuova cartella"
            >
              <Plus className="h-3 w-3" />
            </button>
          ) : null
        }
      />
      {isExpanded && hasChildren && (
        <div>
          {dashboard.folders.map((f) => (
            <FolderRowTree
              key={f.id}
              folder={f}
              dashboardId={dashboard.id}
              pathPrefix={[]}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              location={location}
              onSelectFolder={onSelectFolder}
              onSelectProject={onSelectProject}
              onSelectSession={onSelectSession}
              onCreateFolder={onCreateFolder}
              onRenameProject={onRenameProject}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDeleteSession={onDeleteSession}
              onDeleteProject={onDeleteProject}
              onOpenTerminal={onOpenTerminal}
              onSelectAgent={onSelectAgent}
              dnd={dnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderRowTree({
  folder,
  dashboardId,
  pathPrefix,
  expanded,
  onToggleExpanded,
  location,
  onSelectFolder,
  onSelectProject,
  onSelectSession,
  onCreateFolder,
  onRenameProject,
  onRenameFolder,
  onDeleteFolder,
  onDeleteSession,
  onDeleteProject,
  onOpenTerminal,
  onSelectAgent,
  dnd,
}: {
  folder: FolderNode;
  dashboardId: number;
  pathPrefix: number[];
  expanded: ExpandedSet;
  onToggleExpanded: (k: string) => void;
  location: Location;
  onSelectFolder: FoldersSectionProps['onSelectFolder'];
  onSelectProject: FoldersSectionProps['onSelectProject'];
  onSelectSession: FoldersSectionProps['onSelectSession'];
  onCreateFolder?: FoldersSectionProps['onCreateFolder'];
  onRenameProject?: FoldersSectionProps['onRenameProject'];
  onRenameFolder?: FoldersSectionProps['onRenameFolder'];
  onDeleteFolder?: FoldersSectionProps['onDeleteFolder'];
  onDeleteSession?: FoldersSectionProps['onDeleteSession'];
  onDeleteProject?: FoldersSectionProps['onDeleteProject'];
  onOpenTerminal?: FoldersSectionProps['onOpenTerminal'];
  onSelectAgent?: FoldersSectionProps['onSelectAgent'];
  dnd: DndHandlers;
}) {
  const key = nodeKey('f', folder.id);
  const isExpanded = expanded.has(key);
  const pathIds = [...pathPrefix, folder.id];

  const isSelected =
    location.kind === 'folder' &&
    location.dashboardId === dashboardId &&
    arraysEq(location.folderIds, pathIds);

  const hasChildren = folder.children.length > 0 || folder.projects.length > 0;
  const depth = pathIds.length; // 1 for root folders under dashboard

  const handleDragStart = useCallback((e: React.DragEvent) => {
    writePayload(e, { kind: 'folder', folderId: folder.id, dashboardId });
  }, [folder.id, dashboardId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (!types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dnd.setDropTargetKey(key);
  }, [dnd, key]);

  const handleDragLeave = useCallback(() => {
    if (dnd.dropTargetKey === key) dnd.setDropTargetKey(null);
  }, [dnd, key]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const payload = readPayload(e);
    dnd.setDropTargetKey(null);
    if (!payload) return;
    if (payload.kind === 'project' && dnd.onMoveProject) {
      dnd.onMoveProject(payload.projectName, folder.id);
      return;
    }
    if (payload.kind === 'folder' && dnd.onMoveFolder) {
      // Don't self-drop or drop onto own descendant (backend will also guard cycles)
      if (payload.folderId === folder.id) return;
      dnd.onMoveFolder(payload.folderId, folder.id, dashboardId);
    }
  }, [dnd, folder.id, dashboardId]);

  return (
    <div>
      <TreeRow
        depth={depth}
        isSelected={isSelected}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggleExpand={() => onToggleExpanded(key)}
        onClick={() => onSelectFolder(dashboardId, pathIds)}
        icon={
          isExpanded ? (
            <FolderOpen className="fill-[color:var(--heritage-a,#F5D000)]/25 h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />
          ) : (
            <Folder className="fill-[color:var(--heritage-a,#F5D000)]/25 h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />
          )
        }
        label={<span className="text-[color:var(--heritage-b,#E30613)]">{folder.name}</span>}
        count={folder.totalProjectsCount}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDropTarget={dnd.dropTargetKey === key}
        actions={
          <>
            {onCreateFolder && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder(dashboardId, folder.id);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Nuova sotto-cartella"
                title="Nuova sotto-cartella"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
            {onRenameFolder && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameFolder(folder.id, folder.name);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Rinomina cartella"
                title="Rinomina cartella"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onDeleteFolder && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id, folder.name);
                }}
                className="hover:bg-[color:var(--heritage-b,#E30613)]/10 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:text-[color:var(--heritage-b,#E30613)]"
                aria-label="Elimina cartella"
                title="Elimina cartella"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </>
        }
      />
      {isExpanded && (
        <div>
          {folder.children.map((c) => (
            <FolderRowTree
              key={c.id}
              folder={c}
              dashboardId={dashboardId}
              pathPrefix={pathIds}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              location={location}
              onSelectFolder={onSelectFolder}
              onSelectProject={onSelectProject}
              onSelectSession={onSelectSession}
              onCreateFolder={onCreateFolder}
              onRenameProject={onRenameProject}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDeleteSession={onDeleteSession}
              onDeleteProject={onDeleteProject}
              onOpenTerminal={onOpenTerminal}
              onSelectAgent={onSelectAgent}
              dnd={dnd}
            />
          ))}
          {folder.projects.map((p) => (
            <ProjectRowTree
              key={p.projectName}
              projectNode={p}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              location={location}
              folderContext={{ dashboardId, folderIds: pathIds }}
              onSelectProject={onSelectProject}
              onSelectSession={onSelectSession}
              onRenameProject={onRenameProject}
              onDeleteSession={onDeleteSession}
              onDeleteProject={onDeleteProject}
              onOpenTerminal={onOpenTerminal}
              onSelectAgent={onSelectAgent}
              dnd={dnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AgentListEntry {
  name: string;
  description: string | null;
}

function ProjectRowTree({
  projectNode,
  depth,
  expanded,
  onToggleExpanded,
  location,
  folderContext,
  onSelectProject,
  onSelectSession,
  onRenameProject,
  onDeleteSession,
  onDeleteProject,
  onOpenTerminal,
  onSelectAgent,
  dnd,
}: {
  projectNode: ProjectNode;
  depth: number;
  expanded: ExpandedSet;
  onToggleExpanded: (k: string) => void;
  location: Location;
  folderContext: { dashboardId: number; folderIds: number[] };
  onSelectProject: FoldersSectionProps['onSelectProject'];
  onSelectSession: FoldersSectionProps['onSelectSession'];
  onRenameProject?: FoldersSectionProps['onRenameProject'];
  onDeleteSession?: FoldersSectionProps['onDeleteSession'];
  onDeleteProject?: FoldersSectionProps['onDeleteProject'];
  onOpenTerminal?: FoldersSectionProps['onOpenTerminal'];
  onSelectAgent?: FoldersSectionProps['onSelectAgent'];
  dnd: DndHandlers;
}) {
  const key = nodeKey('p', projectNode.projectName);
  const isExpanded = expanded.has(key);
  const isSelected =
    (location.kind === 'project' && location.projectName === projectNode.projectName) ||
    (location.kind === 'session' && location.projectName === projectNode.projectName) ||
    (location.kind === 'agent' && location.scope === 'project' && location.projectName === projectNode.projectName);

  const tabsState = useTabsStore();
  const hasOpenTab = tabsState.tabs.some((t) => t.projectName === projectNode.projectName);

  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const [agents, setAgents] = useState<AgentListEntry[] | null>(null);

  useEffect(() => {
    if (!isExpanded || agents !== null) return;
    let cancelled = false;
    authenticatedFetch(`/api/project-agents/${encodeURIComponent(projectNode.projectName)}`)
      .then(async (res) => (res.ok ? res.json() : { agents: [] }))
      .then((json) => {
        if (cancelled) return;
        setAgents(Array.isArray(json.agents) ? json.agents : []);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpanded, agents, projectNode.projectName]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    writePayload(e, { kind: 'project', projectName: projectNode.projectName });
  }, [projectNode.projectName]);

  return (
    <div>
      <TreeRow
        depth={depth}
        isSelected={isSelected}
        hasChildren={projectNode.sessions.length > 0}
        isExpanded={isExpanded}
        onToggleExpand={() => onToggleExpanded(key)}
        onClick={() => onSelectProject(projectNode.project, folderContext)}
        icon={<FileCode2 className={`h-4 w-4 ${hasOpenTab ? 'text-emerald-500' : 'text-muted-foreground'}`} />}
        label={
          <span className={`truncate ${hasOpenTab ? 'font-medium text-emerald-500' : ''}`}>
            {hasOpenTab && (
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle"
                title="Sessione aperta"
                aria-label="Sessione aperta"
              />
            )}
            {projectNode.project.displayName || projectNode.projectName}
            {projectNode.isFavorite && <span className="ml-1 text-[color:var(--heritage-a,#F5D000)]">★</span>}
          </span>
        }
        count={projectNode.sessions.length}
        draggable
        onDragStart={handleDragStart}
        actions={
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowClaudeMd(true);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Mostra contesto CLAUDE.md"
              title="Mostra contesto CLAUDE.md"
            >
              <FileText className="h-3 w-3" />
            </button>
            {onRenameProject && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameProject(projectNode.projectName, projectNode.project.displayName);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Rinomina progetto"
                title="Rinomina progetto"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onDeleteProject && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(projectNode.projectName, projectNode.project.displayName);
                }}
                className="hover:bg-[color:var(--heritage-b,#E30613)]/10 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:text-[color:var(--heritage-b,#E30613)]"
                aria-label="Elimina progetto"
                title="Elimina progetto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </>
        }
      />
      {isExpanded && projectNode.sessions.length > 0 && (
        <div>
          {projectNode.sessions.map((s) => (
            <SessionRowTree
              key={`${s.provider}:${s.sessionId}`}
              session={s}
              depth={depth + 1}
              location={location}
              folderContext={folderContext}
              project={projectNode.project}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
              onOpenTerminal={onOpenTerminal}
            />
          ))}
        </div>
      )}
      {isExpanded && agents && agents.length > 0 && (
        <div>
          {agents.map((a) => {
            const isAgentSelected =
              location.kind === 'agent' &&
              location.scope === 'project' &&
              location.projectName === projectNode.projectName &&
              location.agentName === a.name;
            return (
              <TreeRow
                key={`agent:${a.name}`}
                depth={depth + 1}
                isSelected={isAgentSelected}
                hasChildren={false}
                isExpanded={false}
                onClick={() => onSelectAgent?.('project', a.name, projectNode.projectName)}
                icon={<Bot className="h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />}
                label={
                  <span className="truncate" title={a.description ?? undefined}>
                    {a.name}
                  </span>
                }
              />
            );
          })}
        </div>
      )}
      {showClaudeMd && (
        <ClaudeMdViewerDialog
          projectName={projectNode.projectName}
          projectDisplayName={projectNode.project.displayName || projectNode.projectName}
          onClose={() => setShowClaudeMd(false)}
        />
      )}
    </div>
  );
}

function SessionRowTree({
  session,
  depth,
  location,
  folderContext,
  project,
  onSelectSession,
  onDeleteSession,
  onOpenTerminal,
}: {
  session: SessionNode;
  depth: number;
  location: Location;
  folderContext: { dashboardId: number; folderIds: number[] };
  project: Project;
  onSelectSession: FoldersSectionProps['onSelectSession'];
  onDeleteSession?: FoldersSectionProps['onDeleteSession'];
  onOpenTerminal?: FoldersSectionProps['onOpenTerminal'];
}) {
  const isSelected =
    location.kind === 'session' &&
    location.projectName === project.name &&
    location.sessionId === session.sessionId;
  const tabsState = useTabsStore();
  const isOpenInTab = tabsState.tabs.some(
    (t) =>
      t.projectName === project.name &&
      t.sessionId === session.sessionId &&
      t.provider === session.provider,
  );
  const title =
    (session.session.title as string | undefined) ||
    session.session.summary ||
    session.session.name ||
    session.sessionId.slice(0, 8);

  return (
    <TreeRow
      depth={depth}
      isSelected={isSelected}
      onClick={() => onSelectSession(project, session.sessionId, session.provider, folderContext)}
      icon={<MessageSquare className={`h-3.5 w-3.5 ${isOpenInTab ? 'text-emerald-500' : 'text-muted-foreground/70'}`} />}
      label={
        <span className={`truncate text-[13px] ${isOpenInTab ? 'font-medium text-emerald-500' : ''}`}>
          {isOpenInTab && (
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle"
              title="Sessione aperta"
              aria-label="Sessione aperta"
            />
          )}
          {title}
        </span>
      }
      actions={
        <>
          {onOpenTerminal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTerminal(project, session.sessionId, session.provider);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Apri terminale"
              title="Apri terminale"
            >
              <Terminal className="h-3 w-3" />
            </button>
          )}
          {onDeleteSession && session.provider !== 'cursor' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(project, session.sessionId, session.provider);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-[color:var(--heritage-b,#E30613)]/10 hover:text-[color:var(--heritage-b,#E30613)]"
              aria-label="Elimina sessione"
              title="Elimina sessione"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </>
      }
    />
  );
}

function arraysEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function filterDashboard(d: DashboardNode, query: string): DashboardNode | null {
  const filteredFolders = d.folders
    .map((f) => filterFolder(f, query))
    .filter((f): f is FolderNode => f !== null);
  const nameMatches = d.dashboard.name.toLowerCase().includes(query);
  if (nameMatches || filteredFolders.length > 0) {
    return { ...d, folders: filteredFolders };
  }
  return null;
}

function filterFolder(f: FolderNode, query: string): FolderNode | null {
  const filteredChildren = f.children
    .map((c) => filterFolder(c, query))
    .filter((c): c is FolderNode => c !== null);
  const filteredProjects = f.projects.filter((p) =>
    (p.project.displayName || p.projectName).toLowerCase().includes(query),
  );
  const nameMatches = f.name.toLowerCase().includes(query);
  if (nameMatches || filteredChildren.length > 0 || filteredProjects.length > 0) {
    return { ...f, children: filteredChildren, projects: filteredProjects };
  }
  return null;
}
