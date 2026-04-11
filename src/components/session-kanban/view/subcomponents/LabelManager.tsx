import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Check, Pencil, Trash2, X } from 'lucide-react';
import type { SessionLabel } from '../../types/kanban';
import LabelChip from './LabelChip';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

type LabelManagerProps = {
  labels: SessionLabel[];
  assignedLabelIds: number[];
  onToggleLabel: (labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function LabelManager({
  labels,
  assignedLabelIds,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: LabelManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmitNew = () => {
    if (name.trim()) {
      onCreateLabel(name.trim(), color);
      setName('');
      setColor(PRESET_COLORS[0]);
      setIsCreating(false);
    }
  };

  const handleSubmitEdit = (labelId: number) => {
    if (name.trim()) {
      onEditLabel(labelId, name.trim(), color);
      setName('');
      setEditingId(null);
    }
  };

  const startEdit = (label: SessionLabel) => {
    setEditingId(label.id);
    setName(label.label_name);
    setColor(label.color);
    setIsCreating(false);
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground"
      >
        <Tag className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Etichette</div>

          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {labels.map((label) => {
              const isAssigned = assignedLabelIds.includes(label.id);

              if (editingId === label.id) {
                return (
                  <div key={label.id} className="flex flex-col gap-1 rounded p-1">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmitEdit(label.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-0.5 text-xs outline-none"
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`h-4 w-4 rounded-full border-2 ${c === color ? 'border-foreground' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => handleSubmitEdit(label.id)} className="rounded p-0.5 hover:bg-accent">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded p-0.5 hover:bg-accent">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={label.id} className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent">
                  <button
                    type="button"
                    onClick={() => onToggleLabel(label.id)}
                    className="flex flex-1 items-center gap-1.5"
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isAssigned ? 'border-primary bg-primary' : 'border-border'}`}
                    >
                      {isAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <LabelChip name={label.label_name} color={label.color} />
                  </button>
                  <button type="button" onClick={() => startEdit(label)} className="hidden rounded p-0.5 hover:bg-background group-hover:block">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button type="button" onClick={() => onDeleteLabel(label.id)} className="hidden rounded p-0.5 hover:bg-background group-hover:block">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>

          {isCreating ? (
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitNew();
                  if (e.key === 'Escape') { setIsCreating(false); setName(''); }
                }}
                placeholder="Nome etichetta..."
                className="w-full rounded border border-border bg-background px-2 py-0.5 text-xs outline-none"
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-4 w-4 rounded-full border-2 ${c === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1">
                <button type="button" onClick={handleSubmitNew} className="rounded p-0.5 hover:bg-accent">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </button>
                <button type="button" onClick={() => { setIsCreating(false); setName(''); }} className="rounded p-0.5 hover:bg-accent">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setIsCreating(true); setName(''); setColor(PRESET_COLORS[0]); }}
              className="mt-2 flex w-full items-center gap-1 border-t border-border pt-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Nuova etichetta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
