import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../lib/auth/require-internal-api';
import { evaluateRfqForInvoice } from '../../../../../../lib/procurement-workflow';

export async function GET(_: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const auth = await requireInternalApi(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await evaluateRfqForInvoice(auth.admin, (await params).rfqId);
  return 'error' in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result.data, { headers: { 'cache-control': 'private, no-store' } });
}
