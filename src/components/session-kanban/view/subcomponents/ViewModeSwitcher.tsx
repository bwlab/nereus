import { Columns3, AlignJustify, LayoutGrid, Rows } from 'lucide-react';

export type ViewMode = 'kanban' | 'accordion' | 'tabs' | 'grid';

interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const OPTIONS: Array<{ mode: ViewMode; label: string; Icon: typeof Columns3 }> = [
  { mode: 'kanban', label: 'Kanban', Icon: Columns3 },
  { mode: 'accordion', label: 'Accordion', Icon: AlignJustify },
  { mode: 'tabs', label: 'Tabs', Icon: Rows },
  { mode: 'grid', label: 'Grid', Icon: LayoutGrid },
];

export default function ViewModeSwitcher({ viewMode, onViewModeChange }: ViewModeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5">
      {OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onViewModeChange(mode)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
            viewMode === mode
              ? 'bg-[color:var(--heritage-yellow,#F5D000)] text-black shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          aria-label={label}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
