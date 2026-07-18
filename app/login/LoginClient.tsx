'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { getCurrentUserRole } from '../../lib/auth/getCurrentUserRole';
import { getDashboardPathByRole } from '../../lib/auth/redirectByRole';
import HubButton from '../components/ui/HubButton';
import { EMAIL_OTP_LENGTH } from '../../lib/public-request/policy';

export default function LoginClient({ initialError = '' }: { initialError?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initialError);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  useEffect(()=>{if(!cooldown)return;const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearInterval(timer)},[cooldown]);

  useEffect(() => {
    let active = true;
    const redirectIfLoggedIn = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      const role = await getCurrentUserRole(supabase, data.user.id, data.user.user_metadata?.role as string | undefined);
      if (!role) {
        return setError('Account role is missing. Please contact support.');
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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const role = await getCurrentUserRole(
      supabase,
      data.user?.id ?? null,
      data.user?.user_metadata?.role as string | undefined
    );

    if (!role) {
      setError('Account role is missing. Please contact support.');
      setLoading(false);
      return;
    }

    router.replace(getDashboardPathByRole(role));
  };

  const sendCode = async () => {
    setLoading(true); setError(''); setMessage(''); setCodeSent(false);
    const normalized = email.trim().toLowerCase();
    const response=await fetch('/api/public/request-access/send-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:normalized,authIntent:'hub_login'})}),data=await response.json().catch(()=>({}));setLoading(false);
    if(!response.ok){setError(data.error||'We could not send the verification code. Please try again.');return}
    setEmail(normalized);setChallengeId(data.challengeId||'');setCode('');setCodeSent(true);setCooldown(data.cooldownSeconds||60);setMessage('If this email can be used to sign in, an eight-digit verification code has been sent.');
    requestAnimationFrame(()=>codeRefs.current[0]?.focus());
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError('');
    const response=await fetch('/api/public/request-access/verify-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,code,challengeId,authIntent:'hub_login'})}),data=await response.json().catch(()=>({}));
    if(!response.ok){setLoading(false);setError(data.error||'The verification code is invalid or has expired.');return}
    setLoading(false);router.replace(data.hubHref||getDashboardPathByRole(data.primaryRole));router.refresh();
  };

  const resetPassword = async () => {
    setLoading(true); setError('');
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/customer/dashboard?create-password=1` });
    setLoading(false); setMessage('If the email is registered, password recovery instructions have been sent. You may also sign in with an email code.');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.3),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <Link href="/" className="absolute left-4 top-4 inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 sm:left-6 lg:left-8">
        &larr; Back
      </Link>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[560px] items-center">
        <section className="w-full rounded-2xl border border-white/10 bg-white/96 p-6 text-slate-950 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Temporary auth page. Supabase Auth is active.</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Sign In</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{mode==='password'?'Use your email and password, or choose secure email-code access.':'Request and enter an eight-digit code to access your existing account.'}</p>

          <form onSubmit={mode==='password'?handleSubmit:verifyCode} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>{mode==='code'&&codeSent&&<fieldset><legend className="text-sm font-semibold text-slate-700">Eight-digit verification code</legend><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8" role="group" aria-label="Enter the eight-digit verification code">{Array.from({length:EMAIL_OTP_LENGTH},(_,index)=><input key={index} ref={node=>{codeRefs.current[index]=node}} value={code[index]||''} inputMode="numeric" autoComplete={index===0?'one-time-code':'off'} pattern="[0-9]*" maxLength={1} aria-label={`Verification code digit ${index+1} of ${EMAIL_OTP_LENGTH}`} aria-invalid={Boolean(error)} onChange={event=>{const digit=event.target.value.replace(/\D/g,'').slice(-1),next=code.split('');next[index]=digit;setCode(Array.from({length:EMAIL_OTP_LENGTH},(_,i)=>next[i]||'').join('').replace(/\s+$/,''));if(digit&&index<EMAIL_OTP_LENGTH-1)codeRefs.current[index+1]?.focus()}} onPaste={event=>{event.preventDefault();const pasted=event.clipboardData.getData('text').replace(/\D/g,'').slice(0,EMAIL_OTP_LENGTH);setCode(pasted);codeRefs.current[Math.min(EMAIL_OTP_LENGTH-1,Math.max(0,pasted.length-1))]?.focus()}} onKeyDown={event=>{if(event.key==='Backspace'&&!code[index]&&index>0)codeRefs.current[index-1]?.focus();if(event.key==='ArrowLeft'&&index>0)codeRefs.current[index-1]?.focus();if(event.key==='ArrowRight'&&index<EMAIL_OTP_LENGTH-1)codeRefs.current[index+1]?.focus()}} required className="h-12 min-w-0 rounded-lg border border-slate-300 text-center text-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>)}</div></fieldset>}

            {mode==='password'&&<label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>}

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

            {mode==='password'?<HubButton type="submit" loading={loading} loadingText="Signing in..." fullWidth>Sign In</HubButton>:<>{!codeSent?<HubButton type="button" onClick={sendCode} loading={loading} loadingText="Sending..." fullWidth>Email me a sign-in code</HubButton>:<><HubButton type="submit" disabled={code.length!==EMAIL_OTP_LENGTH} loading={loading} loadingText="Verifying..." fullWidth>Verify code and sign in</HubButton><button type="button" onClick={sendCode} disabled={cooldown>0||loading} className="w-full text-sm font-semibold text-blue-700 disabled:text-slate-400">{cooldown?`Resend in ${cooldown}s`:'Resend code'}</button></>}</>}
          </form>

          <div className="mt-4 grid gap-2 text-center text-sm"><button type="button" onClick={()=>{setMode(value=>value==='password'?'code':'password');setError('');setMessage('')}} className="font-semibold text-blue-700">{mode==='password'?'Sign in with a code sent to your email':'Sign in with email and password'}</button>{mode==='password'&&<button type="button" onClick={resetPassword} disabled={!email.trim()||loading} className="font-semibold text-blue-700 disabled:text-slate-400">Forgot password?</button>}{mode==='code'&&<p className="rounded-lg bg-blue-50 p-3 text-left text-xs leading-5 text-blue-900">Accounts created using secure email access can sign in here without a password. After signing in, you may create a password from Customer HUB.</p>}</div>

          <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/register/customer" className="font-semibold text-blue-700 hover:text-blue-800">
              Customer registration
            </Link>
            <Link href="/register/supplier" className="font-semibold text-blue-700 hover:text-blue-800">
              Supplier registration
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
