import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { getCurrentUserRole } from '../../lib/auth/getCurrentUserRole';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (await getCurrentUserRole(supabase, user.id, user.user_metadata?.role) !== 'admin') redirect('/');
  return (
    <div className="hub-scope min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {children}
    </div>
  );
}
