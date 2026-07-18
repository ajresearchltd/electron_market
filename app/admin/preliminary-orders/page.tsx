import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createRequiredAdminClient } from '../../../lib/supabase/admin';

const requestNumber = (row: { id: string; created_at: string }) => `PRE-${new Date(row.created_at).getUTCFullYear()}-${row.id.slice(0, 8).toUpperCase()}`;
const show = (value: unknown) => value == null || value === '' ? '—' : String(value);

export default async function PreliminaryOrdersPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect('/login');
  const role = await session.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (role.data?.role !== 'admin') redirect('/');
  const database = createRequiredAdminClient();
  const enquiries = await database.from('public_sourcing_enquiries').select('*').not('customer_user_id', 'is', null).order('created_at', { ascending: false }).limit(250);
  const userIds = [...new Set((enquiries.data ?? []).map(row => row.customer_user_id).filter(Boolean))];
  const [users, companies] = await Promise.all([
    userIds.length ? database.from('user_profiles').select('id,full_name,company_name,email').in('id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? database.from('customer_company_profiles').select('user_id,company_name').in('user_id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const userMap = new Map((users.data ?? []).map((row: any) => [row.id, row]));
  const companyMap = new Map((companies.data ?? []).map((row: any) => [row.user_id, row]));
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-7xl"><header className="rounded-2xl bg-blue-950 p-5 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Admin HUB</p><h1 className="mt-1 text-3xl font-bold">Preliminary Orders</h1><a href="/admin" className="mt-4 inline-flex rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">Back to Admin HUB</a></header><section className="mt-6 overflow-x-auto rounded-2xl bg-white shadow"><table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr>{['VIEW','REQUEST NO','RECEIVED','CUSTOMER','COMPANY','EMAIL','REQUEST TYPE','SUMMARY','ESTIMATED VALUE','COUNTRY','STATUS'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{(enquiries.data??[]).map((row:any)=>{const profile:any=userMap.get(row.customer_user_id),company:any=companyMap.get(row.customer_user_id),payload=row.payload??{};return <tr key={row.id} className="border-t align-top"><td className="px-3 py-3"><details><summary className="cursor-pointer font-bold text-blue-700">View</summary><pre className="mt-3 max-w-xl whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(payload,null,2)}</pre></details></td><td className="px-3 py-3 font-mono text-xs">{requestNumber(row)}</td><td className="px-3 py-3">{new Date(row.created_at).toLocaleString()}</td><td className="px-3 py-3">{show(profile?.full_name)}</td><td className="px-3 py-3">{show(company?.company_name||profile?.company_name)}</td><td className="px-3 py-3">{show(row.contact_email)}</td><td className="px-3 py-3">{show(row.request_type)}</td><td className="max-w-56 px-3 py-3">{show(payload.description||payload.productName||payload.title||payload.partNumber)}</td><td className="px-3 py-3">{show(payload.estimatedBudget)}</td><td className="px-3 py-3">{show(payload.country)}</td><td className="px-3 py-3">{show(row.status)}</td></tr>})}</tbody></table>{!enquiries.data?.length&&<p className="p-8 text-center text-slate-500">No preliminary orders have been submitted.</p>}</section></div></main>;
}
