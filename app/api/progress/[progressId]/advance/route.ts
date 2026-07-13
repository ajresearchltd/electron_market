import { NextRequest, NextResponse } from 'next/server';
import {
  PROGRESS_STAGES,
  advanceProgressStage,
  isMissingProgressTableError,
  type ProgressStageCode,
} from '../../../../../lib/procurement-progress/progress';
import { createClient } from '../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const stageCodes = PROGRESS_STAGES.map((stage) => stage.code);
const isStageCode = (value: string): value is ProgressStageCode => stageCodes.includes(value as ProgressStageCode);

const allowedForRole: Record<string, ProgressStageCode[]> = {
  customer: ['approved', 'goods_received'],
  supplier: ['quote_received'],
  admin: ['payment', 'goods_shipped', 'order_completed', 'rfq', 'quote_received', 'approved', 'goods_received'],
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ progressId: string }> }) {
  const { progressId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to update progress.', 401);

  const body = await request.json().catch(() => ({}));
  const nextStage = String(body.next_stage || body.stage || '');
  if (!isStageCode(nextStage)) return jsonError('Invalid progress stage.');

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', authData.user.id).maybeSingle();
  const role = profile?.role === 'admin' ? 'admin' : profile?.role === 'supplier' ? 'supplier' : 'customer';
  if (!allowedForRole[role].includes(nextStage)) return jsonError('You do not have permission to set this progress stage.', 403);

  const note = String(body.note || '').trim();
  const eventData = {
    payment_reference: body.payment_reference || null,
    payment_amount: body.payment_amount === '' || body.payment_amount === undefined ? null : Number(body.payment_amount),
    payment_currency: body.payment_currency || null,
    shipment_carrier: body.shipment_carrier || null,
    shipment_tracking_number: body.shipment_tracking_number || null,
    shipment_tracking_url: body.shipment_tracking_url || null,
  };

  const { data, error } = await advanceProgressStage(
    supabase,
    progressId,
    nextStage,
    { userId: authData.user.id, role },
    note,
    eventData,
    { allowBackwards: role === 'admin' },
  );

  if (error) {
    if (isMissingProgressTableError(error.message)) return jsonError('Progress tables are not installed. Run the procurement progress SQL helper first.', 503);
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ progress: data });
}
