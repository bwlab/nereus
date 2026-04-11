import { useState, useRef, useEffect } from 'react';
import { StickyNote, Check, X } from 'lucide-react';

type SessionNoteEditorProps = {
  note: string;
  onSave: (text: string) => void;
};

export default function SessionNoteEditor({ note, onSave }: SessionNoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(note);
  }, [note]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(text.length, text.length);
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    onSave(text);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="flex w-full items-start gap-1 text-left"
      >
        {note ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{note}</p>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Aggiungi nota...
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
          if (e.key === 'Escape') { setText(note); setIsEditing(false); }
        }}
        rows={3}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex justify-end gap-1">
        <button type="button" onClick={handleSave} className="rounded p-0.5 hover:bg-accent">
          <Check className="h-3.5 w-3.5 text-primary" />
        </button>
        <button type="button" onClick={() => { setText(note); setIsEditing(false); }} className="rounded p-0.5 hover:bg-accent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
