import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardApi } from '../../dashboard/hooks/useDashboardApi';
import type { FullWorkspace } from '../../dashboard/types/dashboard';

export interface WorkspaceState {
  workspace: FullWorkspace | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY_WORKSPACE: FullWorkspace = {
  dashboards: [],
  raccoglitori: [],
  assignments: [],
  favoriteProjectNames: [],
};

export function useWorkspace(enabled: boolean = true): WorkspaceState {
  const api = useDashboardApi();
  const [workspace, setWorkspace] = useState<FullWorkspace | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await api.getWorkspace();
      if (!mountedRef.current) return;
      setWorkspace(ws ?? EMPTY_WORKSPACE);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
      setWorkspace(EMPTY_WORKSPACE);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api, enabled]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return useMemo(() => ({ workspace, loading, error, reload }), [workspace, loading, error, reload]);
}
