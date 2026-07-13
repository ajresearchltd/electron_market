'use client';

import Link from 'next/link';
import HubButton from '../../components/ui/HubButton';
import { FormEvent, useEffect, useState } from 'react';

type ConfigState = {
  is_enabled: boolean;
  api_endpoint: string;
  api_key: string;
  api_key_is_configured: boolean;
  api_key_last4: string | null;
  env_key_configured: boolean;
  default_model: string;
  default_system_prompt: string;
  procurement_system_prompt: string;
  max_input_characters: number;
  max_output_tokens: string;
  temperature: string;
  top_p: string;
  reasoning_effort: string;
  response_format_json_text: string;
  allow_guest_chat: boolean;
  allow_file_uploads: boolean;
  allow_bom_analysis: boolean;
  daily_message_limit_per_user: number;
  monthly_token_limit_per_user: string;
  monthly_budget_usd: string;
};

const initialConfig: ConfigState = {
  is_enabled: true,
  api_endpoint: 'https://api.openai.com/v1/responses',
  api_key: '',
  api_key_is_configured: false,
  api_key_last4: null,
  env_key_configured: false,
  default_model: 'gpt-5.5',
  default_system_prompt: '',
  procurement_system_prompt: '',
  max_input_characters: 12000,
  max_output_tokens: '',
  temperature: '',
  top_p: '',
  reasoning_effort: '',
  response_format_json_text: '',
  allow_guest_chat: true,
  allow_file_uploads: false,
  allow_bom_analysis: false,
  daily_message_limit_per_user: 50,
  monthly_token_limit_per_user: '',
  monthly_budget_usd: '',
};

