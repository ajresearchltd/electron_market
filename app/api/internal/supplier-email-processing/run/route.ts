import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { processInboundMessage } from '../../../../../lib/supplier-email/pipeline';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.EMAIL_PROCESSOR_CRON_SECRET; if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Processor authentication failed.' }, { status: 401 });
  const database = createAdminClient(); if (!database) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 });
  const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 5));
  const candidates = await database.rpc('claim_supplier_inbound_messages',{batch_size:limit});
  if (candidates.error) return NextResponse.json({ error: 'Processing queue could not be read.' }, { status: 500 });
  const results = [];
  for (const row of candidates.data ?? []) { try { results.push(await processInboundMessage(database,row.id)); } catch (error) { console.error('[supplier-email-processor]',row.id,error); await database.from('supplier_inbound_messages').update({processing_status:'failed',processing_error:error instanceof Error?error.message:'Processing failed.',locked_at:null}).eq('id',row.id); results.push({id:row.id,status:'failed'}); } }
  return NextResponse.json({ processed: results.length, results });
}
