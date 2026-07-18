import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createRequiredAdminClient } from '../../../lib/supabase/admin';

export default async function CustomerRequestsPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');
  const role = await session.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (role.data?.role !== 'customer') redirect('/');
  const rows = await createRequiredAdminClient().from('public_sourcing_enquiries').select('id,request_type,payload,status,created_at').eq('customer_user_id', user.id).order('created_at', { ascending: false });
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-5xl"><header className="rounded-2xl bg-blue-950 p-5 text-white"><p className="text-xs font-bold uppercase text-cyan-300">Customer HUB</p><h1 className="mt-1 text-3xl font-bold">Preliminary Orders</h1><a href="/customer/dashboard" className="mt-4 inline-flex rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">Back to Customer HUB</a></header><div className="mt-6 space-y-3">{(rows.data??[]).map((row:any)=><details key={row.id} className="rounded-xl border bg-white p-4 shadow-sm"><summary className="cursor-pointer list-none"><div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]"><strong>{`PRE-${new Date(row.created_at).getUTCFullYear()}-${row.id.slice(0,8).toUpperCase()}`}</strong><span>{row.request_type}</span><span>{new Date(row.created_at).toLocaleString()}</span><span className="font-semibold text-blue-700">{row.status} · View</span></div></summary><pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(row.payload??{},null,2)}</pre></details>)}{!rows.data?.length&&<p className="rounded-xl bg-white p-8 text-center text-slate-500">No preliminary orders have been submitted.</p>}</div></div></main>;
}
