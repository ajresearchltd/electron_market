import { NextRequest, NextResponse } from 'next/server';
import { searchNexarByPartNumber } from '../../../../../lib/market-data/nexar';
import { createRequiredAdminClient } from '../../../../../lib/supabase/admin';
import { createClient } from '../../../../../lib/supabase/server';
import { getOrCreateExternalVendor, getVendorOfferSnapshot } from '../../../../../lib/vendors/external-vendors';

const jsonError = (message: string, status = 400, extra: Record<string, unknown> = {}) => (
  NextResponse.json({ ok: false, error: message, ...extra }, { status })
);

const normalizePartNumber = (value: string) => value.trim().toUpperCase();
const validUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isMissingColumnError = (message: string) => /Could not find the '.*' column|schema cache/i.test(message);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const partNumber = String(body.part_number || '').trim();
  const normalizedPartNumber = normalizePartNumber(partNumber);
  const chatSessionId = validUuid(body.chat_session_id) ? String(body.chat_session_id) : null;

  if (!partNumber) return jsonError('Part number is required.');

  let supabase;
  try {
    supabase = createRequiredAdminClient();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Server database client is not configured.', 500);
  }

  const userSupabase = await createClient();
  const { data: authData } = await userSupabase.auth.getUser();
  const userId = authData.user?.id ?? null;

  const requestPayload = {
    part_number: partNumber,
    normalized_part_number: normalizedPartNumber,
    chat_session_id: chatSessionId,
  };

  const { data: requestRow, error: insertError } = await supabase
    .from('octopart_requests')
    .insert({
      user_id: userId,
      chat_session_id: chatSessionId,
      source_provider: 'nexar_octopart',
      query_type: 'part_number',
      part_number: partNumber,
      normalized_part_number: normalizedPartNumber,
      request_status: 'processing',
      request_payload_json: requestPayload,
    })
    .select('id, request_number')
    .single();

  if (insertError) return jsonError(`octopart_requests insert: ${insertError.message}`, 500);

  try {
    const result = await searchNexarByPartNumber(normalizedPartNumber);
    const summary = {
      part_number: result.part_number,
      manufacturer: result.manufacturer,
      description: result.description,
      datasheet_url: result.datasheet_url,
      octopart_url: result.octopart_url,
      source_url: result.source_url,
      offers_count: result.offers.length,
    };

    const { error: updateError } = await supabase
      .from('octopart_requests')
      .update({
        request_status: 'completed',
        response_summary_json: summary,
        raw_response_json: result.raw_response_json,
        error_message: null,
      })
      .eq('id', requestRow.id);

    if (updateError) return jsonError(`octopart_requests update: ${updateError.message}`, 500, { request_id: requestRow.id, request_number: requestRow.request_number });

    if (result.offers.length > 0) {
      const offerRows = [];
      for (const offer of result.offers) {
        let centralSnapshot: Record<string, unknown> = {};
        try {
          const vendor = await getOrCreateExternalVendor(supabase, offer.seller);
          const { snapshot } = await getVendorOfferSnapshot(supabase, vendor.id);
          centralSnapshot = snapshot;
        } catch (error) {
          console.warn('External vendor directory link skipped:', error instanceof Error ? error.message : error);
        }

        offerRows.push({
          octopart_request_id: requestRow.id,
          seller_name: offer.seller,
          part_number: result.part_number,
          manufacturer: result.manufacturer,
          description: result.description,
          available_quantity: offer.available_quantity,
          unit_price: offer.unit_price,
          currency: offer.currency,
          lead_time_days: offer.lead_time_days,
          datasheet_url: result.datasheet_url,
          product_url: offer.product_url,
          source_url: result.source_url,
          raw_offer_json: offer.raw_offer_json ?? {},
          ...centralSnapshot,
        });
      }

      const { error: offersError } = await supabase
        .from('octopart_request_offers')
        .insert(offerRows);

      if (offersError) {
        if (isMissingColumnError(offersError.message)) {
          const fallbackRows = offerRows.map((row) => ({
            octopart_request_id: row.octopart_request_id,
            seller_name: row.seller_name,
            part_number: row.part_number,
            manufacturer: row.manufacturer,
            description: row.description,
            available_quantity: row.available_quantity,
            unit_price: row.unit_price,
            currency: row.currency,
            lead_time_days: row.lead_time_days,
            datasheet_url: row.datasheet_url,
            product_url: row.product_url,
            source_url: row.source_url,
            raw_offer_json: row.raw_offer_json,
          }));
          const { error: fallbackError } = await supabase.from('octopart_request_offers').insert(fallbackRows);
          if (fallbackError) return jsonError(`octopart_request_offers insert: ${fallbackError.message}`, 500, { request_id: requestRow.id, request_number: requestRow.request_number });
        } else {
          return jsonError(`octopart_request_offers insert: ${offersError.message}`, 500, { request_id: requestRow.id, request_number: requestRow.request_number });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      request_number: requestRow.request_number,
      request_id: requestRow.id,
      source: 'nexar_octopart',
      part_number: result.part_number,
      summary,
      offers: result.offers.map((offer) => ({
        seller: offer.seller,
        available_quantity: offer.available_quantity,
        unit_price: offer.unit_price,
        currency: offer.currency,
        lead_time_days: offer.lead_time_days,
        product_url: offer.product_url,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nexar / Octopart search failed.';
    await supabase
      .from('octopart_requests')
      .update({
        request_status: 'error',
        error_message: message,
      })
      .eq('id', requestRow.id);

    return jsonError(message, 500, {
      request_id: requestRow.id,
      request_number: requestRow.request_number,
    });
  }
}
