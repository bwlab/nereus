import { Bot, Sparkles, Cpu, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionProvider } from '../../../types/app';
import { providerLabel, providerLaunchCommand } from '../utils/providerLaunch';

type StepProviderSelectionProps = {
  provider: SessionProvider;
  onProviderChange: (provider: SessionProvider) => void;
};

const PROVIDERS: Array<{
  value: SessionProvider;
  iconBg: string;
  iconColor: string;
  Icon: typeof Bot;
  description: string;
}> = [
  {
    value: 'claude',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColor: 'text-orange-600 dark:text-orange-400',
    Icon: Sparkles,
    description: 'Anthropic Claude Code CLI',
  },
  {
    value: 'codex',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: Cpu,
    description: 'OpenAI Codex CLI',
  },
  {
    value: 'gemini',
    iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
    Icon: Wand2,
    description: 'Google Gemini CLI',
  },
  {
    value: 'cursor',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
    Icon: Bot,
    description: 'Cursor Agent CLI',
  },
];

export default function StepProviderSelection({
  provider,
  onProviderChange,
}: StepProviderSelectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('projectWizard.stepLlm.question', {
          defaultValue: 'Quale LLM vuoi avviare nella shell del progetto?',
        })}
      </h4>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROVIDERS.map(({ value, iconBg, iconColor, Icon, description }) => {
          const selected = provider === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onProviderChange(value)}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                selected
                  ? 'border-primary bg-primary/5 dark:bg-primary/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1">
                  <h5 className="mb-1 font-semibold text-gray-900 dark:text-white">
                    {providerLabel(value)}
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
                  <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {providerLaunchCommand(value)}
                  </code>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
