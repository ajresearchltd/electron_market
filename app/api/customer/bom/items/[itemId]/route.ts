import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isMissingColumnError = (message: string) => /Could not find the '.*' column|schema cache/i.test(message);

const editableFields = [
  'line_number',
  'part_number',
  'normalized_part_number',
  'manufacturer',
  'manufacturer_part_number',
  'product_name',
  'description',
  'specification',
  'package_case',
  'quantity',
  'unit',
  'target_unit_price',
  'target_currency',
  'acceptable_alternatives',
  'allow_substitute',
  'authorized_suppliers_only',
  'preferred_origin_country',
  'date_code_requirement',
  'rohs_required',
  'reach_required',
  'datasheet_url',
  'notes',
  'customer_comment',
] as const;

const textOrNull = (value: unknown) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const boolOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'required'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'not required'].includes(normalized)) return false;
  return null;
};
const normalizePartNumber = (value: string | null) => value ? value.trim().replace(/\s+/g, '').toUpperCase() : null;

const validateItem = (payload: Record<string, any>) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const partNumber = textOrNull(payload.part_number);
  const quantity = numberOrNull(payload.quantity);
  const targetUnitPrice = numberOrNull(payload.target_unit_price);
  const datasheetUrl = textOrNull(payload.datasheet_url);

  if (!partNumber) errors.push('Missing Part Number');
  if (quantity === null) errors.push('Missing Quantity');
  if (quantity !== null && quantity <= 0) errors.push('Quantity must be greater than 0');
  if (partNumber && /^[0-9.,$€£\s]+$/.test(partNumber)) warnings.push('Part number looks suspicious.');
  if (!textOrNull(payload.manufacturer)) warnings.push('Missing Manufacturer');
  if (!textOrNull(payload.description)) warnings.push('Missing Description');
  if (payload.target_unit_price !== null && payload.target_unit_price !== undefined && String(payload.target_unit_price).trim() && targetUnitPrice === null) warnings.push('Target unit price is not numeric.');
  if (datasheetUrl && !/^https?:\/\/\S+$/i.test(datasheetUrl)) warnings.push('Datasheet URL is invalid.');

  return {
    validation_status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    validation_errors: errors,
    validation_warnings: warnings,
  };
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const uploadId = request.nextUrl.searchParams.get('uploadId') || '';
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to view this BOM item.', 401);

  const query = supabase
    .from('customer_bom_upload_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', authData.user.id);
  if (uploadId) query.eq('upload_id', uploadId);
  const { data: item, error: itemError } = await query.maybeSingle();

  if (itemError) return jsonError(itemError.message, 500);
  if (!item) return jsonError('BOM item not found.', 404);

  const { data: upload, error: uploadError } = await supabase
    .from('customer_bom_uploads')
    .select('id, upload_number, document_name, main_column_mapping, secondary_column_mapping')
    .eq('id', item.upload_id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (uploadError) return jsonError(uploadError.message, 500);
  if (!upload) return jsonError('BOM upload not found.', 404);
  return NextResponse.json({ item, upload });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('You must be signed in to edit this BOM item.', 401);

  const { data: existingItem, error: existingError } = await supabase
    .from('customer_bom_upload_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (existingError) return jsonError(existingError.message, 500);
  if (!existingItem) return jsonError('BOM item not found.', 404);

  const body = await request.json().catch(() => ({}));
  const updatePayload: Record<string, any> = {};
  editableFields.forEach((field) => {
    if (!(field in body)) return;
    if (['quantity', 'target_unit_price'].includes(field)) {
      updatePayload[field] = numberOrNull(body[field]);
    } else if (['allow_substitute', 'authorized_suppliers_only', 'rohs_required', 'reach_required'].includes(field)) {
      updatePayload[field] = boolOrNull(body[field]);
    } else {
      updatePayload[field] = textOrNull(body[field]);
    }
  });
  if (!('normalized_part_number' in updatePayload)) {
    updatePayload.normalized_part_number = normalizePartNumber(updatePayload.part_number ?? existingItem.part_number);
  }
  if ('part_number' in updatePayload && String(updatePayload.part_number ?? '') !== String(existingItem.part_number ?? '')) {
    updatePayload.part_number_check_status = 'not_checked';
    updatePayload.part_number_check_message = 'Part number changed. Run verification again.';
    updatePayload.part_number_check_source = null;
    updatePayload.part_number_check_confidence = null;
    updatePayload.part_number_matched_mpn = null;
    updatePayload.part_number_matched_manufacturer = null;
    updatePayload.part_number_matched_description = null;
    updatePayload.part_number_datasheet_url = null;
    updatePayload.part_number_verification_raw_json = {};
    updatePayload.part_number_verified_at = null;
  }

  const validation = validateItem({ ...existingItem, ...updatePayload });
  let updateResult = await supabase
    .from('customer_bom_upload_items')
    .update({
      ...updatePayload,
      ...validation,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', authData.user.id)
    .select('*')
    .single();
  if (updateResult.error && isMissingColumnError(updateResult.error.message)) {
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.part_number_check_confidence;
    delete fallbackPayload.part_number_matched_mpn;
    delete fallbackPayload.part_number_matched_manufacturer;
    delete fallbackPayload.part_number_matched_description;
    delete fallbackPayload.part_number_datasheet_url;
    delete fallbackPayload.part_number_verification_raw_json;
    delete fallbackPayload.part_number_verified_at;
    updateResult = await supabase
      .from('customer_bom_upload_items')
      .update({
        ...fallbackPayload,
        ...validation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('user_id', authData.user.id)
      .select('*')
      .single();
  }
  const { data: updatedItem, error: updateError } = updateResult;
  if (updateError) return jsonError(updateError.message, 500);

  const { data: siblingItems } = await supabase
    .from('customer_bom_upload_items')
    .select('validation_status')
    .eq('upload_id', existingItem.upload_id)
    .eq('user_id', authData.user.id);
  const rows = siblingItems ?? [];
  const totalRows = rows.length;
  const validRows = rows.filter((row) => row.validation_status === 'valid').length;
  const warningRows = rows.filter((row) => row.validation_status === 'warning').length;
  const errorRows = rows.filter((row) => row.validation_status === 'error').length;
  await supabase
    .from('customer_bom_uploads')
    .update({
      total_rows: totalRows,
      valid_rows: validRows,
      warning_rows: warningRows,
      error_rows: errorRows,
      ai_processing_status: errorRows > 0 || warningRows > 0 ? 'completed_with_warnings' : 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingItem.upload_id)
    .eq('user_id', authData.user.id);

  return NextResponse.json({ item: updatedItem });
}
