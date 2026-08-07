import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const ext = name.endsWith('.pdf') ? 'pdf' : name.endsWith('.docx') ? 'docx' : name.endsWith('.txt') ? 'txt' : null;
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    let text = '';
    if (ext === 'pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text: pdfText } = await extractText(pdf, { mergePages: true });
      text = pdfText;
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: bytes });
      text = result.value;
    } else {
      text = bytes.toString('utf-8');
    }

    text = text.replace(/\u0000/g, '').trim();
    if (!text || text.length < 20) {
      return NextResponse.json({ error: 'Could not extract readable text from this file.' }, { status: 422 });
    }

    return NextResponse.json({
      text,
      fileName: file.name,
      fileType: ext,
      sizeBytes: file.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse file: ${err instanceof Error ? err.message : 'unknown error'}` },
      { status: 500 }
    );
  }
}
