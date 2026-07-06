'use client';

import LogoutButton from '../../components/auth/LogoutButton';

export default function SupplierDashboardPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.3),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[960px] items-center">
        <section className="w-full rounded-2xl border border-white/10 bg-white/96 p-6 text-slate-950 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">Supplier area</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Supplier Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Welcome to your supplier account.</p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Account actions</h2>
            <p className="mt-1 text-sm text-slate-600">Use the logout button below to end this session.</p>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

