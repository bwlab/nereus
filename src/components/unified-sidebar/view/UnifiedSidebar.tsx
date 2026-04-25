import { useCallback, useEffect, useState } from 'react';
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

export default function UnifiedSidebar(props: UnifiedSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded());

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
    <aside data-tour="sidebar" className="flex h-full w-[300px] shrink-0 flex-col border-r border-border/60 bg-background/60">
      <PresetsSection
        location={props.location}
        onSelect={props.onSelectPreset}
        counts={props.presetCounts}
      />
      <div className="mt-3 border-t border-border/40" />
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
