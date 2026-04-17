import { useCallback } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import type { KanbanBoard } from '../types/kanban';

export function useSessionKanbanApi(projectName: string) {
  const fetchBoard = useCallback(async (): Promise<KanbanBoard> => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/board`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  }, [projectName]);

  const createColumn = useCallback(async (columnName: string) => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns`, {
      method: 'POST',
      body: JSON.stringify({ columnName }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.column;
  }, [projectName]);

  const updateColumn = useCallback(async (columnId: number, columnName?: string, position?: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ columnName, position }),
    });
  }, [projectName]);

  const reorderColumns = useCallback(async (columnIds: number[]) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns-order`, {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    });
  }, [projectName]);

  const deleteColumn = useCallback(async (columnId: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/columns/${columnId}`, {
      method: 'DELETE',
    });
  }, [projectName]);

  const assignSession = useCallback(async (sessionId: string, columnId: number, position: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ columnId, position }),
    });
  }, []);

  const updateNote = useCallback(async (sessionId: string, noteText: string) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/note`, {
      method: 'PUT',
      body: JSON.stringify({ projectName, noteText }),
    });
  }, [projectName]);

  const createLabel = useCallback(async (labelName: string, color: string) => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelName, color }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.label;
  }, [projectName]);

  const updateLabel = useCallback(async (labelId: number, labelName: string, color: string) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels/${labelId}`, {
      method: 'PUT',
      body: JSON.stringify({ labelName, color }),
    });
  }, [projectName]);

  const deleteLabel = useCallback(async (labelId: number) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/labels/${labelId}`, {
      method: 'DELETE',
    });
  }, [projectName]);

  const assignLabelToSession = useCallback(async (sessionId: string, labelId: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    });
  }, []);

  const removeLabelFromSession = useCallback(async (sessionId: string, labelId: number) => {
    await authenticatedFetch(`/api/kanban/sessions/${encodeURIComponent(sessionId)}/labels/${labelId}`, {
      method: 'DELETE',
    });
  }, []);

  const getArchivedSessions = useCallback(async (): Promise<Array<{ session_id: string; archived_at: string }>> => {
    const res = await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/archived-sessions`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.archived ?? [];
  }, [projectName]);

  const archiveSession = useCallback(async (sessionId: string) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: 'PUT',
    });
  }, [projectName]);

  const unarchiveSession = useCallback(async (sessionId: string) => {
    await authenticatedFetch(`/api/kanban/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: 'DELETE',
    });
  }, [projectName]);

  return {
    fetchBoard,
    createColumn,
    updateColumn,
    reorderColumns,
    deleteColumn,
    assignSession,
    updateNote,
    createLabel,
    updateLabel,
    deleteLabel,
    assignLabelToSession,
    removeLabelFromSession,
    getArchivedSessions,
    archiveSession,
    unarchiveSession,
  };
}
