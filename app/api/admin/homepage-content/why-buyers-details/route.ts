import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../lib/auth/require-admin-api';
import { emptyWhyBuyersDetail, WHY_BUYERS_DETAIL_FIELDS, WHY_BUYERS_DETAIL_LIMITS, WHY_BUYERS_IMAGE_UPLOADS, type WhyBuyersImageInput } from '../../../../../lib/homepage/why-buyers-details';

const BUCKET = 'homepage-icons';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, code?: string, correlationId?: string) => NextResponse.json({ error, ...(code ? { code } : {}), ...(correlationId ? { correlationId } : {}) }, { status });
const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim() || null;
const safeName = (name: string) => name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'detail-image';

class UploadFailure extends Error {
  constructor(public code: string, public field: WhyBuyersImageInput, public status = 500) { super(code); }
}

const imageErrorMessage = (code: string, field: WhyBuyersImageInput) => {
  const label = WHY_BUYERS_IMAGE_UPLOADS[field].label;
  if (code === 'POPUP_IMAGE_EMPTY') return `${label} is empty. Please choose another file.`;
  if (code === 'POPUP_IMAGE_TYPE_UNSUPPORTED') return `${label} must be PNG, JPG or WebP.`;
  if (code === 'POPUP_IMAGE_TOO_LARGE') return `${label} is larger than the 2 MB limit.`;
  if (code === 'POPUP_IMAGE_PATH_SAVE_FAILED') return 'The image was uploaded, but its path could not be saved.';
  return `${label} could not be uploaded to Storage. Please try again.`;
};

const context = async (auth: Awaited<ReturnType<typeof requireAdminApi>>, homepageContentId: string, cardNumber: number) => {
  if ('error' in auth || !UUID.test(homepageContentId) || !Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 6) return null;
  const row = await auth.admin.from('homepage_content').select('homepage_content_id').eq('homepage_content_id', homepageContentId).maybeSingle();
  return row.data ? { homepageContentId, cardNumber } : null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.error, auth.status);
  const homepageContentId = request.nextUrl.searchParams.get('homepage_content_id')?.trim() ?? '';
  const cardNumber = Number(request.nextUrl.searchParams.get('card_number'));
  if (!await context(auth, homepageContentId, cardNumber)) return fail('Invalid Homepage Content card.', 422);
  const result = await auth.admin.from('homepage_why_buyers_card_details').select('*').eq('homepage_content_id', homepageContentId).eq('card_number', cardNumber).maybeSingle();
  if (result.error) return fail('Popup details could not be loaded.', 500);
  return NextResponse.json({ detail: result.data ?? emptyWhyBuyersDetail(homepageContentId, cardNumber) });
}

