import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { customerProfileCompleteness } from '../customer/profile-completeness';

export const preliminaryOrderNumber = (row: { id: string; created_at: string }) => `PRE-${new Date(row.created_at).getUTCFullYear()}-${row.id.slice(0, 8).toUpperCase()}`;
const publicSources = ['homepage', 'industry_solution_detail'];

export async function listPublicPreliminaryOrders(db: SupabaseClient) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await db.from('public_sourcing_enquiries').select('id,customer_user_id,request_type,contact_email,payload,status,source,created_at,converted_at,converted_procurement_chain_id,converted_bom_upload_id').in('source', publicSources).order('created_at', { ascending: false }).range(from, from + 999);
    if (page.error) throw page.error;
    rows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  const userIds = [...new Set(rows.map((row: any) => row.customer_user_id).filter(Boolean))];
  const profileRows: any[] = [], companyRows: any[] = [];
  for (let from = 0; from < userIds.length; from += 200) {
    const ids = userIds.slice(from, from + 200);
    const [profiles, companies] = await Promise.all([
      db.from('user_profiles').select('id,email,full_name,company_name').in('id', ids),
      db.from('customer_company_profiles').select('user_id,company_name,country_iso2,country_name,contact_name,contact_email,contact_phone,phone,business_registration_number,registration_number').in('user_id', ids),
    ]);
    if (profiles.error) throw profiles.error; if (companies.error) throw companies.error;
    profileRows.push(...(profiles.data ?? [])); companyRows.push(...(companies.data ?? []));
  }
  const profileMap = new Map(profileRows.map((row: any) => [row.id, row])), companyMap = new Map(companyRows.map((row: any) => [row.user_id, row]));
  return rows.map((row: any) => {
    const profile: any = profileMap.get(row.customer_user_id), company: any = companyMap.get(row.customer_user_id), completeness = customerProfileCompleteness(profile, company), payload = row.payload ?? {};
    const displayStatus = row.converted_bom_upload_id ? 'Converted to BOM' : completeness.complete ? 'Ready for conversion' : 'Profile incomplete';
    return { id: row.id, requestNumber: preliminaryOrderNumber(row), createdAt: row.created_at, requestType: row.request_type, source: row.source, status: displayStatus, sourceStatus: row.status, displayStatus, convertedAt: row.converted_at, procurementChainId: row.converted_procurement_chain_id, bomUploadId: row.converted_bom_upload_id, customerUserId: row.customer_user_id, customerName: profile?.full_name ?? company?.contact_name ?? null, email: row.contact_email || profile?.email || company?.contact_email || null, company: company?.company_name || profile?.company_name || null, requestSummary: payload.productName || payload.title || payload.partNumber || payload.documentName || payload.description || null, estimatedBudget: payload.estimatedBudget ?? payload.targetBudget ?? null, destination: payload.country || payload.destinationCountry || null, delivery: payload.timeframe || payload.requiredDeliveryDate || null, missingProfileFields: completeness.missing };
  });
}

export async function getPreliminaryOrderDetail(db: SupabaseClient, id: string) {
  const result = await db.from('public_sourcing_enquiries').select('*').eq('id', id).maybeSingle();
  if (result.error) throw result.error; if (!result.data) return null;
  const row: any = result.data;
  const [profile, company] = await Promise.all([db.from('user_profiles').select('id,email,full_name,company_name').eq('id', row.customer_user_id).maybeSingle(), db.from('customer_company_profiles').select('*').eq('user_id', row.customer_user_id).maybeSingle()]);
  const payload = row.payload ?? {}, completeness = customerProfileCompleteness(profile.data, company.data);
  let bom: any = null, bomItems: any[] = [];
  const bomQuery = payload.bomUploadId ? db.from('customer_bom_uploads').select('id,original_file_name,document_name,file_type,total_rows,valid_rows,warning_rows,error_rows,status,ai_processing_status,created_at').eq('id', payload.bomUploadId) : db.from('customer_bom_uploads').select('id,original_file_name,document_name,file_type,total_rows,valid_rows,warning_rows,error_rows,status,ai_processing_status,created_at').eq('preliminary_order_id', id);
  const bomResult = await bomQuery.maybeSingle();
  if (bomResult.data) { bom = bomResult.data; const items = await db.from('customer_bom_upload_items').select('id,row_number,part_number,product_name,manufacturer,quantity,unit,target_unit_price,target_currency,package_case,description,specification,notes,validation_status,validation_errors,validation_warnings').eq('upload_id', bom.id).order('row_number'); bomItems = items.data ?? []; }
  return { ...row, requestNumber: preliminaryOrderNumber(row), profile: profile.data, company: company.data, profileCompleteness: completeness, bom, bomItems };
}
