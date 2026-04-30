import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, SessionProvider } from '../../../types/app';
import type { FullWorkspace } from '../../dashboard/types/dashboard';
import type { Location, PresetKind } from '../types/location';
import PresetsSection from './sections/PresetsSection';
import FoldersSection, { loadExpanded, persistExpanded } from './sections/FoldersSection';

interface UnifiedSidebarProps {
  workspace: FullWorkspace | null;
  projects: Project[];
  location: Location;
  onSelectPreset: (preset: PresetKind) => void;
  onSelectFolder: (dashboardId: number, folderIds: number[]) => void;
  onSelectDashboard: (dashboardId: number) => void;
  onSelectProject: (project: Project, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onSelectSession: (project: Project, sessionId: string, provider: SessionProvider, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
  onCreateDashboard: () => void;
  onCreateFolder?: (dashboardId: number, parentFolderId: number | null) => void;
  onMoveProject?: (projectName: string, targetRaccoglitoreId: number) => void;
  onMoveFolder?: (folderId: number, targetParentId: number | null, targetDashboardId: number) => void;
  onRenameProject?: (projectName: string, currentDisplayName?: string) => void;
  onRenameFolder?: (folderId: number, currentName: string) => void;
  onDeleteFolder?: (folderId: number, currentName: string) => void;
  onDeleteSession?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onDeleteProject?: (projectName: string, displayName?: string) => void;
  onOpenTerminal?: (project: Project, sessionId: string, provider: SessionProvider) => void;
  onSelectAgent?: (scope: 'global' | 'project', agentName: string, projectName?: string) => void;
  presetCounts?: Partial<Record<PresetKind, number>>;
  searchQuery?: string;
}

const PRESETS_HEIGHT_KEY = 'bwlab.sidebar.presetsHeightPx';
const PRESETS_HEIGHT_MIN = 80;
const PRESETS_HEIGHT_MAX_MARGIN = 120; // leave at least this much for folders
const PRESETS_HEIGHT_DEFAULT = 280;

function loadPresetsHeight(): number {
  try {
    const raw = localStorage.getItem(PRESETS_HEIGHT_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : PRESETS_HEIGHT_DEFAULT;
  } catch {
    return PRESETS_HEIGHT_DEFAULT;
  }
}

export default function UnifiedSidebar(props: UnifiedSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded());
  const [presetsHeight, setPresetsHeight] = useState<number>(() => loadPresetsHeight());
  const asideRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(PRESETS_HEIGHT_KEY, String(presetsHeight)); } catch { /* ignore */ }
  }, [presetsHeight]);

  const handleResizerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = { startY: e.clientY, startH: presetsHeight };
  }, [presetsHeight]);

  const handleResizerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const aside = asideRef.current;
    const maxH = aside ? aside.clientHeight - PRESETS_HEIGHT_MAX_MARGIN : 1000;
    const next = Math.min(maxH, Math.max(PRESETS_HEIGHT_MIN, dragStateRef.current.startH + (e.clientY - dragStateRef.current.startY)));
    setPresetsHeight(next);
  }, []);

  const handleResizerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    persistExpanded(expanded);
  }, [expanded]);

  const handleToggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Auto-expand ancestors when a folder/project/session becomes the active location
  useEffect(() => {
    setExpanded((prev) => {
      const loc = props.location;
      const toAdd: string[] = [];
      if (loc.kind === 'folder') {
        toAdd.push(`d:${loc.dashboardId}`);
        for (const fid of loc.folderIds) toAdd.push(`f:${fid}`);
      } else if (loc.kind === 'project' || loc.kind === 'session') {
        if (loc.folderContext) {
          toAdd.push(`d:${loc.folderContext.dashboardId}`);
          for (const fid of loc.folderContext.folderIds) toAdd.push(`f:${fid}`);
        }
        if (loc.kind === 'session') toAdd.push(`p:${loc.projectName}`);
      }
      if (toAdd.length === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const k of toAdd) if (!next.has(k)) { next.add(k); changed = true; }
      return changed ? next : prev;
    });
  }, [props.location]);

  return (
    <aside ref={asideRef} data-tour="sidebar" className="flex h-full w-[300px] shrink-0 flex-col border-r border-border/60 bg-background/60">
      <div style={{ height: presetsHeight }} className="shrink-0 overflow-y-auto">
        <PresetsSection
          location={props.location}
          onSelect={props.onSelectPreset}
          counts={props.presetCounts}
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={handleResizerPointerDown}
        onPointerMove={handleResizerPointerMove}
        onPointerUp={handleResizerPointerUp}
        onPointerCancel={handleResizerPointerUp}
        className="group relative h-1.5 shrink-0 cursor-row-resize border-y border-border/40 bg-border/20 transition hover:bg-[color:var(--heritage-a,#F5D000)]/40"
        title="Trascina per ridimensionare"
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-0.5 w-10 -translate-y-1/2 rounded bg-border/60 group-hover:bg-foreground/40" />
      </div>
        <FoldersSection
        workspace={props.workspace}
        projects={props.projects}
        location={props.location}
        onSelectFolder={props.onSelectFolder}
        onSelectDashboard={props.onSelectDashboard}
        onSelectProject={props.onSelectProject}
        onSelectSession={props.onSelectSession}
        onCreateDashboard={props.onCreateDashboard}
        onCreateFolder={props.onCreateFolder}
        onMoveProject={props.onMoveProject}
        onMoveFolder={props.onMoveFolder}
        onRenameProject={props.onRenameProject}
        onRenameFolder={props.onRenameFolder}
        onDeleteFolder={props.onDeleteFolder}
        onDeleteSession={props.onDeleteSession}
        onDeleteProject={props.onDeleteProject}
        onOpenTerminal={props.onOpenTerminal}
        onSelectAgent={props.onSelectAgent}
        expanded={expanded}
        onToggleExpanded={handleToggleExpanded}
        searchQuery={props.searchQuery}
      />
    </aside>
  );
}
