import { NextResponse } from 'next/server';
import { getCurrentUserAndAdmin } from '../../../../../lib/ai/config';
import { createRequiredAdminClient } from '../../../../../lib/supabase/admin';
import { backfillExternalVendorsFromOctopart } from '../../../../../lib/vendors/external-vendors';

export async function POST() {
  const { isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin) return NextResponse.json({ ok: false, error: error || 'Admin access required.' }, { status: 403 });

  let supabase;
  try {
    supabase = createRequiredAdminClient();
  } catch (clientError) {
    return NextResponse.json({ ok: false, error: clientError instanceof Error ? clientError.message : 'Server database client is not configured.' }, { status: 500 });
  }

  try {
    const summary = await backfillExternalVendorsFromOctopart(supabase);
    return NextResponse.json({ ok: true, summary });
  } catch (backfillError) {
    return NextResponse.json({ ok: false, error: backfillError instanceof Error ? backfillError.message : 'Backfill failed.' }, { status: 500 });
  }
}
