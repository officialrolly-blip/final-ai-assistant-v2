// Provider model catalog.
// Priority: Groq (free, fast, generous rate limits) first,
// OpenRouter free models last (shared 50 req/day cap — kept only as fallback).
export interface ProviderModel {
  provider: 'groq' | 'openrouter';
  id: string;
  name: string;
  free: boolean;
}

export const FREE_MODELS: ProviderModel[] = [
  // --- Groq (primary: free, fast, stable) ---
  // Production models per https://console.groq.com/docs/models.
  // Free Developer tier: generous RPM limits (e.g. 1K RPM on GPT-OSS).
  { provider: 'groq', id: 'groq:openai/gpt-oss-20b', name: 'GPT-OSS 20B via Groq (free, recommended)', free: true },
  { provider: 'groq', id: 'groq:openai/gpt-oss-120b', name: 'GPT-OSS 120B via Groq (free, most capable)', free: true },
  { provider: 'groq', id: 'groq:qwen/qwen3.8-27b', name: 'Qwen 3.8 27B via Groq (free)', free: true },
  { provider: 'groq', id: 'groq:allam-2-7b', name: 'Allam 2 7B via Groq (free)', free: true },
  // --- OpenRouter free (fallback only: shared 50 req/day) ---
  { provider: 'openrouter', id: 'openrouter:google/gemma-4-31b-it:free', name: 'Gemma 4 31B via OpenRouter (free)', free: true },
  { provider: 'openrouter', id: 'openrouter:google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B via OpenRouter (free)', free: true },
  { provider: 'openrouter', id: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super via OpenRouter (free)', free: true },
  { provider: 'openrouter', id: 'openrouter:thinkingmachines/inkling:free', name: 'Inkling via OpenRouter (free)', free: true },
  { provider: 'openrouter', id: 'openrouter:poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 via OpenRouter (free)', free: true },
];

/** Strip the "provider:" prefix to get the raw model id for the upstream API. */
export function rawModelId(id: string): string {
  const idx = id.indexOf(':');
  // Groq ids "groq:llama-3.3-70b-versatile" -> "llama-3.3-70b-versatile".
  // Groq GPT-OSS ids "groq:openai/gpt-oss-20b" -> "openai/gpt-oss-20b".
  // OpenRouter ids "openrouter:google/gemma..." -> "google/gemma...".
  if (idx > -1 && (id.startsWith('groq:') || id.startsWith('openrouter:'))) {
    return id.slice(idx + 1);
  }
  return id;
}

/** Which provider handles this id? Defaults to groq. */
export function providerFor(id: string): 'groq' | 'openrouter' {
  const found = FREE_MODELS.find((m) => m.id === id);
  if (found) return found.provider;
  if (id.startsWith('openrouter:')) return 'openrouter';
  return 'groq';
}

/** Legacy OpenRouter-only ids (no prefix) still resolve — mapped into the new chain. */
function legacyOpenRouterId(id: string): string | null {
  if (id.includes('/') && id.endsWith(':free')) return `openrouter:${id}`;
  return null;
}

export function resolveModelId(choice: string): string {
  if (choice && choice !== 'auto') {
    // Accept new prefixed ids and legacy OpenRouter ids.
    // Legacy gemini:* ids are retired — fall through to auto (Groq default).
    if (FREE_MODELS.some((m) => m.id === choice)) return choice;
    if (choice.startsWith('gemini:') || /^gemini-[\w.-]+$/.test(choice)) return FREE_MODELS[0].id;
    const legacy = legacyOpenRouterId(choice);
    if (legacy && FREE_MODELS.some((m) => m.id === legacy)) return legacy;
    return choice;
  }
  return FREE_MODELS[0].id;
}

export function getModelName(id: string): string {
  const found = FREE_MODELS.find((m) => m.id === id);
  return found ? found.name : id;
}