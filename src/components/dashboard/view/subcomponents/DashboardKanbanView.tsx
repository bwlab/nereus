import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { Raccoglitore } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import RaccoglitoreHeader from './RaccoglitoreHeader';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type DashboardKanbanViewProps = {
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

export default function DashboardKanbanView({
  raccoglitori,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onUpdateRaccoglitore,
  onDeleteRaccoglitore,
  onAssignProject,
  onRemoveProject,
  allProjects,
  taskSummary,
}: DashboardKanbanViewProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [assignRid, setAssignRid] = useState<number | null>(null);

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    onAddRaccoglitore(newColName.trim());
    setNewColName('');
    setIsAddingColumn(false);
  };

  return (
    <>
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {raccoglitori.map((r) => {
          const projects = projectsByRaccoglitore.get(r.id) ?? [];
          return (
            <div key={r.id} className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
              <RaccoglitoreHeader
                raccoglitore={r}
                projectCount={projects.length}
                onUpdate={(updates) => onUpdateRaccoglitore(r.id, updates)}
                onDelete={() => onDeleteRaccoglitore(r.id)}
                onAddProject={() => setAssignRid(r.id)}
              />
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: '100px' }}>
                {projects.map((project) => (
                  <DashboardProjectCard key={project.name} project={project} onClick={onProjectClick} taskSummary={taskSummary[project.path || project.fullPath || '']} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Add column button */}
        <div className="flex w-72 shrink-0 items-start">
          {isAddingColumn ? (
            <div className="flex w-full items-center gap-1 rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') { setIsAddingColumn(false); setNewColName(''); }
                }}
                placeholder="Nome raccoglitore..."
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={handleAddColumn} className="rounded p-1 hover:bg-accent">
                <Check className="h-4 w-4 text-primary" />
              </button>
              <button type="button" onClick={() => { setIsAddingColumn(false); setNewColName(''); }} className="rounded p-1 hover:bg-accent">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingColumn(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/20"
            >
              <Plus className="h-4 w-4" />
              Nuovo raccoglitore
            </button>
          )}
        </div>
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
