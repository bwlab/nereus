import { X, Terminal, Wrench, Plug } from 'lucide-react';
import CommandsTab from './tabs/CommandsTab';
import SkillsTab from './tabs/SkillsTab';
import McpToolsTab from './tabs/McpToolsTab';

export type ProjectSettingsTab = 'commands' | 'skills' | 'mcp';

type ProjectSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectDisplayName?: string;
  activeTab: ProjectSettingsTab;
  onChangeTab: (tab: ProjectSettingsTab) => void;
};

const tabMeta: Record<ProjectSettingsTab, { label: string; icon: typeof Terminal }> = {
  commands: { label: 'Comandi', icon: Terminal },
  skills: { label: 'Skills', icon: Wrench },
  mcp: { label: 'MCP Tools', icon: Plug },
};

export default function ProjectSettingsPanel({
  isOpen, onClose, projectName, projectDisplayName, activeTab, onChangeTab,
}: ProjectSettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Impostazioni progetto</h2>
            <p className="text-xs text-muted-foreground">{projectDisplayName || projectName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-4 pt-2">
          {(Object.keys(tabMeta) as ProjectSettingsTab[]).map((key) => {
            const { label, icon: Icon } = tabMeta[key];
            const isActive = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeTab(key)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'commands' && <CommandsTab projectName={projectName} />}
          {activeTab === 'skills' && <SkillsTab projectName={projectName} />}
          {activeTab === 'mcp' && <McpToolsTab projectName={projectName} />}
        </div>
      </div>
    </div>
  );
}
