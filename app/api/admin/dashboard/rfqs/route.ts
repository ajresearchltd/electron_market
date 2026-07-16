import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../lib/auth/require-internal-api';
import { loadCanonicalRfqsForAdmin } from '../../../../../lib/rfqs/canonical';

export async function GET() {
  const auth = await requireInternalApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await loadCanonicalRfqsForAdmin(auth.admin, 30);
  if ('error' in result) return NextResponse.json({ error: 'Canonical RFQs could not be loaded.' }, { status: 500 });
  for (const warning of result.data.warnings) console.warn('Admin RFQ dashboard integrity warning', warning);
  return NextResponse.json(result.data, { headers: { 'cache-control': 'private, no-store' } });
}
