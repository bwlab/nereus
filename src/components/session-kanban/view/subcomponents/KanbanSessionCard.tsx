import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../../shared/view/ui';
import { formatTimeAgo } from '../../../../utils/dateUtils';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';
import type { ProjectSession, SessionProvider } from '../../../../types/app';
import type { SessionLabel } from '../../types/kanban';
import LabelChip from './LabelChip';
import SessionNoteEditor from './SessionNoteEditor';
import LabelManager from './LabelManager';

type KanbanSessionCardProps = {
  session: ProjectSession;
  note: string;
  sessionLabels: SessionLabel[];
  allLabels: SessionLabel[];
  currentTime: Date;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
};

export default function KanbanSessionCard({
  session,
  note,
  sessionLabels,
  allLabels,
  currentTime,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
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

  const title = session.summary || session.title || session.name || session.id;
  const timestamp = session.lastActivity || session.updated_at || session.createdAt || session.created_at;
  const provider = (session.__provider || 'claude') as SessionProvider;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onSessionClick(session)}
    >
      {/* Header: provider + title */}
      <div className="mb-1.5 flex items-start gap-2">
        <SessionProviderLogo provider={provider} className="h-4 w-4 shrink-0" />
        <h4 className="flex-1 truncate text-sm font-medium leading-tight text-foreground">
          {title}
        </h4>
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
