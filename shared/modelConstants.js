/**
 * Centralized Model Definitions
 * Single source of truth for all supported AI models
 */

/**
 * Claude (Anthropic) Models
 *
 * Note: Claude uses two different formats:
 * - SDK format ('sonnet', 'opus') - used by the UI and claude-sdk.js
 * - API format ('claude-sonnet-4.5') - used by slash commands for display
 */
/**
 * Returns the context window (in tokens) for a given model id/alias.
 * Source: https://platform.claude.com/docs/en/about-claude/models/overview
 * - Opus 4.6: 1M tokens
 * - Sonnet 4.6: 1M tokens
 * - Haiku 4.5: 200k tokens
 */
export function getContextWindowForModel(model, provider = 'claude') {
  if (!model) return 200_000;
  const m = String(model).toLowerCase();

  if (provider === 'claude') {
    // Esplicito 1M via suffisso [1m]
    if (m.includes('[1m]')) return 1_000_000;
    // Haiku is 200k
    if (m.includes('haiku')) return 200_000;
    if (m === 'opus' || m === 'sonnet' || m === 'opusplan') return 1_000_000;
    // Older models or unknown → 200k
    return 200_000;
  }

  if (provider === 'gemini') {
    if (m.includes('pro') || m.includes('flash')) return 1_000_000;
    return 200_000;
  }

  return 200_000;
}

export const CLAUDE_MODELS = {
  // Source of truth: https://platform.claude.com/docs/en/about-claude/models/overview
  // Aliases ufficiali esposti dall'API Anthropic (GET /v1/models).
  OPTIONS: [
    { value: "claude-opus-4-7[1m]", label: "Opus 4.7 (1M ctx)" },
    { value: "claude-sonnet-4-6[1m]", label: "Sonnet 4.6 (1M ctx)" },
    { value: "claude-opus-4-6[1m]", label: "Opus 4.6 (1M ctx)" },
    { value: "claude-haiku-4-5", label: "Haiku 4.5 (200k ctx)" },
    // Special CLI modes
    { value: "opusplan", label: "Opus Plan" },
  ],

  DEFAULT: "claude-sonnet-4-6[1m]",
};

/**
 * Cursor Models
 */
export const CURSOR_MODELS = {
  OPTIONS: [
    { value: "opus-4.6-thinking", label: "Claude 4.6 Opus (Thinking)" },
    { value: "gpt-5.3-codex", label: "GPT-5.3" },
    { value: "gpt-5.2-high", label: "GPT-5.2 High" },
    { value: "gemini-3-pro", label: "Gemini 3 Pro" },
    { value: "opus-4.5-thinking", label: "Claude 4.5 Opus (Thinking)" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5.1-high", label: "GPT-5.1 High" },
    { value: "composer-1", label: "Composer 1" },
    { value: "auto", label: "Auto" },
    { value: "sonnet-4.5", label: "Claude 4.5 Sonnet" },
    { value: "sonnet-4.5-thinking", label: "Claude 4.5 Sonnet (Thinking)" },
    { value: "opus-4.5", label: "Claude 4.5 Opus" },
    { value: "gpt-5.1-codex", label: "GPT-5.1 Codex" },
    { value: "gpt-5.1-codex-high", label: "GPT-5.1 Codex High" },
    { value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
    { value: "gpt-5.1-codex-max-high", label: "GPT-5.1 Codex Max High" },
    { value: "opus-4.1", label: "Claude 4.1 Opus" },
    { value: "grok", label: "Grok" },
  ],

  DEFAULT: "gpt-5-3-codex",
};

/**
 * Codex (OpenAI) Models
 */
export const CODEX_MODELS = {
  OPTIONS: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
    { value: "o3", label: "O3" },
    { value: "o4-mini", label: "O4-mini" },
  ],

  DEFAULT: "gpt-5.4",
};

/**
 * Gemini Models
 */
export const GEMINI_MODELS = {
  OPTIONS: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-pro-exp", label: "Gemini 2.0 Pro Experimental" },
    {
      value: "gemini-2.0-flash-thinking-exp",
      label: "Gemini 2.0 Flash Thinking",
    },
  ],

  DEFAULT: "gemini-2.5-flash",
};
