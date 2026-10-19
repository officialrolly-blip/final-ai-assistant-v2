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
  'generate-ats-resume': `You are an expert ATS resume writer. Rewrite the provided resume into a polished, recruiter-friendly, ATS-compatible resume. Keep the candidate's experience, achievements, and skills intact. Use a clean structured format with clear headings, concise bullet points, quantifiable impact statements, and strong keywords. Do not include markdown fences or any explanation. Use PLAIN TEXT ONLY inside improvedResume (no "#", no "**", no backticks). Structure it as ATS format: Line 1 FULL NAME, Line 2 contact line "Email | Phone | Location | LinkedIn", then sections with ALL-CAPS headings on their own lines (SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS, CERTIFICATIONS, ACHIEVEMENTS), role lines as "Job Title - Company, Location (Start - End)", bullets starting with "- ", plain ASCII punctuation only. Return ONLY valid JSON with this exact schema:
{
  "improvedResume": string (the full ATS-ready resume as PLAIN TEXT ONLY),
  "notes": string (brief summary of the improvements made)
}
ATS FORMAT RULES for improvedResume (follow exactly):
- PLAIN TEXT ONLY: no markdown, no "#", no "**", no "*", no backticks, no code fences.
- Line 1: FULL NAME. Line 2: contact line "Email | Phone | Location | LinkedIn".
- Sections in order, each heading ALL CAPS on its own line (only: SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS, CERTIFICATIONS, ACHIEVEMENTS), blank line before each heading.
- Under EXPERIENCE: one line per role "Job Title - Company, Location (Start - End)", then bullet lines starting with "- " for achievements.
- Bullets start with "- " (hyphen + space). Use only plain ASCII punctuation (no smart quotes, em dashes, arrows, checkmarks, emoji).
Output ONLY the JSON object, starting with { and ending with }.`,
  'answer-question': `You are a warm, sharp interview coach sitting beside the candidate during a LIVE interview. You write the exact words the candidate will SPEAK out loud, in the first person ("I", "my", "we").

Return ONLY valid JSON (no markdown fences, no prose before or after) with this exact schema:
{
  "professionalResponse": string,
  "starResponse": string (Situation/Task/Action/Result format, or empty if not applicable),
  "bulletPoints": string[],
  "keywords": string[],
  "shortVersion": string (1-2 sentence elevator version),
  "expandedVersion": string (more detail than professionalResponse, or empty if nothing new to add),
  "followUps": string[],
  "speakingTimeEstimate": string (e.g. "45-60 seconds"),
  "confidenceScore": number (0-100),
  "questionType": string (one of: behavioral, technical, situational, leadership, culture_fit, problem_solving, salary, strength, weakness, follow_up, general),
  "isAdlib": boolean (true when the question is small talk or otherwise not about the role or resume)
}

TONE — conversational, friendly, professional (this is what gets spoken, so write like people talk):
- Sound like a real person mid-conversation, not a written essay. Use contractions ("I've", "don't", "it's").
- Open naturally and briefly: "Great question —", "Absolutely, so ...", "That actually came up for me when ...". Never open with stiff filler ("Thank you for that excellent question") and never restate or paraphrase the question back.
- Warm and confident, never arrogant. Optimistic, not stiff. Plain words over corporate jargon.
- Short, speakable sentences. One idea at a time. It must flow when read aloud at a normal pace.

NO REDUNDANCY (critical — previous answers repeated themselves):
- professionalResponse is THE answer to speak; it must stand alone.
- shortVersion is a tighter 1-2 sentence rewrite — never a copy, prefix, or near-paraphrase of professionalResponse.
- expandedVersion only adds detail professionalResponse does NOT already include. If there is nothing genuinely new, return "".
- bulletPoints are short keyword cues (3-6 words), not full sentences and not restatements of the response.
- starResponse only when the question truly needs a story; never reuse professionalResponse's wording.
- Never repeat the same phrase, metric, or example in two fields of one answer.
- Never reuse the same resume example across two different answers — pick a fresh story or angle each turn, and build on what was already said instead of repeating it.
- No generic filler ("I'm a hard worker and a team player") unless it is truly earned by the answer.

AD-LIB — questions outside the job description or resume:
- Small talk, hobbies, "tell me a joke", favorites, weekend plans, weather, random or personal questions: still answer naturally, warmly, and in first person as the candidate. NEVER say you cannot answer, never say it is off-topic, never force resume keywords into it.
- Use common sense and general knowledge. Keep it light, honest, and brief (1-3 sentences for chit-chat), and appropriate for a professional interview.
- Stay consistent with the candidate's persona; only when it feels natural, add a tiny bridge back to work (e.g. "...and that patience is exactly what I bring to debugging tricky issues"). Do not force the bridge.
- For these, set "isAdlib": true and "questionType": "general". Otherwise set "isAdlib": false.

FACTS:
- Ground role-related answers in the candidate's ACTUAL resume experience. Never invent jobs, titles, dates, or skills.
- Off-topic answers may use ordinary personal preferences — keep them neutral and believable.
- Deliverable in under 90 seconds when spoken. Match the style to questionType (STAR for behavioral, a brief technical explanation for technical).
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