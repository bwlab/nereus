import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, TerminalSquare, X } from 'lucide-react';
import {
  useTabsStore,
  activateTab,
  closeTab,
  closeOthers,
  closeAllTabs,
  reorderTabs,
  type Tab,
} from '../../../stores/tabsStore';

interface TabBarProps {
  /** Called after activating a tab — caller syncs URL. */
  onActivate?: (tab: Tab) => void;
  /** Called after closing — caller may navigate if no tabs remain. */
  onClose?: (closedId: string) => void;
  /** Optional: tab ids whose underlying session is processing — shows pulsing dot. */
  processingTabIds?: Set<string>;
}

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
}

export default function TabBar({ onActivate, onClose, processingTabIds }: TabBarProps) {
  const { tabs, activeTabId } = useTabsStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleActivate = useCallback(
    (tab: Tab) => {
      activateTab(tab.id);
      onActivate?.(tab);
    },
    [onActivate],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      closeTab(id);
      onClose?.(id);
    },
    [onClose],
  );

  /** Middle-click on the tab itself also closes it (browser parity). */
  const handleAuxClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      closeTab(id);
      onClose?.(id);
    },
    [onClose],
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-bwlab-tab', String(index));
    } catch {
      /* ignore */
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (dragIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === toIndex) return;
    reorderTabs(from, toIndex);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Keyboard shortcuts: Ctrl+Tab next, Ctrl+Shift+Tab prev, Ctrl+1..9 jump.
  // Skip when focus is in an editable element (terminal/input/textarea/contenteditable).
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      // xterm uses a textarea inside .xterm-helper-textarea
      if (el.closest('.xterm')) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (tabs.length === 0) return;
      // Ctrl+Tab / Ctrl+Shift+Tab (always — browser default is tab cycle, we override)
      if (e.key === 'Tab') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const dir = e.shiftKey ? -1 : 1;
        const next = tabs[(idx + dir + tabs.length) % tabs.length];
        if (next) {
          activateTab(next.id);
          onActivate?.(next);
        }
        return;
      }
      // Ctrl+1..9 — only if no editable focus (avoid clobbering chat input shortcuts)
      if (/^[1-9]$/.test(e.key)) {
        if (isEditable(document.activeElement)) return;
        const i = parseInt(e.key, 10) - 1;
        const target = tabs[i];
        if (target) {
          e.preventDefault();
          activateTab(target.id);
          onActivate?.(target);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabs, activeTabId, onActivate]);

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        data-tour="tabbar"
        className="flex h-9 min-h-9 w-full items-stretch overflow-x-auto border-b border-border/40 bg-muted/20"
        role="tablist"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const isProcessing = processingTabIds?.has(tab.id) ?? false;
          const Icon = tab.viewTab === 'shell' || tab.kind === 'shell' ? TerminalSquare : MessageSquare;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(idx)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClick={() => handleActivate(tab)}
              onAuxClick={(e) => handleAuxClick(e, tab.id)}
              className={`group flex min-w-[140px] max-w-[220px] cursor-pointer items-center gap-2 border-r border-border/40 px-3 transition-colors ${
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              role="tab"
              aria-selected={isActive}
              title={tab.title}
            >
              <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <Icon className="h-3.5 w-3.5" />
                {isProcessing && (
                  <span
                    className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-[var(--heritage-a,#F5D000)] ring-2 ring-background"
                    aria-label="In esecuzione"
                  />
                )}
              </span>
              <span className="flex-1 truncate text-xs font-medium">{tab.title}</span>
              <button
                type="button"
                onClick={(e) => handleClose(e, tab.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition hover:bg-muted group-hover:opacity-100"
                aria-label="Chiudi scheda"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <button
            type="button"
            onClick={closeMenu}
            className="fixed inset-0 z-50 cursor-default"
            aria-label="Chiudi menu"
          />
          <div
            className="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                closeTab(contextMenu.tabId);
                onClose?.(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi scheda
            </button>
            <button
              type="button"
              onClick={() => {
                closeOthers(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi altre
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTabs();
                onClose?.(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi tutte
            </button>
          </div>
        </>
      )}
    </>
  );
}
