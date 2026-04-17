import { useState, useCallback, useEffect } from 'react';
import type { ProjectSession } from '../../../types/app';
import type {
  KanbanColumn,
  KanbanSessionAssignment,
  SessionNote,
  SessionLabel,
  SessionLabelAssignment,
} from '../types/kanban';
import { useSessionKanbanApi } from './useSessionKanbanApi';

export function useKanbanState(projectName: string, allSessions: ProjectSession[]) {
  const api = useSessionKanbanApi(projectName);

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [assignments, setAssignments] = useState<KanbanSessionAssignment[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [labels, setLabels] = useState<SessionLabel[]>([]);
  const [labelAssignments, setLabelAssignments] = useState<SessionLabelAssignment[]>([]);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  const refreshArchived = useCallback(async () => {
    try {
      const archived = await api.getArchivedSessions();
      setArchivedIds(new Set(archived.map((a) => a.session_id)));
    } catch (err) {
      console.error('Failed to fetch archived sessions:', err);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    try {
      const board = await api.fetchBoard();
      setColumns(board.columns);
      setAssignments(board.assignments);
      setNotes(board.notes);
      setLabels(board.labels);
      setLabelAssignments(board.labelAssignments);
      await refreshArchived();
    } catch (err) {
      console.error('Failed to fetch kanban board:', err);
    } finally {
      setLoading(false);
    }
  }, [api, refreshArchived]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [projectName]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSessionsByColumn = useCallback(() => {
    const assignmentMap = new Map(assignments.map((a) => [a.session_id, a]));
    const defaultCol = columns.find((c) => c.is_default === 1);

    const buckets = new Map<number, { session: ProjectSession; position: number }[]>();
    for (const col of columns) {
      buckets.set(col.id, []);
    }

    for (const session of allSessions) {
      if (archivedIds.has(session.id)) continue;
      const assignment = assignmentMap.get(session.id);
      if (assignment && buckets.has(assignment.column_id)) {
        buckets.get(assignment.column_id)!.push({ session, position: assignment.position });
      } else if (defaultCol) {
        buckets.get(defaultCol.id)!.push({ session, position: Number.MAX_SAFE_INTEGER });
      }
    }

    for (const [, bucket] of buckets) {
      bucket.sort((a, b) => a.position - b.position);
    }

    return buckets;
  }, [columns, assignments, allSessions, archivedIds]);

  const getArchivedSessionsList = useCallback(() => {
    return allSessions.filter((s) => archivedIds.has(s.id));
  }, [allSessions, archivedIds]);

  const archiveSession = useCallback(async (sessionId: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
    await api.archiveSession(sessionId);
  }, [api]);

  const unarchiveSession = useCallback(async (sessionId: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
    await api.unarchiveSession(sessionId);
  }, [api]);

  const getNoteForSession = useCallback(
    (sessionId: string) => notes.find((n) => n.session_id === sessionId)?.note_text ?? '',
    [notes],
  );

  const getLabelsForSession = useCallback(
    (sessionId: string) => {
      const assignedIds = labelAssignments.filter((la) => la.session_id === sessionId).map((la) => la.label_id);
      return labels.filter((l) => assignedIds.includes(l.id));
    },
    [labels, labelAssignments],
  );

  const addColumn = useCallback(async (columnName: string) => {
    await api.createColumn(columnName);
    await refresh();
  }, [api, refresh]);

  const renameColumn = useCallback(async (columnId: number, columnName: string) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, column_name: columnName } : c)));
    await api.updateColumn(columnId, columnName);
  }, [api]);

  const removeColumn = useCallback(async (columnId: number) => {
    await api.deleteColumn(columnId);
    await refresh();
  }, [api, refresh]);

  const moveSession = useCallback(async (sessionId: string, targetColumnId: number, targetPosition: number) => {
    setAssignments((prev) => {
      const without = prev.filter((a) => a.session_id !== sessionId);
      return [...without, { session_id: sessionId, column_id: targetColumnId, position: targetPosition }];
    });
    await api.assignSession(sessionId, targetColumnId, targetPosition);
  }, [api]);

  const moveColumn = useCallback(async (columnIds: number[]) => {
    setColumns((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return columnIds.map((id, i) => ({ ...map.get(id)!, position: i }));
    });
    await api.reorderColumns(columnIds);
  }, [api]);

  const setSessionNote = useCallback(async (sessionId: string, noteText: string) => {
    setNotes((prev) => {
      const without = prev.filter((n) => n.session_id !== sessionId);
      return [...without, { session_id: sessionId, note_text: noteText, updated_at: new Date().toISOString() }];
    });
    await api.updateNote(sessionId, noteText);
  }, [api]);

  const addLabel = useCallback(async (labelName: string, color: string) => {
    await api.createLabel(labelName, color);
    await refresh();
  }, [api, refresh]);

  const editLabel = useCallback(async (labelId: number, labelName: string, color: string) => {
    setLabels((prev) => prev.map((l) => (l.id === labelId ? { ...l, label_name: labelName, color } : l)));
    await api.updateLabel(labelId, labelName, color);
  }, [api]);

  const removeLabel = useCallback(async (labelId: number) => {
    await api.deleteLabel(labelId);
    await refresh();
  }, [api, refresh]);

  const toggleSessionLabel = useCallback(async (sessionId: string, labelId: number) => {
    const exists = labelAssignments.some((la) => la.session_id === sessionId && la.label_id === labelId);
    if (exists) {
      setLabelAssignments((prev) => prev.filter((la) => !(la.session_id === sessionId && la.label_id === labelId)));
      await api.removeLabelFromSession(sessionId, labelId);
    } else {
      setLabelAssignments((prev) => [...prev, { session_id: sessionId, label_id: labelId }]);
      await api.assignLabelToSession(sessionId, labelId);
    }
  }, [api, labelAssignments]);

  return {
    columns,
    labels,
    loading,
    archivedIds,
    getSessionsByColumn,
    getArchivedSessionsList,
    getNoteForSession,
    getLabelsForSession,
    addColumn,
    renameColumn,
    removeColumn,
    moveSession,
    moveColumn,
    setSessionNote,
    addLabel,
    editLabel,
    removeLabel,
    toggleSessionLabel,
    archiveSession,
    unarchiveSession,
    refresh,
  };
}
