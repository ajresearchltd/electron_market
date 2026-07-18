import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { ingestInboundEmail, normalizeInboundEmail, parseEml, type NormalizedInboundEmail } from '../../../../../lib/supplier-email/pipeline';
import {runSupplierEmailQueue} from '../../../../../lib/supplier-email/queue';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const runtime = 'nodejs';

async function readInboundEmail(request: Request): Promise<{ email?: NormalizedInboundEmail; error?: string; status?: number }> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('message/rfc822')) {
    const rawBuffer = Buffer.from(await request.arrayBuffer());
    if (rawBuffer.byteLength === 0) return { error: 'Empty RFC822 email body', status: 400 };

    const parsed = parseEml(rawBuffer);
    if (!parsed.sender || !parsed.recipients) return { error: 'Malformed RFC822 email: required From or To header is missing.', status: 400 };

    return {
      email: normalizeInboundEmail({ ...parsed, rawEmail: rawBuffer, attachments: [] }, 'rfc822'),
    };
  }

  if (contentType.includes('application/json')) {
    try {
      const payload = await request.json();
      const attachments = await Promise.all((Array.isArray(payload.attachments) ? payload.attachments : []).map(async (file: any) => ({
        fileName: String(file.fileName || 'attachment'),
        mimeType: String(file.mimeType || 'application/octet-stream'),
        bytes: Uint8Array.from(Buffer.from(String(file.contentBase64 || ''), 'base64')),
      })));
      return { email: normalizeInboundEmail({ ...payload, attachments }, String(payload.provider || 'generic')) };
    } catch {
      return { error: 'Malformed JSON email payload.', status: 400 };
    }
  }

  return { error: 'Unsupported Content-Type. Use message/rfc822 or application/json.', status: 415 };
}

export async function POST(request: Request) {
  const configured = process.env.INBOUND_EMAIL_WEBHOOK_SECRET; const supplied = request.headers.get('x-electron-email-secret');
  if (!configured || !supplied || configured.length !== supplied.length || !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) return fail('Webhook authentication failed.', 401);
  const database = createAdminClient(); if (!database) return fail('Server configuration is incomplete.', 503);

  const inbound = await readInboundEmail(request);
  if (!inbound.email) return fail(inbound.error || 'Inbound email body is invalid.', inbound.status || 400);

  try {
    const result = await ingestInboundEmail(database, inbound.email);
    if(!result.duplicate){const queued=await database.from('supplier_inbound_messages').update({processing_status:'queued',processing_error:null,locked_at:null}).eq('id',result.id).eq('processing_status','received');if(queued.error)throw new Error('Inbound email was stored but could not be queued.');const processed=await runSupplierEmailQueue(database,1);return NextResponse.json({...result,processing_status:processed.find((row:any)=>row.id===result.id)?.status??'queued',automaticProcessing:true},{status:202})}
    return NextResponse.json({...result,automaticProcessing:false},{status:200});
  } catch (error) { console.error('[inbound-email-webhook]', error); return fail(error instanceof Error ? error.message : 'Inbound email was rejected.', 500); }
}
