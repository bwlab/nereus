import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Loader2, RotateCcw, Save } from 'lucide-react';
import { useProjectSettingsApi } from '../../../project-settings/hooks/useProjectSettingsApi';

type DirState = {
  current: string;
  defaultPath: string;
  draft: string;
  saving: boolean;
};

const EMPTY: DirState = { current: '', defaultPath: '', draft: '', saving: false };

export default function SkillsSettingsTab() {
  const api = useProjectSettingsApi();
  const [globalDir, setGlobalDir] = useState<DirState>(EMPTY);
  const [projectDir, setProjectDir] = useState<DirState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, p] = await Promise.all([
        api.getSkillsGlobalMasterDir(),
        api.getSkillsMasterDir(),
      ]);
      setGlobalDir({ current: g.path, defaultPath: g.defaultPath, draft: g.path, saving: false });
      setProjectDir({ current: p.path, defaultPath: p.defaultPath, draft: p.path, saving: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void reload(); }, [reload]);

  const saveGlobal = async () => {
    if (!globalDir.draft.trim() || globalDir.draft === globalDir.current) return;
    setGlobalDir((s) => ({ ...s, saving: true }));
    try {
      await api.setSkillsGlobalMasterDir(globalDir.draft.trim());
      setGlobalDir((s) => ({ ...s, current: s.draft.trim(), saving: false }));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setGlobalDir((s) => ({ ...s, saving: false }));
    }
  };

  const saveProject = async () => {
    if (!projectDir.draft.trim() || projectDir.draft === projectDir.current) return;
    setProjectDir((s) => ({ ...s, saving: true }));
    try {
      await api.setSkillsMasterDir(projectDir.draft.trim());
      setProjectDir((s) => ({ ...s, current: s.draft.trim(), saving: false }));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setProjectDir((s) => ({ ...s, saving: false }));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Directory skill</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cartelle contenenti la libreria di skill. La sezione &laquo;Skills&raquo; nella sidebar elenca tutto ciò che è presente.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <DirEditor
        title="Skill globali (master)"
        helper="Skill condivise tra tutti i progetti."
        state={globalDir}
        setState={setGlobalDir}
        onSave={saveGlobal}
      />

      <DirEditor
        title="Skill per-progetto (master)"
        helper="Sorgente da cui i progetti collegano in symlink le proprie skill."
        state={projectDir}
        setState={setProjectDir}
        onSave={saveProject}
      />
    </div>
  );
}

type DirEditorProps = {
  title: string;
  helper: string;
  state: DirState;
  setState: React.Dispatch<React.SetStateAction<DirState>>;
  onSave: () => void;
};

function DirEditor({ title, helper, state, setState, onSave }: DirEditorProps) {
  const dirty = state.draft.trim() !== state.current;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{helper}</div>
        </div>
      </div>
      <input
        type="text"
        value={state.draft}
        onChange={(e) => setState((s) => ({ ...s, draft: e.target.value }))}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, draft: s.defaultPath }))}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Default
        </button>
        <button
          type="button"
          disabled={!dirty || state.saving}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Salva
        </button>
      </div>
      <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
        Default: {state.defaultPath}
      </p>
    </div>
  );
}