export default function AdminAiConfigPage() {
  const [config, setConfig] = useState<ConfigState>(initialConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      const response = await fetch('/api/admin/ai-config');
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to load AI config.');
        setLoading(false);
        return;
      }
      const row = payload.config;
      setConfig({
        ...initialConfig,
        ...row,
        api_key: '',
        default_system_prompt: row.default_system_prompt || '',
        procurement_system_prompt: row.procurement_system_prompt || '',
        max_output_tokens: row.max_output_tokens ?? '',
        temperature: row.temperature ?? '',
        top_p: row.top_p ?? '',
        reasoning_effort: row.reasoning_effort || '',
        response_format_json_text: row.response_format_json ? JSON.stringify(row.response_format_json, null, 2) : '',
        monthly_token_limit_per_user: row.monthly_token_limit_per_user ?? '',
        monthly_budget_usd: row.monthly_budget_usd ?? '',
      });
      setLoading(false);
    };
    loadConfig();
  }, []);

  const update = (field: keyof ConfigState, value: string | boolean | number) => setConfig((current) => ({ ...current, [field]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    let responseFormat = null;
    if (config.response_format_json_text.trim()) {
      try {
        responseFormat = JSON.parse(config.response_format_json_text);
      } catch {
        setError('Response format JSON is invalid.');
        setSaving(false);
        return;
      }
    }

    const response = await fetch('/api/admin/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, response_format_json: responseFormat }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to save AI config.');
      setSaving(false);
      return;
    }
    setConfig((current) => ({ ...current, ...payload.config, api_key: '', response_format_json_text: current.response_format_json_text }));
    setMessage('AI config saved.');
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/admin/ai-config/test', { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'OpenAI test failed.');
    } else {
      setMessage(`OpenAI test passed. Response ${payload.response_id}: ${payload.text}`);
    }
    setTesting(false);
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const labelClass = 'text-sm font-semibold text-slate-700';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-950">
      <header className="bg-[#071b3a] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Admin</p>
            <h1 className="mt-1 text-3xl font-bold">AI config</h1>
            <p className="mt-2 text-sm text-blue-100">Configure OpenAI access, model parameters, prompts, and chat feature limits.</p>
          </div>
          <Link href="/admin" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150">Back to Admin</Link>
        </div>
      </header>

      <form onSubmit={save} className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading AI config...</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-900">API access</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label><span className={labelClass}>API endpoint</span><input className={inputClass} value={config.api_endpoint} onChange={(event) => update('api_endpoint', event.target.value)} /></label>
            <label><span className={labelClass}>API key</span><input type="password" className={inputClass} value={config.api_key} onChange={(event) => update('api_key', event.target.value)} placeholder="Leave blank to keep saved key" /></label>
            <div className="rounded-lg bg-white p-3 text-sm text-slate-700">Saved key: {config.api_key_is_configured ? `Configured${config.api_key_last4 ? ` ending ${config.api_key_last4}` : ''}` : 'Missing'}</div>
            <div className="rounded-lg bg-white p-3 text-sm text-slate-700">Env API key: {config.env_key_configured ? 'Configured' : 'Missing'}</div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-900">Model and prompts</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label><span className={labelClass}>Model</span><input className={inputClass} value={config.default_model} onChange={(event) => update('default_model', event.target.value)} /></label>
            <label><span className={labelClass}>Reasoning effort</span><input className={inputClass} value={config.reasoning_effort} onChange={(event) => update('reasoning_effort', event.target.value)} placeholder="low, medium, high" /></label>
            <label className="md:col-span-2"><span className={labelClass}>Default system prompt</span><textarea rows={4} className={inputClass} value={config.default_system_prompt} onChange={(event) => update('default_system_prompt', event.target.value)} /></label>
            <label className="md:col-span-2"><span className={labelClass}>Procurement system prompt</span><textarea rows={5} className={inputClass} value={config.procurement_system_prompt} onChange={(event) => update('procurement_system_prompt', event.target.value)} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-900">Parameters and limits</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label><span className={labelClass}>Max input characters</span><input type="number" className={inputClass} value={config.max_input_characters} onChange={(event) => update('max_input_characters', Number(event.target.value))} /></label>
            <label><span className={labelClass}>Max output tokens</span><input type="number" className={inputClass} value={config.max_output_tokens} onChange={(event) => update('max_output_tokens', event.target.value)} /></label>
            <label><span className={labelClass}>Temperature</span><input type="number" step="0.1" className={inputClass} value={config.temperature} onChange={(event) => update('temperature', event.target.value)} /></label>
            <label><span className={labelClass}>Top P</span><input type="number" step="0.1" className={inputClass} value={config.top_p} onChange={(event) => update('top_p', event.target.value)} /></label>
            <label><span className={labelClass}>Daily message limit</span><input type="number" className={inputClass} value={config.daily_message_limit_per_user} onChange={(event) => update('daily_message_limit_per_user', Number(event.target.value))} /></label>
            <label><span className={labelClass}>Monthly token limit</span><input type="number" className={inputClass} value={config.monthly_token_limit_per_user} onChange={(event) => update('monthly_token_limit_per_user', event.target.value)} /></label>
            <label><span className={labelClass}>Monthly budget USD</span><input type="number" step="0.01" className={inputClass} value={config.monthly_budget_usd} onChange={(event) => update('monthly_budget_usd', event.target.value)} /></label>
            <label className="md:col-span-3"><span className={labelClass}>Response format JSON</span><textarea rows={4} className={inputClass} value={config.response_format_json_text} onChange={(event) => update('response_format_json_text', event.target.value)} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-900">Feature flags</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ['is_enabled', 'Enable AI chat'],
              ['allow_guest_chat', 'Allow guest chat'],
              ['allow_file_uploads', 'Allow file uploads'],
              ['allow_bom_analysis', 'Allow BOM analysis'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={Boolean(config[field as keyof ConfigState])} onChange={(event) => update(field as keyof ConfigState, event.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <HubButton onClick={testConnection} loading={testing} loadingText="Testing...">Test OpenAI connection</HubButton>
          <HubButton type="submit" loading={saving} loadingText="Saving...">Save</HubButton>
        </div>
      </form>
    </main>
  );
}
