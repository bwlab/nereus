import { useTranslation } from 'react-i18next';

export type SortMode = 'manual' | 'alpha' | 'recent' | 'old';

interface ContentToolbarProps {
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  counter: string;
}

const SORT_KEYS: SortMode[] = ['manual', 'alpha', 'recent', 'old'];

export default function ContentToolbar({ sort, onSortChange, counter }: ContentToolbarProps) {
  const { t } = useTranslation('sidebar');
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/40 px-4 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wider">{t('toolbar.order')}</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="h-7 rounded border border-border/60 bg-background px-1.5 text-xs outline-none focus:border-[color:var(--heritage-a,#F5D000)]"
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`toolbar.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <span className="tabular-nums">{counter}</span>
    </div>
  );
}
