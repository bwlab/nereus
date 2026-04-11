import { useState } from 'react';
import { GripVertical, Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import type { KanbanColumn } from '../../types/kanban';

type KanbanColumnHeaderProps = {
  column: KanbanColumn;
  sessionCount: number;
  dragHandleProps?: Record<string, unknown>;
  onRename: (columnId: number, name: string) => void;
  onDelete: (columnId: number) => void;
  onNewSession?: () => void;
};

export default function KanbanColumnHeader({
  column,
  sessionCount,
  dragHandleProps,
  onRename,
  onDelete,
  onNewSession,
}: KanbanColumnHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(column.column_name);

  const handleSave = () => {
    if (name.trim() && name.trim() !== column.column_name) {
      onRename(column.id, name.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>

      {isEditing ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setName(column.column_name); setIsEditing(false); }
            }}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="button" onClick={handleSave} className="rounded p-0.5 hover:bg-accent">
            <Check className="h-3.5 w-3.5 text-primary" />
          </button>
          <button type="button" onClick={() => { setName(column.column_name); setIsEditing(false); }} className="rounded p-0.5 hover:bg-accent">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <h3 className="flex-1 truncate text-sm font-semibold text-foreground">{column.column_name}</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sessionCount}
          </span>
          {onNewSession && (
            <button
              type="button"
              onClick={onNewSession}
              className="rounded p-0.5 text-primary transition-colors hover:bg-primary/10"
              title="Nuova sessione"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/col:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {!column.is_default && (
            <button
              type="button"
              onClick={() => onDelete(column.id)}
              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/col:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
