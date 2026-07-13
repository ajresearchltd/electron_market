import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAndAdmin } from '../../../../../../lib/ai/config';
import { createRequiredAdminClient } from '../../../../../../lib/supabase/admin';

const allowedStatuses = new Set(['verified', 'needs_review', 'high_risk', 'do_not_use']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const { isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin) return NextResponse.json({ ok: false, error: error || 'Admin access required.' }, { status: 403 });

  const { vendorId } = await params;
  const body = await request.json().catch(() => ({}));
  const verificationStatus = String(body.verification_status || '').trim();
  if (!allowedStatuses.has(verificationStatus)) {
    return NextResponse.json({ ok: false, error: 'Invalid verification_status.' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createRequiredAdminClient();
  } catch (clientError) {
    return NextResponse.json({ ok: false, error: clientError instanceof Error ? clientError.message : 'Server database client is not configured.' }, { status: 500 });
  }

  const updatePayload: Record<string, unknown> = {
    verification_status: verificationStatus,
    updated_at: new Date().toISOString(),
  };
  if (verificationStatus === 'verified') updatePayload.last_verified_at = new Date().toISOString();

  const { data, error: updateError } = await supabase
    .from('external_vendors')
    .update(updatePayload)
    .eq('id', vendorId)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true, vendor: data });
}
