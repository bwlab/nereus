import { useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import type { ClaudeTaskSession, ClaudeTaskSummaryByProject } from '../types/claude-tasks';

export function useClaudeTasksApi() {
  const getSessions = useCallback(async (): Promise<ClaudeTaskSession[]> => {
    const res = await authenticatedFetch('/api/claude-tasks/sessions');
    const data = await res.json();
    return data.sessions ?? [];
  }, []);

  const getSessionTasks = useCallback(async (sessionId: string) => {
    const res = await authenticatedFetch(`/api/claude-tasks/sessions/${sessionId}`);
    const data = await res.json();
    return data.tasks ?? [];
  }, []);

  const getTasksByProject = useCallback(async (projectPath: string): Promise<ClaudeTaskSession[]> => {
    const res = await authenticatedFetch(`/api/claude-tasks/by-project${projectPath}`);
    const data = await res.json();
    return data.sessions ?? [];
  }, []);

  const getSummary = useCallback(async (): Promise<ClaudeTaskSummaryByProject> => {
    const res = await authenticatedFetch('/api/claude-tasks/summary');
    const data = await res.json();
    return data.summary ?? {};
  }, []);

  return useMemo(() => ({
    getSessions,
    getSessionTasks,
    getTasksByProject,
    getSummary,
  }), [getSessions, getSessionTasks, getTasksByProject, getSummary]);
}
