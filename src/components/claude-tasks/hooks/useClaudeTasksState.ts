import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClaudeTask, ClaudeTaskSession } from '../types/claude-tasks';
import { useClaudeTasksApi } from './useClaudeTasksApi';

export function useClaudeTasksState(projectPath: string | null) {
  const api = useClaudeTasksApi();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ClaudeTaskSession[]>([]);
  const [allTasks, setAllTasks] = useState<ClaudeTask[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const reload = useCallback(async () => {
    if (!projectPath) { setSessions([]); setAllTasks([]); setLoading(false); return; }
    setLoading(true);
    const data = await api.getTasksByProject(projectPath);
    setSessions(data);
    const tasks: ClaudeTask[] = [];
    for (const s of data) {
      for (const t of (s.tasks ?? [])) {
        tasks.push({ ...t, sessionId: s.id, sessionName: s.name ?? undefined });
      }
    }
    setAllTasks(tasks);
    setLoading(false);
  }, [api, projectPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  // SSE live updates
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    const params = token ? `?token=${token}` : '';
    const es = new EventSource(`/api/claude-tasks/events${params}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'task-update' || data.type === 'metadata-update') {
          reload();
        }
      } catch { /* skip */ }
    };

    es.onerror = () => {
      // Auto-reconnect handled by EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [reload]);

  const tasksByStatus = {
    pending: allTasks.filter((t) => t.status === 'pending'),
    in_progress: allTasks.filter((t) => t.status === 'in_progress'),
    completed: allTasks.filter((t) => t.status === 'completed'),
  };

  return {
    loading,
    sessions,
    allTasks,
    tasksByStatus,
    reload,
  };
}
