import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanColumn as KanbanColumnType, SessionLabel } from '../../types/kanban';
import type { ProjectSession } from '../../../../types/app';
import KanbanColumnHeader from './KanbanColumnHeader';
import KanbanSessionCard from './KanbanSessionCard';

type KanbanColumnProps = {
  column: KanbanColumnType;
  sessions: ProjectSession[];
  allLabels: SessionLabel[];
  currentTime: Date;
  getNoteForSession: (sessionId: string) => string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onRenameColumn: (columnId: number, name: string) => void;
  onDeleteColumn: (columnId: number) => void;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
  onNewSession?: () => void;
  projectName: string;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: import('../../../../types/app').Project[];
  onArchive?: (sessionId: string) => void;
};

export default function KanbanColumn({
  column,
  sessions,
  allLabels,
  currentTime,
  getNoteForSession,
  getLabelsForSession,
  onRenameColumn,
  onDeleteColumn,
  onSessionClick,
  onNoteChange,
  onToggleLabel,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
  onNewSession,
  projectName,
  onSessionUpdated,
  onSessionDeleted,
  allProjects,
  onArchive,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column-${column.id}`, data: { type: 'column', column } });

  const { setNodeRef: setDroppableRef } = useDroppable({ id: `droppable-${column.id}`, data: { type: 'column', column } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sessionIds = sessions.map((s) => s.id);

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...attributes}
      className={`group/col flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 ${isDragging ? 'opacity-50' : ''}`}
    >
      <KanbanColumnHeader
        column={column}
        sessionCount={sessions.length}
        dragHandleProps={listeners}
        onRename={onRenameColumn}
        onDelete={onDeleteColumn}
        onNewSession={onNewSession}
      />

      <div
        ref={setDroppableRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-2"
        style={{ minHeight: '100px' }}
      >
        <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
          {sessions.map((session) => (
            <KanbanSessionCard
              key={session.id}
              session={session}
              note={getNoteForSession(session.id)}
              sessionLabels={getLabelsForSession(session.id)}
              allLabels={allLabels}
              currentTime={currentTime}
              onSessionClick={onSessionClick}
              onNoteChange={onNoteChange}
              onToggleLabel={onToggleLabel}
              onCreateLabel={onCreateLabel}
              onEditLabel={onEditLabel}
              onDeleteLabel={onDeleteLabel}
              projectName={projectName}
              onSessionUpdated={onSessionUpdated}
              onSessionDeleted={onSessionDeleted}
              allProjects={allProjects}
              onArchive={onArchive}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
