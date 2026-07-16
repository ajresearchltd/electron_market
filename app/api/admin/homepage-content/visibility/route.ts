import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../lib/auth/require-admin-api';
import { HOMEPAGE_SECTION_KEYS, isHomepageSectionKey } from '../../../../../lib/homepage/sections';

const errorJson = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return errorJson(auth.error, auth.status);

  const { data, error } = await auth.admin
    .from('homepage_section_settings')
    .select('section_key, is_enabled')
    .in('section_key', HOMEPAGE_SECTION_KEYS);

  if (error) return errorJson(error.message, 500);

  const settings = Object.fromEntries(HOMEPAGE_SECTION_KEYS.map((key) => [key, true]));
  for (const row of data ?? []) {
    if (isHomepageSectionKey(row.section_key) && typeof row.is_enabled === 'boolean') {
      settings[row.section_key] = row.is_enabled;
    }
  }

  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return errorJson(auth.error, auth.status);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return errorJson('A JSON request body is required.', 400);
  if (!isHomepageSectionKey(body.sectionKey)) return errorJson('Unknown homepage section.', 404);
  if (typeof body.isEnabled !== 'boolean') return errorJson('isEnabled must be a boolean.', 400);

  const { data, error } = await auth.admin
    .from('homepage_section_settings')
    .update({ is_enabled: body.isEnabled, updated_at: new Date().toISOString() })
    .eq('section_key', body.sectionKey)
    .select('section_key, is_enabled')
    .maybeSingle();

  if (error) return errorJson(error.message, 500);
  if (!data) return errorJson('Homepage section setting was not found.', 404);

  revalidatePath('/');
  return NextResponse.json({ sectionKey: data.section_key, isEnabled: data.is_enabled });
}
