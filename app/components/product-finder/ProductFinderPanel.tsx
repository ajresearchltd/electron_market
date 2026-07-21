'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Mode = 'customer' | 'admin' | 'supplier';
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'status'; text: string };
type HistoryItem = { id: string; title: string; state: string; preview: string; updated_at: string };
type Offer = { partNumber?: string; manufacturer?: string; supplierSku?: string; productName?: string; description?: string; availableQuantity?: number; unit?: string; unitPrice?: number; currency?: string; moq?: number; leadTime?: string; condition?: string };

export default function ProductFinderPanel({ mode }: { mode: Mode }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [session, setSession] = useState<{ id: string; title: string } | null>(null);
  const submitting = useRef(false);
  const conversation = useRef<HTMLDivElement>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/product-finder/sessions', { cache: 'no-store' });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setHistory(value.items ?? []);
    } finally { setHistoryLoading(false); }
  };

  const selectConversation = async (id: string) => {
    if (busy) return;
    const response = await fetch(`/api/product-finder/sessions/${id}`, { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) { setMessages([{ id: crypto.randomUUID(), role: 'status', text: value.error ?? 'Conversation could not be loaded.' }]); return; }
    setSession(value.session);
    setMessages(value.messages ?? []);
    setOffers(value.offers ?? []);
  };

  useEffect(() => { loadHistory().catch(() => setHistoryLoading(false)); }, []);
  useEffect(() => { const viewport = conversation.current; if (viewport) viewport.scrollTop = viewport.scrollHeight; }, [messages, busy]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = query;
    if (!message.trim() || busy || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setQuery('');
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text: message }]);
    try {
      const request = await fetch('/api/product-finder/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, sessionId: session?.id }) });
      const value = await request.json();
      if (!request.ok) throw new Error(value.error || 'The web-search response could not be completed.');
      setSession(value.session);
      setOffers(value.offers ?? []);
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: value.assistantMessage }]);
      await loadHistory();
    } catch (error) {
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'status', text: error instanceof Error ? error.message : 'The web-search response could not be completed.' }]);
    } finally { submitting.current = false; setBusy(false); }
  };

  const newConversation = () => { if (!busy) { setSession(null); setMessages([]); setOffers([]); setQuery(''); } };

  return (
    <section aria-labelledby={`${mode}-product-finder-title`} className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-xl">
      <header className="shrink-0 border-b px-4 py-4 sm:px-6"><h2 id={`${mode}-product-finder-title`} className="text-2xl font-bold text-slate-950">Product Finder</h2><p className="mt-2 text-sm text-slate-600">OpenAI response with supplier inventory and Web Search.</p></header>
      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[minmax(360px,.8fr)_minmax(0,1.2fr)]">
        <div className="flex min-h-0 min-w-0 flex-col border-b lg:col-start-2 lg:row-start-1 lg:border-b-0 lg:border-l">
          <form onSubmit={submit} className="border-b p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-800">{session ? session.title : 'New unsaved chat'}</p><button type="button" onClick={newConversation} disabled={busy} className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">New Chat</button></div><label className="sr-only" htmlFor={`${mode}-finder-query`}>Message</label><textarea id={`${mode}-finder-query`} value={query} onChange={event => setQuery(event.target.value)} rows={4} maxLength={12000} className="w-full resize-y rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder={session ? 'Continue this conversation…' : 'Enter your request…'} /><button disabled={busy || !query.trim()} className="admin-primary-button mt-3 disabled:opacity-50">{busy ? 'Searching…' : 'Send'}</button></form>
          <div ref={conversation} className="min-h-[420px] flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/70 p-4 sm:p-5 lg:min-h-0" aria-label="Product Finder conversation" aria-live="polite">
            {!messages.length && !busy && <p className="text-sm text-slate-500">Start a request or choose a saved chat.</p>}
            {messages.map(message => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><pre className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 font-sans text-sm leading-6 ${message.role === 'user' ? 'bg-blue-100 text-slate-950' : message.role === 'assistant' ? 'bg-purple-900 text-white' : 'border border-amber-200 bg-amber-50 text-amber-900'}`}>{message.text}</pre></div>)}
            {busy && <p role="status" className="text-sm font-medium text-cyan-700">Checking supplier inventory and the web…</p>}
          </div>
        </div>
        <aside className="grid min-h-[620px] min-w-0 grid-rows-2 overflow-hidden bg-blue-950 text-blue-50 lg:col-start-1 lg:row-start-1 lg:min-h-0" aria-label="Saved chats and supply offers">
          <section className="flex min-h-0 flex-col border-b border-blue-800" aria-labelledby={`${mode}-saved-chats-title`}>
            <header className="flex items-center justify-between gap-3 border-b border-blue-800 px-4 py-3"><h3 id={`${mode}-saved-chats-title`} className="text-lg font-bold text-white">All Chats</h3><button type="button" onClick={newConversation} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">New chat</button></header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">{historyLoading && <p className="p-2 text-sm text-blue-200">Loading chats…</p>}{!historyLoading && !history.length && <p className="p-2 text-sm text-blue-200">No saved chats yet.</p>}{history.map(item => <button key={item.id} type="button" onClick={() => selectConversation(item.id)} disabled={busy} className={`w-full rounded-lg border p-3 text-left ${session?.id === item.id ? 'border-cyan-300 bg-blue-700' : 'border-blue-700 bg-blue-900 hover:bg-blue-800'}`}><span className="block truncate text-sm font-bold text-white">{item.title}</span><span className="mt-1 block truncate text-xs text-blue-200">{item.preview}</span></button>)}</div>
          </section>
          <section className="flex min-h-0 flex-col" aria-labelledby={`${mode}-supply-offers-title`}>
            <header className="border-b border-blue-800 px-4 py-3"><div className="flex items-center justify-between gap-3"><h3 id={`${mode}-supply-offers-title`} className="text-lg font-bold text-white">Ready Supply Offers</h3>{offers.length > 0 && <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-blue-900">{offers.length}</span>}</div><p className="mt-1 text-xs text-blue-200">Real supplier-entered availability and prices.</p></header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">{!offers.length && <p className="p-2 text-sm text-blue-200">Matching supply offers will appear here.</p>}{offers.map((offer, index) => <article key={`${offer.partNumber}-${offer.supplierSku}-${index}`} className="rounded-xl border border-blue-700 bg-white p-4 text-slate-900"><h4 className="font-bold">{offer.partNumber || offer.productName || 'Supplier item'}</h4><p className="mt-1 text-xs text-slate-600">{[offer.manufacturer, offer.productName].filter(Boolean).join(' · ')}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><p className="rounded-lg bg-emerald-50 p-2"><span className="block text-slate-500">Available</span><strong>{offer.availableQuantity ?? '—'} {offer.unit || 'pcs'}</strong></p><p className="rounded-lg bg-blue-50 p-2"><span className="block text-slate-500">Unit price</span><strong>{offer.unitPrice ?? '—'} {offer.currency || ''}</strong></p><p className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">MOQ</span><strong>{offer.moq ?? '—'}</strong></p><p className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Lead time</span><strong>{offer.leadTime || '—'}</strong></p></div></article>)}</div>
          </section>
        </aside>
      </div>
    </section>
  );
}
