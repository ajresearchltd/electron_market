import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { createRequiredAdminClient } from '../../../../../lib/supabase/admin';

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const profile = await auth.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile.data?.role === 'supplier') return NextResponse.json({ error: 'Product Finder is available in Customer HUB.' }, { status: 403 });
  const database = createRequiredAdminClient();
  const { sessionId } = await params;
  const session = await database.from('product_search_sessions').select('id,title,state,created_at,updated_at').eq('id', sessionId).eq('owner_user_id', user.id).maybeSingle();
  if (!session.data) return NextResponse.json({ error: 'Conversation was not found.' }, { status: 404 });
  const events = await database.from('product_search_events').select('id,event_type,safe_payload,created_at').eq('session_id', sessionId).in('event_type', ['finder_user_message', 'finder_assistant_message']).order('created_at', { ascending: true }).limit(100);
  const messages = (events.data ?? []).map((event: any) => ({ id: String(event.id), role: event.event_type === 'finder_user_message' ? 'user' : 'assistant', text: event.event_type === 'finder_user_message' ? event.safe_payload?.message : event.safe_payload?.assistantMessage })).filter((row: any) => typeof row.text === 'string');
  const lastAssistant = [...(events.data ?? [])].reverse().find((event: any) => event.event_type === 'finder_assistant_message');
  return NextResponse.json({ session: session.data, messages, offers: lastAssistant?.safe_payload?.inventoryOffers ?? [] }, { headers: { 'cache-control': 'private, no-store' } });
}
