import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(_: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const client = await createClient(); const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  const database = createAdminClient(); if (!database) return NextResponse.json({ error: 'RFQ details are unavailable.' }, { status: 503 });
  const rfqId = (await params).rfqId;
  const header = await database.from('rfq_orders0').select('rfq_id,procurement_chain_id,procurement_number,order_number,rfq_status,deadline_at,total_items_count,total_requested_quantity,currency,allow_all_suppliers,customer_id').eq('rfq_id', rfqId).maybeSingle();
  if (!header.data) return NextResponse.json({ error: 'RFQ not found.' }, { status: 404 });
  const assignment = await database.from('rfq_supplier_assignments').select('assignment_id,assignment_status').eq('rfq_id', rfqId).eq('supplier_id', user.id).maybeSingle();
  const responses = await database.from('supplier_responses').select('id,status,needs_review,quote_valid_until,source_message_id').eq('rfq_id', rfqId).eq('supplier_id', user.id).eq('is_current', true);
  const eligible=header.data.allow_all_suppliers!==false?await database.from('supplier_company_profiles').select('profile_id').eq('user_id',user.id).in('verification_status',['approved','verified']).maybeSingle():{data:null};
  if (!eligible.data&&!assignment.data && !(responses.data ?? []).length) return NextResponse.json({ error: 'RFQ not found.' }, { status: 404 });
  const items = await database.from('rfq_order_items0').select('rfq_item_id,line_number,part_number,manufacturer,description,requested_quantity,quantity_unit,source_bom_item_id').eq('rfq_id', rfqId).order('line_number');
  const responseIds = (responses.data ?? []).map((row: any) => row.id);
  const offers = responseIds.length ? await database.from('supplier_response_items').select('id,supplier_response_id,rfq_item_id,bom_item_id,offered_mpn,offered_manufacturer,offered_quantity,available_quantity,calculated_unit_price,currency,price_basis_quantity,price_basis_unit,moq,lead_time_days,package_quantity,condition,date_code_normalized,date_code_raw,response_status,review_status,normalization_status,matching_confidence').in('supplier_response_id', responseIds).eq('supplier_id', user.id).eq('is_current', true) : { data: [], error: null };
  const allocations = await database.from('procurement_supplier_allocations').select('id,rfq_item_id,supplier_response_item_id,allocated_quantity,is_active,selected_at,selected_by').eq('rfq_id', rfqId).eq('supplier_id', user.id).eq('is_active', true);
  if (items.error || offers.error) return NextResponse.json({ error: 'RFQ positions could not be loaded.' }, { status: 500 });
  const {customer_id:_customerId,...safeRfq}=header.data;
  return NextResponse.json({ rfq: safeRfq, items: items.data ?? [], offers: offers.data ?? [], allocations: allocations.data ?? [], assignment: assignment.data }, { headers: { 'cache-control': 'private, no-store' } });
}
