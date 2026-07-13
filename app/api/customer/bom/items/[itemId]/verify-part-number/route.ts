import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerBomPartNumber } from '../../../../../../../lib/customer-bom/part-number-verification';
import { createClient } from '../../../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isMissingColumnError = (message: string) => /Could not find the '.*' column|schema cache/i.test(message);

const toUpdatePayload = (result: Awaited<ReturnType<typeof verifyCustomerBomPartNumber>>) => ({
  part_number_check_status: result.status,
  part_number_check_message: result.message,
  part_number_check_source: result.source,
  part_number_check_confidence: result.confidence,
  part_number_matched_mpn: result.matched_mpn,
  part_number_matched_manufacturer: result.matched_manufacturer,
  part_number_matched_description: result.matched_description,
  part_number_datasheet_url: result.datasheet_url,
  part_number_verification_raw_json: result.raw_json,
  part_number_verified_at: new Date().toISOString(),
});

const basicUpdatePayload = (result: Awaited<ReturnType<typeof verifyCustomerBomPartNumber>>) => ({
  part_number_check_status: result.status,
  part_number_check_message: result.message,
  part_number_check_source: result.source,
});

export async function POST(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to verify this BOM item.', 401);

  const { data: item, error: itemError } = await supabase
    .from('customer_bom_upload_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (itemError) return jsonError(itemError.message, 500);
  if (!item) return jsonError('BOM item not found.', 404);

  const result = await verifyCustomerBomPartNumber(supabase, item);
  let updatePayload = toUpdatePayload(result);
  let update = await supabase
    .from('customer_bom_upload_items')
    .update(updatePayload)
    .eq('id', itemId)
    .eq('user_id', authData.user.id)
    .select('*')
    .single();

  if (update.error && isMissingColumnError(update.error.message)) {
    update = await supabase
      .from('customer_bom_upload_items')
      .update(basicUpdatePayload(result))
      .eq('id', itemId)
      .eq('user_id', authData.user.id)
      .select('*')
      .single();
  }
  if (update.error) return jsonError(update.error.message, 500);
  return NextResponse.json({ item: update.data, verification: result });
}
