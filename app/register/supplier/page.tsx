'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { getCurrentUserRole } from '../../../lib/auth/getCurrentUserRole';
import { getDashboardPathByRole } from '../../../lib/auth/redirectByRole';

export default function SupplierRegisterPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const redirectIfLoggedIn = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      const role = await getCurrentUserRole(supabase, data.user.id, data.user.user_metadata?.role as string | undefined);
      if (!role) {
        setError('Account role is missing. Please contact support.');
        return;
      }

      router.replace(getDashboardPathByRole(role));
    };

    redirectIfLoggedIn();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!fullName.trim()) {
      setError('Contact person / full name is required.');
      setLoading(false);
      return;
    }

    if (!companyName.trim()) {
      setError('Company name is required.');
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError('Email is required.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role: 'supplier',
          full_name: fullName.trim(),
          company_name: companyName.trim(),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session && data.user) {
      const role = await getCurrentUserRole(supabase, data.user.id, data.user.user_metadata?.role as string | undefined);
      if (!role) {
        setError('Account role is missing. Please contact support.');
        setLoading(false);
        return;
      }

      router.replace(getDashboardPathByRole(role));
      return;
    }

    setMessage('Please check your email to confirm your account. After confirmation, log in to continue.');
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.3),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[560px] items-center">
        <section className="w-full rounded-2xl border border-white/10 bg-white/96 p-6 text-slate-950 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Temporary auth page. Supabase Auth is active.</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Create Supplier Account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Create a supplier account and we’ll send you to the correct dashboard after sign-up.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Contact person / full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create Supplier Account'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
              Already have an account?
            </Link>
            <Link href="/register/customer" className="font-semibold text-blue-700 hover:text-blue-800">
              Customer account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

