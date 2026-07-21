'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Config = {
  model: string;
  instructions: string;
  reasoningEffort: string;
  verbosity: 'low' | 'medium' | 'high';
  maxOutputTokens: number;
  webSearchEnabled: boolean;
  toolChoice: 'auto' | 'required';
  parallelToolCalls: boolean;
  storeResponses: boolean;
  temperature: null;
};

export default function FinderAiConfigPage() {
  const [configuration, setConfiguration] = useState<Config | null>(null);
  const [defaults, setDefaults] = useState<Config | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<any>({});
  const [requestShape, setRequestShape] = useState<any>(null);
  const [sdkVersion, setSdkVersion] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch('/api/admin/product-finder-ai-config', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) { setErrors([data.error]); return; }
    setConfiguration(data.configuration);
    setDefaults(data.defaults);
    setModels(data.approvedModels ?? []);
    setCapabilities(data.capabilities ?? {});
    setRequestShape(data.effectiveRequest);
    setSdkVersion(data.sdkVersion);
  };

  useEffect(() => { load(); }, []);

  const call = async (action: string, config = configuration) => {
    setBusy(true); setErrors([]); setMessage('');
    const response = await fetch('/api/admin/product-finder-ai-config', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, configuration: config }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setErrors(data.errors ?? [data.error]); return null; }
    return data;
  };

  const validate = async () => { if (await call('validate')) setMessage('Configuration is valid for the installed SDK and selected model.'); };
  const save = async () => { const data = await call('save'); if (data) { setConfiguration(data.configuration); setRequestShape(data.effectiveRequest); setMessage(data.message); } };
  const restore = () => { if (defaults) { setConfiguration(structuredClone(defaults)); setRequestShape(null); setMessage('Current defaults restored in the form. Select SAVE to activate them.'); } };
  const field = 'mt-1 block w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (!configuration) return <main className="p-8">Loading Finder AI configuration…{errors.map(error => <p key={error} className="text-red-700">{error}</p>)}</main>;
  const preview = requestShape ?? { model: configuration.model, instructions: configuration.instructions, reasoning: configuration.reasoningEffort ? { effort: configuration.reasoningEffort } : undefined, text: { verbosity: configuration.verbosity }, max_output_tokens: configuration.maxOutputTokens, store: configuration.storeResponses, ...(configuration.webSearchEnabled ? { tools: [{ type: 'web_search' }], tool_choice: configuration.toolChoice, parallel_tool_calls: configuration.parallelToolCalls } : { tools: [] }) };

  return <main className="min-h-screen overflow-x-hidden bg-slate-100">
    <header className="bg-[#071b3a] px-4 py-5 text-white sm:px-6"><div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs uppercase tracking-widest text-cyan-300">Admin only</p><h1 className="text-3xl font-bold">Finder AI conf</h1><p className="text-sm text-blue-100">OpenAI Responses API · SDK {sdkVersion}</p></div><Link href="/admin" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 font-semibold">Back to Admin</Link></div></header>
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5 px-4 py-5 sm:px-5">
      {message && <p role="status" className="mx-auto w-full max-w-3xl rounded-lg bg-emerald-100 p-3 text-emerald-900">{message}</p>}
      {errors.length > 0 && <ul role="alert" className="mx-auto w-full max-w-3xl rounded-lg bg-red-100 p-3 text-red-900">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <section className="mx-auto grid w-full max-w-3xl min-w-0 gap-5 overflow-hidden rounded-xl border bg-white p-4 shadow-sm sm:p-5" aria-labelledby="responses-api-settings-title">
        <div><h2 id="responses-api-settings-title" className="text-xl font-bold text-slate-950">OpenAI Responses API Settings</h2><p className="mt-1 text-sm text-slate-600">Saved settings used by AI Product Finder server requests.</p></div>
        <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Model</span><select className={field} value={configuration.model} onChange={event => setConfiguration({ ...configuration, model: event.target.value })}>{models.map(model => <option key={model}>{model}</option>)}</select></label>
        {capabilities.webSearch && <label className="flex min-w-0 items-start gap-3"><input className="mt-1" type="checkbox" checked={configuration.webSearchEnabled} onChange={event => setConfiguration({ ...configuration, webSearchEnabled: event.target.checked })}/><span><span className="block text-sm font-semibold text-slate-800">Allow Internet Access</span><span className="mt-1 block text-sm text-slate-600">Allow the AI model to search the Internet for current product pages, datasheets, prices and supplier links.</span></span></label>}
        {capabilities.reasoningEffort && <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Reasoning Effort</span><select className={field} value={configuration.reasoningEffort} onChange={event => setConfiguration({ ...configuration, reasoningEffort: event.target.value })}>{capabilities.reasoningEffort.map((value: string) => <option key={value} value={value}>{value || 'Model default'}</option>)}</select></label>}
        {capabilities.verbosity && <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Verbosity</span><select className={field} value={configuration.verbosity} onChange={event => setConfiguration({ ...configuration, verbosity: event.target.value as Config['verbosity'] })}>{capabilities.verbosity.map((value: string) => <option key={value}>{value}</option>)}</select></label>}
        <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Max Output Tokens</span><input className={field} type="number" min={100} max={900} value={configuration.maxOutputTokens} onChange={event => setConfiguration({ ...configuration, maxOutputTokens: Number(event.target.value) })}/></label>
        {capabilities.temperature && <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Temperature</span><input className={field} type="number" disabled value=""/></label>}
        {capabilities.toolChoice && <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">Tool Choice</span><select className={field} disabled value="auto"><option value="auto">auto</option></select><span className="mt-1 block text-xs text-slate-500">Product Finder lets the model select the next tool.</span></label>}
        {capabilities.parallelToolCalls && <label className="flex min-w-0 items-center gap-3"><input type="checkbox" disabled checked={false}/><span className="text-sm font-semibold text-slate-800">Parallel Tool Calls <span className="font-normal text-slate-500">(disabled for deterministic tool-result handling)</span></span></label>}
        {capabilities.storeResponses && <label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={configuration.storeResponses} onChange={event => setConfiguration({ ...configuration, storeResponses: event.target.checked })}/><span className="text-sm font-semibold text-slate-800">Store Responses</span></label>}
        <label className="min-w-0"><span className="text-sm font-semibold text-slate-800">System Prompt</span><textarea className={`${field} resize-y`} rows={18} value={configuration.instructions} onChange={event => setConfiguration({ ...configuration, instructions: event.target.value })}/></label>
      </section>
      <section className="mx-auto w-full max-w-3xl min-w-0 overflow-hidden rounded-xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="font-bold text-slate-950">Effective API request shape</h2><p className="mt-1 text-xs text-slate-500">Runtime conversation, input, user, session and private identifiers are omitted.</p><pre className="mt-3 max-h-96 max-w-full overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(preview, null, 2)}</pre></section>
      <div className="sticky bottom-0 mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2 rounded-xl border bg-white p-4 shadow sm:justify-end"><button disabled={busy} onClick={restore} className="admin-primary-button">Restore current defaults</button><button disabled={busy} onClick={validate} className="admin-primary-button">Validate</button><button disabled={busy} onClick={save} className="admin-primary-button min-w-28">SAVE</button></div>
    </div>
  </main>;
}
