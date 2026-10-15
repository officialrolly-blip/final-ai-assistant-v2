import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? '',
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    hasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY),
    hasDeepgram: Boolean(process.env.DEEPGRAM_API_KEY),
  });
}
