import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { ProjectSession } from '../../../../types/app';
import type { KanbanColumn as KanbanColumnType, SessionLabel } from '../../types/kanban';
import KanbanColumn from './KanbanColumn';
import AddColumnButton from './AddColumnButton';

type KanbanBoardProps = {
  columns: KanbanColumnType[];
  sessionsByColumn: Map<number, { session: ProjectSession; position: number }[]>;
  labels: SessionLabel[];
  currentTime: Date;
  getNoteForSession: (sessionId: string) => string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onAddColumn: (name: string) => void;
  onRenameColumn: (columnId: number, name: string) => void;
  onDeleteColumn: (columnId: number) => void;
  onMoveColumn: (columnIds: number[]) => void;
  onMoveSession: (sessionId: string, columnId: number, position: number) => void;
  onSessionClick: (session: ProjectSession) => void;
  onNoteChange: (sessionId: string, text: string) => void;
  onToggleLabel: (sessionId: string, labelId: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onEditLabel: (labelId: number, name: string, color: string) => void;
  onDeleteLabel: (labelId: number) => void;
  onNewSession: () => void;
  projectName: string;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: import('../../../../types/app').Project[];
  onArchive?: (sessionId: string) => void;
};

export default function KanbanBoard({
  columns,
  sessionsByColumn,
  labels,
  currentTime,
  getNoteForSession,
  getLabelsForSession,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onMoveColumn,
  onMoveSession,
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
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnForSession = useCallback(
    (sessionId: string): number | undefined => {
      for (const [colId, items] of sessionsByColumn) {
        if (items.some((item) => item.session.id === sessionId)) return colId;
      }
      return undefined;
    },
    [sessionsByColumn],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'session' && overData?.type === 'column') {
      const activeColumnId = findColumnForSession(String(active.id));
      const overColumnId = overData.column.id;
      if (activeColumnId !== overColumnId) {
        onMoveSession(String(active.id), overColumnId, 0);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Column reorder
    if (activeData?.type === 'column' && overData?.type === 'column') {
      const oldIndex = columns.findIndex((c) => `column-${c.id}` === String(active.id));
      const newIndex = columns.findIndex((c) => `column-${c.id}` === String(over.id));
      if (oldIndex !== newIndex) {
        const reordered = [...columns];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        onMoveColumn(reordered.map((c) => c.id));
      }
      return;
    }

    // Session reorder within or across columns
    if (activeData?.type === 'session') {
      const overColumnId =
        overData?.type === 'column'
          ? overData.column.id
          : findColumnForSession(String(over.id));

      if (overColumnId !== undefined) {
        const items = sessionsByColumn.get(overColumnId) || [];
        const overIndex = items.findIndex((item) => item.session.id === String(over.id));
        const position = overIndex >= 0 ? overIndex : items.length;
        onMoveSession(String(active.id), overColumnId, position);
      }
    }
  };

  const columnIds = columns.map((c) => `column-${c.id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => {
            const items = sessionsByColumn.get(column.id) || [];
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                sessions={items.map((i) => i.session)}
                allLabels={labels}
                currentTime={currentTime}
                getNoteForSession={getNoteForSession}
                getLabelsForSession={getLabelsForSession}
                onRenameColumn={onRenameColumn}
                onDeleteColumn={onDeleteColumn}
                onSessionClick={onSessionClick}
                onNoteChange={onNoteChange}
                onToggleLabel={onToggleLabel}
                onCreateLabel={onCreateLabel}
                onEditLabel={onEditLabel}
                onDeleteLabel={onDeleteLabel}
                onNewSession={column.is_default ? onNewSession : undefined}
                projectName={projectName}
                onSessionUpdated={onSessionUpdated}
                onSessionDeleted={onSessionDeleted}
                allProjects={allProjects}
                onArchive={onArchive}
              />
            );
          })}
        </SortableContext>

        <AddColumnButton onAdd={onAddColumn} />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="rounded-lg border border-primary bg-card p-3 opacity-80 shadow-lg">
            <span className="text-sm text-muted-foreground">Trascinamento...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
