import { NextRequest } from 'next/server';
import { FREE_MODELS, resolveModelId, rawModelId, providerFor } from '@/lib/ai/models';
import { tryGroq } from '@/lib/ai/groq';
import { tryOpenRouter } from '@/lib/ai/openrouter';
import type { ChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RequestBody {
  task: 'analyze-resume' | 'generate-ats-resume' | 'interview-prep' | 'answer-question' | 'detect-question';
  messages: ChatMessage[];
  model?: string;
}

// Max tokens per task — interview-prep needs much more room than a single answer
const MAX_TOKENS: Record<RequestBody['task'], number> = {
  'analyze-resume': 6000, // Increased from 4000 to reduce truncation
  'generate-ats-resume': 8000, // Increased from 6000
  'interview-prep': 10000, // Increased from 8000
  'answer-question': 2000,
  'detect-question': 200,
};

const SYSTEM_PROMPTS: Record<RequestBody['task'], string> = {
  'analyze-resume': `CRITICAL INSTRUCTION: You must output ONLY valid JSON. No markdown, no code fences, no explanations, no introductory text, no concluding text.

Return ONLY this JSON structure (starting with { and ending with }):
{
  "overallScore": number (0-100),
  "atsCompatibility": number (0-100),
  "resumeQuality": number (0-100),
  "keywordMatch": number (0-100),
  "missingSkills": string[],
  "technicalSkills": string[],
  "softSkills": string[],
  "relevantExperience": string[],
  "projects": string[],
  "achievements": string[],
  "formatting": string[],
  "grammar": string[],
  "strengths": string[],
  "weaknesses": string[],
  "suggestions": string[],
  "summary": string
}

Be specific and actionable. Analyze the resume against the provided job description and company.`,
  'interview-prep': `CRITICAL INSTRUCTION: You must output ONLY valid JSON. No markdown, no code fences, no explanations, no introductory text, no concluding text.

Return ONLY this JSON structure (starting with { and ending with }):
{
  "behavioralQuestions": [{ "id": string, "question": string, "type": "behavioral", "category": "behavioral", "suggestedAnswer": string, "keyPoints": string[] }],
  "technicalQuestions": [{ "id": string, "question": string, "type": "technical", "category": "technical", "suggestedAnswer": string, "keyPoints": string[] }],
  "companyQuestions": [{ "id": string, "question": string, "type": "general", "category": "company", "suggestedAnswer": string, "keyPoints": string[] }],
  "starExamples": [{ "situation": string, "task": string, "action": string, "result": string }],
  "weaknessQuestions": [{ "id": string, "question": string, "type": "weakness", "category": "weakness", "suggestedAnswer": string, "keyPoints": string[] }],
  "strengthQuestions": [{ "id": string, "question": string, "type": "strength", "category": "strength", "suggestedAnswer": string, "keyPoints": string[] }]
}

Generate 3-5 questions per category (keep answers concise). Make answers specific to the candidate's resume. Each "type" must be one of: behavioral, technical, situational, leadership, culture_fit, problem_solving, salary, strength, weakness, follow_up, general.`,
  'generate-ats-resume': `You are an expert ATS resume writer. Rewrite the provided resume into a polished, recruiter-friendly, ATS-compatible resume. Keep the candidate's experience, achievements, and skills intact. Use a clean structured format with clear headings, concise bullet points, quantifiable impact statements, and strong keywords. Do not include markdown fences or any explanation. Return ONLY valid JSON with this exact schema:
{
  "improvedResume": string,
  "notes": string
}
Output ONLY the JSON object, starting with { and ending with }.`,
  'answer-question': `You are an expert interview coach helping a candidate during a LIVE interview. Given the interviewer's question, the conversation history, the candidate's resume, and the job context, generate an instant, professional answer.

Return ONLY valid JSON (no markdown fences, no prose before or after) with this exact schema:
{
  "professionalResponse": string,
  "starResponse": string (Situation/Task/Action/Result format, or empty if not applicable),
  "bulletPoints": string[],
  "keywords": string[],
  "shortVersion": string (1-2 sentence elevator version),
  "expandedVersion": string (more detailed version),
  "followUps": string[],
  "speakingTimeEstimate": string (e.g. "45-60 seconds"),
  "confidenceScore": number (0-100),
  "questionType": string (one of: behavioral, technical, situational, leadership, culture_fit, problem_solving, salary, strength, weakness, follow_up, general)
}

Rules:
- Base answers on the candidate's ACTUAL resume experience. Never invent fake jobs or skills.
- Keep responses concise and deliverable in under 90 seconds.
- Match the answer style to the detected question type.
- If it's a technical question, include a brief technical explanation.
- If behavioral, use STAR format.
- Be authentic, not robotic.
- Output ONLY the JSON object, starting with { and ending with }.`,
  'detect-question': `You are an interview question classifier. Given the interviewer's text, determine the question type. Return ONLY valid JSON: { "questionType": string, "confidence": number (0-100) }. Question type must be one of: behavioral, technical, situational, leadership, culture_fit, problem_solving, salary, strength, weakness, follow_up, general.`,
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const { task, messages, model } = body;

  const groqKey = process.env.GROQ_API_KEY ?? '';
  const openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!groqKey && !openRouterKey) {
    return new Response(
      JSON.stringify({ error: 'No AI provider key set. Add GROQ_API_KEY (recommended, free at console.groq.com) or OPENROUTER_API_KEY to your .env file.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemPrompt = SYSTEM_PROMPTS[task] ?? SYSTEM_PROMPTS['answer-question'];
  const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];

  // Fallback chain: chosen model first, then all free models (Groq first).
  const resolvedRequested = model && model !== 'auto' ? resolveModelId(model) : null;
  const validIds = new Set(FREE_MODELS.map((m) => m.id));
  const requested = resolvedRequested && validIds.has(resolvedRequested) ? [resolvedRequested] : [];
  // Skip providers with no key configured.
  const chain = [...requested, ...FREE_MODELS.map((m) => m.id)]
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .filter((id) => (providerFor(id) === 'groq' ? Boolean(groqKey) : Boolean(openRouterKey)));

  const maxTokens = MAX_TOKENS[task] ?? 2000;
  const encoder = new TextEncoder();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let succeeded = false;
      let lastError = '';

      for (const modelId of chain) {
        if (succeeded) break;
        const provider = providerFor(modelId);
        const raw = rawModelId(modelId);

        // Up to 2 attempts for retryable errors (429/5xx/network); else next model.
        for (let attempt = 0; attempt < 2 && !succeeded; attempt += 1) {
          console.log(`[chat] trying ${modelId} (attempt ${attempt + 1})`);
          const result =
            provider === 'groq'
              ? await tryGroq(modelId, raw, {
                  apiKey: groqKey,
                  messages: fullMessages,
                  maxTokens,
                  emit,
                })
              : await tryOpenRouter(modelId, raw, {
                  apiKey: openRouterKey,
                  messages: fullMessages,
                  maxTokens,
                  emit,
                });
          if (result.ok) {
            succeeded = true;
            break;
          }
          lastError = result.error;
          console.error(`[chat] ${modelId} failed:`, lastError);
          // OpenRouter's daily free-quota 429 won't clear by waiting — skip ahead.
          if (result.retryable && !lastError.includes('free-models-per-day') && attempt === 0) {
            await sleep(1500);
            continue;
          }
          break;
        }
      }

      if (!succeeded) {
        const hint = !groqKey
          ? ' Tip: add a free GROQ_API_KEY (https://console.groq.com/keys) for fast, stable free inference.'
          : lastError.includes('free-models-per-day')
            ? ' Tip: OpenRouter free quota is 50 req/day — Groq is primary, but it also failed. Check server logs.'
            : '';
        emit({ error: `All models failed. Last: ${lastError}${hint}` });
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
export async function GET() {
  return new Response(
    JSON.stringify({ models: FREE_MODELS, defaultModel: resolveModelId('auto') }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}