import { useState, useEffect, useCallback } from 'react';
import { Loader2, Sparkles, AlertCircle, FolderOpen, Check } from 'lucide-react';
import { useProjectSettingsApi, type ProjectSkill } from '../../hooks/useProjectSettingsApi';

type SkillsTabProps = {
  projectName: string;
};

export default function SkillsTab({ projectName }: SkillsTabProps) {
  const api = useProjectSettingsApi();
  const [skills, setSkills] = useState<ProjectSkill[]>([]);
  const [masterDir, setMasterDir] = useState('');
  const [masterExists, setMasterExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingDir, setEditingDir] = useState(false);
  const [newDirValue, setNewDirValue] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSkills(projectName);
      setSkills(data.skills);
      setMasterDir(data.masterDir);
      setMasterExists(data.masterExists);
      setNewDirValue(data.masterDir);
    } finally {
      setLoading(false);
    }
  }, [api, projectName]);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (skill: ProjectSkill) => {
    try {
      await api.toggleSkill(projectName, skill.name, !skill.enabled);
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSaveDir = async () => {
    if (!newDirValue.trim()) return;
    await api.setSkillsMasterDir(newDirValue.trim());
    setEditingDir(false);
    await reload();
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Master dir config */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Directory master skill</span>
        </div>
        {editingDir ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDirValue}
              onChange={(e) => setNewDirValue(e.target.value)}
              className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="button" onClick={handleSaveDir} className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Salva</button>
            <button type="button" onClick={() => { setEditingDir(false); setNewDirValue(masterDir); }} className="rounded-lg border border-border px-2 py-1 text-xs">Annulla</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{masterDir}</code>
            <button type="button" onClick={() => setEditingDir(true)} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Modifica</button>
          </div>
        )}
        {!masterExists && (
          <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> Directory non trovata
          </div>
        )}
      </div>

      {/* Skills list */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Skill disponibili</h3>
        {skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Nessuna skill trovata nella directory master
          </p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={skill.name} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${skill.enabled ? 'text-primary' : 'text-muted-foreground/50'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{skill.name}</span>
                    {skill.enabled && (
                      <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Check className="h-2.5 w-2.5" /> attiva
                      </span>
                    )}
                    {skill.linkInfo === 'real-dir' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        dir reale
                      </span>
                    )}
                  </div>
                  {skill.description && <p className="mt-0.5 text-xs text-muted-foreground">{skill.description}</p>}
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{skill.masterPath}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(skill)}
                  disabled={skill.linkInfo === 'real-dir'}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${skill.enabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${skill.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
