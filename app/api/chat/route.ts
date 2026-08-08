import { NextRequest } from 'next/server';
import { FREE_MODELS, resolveModelId } from '@/lib/ai/models';
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENROUTER_API_KEY is not set. Add it to your .env file.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemPrompt = SYSTEM_PROMPTS[task] ?? SYSTEM_PROMPTS['answer-question'];
  const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];

  // Model fallback chain: chosen model first, then all free models.
  const requested = model && model !== 'auto' ? [model] : [];
  const chain = [...requested, ...FREE_MODELS.map((m) => m.id)].filter(
    (id, i, arr) => arr.indexOf(id) === i
  );

  const maxTokens = MAX_TOKENS[task] ?? 2000;
  const encoder = new TextEncoder();

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const stream = new ReadableStream({
    async start(controller) {
      let succeeded = false;
      let lastError = '';

      for (const modelId of chain) {
        if (succeeded) break;

        // Try each model up to 3 times with exponential backoff for 429s
        for (let attempt = 0; attempt < 3 && !succeeded; attempt += 1) {
          try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Interview Copilot',
              },
              body: JSON.stringify({
                model: modelId,
                messages: fullMessages,
                stream: true,
                temperature: 0.7,
                max_tokens: maxTokens,
              }),
            });

            if (!res.ok || !res.body) {
              lastError = `${modelId}: HTTP ${res.status}`;
              if (res.status === 429) {
                // Exponential backoff: 1.2s, 2.4s, 4.8s
                const backoff = 1200 * Math.pow(2, attempt);
                await sleep(backoff);
                continue;
              }
              // Non-retryable error like 404 — move to next model immediately
              break;
            }

            // Signal which model is being used
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: modelId })}\n\n`));

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
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                  }
                } catch {
                  // ignore malformed chunk
                }
              }
            }
            succeeded = true;
          } catch (err) {
            lastError = `${modelId}: ${err instanceof Error ? err.message : String(err)}`;
            if (lastError.includes('429')) {
              const backoff = 1200 * Math.pow(2, attempt);
              await sleep(backoff);
              continue;
            }
            break;
          }
        }
      }

      if (!succeeded) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: `All models failed. Last: ${lastError}` })}\n\n`)
        );
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