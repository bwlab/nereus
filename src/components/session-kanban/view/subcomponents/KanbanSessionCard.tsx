import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Pencil, Trash2, Check, X, FolderInput, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../../shared/view/ui';
import { formatTimeAgo } from '../../../../utils/dateUtils';
import { api } from '../../../../utils/api';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';
import type { ProjectSession, SessionProvider } from '../../../../types/app';
import type { SessionLabel } from '../../types/kanban';
import LabelChip from './LabelChip';
import SessionNoteEditor from './SessionNoteEditor';
import LabelManager from './LabelManager';
import MoveSessionDialog from './MoveSessionDialog';
import type { Project } from '../../../../types/app';

type KanbanSessionCardProps = {
  session: ProjectSession;
  note: string;
  sessionLabels: SessionLabel[];
  allLabels: SessionLabel[];
  currentTime: Date;
  projectName: string;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: Project[];
  onArchive?: (sessionId: string) => void;
};

export default function KanbanSessionCard({
  session,
  note,
  sessionLabels,
  allLabels,
  currentTime,
  projectName,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
  onSessionUpdated,
  onSessionDeleted,
  allProjects,
  onArchive,
}: KanbanSessionCardProps) {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id, data: { type: 'session', session } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = String(session.summary || session.title || session.name || session.id);
  const timestamp = session.lastActivity || session.updated_at || session.createdAt || session.created_at;
  const provider = (session.__provider || 'claude') as SessionProvider;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Active detection (same logic as sidebar): < 10 min since last activity
  let isActive = false;
  if (timestamp) {
    const d = new Date(String(timestamp));
    if (!isNaN(d.getTime())) {
      const diffMin = Math.floor((currentTime.getTime() - d.getTime()) / 60000);
      isActive = diffMin < 10;
    }
  }

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(title);
    setIsEditing(true);
  };

  const handleSaveRename = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = editValue.trim();
    if (next && next !== title) {
      try {
        const res = await api.renameSession(session.id, next, provider);
        if (res.ok) onSessionUpdated();
      } catch (err) {
        console.error('Failed to rename session:', err);
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditValue(title);
    setIsEditing(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminare la sessione "${title}"?`)) return;
    try {
      let res;
      if (provider === 'codex') res = await api.deleteCodexSession(session.id);
      else if (provider === 'gemini') res = await api.deleteGeminiSession(session.id);
      else res = await api.deleteSession(projectName, session.id);
      if (res.ok) onSessionDeleted(session.id);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${isActive ? 'border-green-500/40' : 'border-border'} ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => { if (!isEditing) onSessionClick(session); }}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        </div>
      )}

      {/* Hover actions: edit/delete */}
      {!isEditing && (
        <div
          className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleStartEdit}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded bg-muted/80 hover:bg-accent"
            title="Rinomina"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          {provider === 'claude' && allProjects && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMoveDialog(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex h-6 w-6 items-center justify-center rounded bg-muted/80 hover:bg-accent"
              title="Sposta in un altro progetto"
            >
              <FolderInput className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onArchive(session.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex h-6 w-6 items-center justify-center rounded bg-muted/80 hover:bg-accent"
              title="Archivia"
            >
              <Archive className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded bg-destructive/10 hover:bg-destructive/20"
            title="Elimina"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
      )}

      {showMoveDialog && allProjects && (
        <MoveSessionDialog
          session={session}
          sessionTitle={title}
          currentProjectName={projectName}
          allProjects={allProjects}
          onClose={() => setShowMoveDialog(false)}
          onMoved={(sid) => { setShowMoveDialog(false); onSessionDeleted(sid); onSessionUpdated(); }}
        />
      )}

      {/* Header: provider + title */}
      <div className="mb-1.5 flex items-start gap-2">
        <SessionProviderLogo provider={provider} className="h-4 w-4 shrink-0" />
        {isEditing ? (
          <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveRename(); }
                if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
              }}
              className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="button" onClick={(e) => handleSaveRename(e)} onPointerDown={(e) => e.stopPropagation()} className="rounded p-0.5 hover:bg-accent">
              <Check className="h-3.5 w-3.5 text-primary" />
            </button>
            <button type="button" onClick={(e) => handleCancelEdit(e)} onPointerDown={(e) => e.stopPropagation()} className="rounded p-0.5 hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <h4 className="flex-1 truncate pr-14 text-sm font-medium leading-tight text-foreground">
            {title}
          </h4>
        )}
      </div>

      {/* Meta: time + message count */}
      <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
        {timestamp && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(String(timestamp), currentTime, t)}
          </span>
        )}
        {session.messageCount !== undefined && (
          <Badge variant="secondary" className="text-[10px]">
            {session.messageCount}
          </Badge>
        )}
      </div>

      {/* Labels */}
      {sessionLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {sessionLabels.map((label) => (
            <LabelChip
              key={label.id}
              name={label.label_name}
              color={label.color}
              onRemove={() => onToggleLabel(session.id, label.id)}
            />
          ))}
        </div>
      )}

      {/* Note */}
      <div className="mb-1">
        <SessionNoteEditor note={note} onSave={(text) => onNoteChange(session.id, text)} />
      </div>

      {/* Label manager trigger */}
      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <LabelManager
          labels={allLabels}
          assignedLabelIds={sessionLabels.map((l) => l.id)}
          onToggleLabel={(labelId) => onToggleLabel(session.id, labelId)}
          onCreateLabel={onCreateLabel}
          onEditLabel={onEditLabel}
          onDeleteLabel={onDeleteLabel}
        />
      </div>
    </div>
  );
}
