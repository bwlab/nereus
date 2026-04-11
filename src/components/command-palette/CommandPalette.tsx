import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Folder, MessageSquare, X, Clock, ArrowRight } from 'lucide-react';
import type { Project, ProjectSession } from '../../types/app';
import { api } from '../../utils/api';

type ConversationMatch = {
  snippet: string;
  timestamp: string | null;
};

type ConversationSession = {
  sessionId: string;
  sessionSummary: string;
  provider?: string;
  matches: ConversationMatch[];
};

type ConversationProjectResult = {
  projectName: string;
  projectDisplayName: string;
  sessions: ConversationSession[];
};

type SearchResult = {
  type: 'project' | 'session';
  project: Project;
  session?: ProjectSession & { __provider?: string };
  snippet?: string;
};

type CommandPaletteProps = {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: ProjectSession) => void;
};

export default function CommandPalette({ projects, onProjectSelect, onSessionSelect }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [conversationResults, setConversationResults] = useState<ConversationProjectResult[]>([]);
  const [isSearchingConversations, setIsSearchingConversations] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setConversationResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [isOpen]);

  // Search conversations with debounce
  const searchConversations = useCallback((q: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (q.length < 2) {
      setConversationResults([]);
      setIsSearchingConversations(false);
      return;
    }

    setIsSearchingConversations(true);
    const results: ConversationProjectResult[] = [];
    const url = api.searchConversationsUrl(q, 20);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('result', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ConversationProjectResult;
        results.push(data);
        setConversationResults([...results]);
      } catch { /* ignore */ }
    });

    es.addEventListener('done', () => {
      es.close();
      eventSourceRef.current = null;
      setIsSearchingConversations(false);
    });

    es.addEventListener('error', () => {
      es.close();
      eventSourceRef.current = null;
      setIsSearchingConversations(false);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchConversations(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchConversations]);

  // Filter projects client-side
  const filteredProjects = query.trim()
    ? projects.filter((p) => {
        const term = query.toLowerCase();
        return (p.displayName || p.name).toLowerCase().includes(term)
          || (p.path || p.fullPath || '').toLowerCase().includes(term);
      }).slice(0, 8)
    : projects.slice(0, 5);

  // Build flat results list
  const results: SearchResult[] = [];

  for (const p of filteredProjects) {
    results.push({ type: 'project', project: p });
  }

  for (const cr of conversationResults) {
    const project = projects.find((p) => p.name === cr.projectName);
    if (!project) continue;
    for (const cs of cr.sessions) {
      results.push({
        type: 'session',
        project,
        session: { id: cs.sessionId, __provider: cs.provider || 'claude', title: cs.sessionSummary } as ProjectSession & { __provider?: string },
        snippet: cs.matches[0]?.snippet,
      });
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    if (result.type === 'session' && result.session) {
      onSessionSelect(result.session);
    } else {
      onProjectSelect(result.project);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Cerca progetti e sessioni..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setSelectedIndex(0); }} className="rounded p-0.5 hover:bg-accent">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && query.length >= 2 && !isSearchingConversations && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nessun risultato</p>
          )}

          {results.length === 0 && query.length < 2 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Digita per cercare tra progetti e sessioni
            </p>
          )}

          {/* Project results */}
          {filteredProjects.length > 0 && (
            <div className="mb-1 px-2 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Progetti</span>
            </div>
          )}

          {filteredProjects.map((p) => {
            const idx = results.findIndex((r) => r.type === 'project' && r.project.name === p.name);
            return (
              <button
                key={`p-${p.name}`}
                type="button"
                onClick={() => handleSelect(results[idx])}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedIndex === idx ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium">{p.displayName || p.name}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{p.path || p.fullPath}</span>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            );
          })}

          {/* Session results */}
          {conversationResults.length > 0 && (
            <div className="mb-1 mt-2 px-2 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sessioni</span>
            </div>
          )}

          {conversationResults.map((cr) => {
            const project = projects.find((p) => p.name === cr.projectName);
            return cr.sessions.map((cs) => {
              const idx = results.findIndex((r) => r.type === 'session' && r.session?.id === cs.sessionId);
              if (idx === -1) return null;
              return (
                <button
                  key={`s-${cs.sessionId}`}
                  type="button"
                  onClick={() => handleSelect(results[idx])}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedIndex === idx ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/50'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{cs.sessionSummary || cs.sessionId.slice(0, 8)}</span>
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                        {project?.displayName || cr.projectDisplayName}
                      </span>
                    </div>
                    {cs.matches[0]?.snippet && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {cs.matches[0].snippet}
                      </p>
                    )}
                  </div>
                </button>
              );
            });
          })}

          {isSearchingConversations && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 animate-spin" />
              Ricerca sessioni in corso...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd> naviga
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd> apri
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">esc</kbd> chiudi
          </span>
        </div>
      </div>
    </div>
  );
}
