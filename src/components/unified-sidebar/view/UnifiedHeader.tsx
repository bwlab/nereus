import { useEffect, useRef } from 'react';
import { Moon, Sun, Search, Menu, Settings as SettingsIcon, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { FullWorkspace } from '../../dashboard/types/dashboard';
import type { Project } from '../../../types/app';

interface UnifiedHeaderProps {
  projects: Project[];
  workspace: FullWorkspace | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isMobile?: boolean;
  onMenuClick?: () => void;
  onOpenSettings?: () => void;
  onCreateProject?: () => void;
}

export default function UnifiedHeader({ projects, workspace, searchQuery, onSearchChange, isMobile, onMenuClick, onOpenSettings, onCreateProject }: UnifiedHeaderProps) {
  const { t } = useTranslation('sidebar');
  const { isDarkMode, toggleDarkMode } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        if (target && target.isContentEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onSearchChange('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSearchChange]);

  const folderCount = workspace?.raccoglitori.length ?? 0;
  const projectCount = projects.length;

  return (
    <header className="grid h-[60px] shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border/60 bg-background px-4 sm:grid-cols-[240px_1fr_auto]">
      <div className="flex min-w-0 items-center gap-2">
        {isMobile && onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:bg-muted"
            aria-label={t('header.openMenu')}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div
          className="h-7 w-7 shrink-0 rounded-md"
          style={{
            background: 'linear-gradient(135deg, var(--heritage-a, #F5D000) 50%, var(--heritage-b, #E30613) 50%)',
          }}
          aria-hidden
        />
        <div className="hidden min-w-0 leading-tight sm:block">
          <span className="text-sm font-bold tracking-tight">bwlab</span>
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Claude Code UI
          </span>
        </div>
      </div>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('header.searchPlaceholder')}
          className="focus:ring-[color:var(--heritage-a,#F5D000)]/25 h-10 w-full rounded-md border border-border/70 bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-[color:var(--heritage-a,#F5D000)] focus:bg-background focus:ring-2"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
          {t('header.stats', { projects: projectCount, folders: folderCount })}
        </span>
        {onCreateProject && (
          <button
            type="button"
            onClick={onCreateProject}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:scale-105 hover:border-[color:var(--heritage-a,#F5D000)] hover:text-[color:var(--heritage-a,#F5D000)]"
            aria-label={t('header.createProject', { defaultValue: 'Crea nuovo progetto' })}
            title={t('header.createProject', { defaultValue: 'Crea nuovo progetto' })}
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        )}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:scale-105 hover:border-[color:var(--heritage-a,#F5D000)] hover:text-[color:var(--heritage-a,#F5D000)]"
            aria-label={t('header.settings')}
            title={t('header.settings')}
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:scale-105 hover:border-[color:var(--heritage-a,#F5D000)] hover:text-[color:var(--heritage-a,#F5D000)]"
          aria-label={isDarkMode ? t('header.themeLight') : t('header.themeDark')}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
