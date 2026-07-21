import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../lib/auth/require-admin-api';

const BUCKET = 'homepage-icons';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const IMAGE_FIELD = /pic|logo|image/i;
const WHY_BUYERS_PHOTO_FIELD = /^section_5_pic_([1-6])$/;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const safeName = (name: string) => name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'homepage-image';

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.error, auth.status);
  const result = await auth.admin.from('homepage_why_buyers_card_settings').select('card_index, is_enabled').order('card_index');
  if (result.error) return fail('Why Buyers card visibility could not be loaded.', 500);
  const visibility = Array.from({ length: 6 }, (_, index) => result.data?.find((row) => row.card_index === index + 1)?.is_enabled ?? true);
  return NextResponse.json({ visibility });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return fail(auth.error, auth.status);

  const form = await request.formData().catch(() => null);
  if (!form) return fail('Invalid save request.', 400);
  const rowId = String(form.get('homepageContentId') || '').trim();
  const rawPayload = String(form.get('payload') || '');
  const rawWhyBuyersVisibility = String(form.get('whyBuyersVisibility') || '');
  if (!rowId || !rawPayload || !rawWhyBuyersVisibility) return fail('Homepage content row, payload, and card visibility are required.', 400);

  let payload: Record<string, string | null>;
  try { payload = JSON.parse(rawPayload); } catch { return fail('Invalid homepage content payload.', 400); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Invalid homepage content payload.', 400);
  let whyBuyersVisibility: boolean[];
  try { whyBuyersVisibility = JSON.parse(rawWhyBuyersVisibility); } catch { return fail('Invalid Why Buyers card visibility.', 400); }
  if (!Array.isArray(whyBuyersVisibility) || whyBuyersVisibility.length !== 6 || whyBuyersVisibility.some((value) => typeof value !== 'boolean')) return fail('Invalid Why Buyers card visibility.', 400);

  const uploadedPaths: string[] = [];
  let previousVisibilityRows: { card_index: number; is_enabled: boolean }[] = [];
  let visibilityWasSaved = false;
  try {
    const imageFiles = [...form.entries()].filter(([entryKey, value]) => entryKey.startsWith('file:') && value instanceof File) as [string, File][];
    for (const [entryKey, value] of imageFiles) {
      const fieldKey = entryKey.slice(5);
      if (!Object.hasOwn(payload, fieldKey) || !IMAGE_FIELD.test(fieldKey)) return fail('Invalid homepage image field.', 400);
      if (value.size === 0) return fail('The image could not be uploaded. Please select a non-empty file.', 400);
      if (!ALLOWED_TYPES.has(value.type)) return fail('The image could not be uploaded. Use PNG, JPEG, WebP, or SVG.', 400);
      if (WHY_BUYERS_PHOTO_FIELD.test(fieldKey) && value.type === 'image/svg+xml') return fail('The photograph could not be uploaded. Use PNG, JPEG, or WebP.', 400);
      if (value.size > MAX_FILE_SIZE) return fail('The image could not be uploaded. Images must be 2 MB or smaller.', 400);
    }
    for (const [entryKey, value] of imageFiles) {
      const fieldKey = entryKey.slice(5);
      const extension = value.type === 'image/jpeg' ? 'jpg' : value.type.split('/')[1].replace('svg+xml', 'svg');
      const whyBuyersCard = fieldKey.match(WHY_BUYERS_PHOTO_FIELD)?.[1];
      const folder = whyBuyersCard ? `why-buyers-choose/card-${whyBuyersCard}` : `homepage-content/${fieldKey}`;
      const path = `${folder}/${crypto.randomUUID()}-${safeName(value.name)}.${extension}`;
      const uploaded = await auth.admin.storage.from(BUCKET).upload(path, value, { cacheControl: '3600', contentType: value.type, upsert: false });
      if (uploaded.error) {
        console.error('Homepage image upload failed.', { fieldKey, code: uploaded.error.name });
        throw new Error('upload_failed');
      }
      uploadedPaths.push(uploaded.data.path);
      payload[fieldKey] = auth.admin.storage.from(BUCKET).getPublicUrl(uploaded.data.path).data.publicUrl;
    }

    const previousVisibility = await auth.admin.from('homepage_why_buyers_card_settings').select('card_index, is_enabled').order('card_index');
    if (previousVisibility.error) throw new Error('visibility_save_failed');
    previousVisibilityRows = previousVisibility.data ?? [];
    const visibilityRows = whyBuyersVisibility.map((is_enabled, index) => ({ card_index: index + 1, is_enabled, updated_at: new Date().toISOString() }));
    const visibilitySaved = await auth.admin.from('homepage_why_buyers_card_settings').upsert(visibilityRows, { onConflict: 'card_index' });
    if (visibilitySaved.error) {
      console.error('Why Buyers card visibility save failed.', { code: visibilitySaved.error.code });
      throw new Error('visibility_save_failed');
    }
    visibilityWasSaved = true;

    const saved = await auth.admin.from('homepage_content').update(payload).eq('homepage_content_id', rowId).select('*').single();
    if (saved.error || !saved.data) {
      console.error('Homepage content save failed.', { code: saved.error?.code || 'no_row' });
      throw new Error('save_failed');
    }
    return NextResponse.json({ row: saved.data, whyBuyersVisibility });
  } catch (error) {
    if (visibilityWasSaved && previousVisibilityRows.length) await auth.admin.from('homepage_why_buyers_card_settings').upsert(previousVisibilityRows.map((row) => ({ ...row, updated_at: new Date().toISOString() })), { onConflict: 'card_index' });
    if (uploadedPaths.length) await auth.admin.storage.from(BUCKET).remove(uploadedPaths);
    return fail(error instanceof Error && error.message === 'upload_failed' ? 'The image could not be uploaded. Please check the file and try again.' : error instanceof Error && error.message === 'visibility_save_failed' ? 'Why Buyers card visibility could not be saved. Please try again.' : 'Homepage content could not be saved. Please try again.', 500);
  }
}
