import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SessionProvider } from '../../../types/app';
import {
  DEFAULT_LOCATION,
  type Location,
  type PresetKind,
  isPresetKind,
  toPath,
} from '../types/location';

const STORAGE_KEY = 'ui:location';

const SESSION_PROVIDERS: SessionProvider[] = ['claude', 'cursor', 'codex', 'gemini'];
const isProvider = (v: string | undefined): v is SessionProvider =>
  !!v && (SESSION_PROVIDERS as string[]).includes(v);

/**
 * Parse the current URL into a Location. Unknown URLs fall back to the default preset.
 * Valid route patterns:
 *   /                                 -> preset:all
 *   /preset/:preset
 *   /d/:dashboardId
 *   /d/:dashboardId/f/:folderIds      (folderIds = dot-separated numbers)
 *   /p/:projectName
 *   /p/:projectName/s/:provider/:id
 *
 * Legacy: /session/:sessionId — resolved externally via shim (can't recover project from id alone).
 */
export function parsePath(pathname: string): Location | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '') return { kind: 'preset', preset: 'all' };

  const parts = clean.split('/').filter(Boolean);

  if (parts[0] === 'preset' && parts[1]) {
    return isPresetKind(parts[1]) ? { kind: 'preset', preset: parts[1] } : null;
  }

  if (parts[0] === 'd' && parts[1]) {
    const dashboardId = Number(parts[1]);
    if (!Number.isFinite(dashboardId)) return null;
    if (parts[2] === 'f' && parts[3]) {
      const folderIds = parts[3]
        .split('.')
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      return { kind: 'folder', dashboardId, folderIds };
    }
    return { kind: 'folder', dashboardId, folderIds: [] };
  }

  if (parts[0] === 'p' && parts[1]) {
    const projectName = decodeURIComponent(parts[1]);
    if (parts[2] === 's' && isProvider(parts[3]) && parts[4]) {
      const sessionId = decodeURIComponent(parts[4]);
      return { kind: 'session', projectName, sessionId, provider: parts[3] };
    }
    return { kind: 'project', projectName };
  }

  return null;
}

function loadStoredLocation(): Location | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Location;
    if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistLocation(loc: Location): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

export interface UnifiedLocationApi {
  location: Location;
  setLocation: (next: Location, opts?: { replace?: boolean }) => void;
  goToPreset: (preset: PresetKind) => void;
  goHome: () => void;
}

export function useUnifiedLocation(): UnifiedLocationApi {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const location = useMemo<Location>(() => {
    const pathname = routerLocation.pathname;
    // Shim: legacy /session/:sessionId cannot be resolved without project context.
    // Leave it as default preset — AppContent's useProjectsState still wires the session.
    if (pathname.startsWith('/session/')) return DEFAULT_LOCATION;
    const parsed = parsePath(pathname);
    return parsed ?? DEFAULT_LOCATION;
  }, [routerLocation.pathname]);

  useEffect(() => {
    persistLocation(location);
  }, [location]);

  const setLocation = useCallback(
    (next: Location, opts?: { replace?: boolean }) => {
      const targetPath = toPath(next);
      if (routerLocation.pathname === targetPath) return;
      navigate(targetPath, { replace: opts?.replace });
    },
    [navigate, routerLocation.pathname],
  );

  const goToPreset = useCallback((preset: PresetKind) => {
    setLocation({ kind: 'preset', preset });
  }, [setLocation]);

  const goHome = useCallback(() => {
    setLocation(DEFAULT_LOCATION);
  }, [setLocation]);

  return useMemo(
    () => ({ location, setLocation, goToPreset, goHome }),
    [location, setLocation, goToPreset, goHome],
  );
}

export { loadStoredLocation, persistLocation };
