/**
 * Multi-tab store: browser-like tabs for project sessions/shells.
 *
 * Module-level singleton + useSyncExternalStore for subscriptions.
 * Persists to sessionStorage so refresh restores tabs (not localStorage:
 * cross-restart stale state would point to dead PTYs / removed projects).
 *
 * Dedup rules:
 *   - shell: at most 1 tab per projectName
 *   - chat with sessionId: at most 1 tab per (projectName, sessionId, provider)
 *   - chat new (no sessionId): always create new tab
 */

import { useSyncExternalStore } from 'react';
import type { AppTab, SessionProvider } from '../types/app';
import { toPath } from '../components/unified-sidebar/types/location';

export type TabKind = 'chat' | 'shell';

/** View tab inside MainContent (chat/files/shell/git/...). Per-tab so each card preserves its own pane. */
export type ViewTab = AppTab;

export interface Tab {
  id: string;
  kind: TabKind;
  projectName: string;
  sessionId?: string;
  provider?: SessionProvider;
  title: string;
  /** Active inner view (chat/files/shell/git/...). Defaults to kind. */
  viewTab: ViewTab;
  /** Shell-only: command to run on first connect (e.g., `claude`, `gemini`). */
  initialCommand?: string;
}

export interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
}

const STORAGE_KEY = 'bwlab.tabs.v1';
const MAX_TABS = 8;

function loadInitial(): TabsState {
  if (typeof window === 'undefined') return { tabs: [], activeTabId: null };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: [], activeTabId: null };
    const parsed = JSON.parse(raw) as TabsState;
    if (!Array.isArray(parsed.tabs)) return { tabs: [], activeTabId: null };
    // Backfill viewTab for tabs persisted before that field existed.
    const tabs = parsed.tabs.map((t) => ({ ...t, viewTab: t.viewTab ?? t.kind }));
    return { tabs, activeTabId: parsed.activeTabId ?? null };
  } catch {
    return { tabs: [], activeTabId: null };
  }
}

let state: TabsState = loadInitial();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TabsState {
  return state;
}

function genId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function findExisting(spec: OpenTabSpec): Tab | undefined {
  if (spec.kind === 'shell') {
    return state.tabs.find(
      (t) =>
        t.kind === 'shell' &&
        t.projectName === spec.projectName &&
        t.sessionId === spec.sessionId &&
        t.provider === spec.provider,
    );
  }
  if (spec.kind === 'chat' && spec.sessionId) {
    return state.tabs.find(
      (t) =>
        t.kind === 'chat' &&
        t.projectName === spec.projectName &&
        t.sessionId === spec.sessionId &&
        t.provider === spec.provider,
    );
  }
  return undefined;
}

export interface OpenTabSpec {
  kind: TabKind;
  projectName: string;
  sessionId?: string;
  provider?: SessionProvider;
  title: string;
  initialCommand?: string;
}

/**
 * Open a tab. If a matching one exists (per dedup rules) it is activated.
 * Returns the tab id.
 *
 * @throws if MAX_TABS reached and no existing match.
 */
export function openTab(spec: OpenTabSpec): string {
  const existing = findExisting(spec);
  if (existing) {
    state = { ...state, activeTabId: existing.id };
    emit();
    return existing.id;
  }
  if (state.tabs.length >= MAX_TABS) {
    throw new Error(`Limite di ${MAX_TABS} schede raggiunto. Chiudi una scheda prima di aprirne un'altra.`);
  }
  const tab: Tab = {
    id: genId(),
    kind: spec.kind,
    projectName: spec.projectName,
    sessionId: spec.sessionId,
    provider: spec.provider,
    title: spec.title,
    viewTab: spec.kind,
    initialCommand: spec.initialCommand,
  };
  state = { tabs: [...state.tabs, tab], activeTabId: tab.id };
  emit();
  return tab.id;
}

export function closeTab(id: string): void {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const nextTabs = state.tabs.filter((t) => t.id !== id);
  let nextActive = state.activeTabId;
  if (state.activeTabId === id) {
    nextActive = nextTabs[idx]?.id ?? nextTabs[idx - 1]?.id ?? null;
  }
  state = { tabs: nextTabs, activeTabId: nextActive };
  emit();
}

export function activateTab(id: string): void {
  if (state.activeTabId === id) return;
  if (!state.tabs.some((t) => t.id === id)) return;
  state = { ...state, activeTabId: id };
  emit();
}

export function reorderTabs(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(fromIndex, 1);
  if (!moved) return;
  tabs.splice(toIndex, 0, moved);
  state = { ...state, tabs };
  emit();
}

/**
 * When a "new session" chat tab gets a real sessionId (after first message),
 * upgrade it in place so future opens dedup correctly.
 */
export function updateTabSession(
  id: string,
  patch: { sessionId: string; provider: SessionProvider; title?: string },
): void {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const tabs = [...state.tabs];
  tabs[idx] = { ...tabs[idx], ...patch };
  state = { ...state, tabs };
  emit();
}

export function setTabView(id: string, viewTab: ViewTab): void {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1 || state.tabs[idx].viewTab === viewTab) return;
  const tabs = [...state.tabs];
  tabs[idx] = { ...tabs[idx], viewTab };
  state = { ...state, tabs };
  emit();
}

export function setTabTitle(id: string, title: string): void {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1 || state.tabs[idx].title === title) return;
  const tabs = [...state.tabs];
  tabs[idx] = { ...tabs[idx], title };
  state = { ...state, tabs };
  emit();
}

export function closeAllTabs(): void {
  state = { tabs: [], activeTabId: null };
  emit();
}

export function closeOthers(keepId: string): void {
  const keep = state.tabs.find((t) => t.id === keepId);
  if (!keep) return;
  state = { tabs: [keep], activeTabId: keep.id };
  emit();
}

/** React hook: subscribe to the whole tabs state. */
export function useTabsStore(): TabsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-React access (e.g., inside event handlers that already capture nothing). */
export function getTabsState(): TabsState {
  return state;
}

/** Map a tab to its canonical URL for navigation. */
export function tabToUrl(tab: Tab): string {
  if (tab.sessionId && tab.provider) {
    return toPath({
      kind: 'session',
      projectName: tab.projectName,
      sessionId: tab.sessionId,
      provider: tab.provider,
    });
  }
  return toPath({ kind: 'project', projectName: tab.projectName });
}

export const __TABS_INTERNAL = {
  MAX_TABS,
  STORAGE_KEY,
};
