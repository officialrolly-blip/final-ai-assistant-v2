import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY is not set.' }, { status: 500 });
  }
  // Deepgram supports passing the API key directly in the WebSocket URL query param.
  return NextResponse.json({ url: 'wss://api.deepgram.com/v1/listen' });
}
