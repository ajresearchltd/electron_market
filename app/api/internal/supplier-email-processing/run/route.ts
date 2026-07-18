import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import {runSupplierEmailQueue} from '../../../../../lib/supplier-email/queue';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.EMAIL_PROCESSOR_CRON_SECRET; if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Processor authentication failed.' }, { status: 401 });
  const database = createAdminClient(); if (!database) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 });
  const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 5));
  let results;try{results=await runSupplierEmailQueue(database,limit)}catch{return NextResponse.json({error:'Processing queue could not be read.'},{status:500})}
  return NextResponse.json({ processed: results.length, results });
}
