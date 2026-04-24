import { ChevronRight, Home, Search, Flag } from 'lucide-react';
import type { FullWorkspace } from '../../../dashboard/types/dashboard';
import type { Project } from '../../../../types/app';
import type { Location } from '../../types/location';
import { PRESET_LABELS } from '../../types/location';
import { resolveFolderPath, buildUnifiedTree } from '../../utils/buildUnifiedTree';

interface UnifiedBreadcrumbProps {
  location: Location;
  workspace: FullWorkspace | null;
  projects: Project[];
  searchQuery?: string;
  selectedSessionTitle?: string | null;
  onGoHome: () => void;
  onGoToFolder: (dashboardId: number, folderIds: number[]) => void;
  onGoToProject: (projectName: string, folderContext?: { dashboardId: number; folderIds: number[] }) => void;
}

export default function UnifiedBreadcrumb({
  location,
  workspace,
  projects,
  searchQuery,
  selectedSessionTitle,
  onGoHome,
  onGoToFolder,
  onGoToProject,
}: UnifiedBreadcrumbProps) {
  const items: Array<{ label: string; onClick?: () => void; bold?: boolean }> = [];

  // Search state overrides everything
  if (searchQuery && searchQuery.trim().length > 0) {
    return (
      <div className="flex h-[42px] items-center gap-2 border-b border-border/60 px-4 text-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Risultati per</span>
        <span className="font-semibold">"{searchQuery.trim()}"</span>
      </div>
    );
  }

  if (location.kind === 'preset') {
    return (
      <div className="flex h-[42px] items-center gap-2 border-b border-border/60 px-4 text-sm">
        <Flag className="h-4 w-4 text-[color:var(--heritage-a,#F5D000)]" />
        <span className="font-semibold">{PRESET_LABELS[location.preset]}</span>
      </div>
    );
  }

  items.push({ label: 'Home', onClick: onGoHome });

  const tree = workspace ? buildUnifiedTree(workspace, projects).dashboards : [];

  if (location.kind === 'folder') {
    const { dashboard, crumbs } = resolveFolderPath(tree, location.dashboardId, location.folderIds);
    if (dashboard) {
      items.push({
        label: dashboard.dashboard.name,
        onClick: () => onGoToFolder(dashboard.id, []),
      });
    }
    crumbs.forEach((c, idx) => {
      const subPath = crumbs.slice(0, idx + 1).map((x) => x.id);
      const isLast = idx === crumbs.length - 1;
      items.push({
        label: c.name,
        onClick: () => onGoToFolder(location.dashboardId, subPath),
        bold: isLast,
      });
    });
  } else if (location.kind === 'project' || location.kind === 'session') {
    const ctx = location.folderContext;
    if (ctx) {
      const { dashboard, crumbs } = resolveFolderPath(tree, ctx.dashboardId, ctx.folderIds);
      if (dashboard) {
        items.push({
          label: dashboard.dashboard.name,
          onClick: () => onGoToFolder(dashboard.id, []),
        });
      }
      crumbs.forEach((c, idx) => {
        const subPath = crumbs.slice(0, idx + 1).map((x) => x.id);
        items.push({
          label: c.name,
          onClick: () => onGoToFolder(ctx.dashboardId, subPath),
        });
      });
    }
    const project = projects.find((p) => p.name === location.projectName);
    const projectLabel = project?.displayName ?? location.projectName;
    items.push({
      label: projectLabel,
      onClick: location.kind === 'session' ? () => onGoToProject(location.projectName, ctx) : undefined,
      bold: location.kind === 'project',
    });
    if (location.kind === 'session') {
      items.push({
        label: selectedSessionTitle || location.sessionId.slice(0, 8),
        bold: true,
      });
    }
  }

  return (
    <div className="flex h-[42px] items-center gap-1 overflow-x-auto border-b border-border/60 px-4 text-sm whitespace-nowrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
          {i === 0 ? (
            <button
              type="button"
              onClick={item.onClick}
              className="flex items-center gap-1 rounded px-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={`rounded px-1 transition ${
                item.bold ? 'font-semibold text-foreground' : 'text-muted-foreground'
              } ${item.onClick ? 'hover:bg-muted hover:text-foreground' : ''}`}
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
