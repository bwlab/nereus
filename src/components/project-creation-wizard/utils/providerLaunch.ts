import type { SessionProvider } from '../../../types/app';

export function providerLaunchCommand(provider: SessionProvider): string {
  switch (provider) {
    case 'claude':
      return 'claude';
    case 'codex':
      return 'codex';
    case 'gemini':
      return 'gemini';
    case 'cursor':
      return 'cursor-agent';
  }
}

export function providerLabel(provider: SessionProvider): string {
  switch (provider) {
    case 'claude':
      return 'Claude Code';
    case 'codex':
      return 'OpenAI Codex';
    case 'gemini':
      return 'Gemini CLI';
    case 'cursor':
      return 'Cursor Agent';
  }
}
