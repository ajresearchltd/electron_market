import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { ensurePasswordlessRequestAccount } from '../../../../../lib/public-request/provision';

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    return NextResponse.json(await ensurePasswordlessRequestAccount(user, new URL(request.url).origin), { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Passwordless account completion failed.', { userId: user.id, code: 'account_completion_failed' });
    return NextResponse.json({ error: 'Account setup could not be completed.', diagnosticCode: 'ACCOUNT_COMPLETION_FAILED' }, { status: 409, headers: { 'cache-control': 'private, no-store' } });
  }
}
