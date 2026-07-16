import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../lib/auth/require-internal-api';
import { ingestInboundEmail, normalizeInboundEmail, parseEml } from '../../../../../lib/supplier-email/pipeline';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireInternalApi(); if ('error' in auth) return fail(auth.error, auth.status);
  try {
    const form = await request.formData(); const files = form.getAll('attachments').filter((value): value is File => value instanceof File && value.size > 0);
    const eml = form.get('eml'); let parsed: Record<string, any> = {}; let rawEmail: Uint8Array | null = null;
    if (eml instanceof File && eml.size) { rawEmail = new Uint8Array(await eml.arrayBuffer()); parsed = parseEml(rawEmail); }
    const normalized = normalizeInboundEmail({ ...parsed, sender: form.get('sender') || parsed.sender, recipients: form.get('recipients') || parsed.recipients, subject: form.get('subject') || parsed.subject, textBody: form.get('body') || parsed.textBody, rawEmail, attachments: await Promise.all(files.map(async (file) => ({ fileName: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }))) }, 'manual');
    if (!normalized.sender) return fail('Sender email is required.');
    if (!normalized.textBody && !normalized.rawEmail && !normalized.attachments.length) return fail('Email text, an .eml file, or an attachment is required.');
    const result = await ingestInboundEmail(auth.admin, normalized); return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) { console.error('[supplier-inbox-ingest]', error); return fail(error instanceof Error ? error.message : 'Inbound email could not be stored.', 500); }
}
