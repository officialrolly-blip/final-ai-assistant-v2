// Groq helper (OpenAI-compatible SSE streaming).
// POST https://api.groq.com/openai/v1/chat/completions
import type { ChatMessage } from '@/lib/types';

export interface ProviderResult {
  ok: boolean;
  /** True if worth retrying after a short backoff (429 / 5xx / network). */
  retryable: boolean;
  error: string;
}

export async function tryGroq(
  modelId: string,
  rawModel: string,
  opts: {
    apiKey: string;
    messages: ChatMessage[];
    maxTokens: number;
    emit: (obj: unknown) => void;
  },
): Promise<ProviderResult> {
  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: rawModel,
        messages: opts.messages,
        stream: true,
        temperature: 0.7,
        max_tokens: opts.maxTokens,
      }),
    });
  } catch (err) {
    return { ok: false, retryable: true, error: `${modelId}: network ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '');
    // 401 = bad key (not retryable). 429/5xx = retryable.
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, retryable, error: `${modelId}: HTTP ${res.status}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}` };
  }
  opts.emit({ model: modelId });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotText = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const streamErr = parsed.error?.message ?? parsed.error;
        if (streamErr) {
          reader.cancel().catch(() => {});
          const msg = typeof streamErr === 'string' ? streamErr : JSON.stringify(streamErr).slice(0, 300);
          return { ok: false, retryable: false, error: `${modelId}: ${msg}` };
        }
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          gotText = true;
          opts.emit({ content: delta });
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
  if (!gotText) return { ok: false, retryable: false, error: `${modelId}: empty response` };
  return { ok: true, retryable: false, error: '' };
}
