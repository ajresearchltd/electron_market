import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../lib/auth/require-internal-api';
import {
  normalizeIndustryProductSummary,
  validateIndustryProductSummary,
} from '../../../../../lib/industry-solutions/product-summary';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ solutionId: string }> },
) {
  const auth = await requireInternalApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin authorization is required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const summaryError = validateIndustryProductSummary(body.product_summary);
  if (summaryError) return NextResponse.json({ error: summaryError }, { status: 422 });

  const saved = await auth.admin
    .from('industry_solution')
    .update({
      title: String(body.title ?? '').trim() || null,
      text: String(body.text ?? '').trim() || null,
      pic: String(body.pic ?? '').trim() || null,
      product_summary: normalizeIndustryProductSummary(body.product_summary),
    })
    .eq('ind_id', (await params).solutionId)
    .select('ind_id')
    .maybeSingle();

  if (saved.error) {
    console.error('Industry Solution update failed.', { code: saved.error.code });
    return NextResponse.json({ error: 'Industry Solution could not be saved.' }, { status: 409 });
  }
  if (!saved.data) {
    return NextResponse.json({ error: 'Industry Solution was not found.' }, { status: 404 });
  }

  return NextResponse.json({ id: saved.data.ind_id });
}
