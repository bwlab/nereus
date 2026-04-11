import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { Raccoglitore } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import { getIconComponent } from '../../utils/getIconComponent';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type DashboardTabsViewProps = {
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

export default function DashboardTabsView({
  raccoglitori,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onAssignProject,
  onRemoveProject,
  allProjects,
  taskSummary,
}: DashboardTabsViewProps) {
  const [activeTab, setActiveTab] = useState<number | null>(raccoglitori[0]?.id ?? null);
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const activeRaccoglitore = raccoglitori.find((r) => r.id === activeTab);
  const activeProjects = activeTab ? (projectsByRaccoglitore.get(activeTab) ?? []) : [];

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-1">
          {raccoglitori.map((r) => {
            const IconComponent = getIconComponent(r.icon);
            const count = (projectsByRaccoglitore.get(r.id) ?? []).length;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveTab(r.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                  r.id === activeTab
                    ? 'border-b-2 font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={r.id === activeTab ? { borderBottomColor: r.color } : undefined}
              >
                <span style={{ color: r.color }}><IconComponent className="h-3.5 w-3.5" /></span>
                {r.name}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
              </button>
            );
          })}
          {isAdding ? (
            <div className="flex shrink-0 items-center gap-1 px-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }
                  if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
                }}
                placeholder="Nome..."
                className="w-32 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={() => { if (newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }}} className="rounded p-0.5 hover:bg-accent">
                <Check className="h-3.5 w-3.5 text-primary" />
              </button>
              <button type="button" onClick={() => { setIsAdding(false); setNewName(''); }} className="rounded p-0.5 hover:bg-accent">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent/50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeRaccoglitore && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{activeRaccoglitore.notes || ''}</p>
              <button
                type="button"
                onClick={() => setAssignRid(activeRaccoglitore.id)}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
              >
                <Plus className="h-3 w-3" /> Aggiungi progetto
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeProjects.map((p) => (
              <DashboardProjectCard key={p.name} project={p} onClick={onProjectClick} taskSummary={taskSummary[p.path || p.fullPath || '']} />
            ))}
          </div>
          {activeProjects.length === 0 && activeRaccoglitore && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nessun progetto in questo raccoglitore</p>
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
