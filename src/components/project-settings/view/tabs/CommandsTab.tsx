import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2, FileText, Sparkles } from 'lucide-react';
import { useProjectSettingsApi, type ProjectCommand } from '../../hooks/useProjectSettingsApi';

type CommandsTabProps = {
  projectName: string;
};

export default function CommandsTab({ projectName }: CommandsTabProps) {
  const api = useProjectSettingsApi();
  const [commands, setCommands] = useState<ProjectCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProjectCommand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [initStatus, setInitStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listCommands(projectName);
      setCommands(list);
    } finally {
      setLoading(false);
    }
  }, [api, projectName]);

  useEffect(() => { reload(); }, [reload]);

  const handleInit = async () => {
    setInitStatus(null);
    try {
      const result = await api.generateClaudeMd(projectName);
      setInitStatus(result.alreadyExists ? `CLAUDE.md esistente: ${result.path}` : `CLAUDE.md generato: ${result.path}`);
    } catch (err) {
      setInitStatus((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* /init quick action */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Genera CLAUDE.md</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Crea lo scheletro di CLAUDE.md nel progetto se non esiste già.</p>
            {initStatus && <p className="mt-1 text-xs text-muted-foreground">{initStatus}</p>}
          </div>
          <button
            type="button"
            onClick={handleInit}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            /init
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Comandi di progetto</h3>
        {!isCreating && !editing && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> Nuovo
          </button>
        )}
      </div>

      {/* Create/Edit form */}
      {(isCreating || editing) && (
        <CommandForm
          projectName={projectName}
          command={editing}
          onCancel={() => { setIsCreating(false); setEditing(null); }}
          onSaved={async () => { await reload(); setIsCreating(false); setEditing(null); }}
        />
      )}

      {/* Commands list */}
      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      {!loading && commands.length === 0 && !isCreating && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nessun comando. Crea il primo con <strong>Nuovo</strong>.
        </div>
      )}

      {!loading && commands.length > 0 && (
        <div className="space-y-2">
          {commands.map((cmd) => (
            <div key={cmd.name} className="group rounded-lg border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">/{cmd.name}</span>
                    {cmd.namespace && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{cmd.namespace}</span>}
                  </div>
                  {cmd.description && <p className="mt-0.5 text-xs text-muted-foreground">{cmd.description}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => setEditing(cmd)} className="rounded p-1 hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Eliminare /${cmd.name}?`)) return;
                      await api.deleteCommand(projectName, cmd.name);
                      await reload();
                    }}
                    className="rounded p-1 hover:bg-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandForm({
  projectName, command, onCancel, onSaved,
}: {
  projectName: string;
  command: ProjectCommand | null;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const api = useProjectSettingsApi();
  const isEdit = Boolean(command);
  const [name, setName] = useState(command?.name ?? '');
  const [description, setDescription] = useState(command?.description ?? '');
  const [body, setBody] = useState(command?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateCommand(projectName, command!.name, { description, body });
      } else {
        if (!name.trim()) { setError('Nome richiesto'); return; }
        await api.createCommand(projectName, { name, description, body });
      }
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{isEdit ? `Modifica /${command!.name}` : 'Nuovo comando'}</h4>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-accent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        {!isEdit && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome (senza /)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mycommand"
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Descrizione</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Contenuto (prompt inviato a Claude, supporta $1, $2, $ARGUMENTS)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">Annulla</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
