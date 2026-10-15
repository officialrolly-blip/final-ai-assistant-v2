// OpenRouter helper (OpenAI-compatible SSE streaming).
// POST https://openrouter.ai/api/v1/chat/completions
import type { ChatMessage } from '@/lib/types';
import type { ProviderResult } from '@/lib/ai/groq';

export async function tryOpenRouter(
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
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Interview Copilot',
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
    const retryable = res.status === 429;
    return { ok: false, retryable, error: `${modelId}: HTTP ${res.status}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}` };
  }
  opts.emit({ model: modelId });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
        if (delta) opts.emit({ content: delta });
      } catch {
        // ignore malformed chunk
      }
    }
  }
  return { ok: true, retryable: false, error: '' };
}
