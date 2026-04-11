import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';

type AddColumnButtonProps = {
  onAdd: (name: string) => void;
};

export default function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="flex h-10 min-w-[220px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Nuova colonna
      </button>
    );
  }

  return (
    <div className="flex min-w-[220px] shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setIsAdding(false); setName(''); }
        }}
        placeholder="Nome colonna..."
        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <button type="button" onClick={handleSubmit} className="rounded p-1 hover:bg-accent">
        <Check className="h-4 w-4 text-primary" />
      </button>
      <button type="button" onClick={() => { setIsAdding(false); setName(''); }} className="rounded p-1 hover:bg-accent">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
