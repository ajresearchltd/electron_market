import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { validatePublicEnquiry } from './policy';

export async function currentRequestIdentity() {
  const session = await createClient(), { data: { user } } = await session.auth.getUser();
  if (user) {
    const [profile, company] = await Promise.all([
      session.from('user_profiles').select('id,email,full_name,company_name,role').eq('id', user.id).maybeSingle(),
      session.from('customer_company_profiles').select('company_name,profile_photo_path,profile_photo_url').eq('user_id', user.id).maybeSingle(),
    ]);
    let avatarUrl: string | null = company.data?.profile_photo_url ?? null;
    if (company.data?.profile_photo_path) {
      const signed = await session.storage.from('customer-profile-photos').createSignedUrl(company.data.profile_photo_path, 600);
      avatarUrl = signed.data?.signedUrl ?? avatarUrl;
    }
    return { kind: 'authenticated' as const, userId: user.id, email: user.email ?? profile.data?.email ?? '', role: profile.data?.role ?? null, fullName: profile.data?.full_name ?? user.email ?? 'Customer', companyName: company.data?.company_name ?? profile.data?.company_name ?? 'Customer', avatarUrl };
  }
  return { kind: 'guest' as const, verified: false };
}

export const validateEnquiry = validatePublicEnquiry;

type EnquiryContext = { source?: unknown; industrySolutionId?: unknown; publicSupplierSlug?: unknown; canonicalSupplierId?: unknown } | null | undefined;

export async function submitPublicEnquiry(type: string, payload: any, submissionIdempotencyKey: unknown, context?: EnquiryContext) {
  const identity = await currentRequestIdentity(), error = validatePublicEnquiry(type, payload), key = String(submissionIdempotencyKey ?? '');
  if (error) return { ok: false, error };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return { ok: false, error: 'A valid submission identity is required.' };
  if (identity.kind !== 'authenticated') return { ok: false, error: 'Sign in with your email code before submitting a request.' };

  const db = createAdminClient();
  if (!db) throw new Error('Request submission is unavailable.');
  let source = 'homepage';
  const safePayload: Record<string, unknown> = Object.fromEntries(Object.entries(payload ?? {}).filter(([field])=>!['canonicalSupplierId','requestedSupplierId','supplierId'].includes(field)).map(([field, value]) => [field, typeof value === 'string' ? value.trim().slice(0, 10000) : value]));
  if (context?.source === 'industry_solution_detail') {
    const industrySolutionId = String(context.industrySolutionId ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(industrySolutionId)) return { ok: false, error: 'The Industry Solution is not available.' };
    const solution = await db.from('industry_solution').select('ind_id,title').eq('ind_id', industrySolutionId).maybeSingle();
    if (solution.error || !solution.data) return { ok: false, error: 'The Industry Solution is not available.' };
    source = 'industry_solution_detail';
    safePayload.source = source;
    safePayload.industrySolutionId = solution.data.ind_id;
    safePayload.industrySolutionTitle = solution.data.title;
  } else if (context?.source === 'supplier_public_profile' || payload?.source === 'supplier_public_profile') {
    const publicSupplierSlug = String(context?.publicSupplierSlug ?? payload?.publicSupplierSlug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSupplierSlug) || publicSupplierSlug.length > 180) return { ok: false, error: 'The selected supplier is not available for public requests.' };
    const snapshot = await db.from('verified_supplier').select('canonical_supplier_id,public_slug,public_display_name,name,suppliers!inner(supplier_id,supplier_status)').eq('public_slug', publicSupplierSlug).eq('is_active', true).eq('is_public', true).eq('show_public_website', true).not('canonical_supplier_id', 'is', null).eq('suppliers.supplier_status', 'active').maybeSingle();
    if (snapshot.error || !snapshot.data?.canonical_supplier_id) return { ok: false, error: 'The selected supplier is not available for public requests.' };
    source = 'supplier_public_profile';
    safePayload.source = source;
    safePayload.publicSupplierSlug = snapshot.data.public_slug;
    safePayload.requestedSupplierId = snapshot.data.canonical_supplier_id;
    safePayload.selectedSupplierName = snapshot.data.public_display_name || snapshot.data.name || 'Verified Supplier';
  }

  const existing = await db.from('public_sourcing_enquiries').select('id,created_at,request_type,source,payload').eq('customer_user_id', identity.userId).eq('submission_idempotency_key', key).maybeSingle();
  if (existing.error) throw new Error('Request replay protection is unavailable.');
  if (existing.data) {
    const stored=existing.data.payload??{},sameTarget=existing.data.source===source&&existing.data.request_type===type&&(source!=='supplier_public_profile'||(stored.publicSupplierSlug===safePayload.publicSupplierSlug&&stored.requestedSupplierId===safePayload.requestedSupplierId));
    if(!sameTarget)return{ok:false,error:'This submission identity already belongs to a different request. Please start a new submission.'};
    const year = new Date(existing.data.created_at).getUTCFullYear();
    return { ok: true, id: existing.data.id, requestNumber: `PRE-${year}-${existing.data.id.slice(0, 8).toUpperCase()}`, selectedSupplierName:stored.selectedSupplierName??null, idempotentReplay: true };
  }

  const inserted = await db.from('public_sourcing_enquiries').insert({ request_session_id: null, customer_user_id: identity.userId, request_type: type, contact_email: identity.email, payload: safePayload, status: 'submitted', source, submission_idempotency_key: key }).select('id,created_at').single();
  if (inserted.error?.code === '23505') {
    const replay = await db.from('public_sourcing_enquiries').select('id,created_at,request_type,source,payload').eq('customer_user_id', identity.userId).eq('submission_idempotency_key', key).single();
    if (replay.error) throw new Error('Request could not be recovered.');
    const stored=replay.data.payload??{},sameTarget=replay.data.source===source&&replay.data.request_type===type&&(source!=='supplier_public_profile'||(stored.publicSupplierSlug===safePayload.publicSupplierSlug&&stored.requestedSupplierId===safePayload.requestedSupplierId));
    if(!sameTarget)return{ok:false,error:'This submission identity already belongs to a different request. Please start a new submission.'};
    const year = new Date(replay.data.created_at).getUTCFullYear();
    return { ok: true, id: replay.data.id, requestNumber: `PRE-${year}-${replay.data.id.slice(0, 8).toUpperCase()}`, selectedSupplierName:stored.selectedSupplierName??null, idempotentReplay: true };
  }
  if (inserted.error) throw new Error('Request could not be saved.');
  const year = new Date(inserted.data.created_at).getUTCFullYear();
  return { ok: true, id: inserted.data.id, requestNumber: `PRE-${year}-${inserted.data.id.slice(0, 8).toUpperCase()}`, selectedSupplierName:safePayload.selectedSupplierName??null, idempotentReplay: false };
}
