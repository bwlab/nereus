import { useState, useRef, useEffect } from 'react';
import { Cpu, Check, X } from 'lucide-react';
import { CLAUDE_MODELS, CODEX_MODELS, CURSOR_MODELS, GEMINI_MODELS } from '../../../../../shared/modelConstants';

type Provider = 'claude' | 'cursor' | 'codex' | 'gemini';

type ModelSelectorProps = {
  provider: Provider | string;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
};

function getModelsForProvider(provider: string): { value: string; label: string }[] {
  switch (provider) {
    case 'cursor': return CURSOR_MODELS.OPTIONS;
    case 'codex': return CODEX_MODELS.OPTIONS;
    case 'gemini': return GEMINI_MODELS.OPTIONS;
    case 'claude':
    default:
      return CLAUDE_MODELS.OPTIONS;
  }
}

export default function ModelSelector({ provider, selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const models = getModelsForProvider(provider);
  const currentModel = models.find((m) => m.value === selectedModel) || models[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-all duration-200 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 sm:h-10 sm:w-10"
        title={`Modello: ${currentModel?.label ?? 'Default'}`}
      >
        <Cpu className="h-5 w-5 text-primary" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Seleziona modello</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 hover:bg-accent"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground capitalize">Provider: {provider}</p>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {models.map((model) => {
              const isSelected = model.value === selectedModel;
              return (
                <button
                  key={model.value}
                  type="button"
                  onClick={() => {
                    onModelChange(model.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/50 ${
                    isSelected ? 'bg-accent text-foreground' : 'text-foreground'
                  }`}
                >
                  <span className="truncate">{model.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
