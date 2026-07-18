import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { customerProfileCompleteness } from '../customer/profile-completeness';

export const preliminaryOrderNumber = (row: { id: string; created_at: string }) => `PRE-${new Date(row.created_at).getUTCFullYear()}-${row.id.slice(0, 8).toUpperCase()}`;
const publicSources = ['homepage', 'industry_solution_detail'];

export async function listIncompletePublicPreliminaryOrders(db: SupabaseClient, limit = 15) {
  const result = await db.from('public_sourcing_enquiries').select('id,customer_user_id,request_type,contact_email,payload,status,source,created_at').in('source', publicSources).not('customer_user_id', 'is', null).order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 20));
  if (result.error) throw result.error;
  const userIds = [...new Set((result.data ?? []).map((row: any) => row.customer_user_id).filter(Boolean))];
  const [profiles, companies] = await Promise.all([
    userIds.length ? db.from('user_profiles').select('id,email,full_name,company_name').in('id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? db.from('customer_company_profiles').select('user_id,company_name,country_iso2,country_name,contact_name,contact_email,contact_phone,phone,business_registration_number,registration_number').in('user_id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map((profiles.data ?? []).map((row: any) => [row.id, row])), companyMap = new Map((companies.data ?? []).map((row: any) => [row.user_id, row]));
  return (result.data ?? []).map((row: any) => {
    const profile: any = profileMap.get(row.customer_user_id), company: any = companyMap.get(row.customer_user_id), completeness = customerProfileCompleteness(profile, company), payload = row.payload ?? {};
    return { id: row.id, requestNumber: preliminaryOrderNumber(row), createdAt: row.created_at, requestType: row.request_type, source: row.source, status: row.status, customerUserId: row.customer_user_id, customerName: profile?.full_name ?? company?.contact_name ?? null, email: row.contact_email || profile?.email || company?.contact_email || null, company: company?.company_name || profile?.company_name || null, requestSummary: payload.productName || payload.title || payload.partNumber || payload.documentName || payload.description || null, estimatedBudget: payload.estimatedBudget ?? payload.targetBudget ?? null, destination: payload.country || payload.destinationCountry || null, delivery: payload.timeframe || payload.requiredDeliveryDate || null, missingProfileFields: completeness.missing };
  }).filter((row: any) => row.missingProfileFields.length > 0);
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
  if (bomResult.data) { bom = bomResult.data; const items = await db.from('customer_bom_upload_items').select('row_number,part_number,manufacturer,quantity,description,validation_status,validation_errors,validation_warnings').eq('upload_id', bom.id).order('row_number').limit(5); bomItems = items.data ?? []; }
  return { ...row, requestNumber: preliminaryOrderNumber(row), profile: profile.data, company: company.data, profileCompleteness: completeness, bom, bomItems };
}
