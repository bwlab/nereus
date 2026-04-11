import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { Raccoglitore } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import { getIconComponent } from '../../utils/getIconComponent';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type DashboardGridViewProps = {
  raccoglitori: Raccoglitore[];
  projectsByRaccoglitore: Map<number, Project[]>;
  onProjectClick: (project: Project) => void;
  onAddRaccoglitore: (name: string, color?: string, icon?: string, notes?: string) => void;
  onUpdateRaccoglitore: (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDeleteRaccoglitore: (rid: number) => void;
  onAssignProject: (rid: number, projectName: string) => void;
  onRemoveProject: (rid: number, projectName: string) => void;
  allProjects: Project[];
  taskSummary: ClaudeTaskSummaryByProject;
};

export default function DashboardGridView({
  raccoglitori,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onAssignProject,
  onRemoveProject,
  allProjects,
  taskSummary,
}: DashboardGridViewProps) {
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <>
      <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
        {raccoglitori.map((r) => {
          const projects = projectsByRaccoglitore.get(r.id) ?? [];
          const IconComponent = getIconComponent(r.icon);

          return (
            <div key={r.id}>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: r.color + '20', color: r.color }}>
                  <IconComponent className="h-3 w-3" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{r.name}</h3>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{projects.length}</span>
                <button
                  type="button"
                  onClick={() => setAssignRid(r.id)}
                  className="rounded p-0.5 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {projects.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {projects.map((p) => (
                    <DashboardProjectCard key={p.name} project={p} onClick={onProjectClick} taskSummary={taskSummary[p.path || p.fullPath || '']} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/50 py-4 text-center text-xs text-muted-foreground">
                  Nessun progetto
                </p>
              )}
            </div>
          );
        })}

        {isAdding ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }
                if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
              }}
              placeholder="Nome raccoglitore..."
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="button" onClick={() => { if (newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }}} className="rounded p-1 hover:bg-accent">
              <Check className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => { setIsAdding(false); setNewName(''); }} className="rounded p-1 hover:bg-accent">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground hover:border-border hover:bg-muted/10"
          >
            <Plus className="h-4 w-4" /> Nuovo raccoglitore
          </button>
        )}
      </div>

      {assignRid !== null && (
        <ProjectAssignmentDialog
          allProjects={allProjects}
          assignedProjects={(projectsByRaccoglitore.get(assignRid) ?? []).map((p) => p.name)}
          onAssign={(name) => onAssignProject(assignRid, name)}
          onRemove={(name) => onRemoveProject(assignRid, name)}
          onClose={() => setAssignRid(null)}
        />
      )}
    </>
  );
}
