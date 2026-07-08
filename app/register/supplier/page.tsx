'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { getCurrentUserRole } from '../../../lib/auth/getCurrentUserRole';
import { getDashboardPathByRole } from '../../../lib/auth/redirectByRole';

type CountryRow = {
  country_id: number;
  iso2: string;
  iso3: string | null;
  name: string;
};

type SupplierFormData = {
  fullName: string;
  companyName: string;
  businessRegistrationNumber: string;
  supplyCountryIso2: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const emptyFormData: SupplierFormData = {
  fullName: '',
  companyName: '',
  businessRegistrationNumber: '',
  supplyCountryIso2: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const nullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export default function SupplierRegisterPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [formData, setFormData] = useState<SupplierFormData>(emptyFormData);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedCountry = useMemo(
    () => countries.find((country) => country.iso2 === formData.supplyCountryIso2) ?? null,
    [countries, formData.supplyCountryIso2]
  );

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

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      setCountriesLoading(true);
      setCountriesError('');

      const { data, error: queryError } = await supabase
        .from('countries')
        .select('country_id, iso2, iso3, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!active) return;

      if (queryError) {
        setCountries([]);
        setCountriesError(queryError.message);
      } else {
        setCountries((data ?? []) as CountryRow[]);
      }

      setCountriesLoading(false);
    };

    loadCountries();

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateField = (field: keyof SupplierFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!termsAccepted) {
      setError('You must agree with the registration terms.');
      setLoading(false);
      return;
    }

    if (!formData.fullName.trim()) {
      setError('Contact person / full name is required.');
      setLoading(false);
      return;
    }

    if (!formData.companyName.trim()) {
      setError('Company name is required.');
      setLoading(false);
      return;
    }

    if (!formData.businessRegistrationNumber.trim()) {
      setError('Business registration number is required.');
      setLoading(false);
      return;
    }

    if (!formData.supplyCountryIso2.trim()) {
      setError('Country of product supply / country of origin is required.');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (!formData.confirmPassword) {
      setError('Confirm password is required.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: {
          role: 'supplier',
          full_name: formData.fullName.trim(),
          company_name: formData.companyName.trim(),
          business_registration_number: formData.businessRegistrationNumber.trim(),
          supply_country_iso2: formData.supplyCountryIso2,
          supply_country_name: selectedCountry?.name ?? '',
          terms_accepted: true,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session && data.user) {
      const { error: profileError } = await supabase.from('supplier_company_profiles').upsert(
        {
          user_id: data.user.id,
          company_name: formData.companyName.trim(),
          business_registration_number: formData.businessRegistrationNumber.trim(),
          country_iso2: formData.supplyCountryIso2,
          country_name: selectedCountry?.name ?? null,
          company_email: nullableText(formData.email),
          main_contact_name: formData.fullName.trim(),
          main_contact_email: nullableText(formData.email),
          verification_status: 'pending',
        },
        { onConflict: 'user_id' }
      );

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

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
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[720px] items-center">
        <section className="w-full rounded-2xl border border-white/10 bg-white/96 p-6 text-slate-950 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Temporary auth page. Supabase Auth is active.</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Create Supplier Account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Create a supplier account and we’ll send you to the correct dashboard after sign-up.</p>

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            <p className="font-semibold text-emerald-900">Supplier registration terms</p>
            <p className="mt-2">
              Electron Market is a B2B marketplace service for wholesale supply of electronic components and related products. Supplier registration is intended for businesses that can provide accurate company information and reliably supply the products listed on the platform.
            </p>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-emerald-900">I agree with the registration terms</span>
            </label>
          </div>

          {termsAccepted ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Contact person / full name</span>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Company name</span>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(event) => updateField('companyName', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Business registration number</span>
                <input
                  type="text"
                  value={formData.businessRegistrationNumber}
                  onChange={(event) => updateField('businessRegistrationNumber', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Country of product supply / country of origin</span>
                <select
                  value={formData.supplyCountryIso2}
                  onChange={(event) => updateField('supplyCountryIso2', event.target.value)}
                  disabled={countriesLoading || countries.length === 0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">{countriesLoading ? 'Loading countries...' : 'Select country'}</option>
                  {countries.map((country) => (
                    <option key={country.country_id} value={country.iso2}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {selectedCountry && <p className="mt-1 text-xs text-slate-500">Selected: {selectedCountry.name} ({selectedCountry.iso2})</p>}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Password</span>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Confirm password</span>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {countriesError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{countriesError}</div>}
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

              <button
                type="submit"
                disabled={loading || countriesLoading || countries.length === 0}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creating account...' : 'Create Supplier Account'}
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Complete the terms checkbox to continue to the supplier registration form.
            </div>
          )}

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