export async function PUT(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.error, auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : auth.status === 403 ? 'UNAUTHORIZED' : 'ADMIN_CLIENT_UNAVAILABLE', correlationId);
  const form = await request.formData().catch(() => null);
  if (!form) return fail('Invalid multipart popup-details request.', 400, 'INVALID_MULTIPART_REQUEST', correlationId);
  const homepageContentId = String(form.get('homepage_content_id') ?? '').trim();
  const cardNumber = Number(form.get('card_number'));
  if (!await context(auth, homepageContentId, cardNumber)) return fail('Invalid Homepage Content card.', 422, 'INVALID_POPUP_CARD', correlationId);

  const payload: Record<string, string | number | null> = { homepage_content_id: homepageContentId, card_number: cardNumber };
  for (const field of WHY_BUYERS_DETAIL_FIELDS) {
    payload[field] = clean(form.get(field));
    if (typeof payload[field] === 'string' && payload[field].length > WHY_BUYERS_DETAIL_LIMITS[field]) return fail(`${field.replaceAll('_', ' ')} is too long.`, 422, 'POPUP_FIELD_TOO_LONG', correlationId);
  }
  if (payload.button_url) {
    const url = String(payload.button_url); let valid = url.startsWith('/') && !url.startsWith('//');
    if (!valid) try { valid = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* handled below */ }
    if (!valid) return fail('Button URL must be an internal route or an HTTP/HTTPS URL.', 422, 'POPUP_BUTTON_URL_INVALID', correlationId);
  }

  const uploads = Object.keys(WHY_BUYERS_IMAGE_UPLOADS).map(field => ({ field: field as WhyBuyersImageInput, value: form.get(field) })).filter(item => item.value instanceof File) as { field: WhyBuyersImageInput; value: File }[];
  for (const { field, value } of uploads) {
    if (value.size === 0) return fail(imageErrorMessage('POPUP_IMAGE_EMPTY', field), 422, 'POPUP_IMAGE_EMPTY', correlationId);
    if (!IMAGE_TYPES.has(value.type)) return fail(imageErrorMessage('POPUP_IMAGE_TYPE_UNSUPPORTED', field), 422, 'POPUP_IMAGE_TYPE_UNSUPPORTED', correlationId);
    if (value.size > MAX_IMAGE_SIZE) return fail(imageErrorMessage('POPUP_IMAGE_TOO_LARGE', field), 422, 'POPUP_IMAGE_TOO_LARGE', correlationId);
  }

  const uploadedPaths: string[] = [];
  try {
    for (const { field, value } of uploads) {
      const config = WHY_BUYERS_IMAGE_UPLOADS[field];
      const extension = value.type === 'image/jpeg' ? 'jpg' : value.type.split('/')[1];
      const path = `why-buyers-choose/details/${homepageContentId}/card-${cardNumber}/${config.folder}/${crypto.randomUUID()}-${safeName(value.name)}.${extension}`;
      const bytes = new Uint8Array(await value.arrayBuffer());
      const saved = await auth.admin.storage.from(BUCKET).upload(path, bytes, { contentType: value.type, cacheControl: '3600', upsert: false });
      if (saved.error) {
        console.error('Why Buyers popup image operation failed.', { operation: 'upload', imageField: field, stage: 'storage', diagnosticCode: 'POPUP_STORAGE_UPLOAD_FAILED', correlationId, httpStatus: 502, storageCode: saved.error.name });
        throw new UploadFailure('POPUP_STORAGE_UPLOAD_FAILED', field, 502);
      }
      uploadedPaths.push(saved.data.path);
      payload[config.pathField] = auth.admin.storage.from(BUCKET).getPublicUrl(saved.data.path).data.publicUrl;
    }

    const result = await auth.admin.from('homepage_why_buyers_card_details').upsert(payload, { onConflict: 'homepage_content_id,card_number' }).select('*').single();
    if (result.error || !result.data) {
      const field = uploads[0]?.field ?? 'main_image';
      console.error('Why Buyers popup image operation failed.', { operation: 'save', imageField: field, stage: 'database', diagnosticCode: uploads.length ? 'POPUP_IMAGE_PATH_SAVE_FAILED' : 'POPUP_DETAIL_SAVE_FAILED', correlationId, httpStatus: 500, databaseCode: result.error?.code ?? 'no_row' });
      if (uploads.length) throw new UploadFailure('POPUP_IMAGE_PATH_SAVE_FAILED', field);
      return fail('Popup details could not be saved. Please try again.', 500, 'POPUP_DETAIL_SAVE_FAILED', correlationId);
    }
    return NextResponse.json({ detail: result.data, correlationId });
  } catch (error) {
    if (uploadedPaths.length) await auth.admin.storage.from(BUCKET).remove(uploadedPaths);
    if (error instanceof UploadFailure) return fail(imageErrorMessage(error.code, error.field), error.status, error.code, correlationId);
    console.error('Why Buyers popup image operation failed.', { operation: 'upload', stage: 'server', diagnosticCode: 'POPUP_STORAGE_UPLOAD_FAILED', correlationId, httpStatus: 500 });
    return fail('The image could not be uploaded to Storage. Please try again.', 500, 'POPUP_STORAGE_UPLOAD_FAILED', correlationId);
  }
}
