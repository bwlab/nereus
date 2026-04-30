import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { TerminalSquare, X, Play } from 'lucide-react';
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
  // If the stored model is no longer in the official list (e.g. a removed alias like opus[1m]),
  // fall back to the default so the popover doesn't emit an invalid value.
  const isValidModel = CLAUDE_MODELS.OPTIONS.some((m) => m.value === currentModel);
  const [model, setModel] = useState(isValidModel ? currentModel : CLAUDE_MODELS.DEFAULT);
  const [verbose, setVerbose] = useState(false);
  const [debug, setDebug] = useState(false);
  const [launching, setLaunching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const computePos = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const width = 320;
      const popHeight = popoverRef.current?.offsetHeight ?? 360;
      const margin = 8;
      let top = r.top - popHeight - margin;
      if (top < margin) top = Math.min(r.bottom + margin, window.innerHeight - popHeight - margin);
      let left = r.right - width;
      if (left < margin) left = margin;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
      setPopoverPos({ top, left });
    };
    computePos();
    window.addEventListener('resize', computePos);
    window.addEventListener('scroll', computePos, true);
    return () => {
      window.removeEventListener('resize', computePos);
      window.removeEventListener('scroll', computePos, true);
    };
  }, [isOpen]);

  // Preview del comando (allineato al backend che wrappa ogni valore in single quotes)
  const shQuote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
  const parts: string[] = ['claude'];
  if (continueSession) {
    parts.push('--continue');
  } else if (resume && currentSessionId) {
    parts.push('--resume', shQuote(currentSessionId));
  }
  if (permissionMode === 'bypassPermissions') parts.push('--dangerously-skip-permissions');
  else if (permissionMode !== 'default') parts.push('--permission-mode', shQuote(permissionMode));
  if (model) parts.push('--model', shQuote(model));
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
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground sm:h-8 sm:w-8"
        title="Apri claude nel terminale di sistema"
      >
        <TerminalSquare className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverPos?.top ?? -9999,
            left: popoverPos?.left ?? -9999,
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
          className="z-[100] w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
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
        </div>,
        document.body,
      )}
    </div>
  );
}
