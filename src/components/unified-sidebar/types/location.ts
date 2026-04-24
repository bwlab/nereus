import type { SessionProvider } from '../../../types/app';

export type PresetKind = 'all' | 'recent' | 'unassigned' | 'favorites';

export interface FolderContext {
  dashboardId: number;
  folderIds: number[];
}

export type Location =
  | { kind: 'preset'; preset: PresetKind }
  | { kind: 'folder'; dashboardId: number; folderIds: number[] }
  | { kind: 'project'; projectName: string; folderContext?: FolderContext }
  | {
      kind: 'session';
      projectName: string;
      sessionId: string;
      provider: SessionProvider;
      folderContext?: FolderContext;
    };

export const DEFAULT_LOCATION: Location = { kind: 'preset', preset: 'all' };

export const PRESET_LABELS: Record<PresetKind, string> = {
  all: 'Tutti i progetti',
  recent: 'Sessioni recenti',
  unassigned: 'Senza cartella',
  favorites: 'Preferiti',
};

export const PRESET_VALUES: PresetKind[] = ['all', 'recent', 'unassigned', 'favorites'];

export const isPresetKind = (v: unknown): v is PresetKind =>
  typeof v === 'string' && (PRESET_VALUES as string[]).includes(v);

export const locationKey = (loc: Location): string => {
  switch (loc.kind) {
    case 'preset':
      return `preset:${loc.preset}`;
    case 'folder':
      return `folder:${loc.dashboardId}:${loc.folderIds.join('.')}`;
    case 'project':
      return `project:${loc.projectName}`;
    case 'session':
      return `session:${loc.provider}:${loc.sessionId}`;
  }
};

export const locationsEqual = (a: Location, b: Location): boolean =>
  locationKey(a) === locationKey(b);

export const toPath = (loc: Location): string => {
  switch (loc.kind) {
    case 'preset':
      return loc.preset === 'all' ? '/' : `/preset/${loc.preset}`;
    case 'folder':
      return loc.folderIds.length === 0
        ? `/d/${loc.dashboardId}`
        : `/d/${loc.dashboardId}/f/${loc.folderIds.join('.')}`;
    case 'project':
      return `/p/${encodeURIComponent(loc.projectName)}`;
    case 'session':
      return `/p/${encodeURIComponent(loc.projectName)}/s/${loc.provider}/${encodeURIComponent(loc.sessionId)}`;
  }
};
