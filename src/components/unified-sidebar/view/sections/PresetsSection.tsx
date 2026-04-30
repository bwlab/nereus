import { Layers, Clock, Inbox, Star, Bot, Activity, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { Location, PresetKind } from '../../types/location';
import { PRESET_I18N_KEY } from '../../types/location';

interface PresetsSectionProps {
  location: Location;
  onSelect: (preset: PresetKind) => void;
  counts?: Partial<Record<PresetKind, number>>;
}

const PRESET_ICONS: Record<PresetKind, ComponentType<{ className?: string }>> = {
  all: Layers,
  recent: Clock,
  unassigned: Inbox,
  favorites: Star,
  'global-agents': Bot,
  skills: Sparkles,
  'open-tabs': Activity,
};

const PRESET_ORDER: PresetKind[] = ['all', 'recent', 'unassigned', 'favorites', 'global-agents', 'skills', 'open-tabs'];

export default function PresetsSection({ location, onSelect, counts }: PresetsSectionProps) {
  const { t } = useTranslation('sidebar');
  const activePreset = location.kind === 'preset' ? location.preset : null;
  return (
    <div data-tour="presets" className="px-3 pt-3">
      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {t('presets.title')}
      </div>
      <ul className="flex flex-col gap-0.5">
        {PRESET_ORDER.map((preset) => {
          const Icon = PRESET_ICONS[preset];
          const isActive = activePreset === preset;
          const count = counts?.[preset];
          return (
            <li key={preset}>
              <button
                type="button"
                onClick={() => onSelect(preset)}
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-[color:var(--heritage-a,#F5D000)] font-semibold text-black shadow-sm'
                    : 'text-foreground/85 hover:bg-muted/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{t(`presets.${PRESET_I18N_KEY[preset]}`)}</span>
                {typeof count === 'number' && (
                  <span
                    className={`text-[11px] tabular-nums ${
                      isActive ? 'text-black/70' : 'text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
