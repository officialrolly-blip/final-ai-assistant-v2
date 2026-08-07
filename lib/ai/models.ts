// Curated list of free OpenRouter models, ordered by preference for interview-assistant use.
// The manager tries each in order until one works.
export interface OpenRouterModel {
  id: string;
  name: string;
  free: boolean;
}

export const FREE_MODELS: OpenRouterModel[] = [
  { id: 'inclusionai/ling-3.0-flash:free', name: 'Ling 3.0 Flash (free)', free: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Poolside Laguna S 2.1 (free)', free: true },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4 26B A4B (free)', free: true },
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B (free)', free: true },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA Nemotron 3 Super 120B (free)', free: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta Llama 3.3 70B (free)', free: true },
  { id: 'qwen/qwen3-32b:free', name: 'Qwen 3 32B (free)', free: true },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek Chat V3 (free)', free: true },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B (free)', free: true },
  { id: 'openai/gpt-oss-120b:free', name: 'OpenAI GPT-OSS 120B (free)', free: true },
  { id: 'moonshotai/kimi-k2-instruct:free', name: 'Kimi K2 Instruct (free)', free: true },
  { id: 'z-ai/glm-4.5-air:free', name: 'Z-AI GLM 4.5 Air (free)', free: true },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'NVIDIA Llama 3.1 Nemotron 70B (free)', free: true },
  { id: 'cognitivecomputations/dolphin3.0-mistral-24b:free', name: 'Dolphin 3.0 Mistral 24B (free)', free: true },
  { id: 'allenai/olmo-2-1124-7b-instruct:free', name: 'OLMo 2 1124 7B (free)', free: true },
  { id: 'qwen/qwen2.5-72b-instruct:free', name: 'Qwen 2.5 72B (free)', free: true },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Meta Llama 3.1 8B (free)', free: true },
];

export function resolveModelId(choice: string): string {
  if (choice && choice !== 'auto') return choice;
  return FREE_MODELS[0].id;
}

export function getModelName(id: string): string {
  const found = FREE_MODELS.find((m) => m.id === id);
  return found ? found.name : id;
}