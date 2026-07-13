import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerBomPartNumber } from '../../../../../../../lib/customer-bom/part-number-verification';
import { createClient } from '../../../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

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

const isMissingColumnError = (message: string) => /Could not find the '.*' column|schema cache/i.test(message);

export async function POST(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to verify BOM part numbers.', 401);

  const { data: upload, error: uploadError } = await supabase
    .from('customer_bom_uploads')
    .select('id')
    .eq('id', uploadId)
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (uploadError) return jsonError(uploadError.message, 500);
  if (!upload) return jsonError('BOM upload not found.', 404);

  const { data: items, error: itemError } = await supabase
    .from('customer_bom_upload_items')
    .select('id, part_number, manufacturer')
    .eq('upload_id', uploadId)
    .eq('user_id', authData.user.id)
    .order('row_number', { ascending: true });
  if (itemError) return jsonError(itemError.message, 500);

  let greenFound = 0;
  let yellowReview = 0;
  let redNotFound = 0;
  const errors: string[] = [];

  for (const item of items ?? []) {
    const result = await verifyCustomerBomPartNumber(supabase, item);
    if (['found_internal', 'found_octopart_exact', 'found_exact'].includes(result.status)) greenFound += 1;
    else if (['found_octopart_possible', 'manufacturer_mismatch', 'ambiguous', 'needs_review', 'suspicious_format'].includes(result.status)) yellowReview += 1;
    else redNotFound += 1;

    const { error: updateError } = await supabase
      .from('customer_bom_upload_items')
      .update(toUpdatePayload(result))
      .eq('id', item.id)
      .eq('user_id', authData.user.id);
    if (updateError) {
      if (isMissingColumnError(updateError.message)) {
        const { error: fallbackError } = await supabase
          .from('customer_bom_upload_items')
          .update(basicUpdatePayload(result))
          .eq('id', item.id)
          .eq('user_id', authData.user.id);
        if (fallbackError) errors.push(fallbackError.message);
      } else {
        errors.push(updateError.message);
      }
    }
  }

  return NextResponse.json({
    total_checked: items?.length ?? 0,
    green_found: greenFound,
    yellow_review: yellowReview,
    red_not_found: redNotFound,
    errors,
  });
}
