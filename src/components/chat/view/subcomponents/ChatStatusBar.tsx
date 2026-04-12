import { CLAUDE_MODELS, CODEX_MODELS, CURSOR_MODELS, GEMINI_MODELS, getContextWindowForModel } from '../../../../../shared/modelConstants';

type Provider = 'claude' | 'cursor' | 'codex' | 'gemini';

type ChatStatusBarProps = {
  provider: Provider | string;
  selectedModel: string;
  permissionMode: string;
  tokenBudget: { used?: number; total?: number } | null;
  sessionId?: string | null;
  appVersion?: string;
};

function getModelLabel(provider: string, value: string): string {
  const map: Record<string, { value: string; label: string }[]> = {
    claude: CLAUDE_MODELS.OPTIONS,
    cursor: CURSOR_MODELS.OPTIONS,
    codex: CODEX_MODELS.OPTIONS,
    gemini: GEMINI_MODELS.OPTIONS,
  };
  const opts = map[provider] ?? [];
  return opts.find((o) => o.value === value)?.label ?? value;
}

function renderContextBar(pct: number): string {
  const filled = Math.round(Math.min(Math.max(pct, 0), 100) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const permissionModeMeta: Record<string, { label: string; color: string }> = {
  default: { label: 'default', color: 'bg-muted-foreground' },
  acceptEdits: { label: 'accept edits', color: 'bg-green-500' },
  bypassPermissions: { label: 'bypass', color: 'bg-orange-500' },
  plan: { label: 'plan mode', color: 'bg-primary' },
  dontAsk: { label: "don't ask", color: 'bg-muted-foreground' },
};

export default function ChatStatusBar({
  provider,
  selectedModel,
  permissionMode,
  tokenBudget,
  sessionId,
  appVersion,
}: ChatStatusBarProps) {
  const modelLabel = getModelLabel(provider, selectedModel);
  const used = tokenBudget?.used ?? 0;
  const total = getContextWindowForModel(selectedModel, provider);
  const ctxPct = total > 0 ? Math.round((used / total) * 100) : 0;
  const modeMeta = permissionModeMeta[permissionMode] ?? permissionModeMeta.default;
  const shortSid = sessionId ? sessionId.slice(0, 8) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">{modelLabel}</span>
      <span className="text-muted-foreground/60">|</span>

      <span className="capitalize">{provider}</span>
      <span className="text-muted-foreground/60">|</span>

      <span>
        ctx:[<span className="text-primary">{renderContextBar(ctxPct)}</span>] {ctxPct}%
      </span>
      <span className="text-muted-foreground/60">|</span>

      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${modeMeta.color}`} />
        {modeMeta.label}
      </span>

      {shortSid && (
        <>
          <span className="text-muted-foreground/60">|</span>
          <span>sid:{shortSid}</span>
        </>
      )}

      {appVersion && (
        <>
          <span className="text-muted-foreground/60">|</span>
          <span>v{appVersion}</span>
        </>
      )}
    </div>
  );
}
