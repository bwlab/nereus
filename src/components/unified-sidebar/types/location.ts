import type { SessionProvider } from '../../../types/app';

export type PresetKind = 'all' | 'recent' | 'unassigned' | 'favorites' | 'global-agents' | 'skills' | 'open-tabs';

export interface FolderContext {
  dashboardId: number;
  folderIds: number[];
}

export type AgentScope = 'global' | 'project';

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
    }
  | { kind: 'agent'; scope: AgentScope; agentName: string; projectName?: string };

export const DEFAULT_LOCATION: Location = { kind: 'preset', preset: 'all' };

/** Maps PresetKind to i18n key under sidebar:presets.* */
export const PRESET_I18N_KEY: Record<PresetKind, string> = {
  all: 'all',
  recent: 'recent',
  unassigned: 'unassigned',
  favorites: 'favorites',
  'global-agents': 'globalAgents',
  skills: 'skills',
  'open-tabs': 'openTabs',
};

export const PRESET_VALUES: PresetKind[] = ['all', 'recent', 'unassigned', 'favorites', 'global-agents', 'skills', 'open-tabs'];

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
    case 'agent':
      return `agent:${loc.scope}:${loc.projectName ?? ''}:${loc.agentName}`;
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
    case 'agent':
      return loc.scope === 'global'
        ? `/agents/global/${encodeURIComponent(loc.agentName)}`
        : `/p/${encodeURIComponent(loc.projectName ?? '')}/agents/${encodeURIComponent(loc.agentName)}`;
  }
};
