import { useState, useRef, useEffect } from 'react';
import { Terminal, X, Play } from 'lucide-react';
import { CLAUDE_MODELS } from '../../../../../shared/modelConstants';
import { authenticatedFetch } from '../../../../utils/api';

type TerminalLauncherProps = {
  projectName: string;
  currentSessionId?: string | null;
  currentModel: string;
  currentPermissionMode: string;
};

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export default function TerminalLauncher({
  projectName, currentSessionId, currentModel, currentPermissionMode,
}: TerminalLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resume, setResume] = useState(Boolean(currentSessionId));
  const [continueSession, setContinueSession] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>((currentPermissionMode as PermissionMode) || 'default');
  const [model, setModel] = useState(currentModel);
  const [verbose, setVerbose] = useState(false);
  const [debug, setDebug] = useState(false);
  const [launching, setLaunching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preview del comando
  const parts: string[] = ['claude'];
  if (continueSession) {
    parts.push('--continue');
  } else if (resume && currentSessionId) {
    parts.push('--resume', currentSessionId);
  }
  if (permissionMode === 'bypassPermissions') parts.push('--dangerously-skip-permissions');
  else if (permissionMode !== 'default') parts.push('--permission-mode', permissionMode);
  if (model) parts.push('--model', model);
  if (verbose) parts.push('--verbose');
  if (debug) parts.push('--debug');
  const commandPreview = parts.join(' ');

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await authenticatedFetch(`/api/project-open/${encodeURIComponent(projectName)}/in-terminal-with-claude`, {
        method: 'POST',
        body: JSON.stringify({
          resume: resume && !continueSession ? currentSessionId : null,
          continueSession,
          permissionMode,
          model,
          verbose,
          debug,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Impossibile aprire il terminale');
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground sm:h-8 sm:w-8"
        title="Apri claude nel terminale di sistema"
      >
        <Terminal className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Apri claude nel terminale</h3>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded p-1 hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-3 p-3 text-xs">
            {/* Resume / Continue */}
            <div className="space-y-1.5">
              <label className={`flex items-center gap-2 ${!currentSessionId ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={resume && !continueSession}
                  disabled={!currentSessionId || continueSession}
                  onChange={(e) => setResume(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-foreground">
                  Resume sessione corrente
                  {currentSessionId && <span className="ml-1 font-mono text-muted-foreground">({currentSessionId.slice(0, 8)})</span>}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={continueSession}
                  onChange={(e) => { setContinueSession(e.target.checked); if (e.target.checked) setResume(false); }}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-foreground">Continue (ultima conversazione del cwd)</span>
              </label>
            </div>

            {/* Permission mode */}
            <div>
              <label className="mb-1 block text-muted-foreground">Permission mode</label>
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
                className="w-full rounded border border-border bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="default">default</option>
                <option value="acceptEdits">acceptEdits</option>
                <option value="bypassPermissions">bypassPermissions (--dangerously-skip-permissions)</option>
                <option value="plan">plan</option>
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="mb-1 block text-muted-foreground">Modello</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
              >
                {CLAUDE_MODELS.OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Flags */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verbose}
                  onChange={(e) => setVerbose(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-foreground">Verbose (<code className="rounded bg-muted px-1">--verbose</code>)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-foreground">Debug (<code className="rounded bg-muted px-1">--debug</code>)</span>
              </label>
            </div>

            {/* Command preview */}
            <div>
              <label className="mb-1 block text-muted-foreground">Comando</label>
              <code className="block overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
                {commandPreview}
              </code>
            </div>
          </div>

          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {launching ? 'Apertura...' : 'Apri terminale'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
