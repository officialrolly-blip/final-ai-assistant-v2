'use client';

import type { ChatMessage } from '@/lib/types';

type Task = 'analyze-resume' | 'generate-ats-resume' | 'interview-prep' | 'answer-question' | 'detect-question';

interface StreamOptions {
  task: Task;
  messages: ChatMessage[];
  model?: string;
  onToken: (chunk: string) => void;
  onModel?: (modelId: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(opts: StreamOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: opts.task, messages: opts.messages, model: opts.model }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${txt}` };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const block of lines) {
        const line = block.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.model) opts.onModel?.(parsed.model);
          if (parsed.content) opts.onToken(parsed.content);
          if (parsed.error) return { ok: false, error: parsed.error };
        } catch {
          // ignore
        }
      }
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, error: 'aborted' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Robustly extract a JSON object from an LLM text response that may include
// surrounding prose, markdown fences, trailing commas, or truncation.
export function extractJson<T = unknown>(text: string): T | null {
  if (!text || !text.trim()) {
    console.error('extractJson: Empty or null text provided');
    return null;
  }
  
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Log the cleaned text for debugging
  console.log('extractJson: Attempting to parse:', cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : ''));

  // Find first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start === -1) {
    console.error('extractJson: No opening brace found in response');
    console.error('Full response:', cleaned);
    return null;
  }

  // If we have both braces, try the full slice first
  if (end > start) {
    const slice = cleaned.slice(start, end + 1);
    const result = tryParse<T>(slice);
    if (result !== null) {
      console.log('extractJson: Successfully parsed full JSON slice');
      return result;
    }
  }

  // Try progressively smaller slices from the end
  for (let i = cleaned.length; i > start; i--) {
    const slice = cleaned.slice(start, i);
    const result = tryParse<T>(slice);
    if (result !== null) {
      console.log(`extractJson: Successfully parsed JSON slice at position ${i}`);
      return result;
    }
  }

  // Last resort: the JSON may be truncated (missing closing braces).
  // Try to auto-close it by counting open vs close braces/brackets.
  const truncated = cleaned.slice(start);
  const repaired = repairJson(truncated);
  if (repaired) {
    const result = tryParse<T>(repaired);
    if (result !== null) {
      console.log('extractJson: Successfully parsed repaired JSON');
      return result;
    }
  }

  console.error('extractJson: Failed to parse JSON from response');
  console.error('Full response:', cleaned);
  return null;
}

// Attempt to parse JSON, fixing common LLM issues like trailing commas.
function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fix trailing commas before } or ]
    const fixed = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(fixed) as T;
    } catch {
      return null;
    }
  }
}

// Best-effort extraction of a single string field from a *partial* (still
// streaming) JSON response. Used to show the professional response live as it
// arrives, instead of waiting for the whole JSON object to finish.
// Returns the decoded value so far, or '' if the field isn't present yet.
export function extractPartialString(raw: string, field: string): string {
  const key = `"${field}"`;
  const keyIdx = raw.indexOf(key);
  if (keyIdx === -1) return '';
  // Find the colon after the key, then the opening quote of the value.
  let i = keyIdx + key.length;
  while (i < raw.length && raw[i] !== ':') i++;
  i++; // skip ':'
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (raw[i] !== '"') return '';
  i++; // skip opening quote

  let out = '';
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\') {
      const next = raw[i + 1];
      if (next === undefined) break; // truncated escape sequence
      switch (next) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'u': {
          const hex = raw.slice(i + 2, i + 6);
          if (hex.length < 4) { i = raw.length; break; } // truncated unicode escape
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default: out += next;
      }
      i += 2;
    } else if (ch === '"') {
      break; // closing quote — value complete
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

// Attempt to repair truncated JSON by auto-closing open braces/brackets.
function repairJson(text: string): string | null {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  if (braces < 0 || brackets < 0) return null; // malformed, not truncated

  let repaired = text;
  // Close any open brackets first, then braces
  for (let i = 0; i < brackets; i++) repaired += ']';
  for (let i = 0; i < braces; i++) repaired += '}';

  return repaired;
}
