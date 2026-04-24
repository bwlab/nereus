export default function FooterHint() {
  const shortcuts: Array<{ keys: string[]; label: string }> = [
    { keys: ['/'], label: 'cerca' },
    { keys: ['↑', '↓'], label: 'naviga' },
    { keys: ['Enter'], label: 'apri' },
    { keys: ['Esc'], label: 'reset' },
  ];
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border/50 bg-background/60 px-4 text-[11px] text-muted-foreground">
      {shortcuts.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          {s.keys.map((k, j) => (
            <kbd
              key={j}
              className="rounded border border-border/60 bg-muted/40 px-1 font-mono text-[10px]"
            >
              {k}
            </kbd>
          ))}
          <span>{s.label}</span>
        </span>
      ))}
    </footer>
  );
}
