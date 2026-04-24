import type { ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface TreeRowProps {
  depth: number;
  isSelected?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  icon?: ReactNode;
  label: ReactNode;
  count?: number | string | null;
  actions?: ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  isDropTarget?: boolean;
  className?: string;
}

export default function TreeRow({
  depth,
  isSelected = false,
  hasChildren = false,
  isExpanded = false,
  onToggleExpand,
  onClick,
  icon,
  label,
  count,
  actions,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  isDropTarget = false,
  className = '',
}: TreeRowProps) {
  const indentPx = Math.min(depth, 8) * 14 + 8;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`group relative flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-sm transition ${
        isSelected
          ? 'bg-[color:var(--heritage-a,#F5D000)]/15 text-[color:var(--heritage-a,#F5D000)]'
          : 'text-foreground/85 hover:bg-muted/50'
      } ${
        isDropTarget
          ? 'ring-1 ring-[color:var(--heritage-b,#E30613)]/60 bg-[color:var(--heritage-b,#E30613)]/10'
          : ''
      } ${className}`}
      style={{ paddingLeft: indentPx }}
    >
      {isSelected && (
        <span className="pointer-events-none absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[color:var(--heritage-a,#F5D000)]" />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.(e);
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-foreground ${
          hasChildren ? '' : 'invisible'
        }`}
        aria-label={isExpanded ? 'Collassa' : 'Espandi'}
        tabIndex={-1}
      >
        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {actions ? (
        <span className="hidden items-center gap-0.5 group-hover:flex">{actions}</span>
      ) : (
        typeof count === 'number' || typeof count === 'string' ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground group-hover:hidden">
            {count}
          </span>
        ) : null
      )}
    </div>
  );
}
