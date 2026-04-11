import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Check, X } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { Raccoglitore } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import { getIconComponent } from '../../utils/getIconComponent';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type DashboardAccordionViewProps = {
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

export default function DashboardAccordionView({
  raccoglitori,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onAssignProject,
  onRemoveProject,
  allProjects,
  taskSummary,
}: DashboardAccordionViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(raccoglitori.map((r) => r.id)));
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <>
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
        {raccoglitori.map((r) => {
          const projects = projectsByRaccoglitore.get(r.id) ?? [];
          const isOpen = expanded.has(r.id);
          const IconComponent = getIconComponent(r.icon);

          return (
            <div key={r.id} className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: r.color + '20', color: r.color }}>
                  <IconComponent className="h-3 w-3" />
                </div>
                <span className="flex-1 text-sm font-semibold">{r.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{projects.length}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAssignRid(r.id); }}
                  className="rounded p-1 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </button>
              {isOpen && projects.length > 0 && (
                <div className="grid grid-cols-1 gap-2 border-t border-border/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((p) => (
                    <DashboardProjectCard key={p.name} project={p} onClick={onProjectClick} taskSummary={taskSummary[p.path || p.fullPath || '']} />
                  ))}
                </div>
              )}
              {isOpen && projects.length === 0 && (
                <div className="border-t border-border/50 px-4 py-4 text-center text-xs text-muted-foreground">
                  Nessun progetto
                </div>
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
