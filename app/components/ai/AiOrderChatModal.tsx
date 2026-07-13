'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  message_order?: number;
  created_at?: string;
  status?: string;
  error_message?: string;
};

type AiOrderChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type OctopartOffer = {
  seller: string | null;
  available_quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  lead_time_days: number | null;
  product_url: string | null;
};

type OctopartResult = {
  request_number: number;
  request_id: string;
  part_number: string;
  summary: {
    part_number?: string | null;
    manufacturer?: string | null;
    description?: string | null;
    datasheet_url?: string | null;
    octopart_url?: string | null;
    source_url?: string | null;
    offers_count?: number | null;
  };
  offers: OctopartOffer[];
};

const getGuestSessionId = () => {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem('electron_market_ai_guest_session_id');
  if (existing) return existing;
  const generated = `guest-${crypto.randomUUID()}`;
  window.localStorage.setItem('electron_market_ai_guest_session_id', generated);
  return generated;
};

const formatMessageDateTime = (value: string | undefined) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export default function AiOrderChatModal({ isOpen, onClose }: AiOrderChatModalProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState('');
  const [chatNumber, setChatNumber] = useState<number | null>(null);
  const [guestSessionId, setGuestSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketPartNumber, setMarketPartNumber] = useState('');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [marketResult, setMarketResult] = useState<OctopartResult | null>(null);
  const messagesStartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGuestSessionId(getGuestSessionId());
  }, [isOpen]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => Number(b.message_order ?? 0) - Number(a.message_order ?? 0)),
    [messages]
  );

  useEffect(() => {
    messagesStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sortedMessages.length, loading]);

  useEffect(() => {
    if (!chatSessionId) return;
    let active = true;
    const loadMessages = async () => {
      const response = await fetch(`/api/ai-chat?chat_session_id=${encodeURIComponent(chatSessionId)}`);
      const payload = await response.json();
      if (!active || !response.ok || !Array.isArray(payload.messages)) return;
      setChatNumber(payload.chat_number ?? null);
      setMessages(payload.messages);
    };
    loadMessages();
    return () => {
      active = false;
    };
  }, [chatSessionId]);

  if (!isOpen) return null;

  const searchMarketData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPartNumber = marketPartNumber.trim();
    if (!trimmedPartNumber || marketLoading) return;

    setMarketLoading(true);
    setMarketError('');
    setMarketResult(null);

    const response = await fetch('/api/market-data/octopart/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_number: trimmedPartNumber,
        chat_session_id: chatSessionId || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      setMarketError(payload.error || 'Octopart / Nexar search failed.');
      setMarketLoading(false);
      return;
    }

    setMarketResult(payload as OctopartResult);
    setMessages((current) => [
      ...current,
      {
        id: `octopart-${payload.request_id}`,
        role: 'assistant',
        content: `Octopart/Nexar search completed for ${payload.part_number}. Request No. ${payload.request_number}. Manufacturer: ${payload.summary?.manufacturer || 'Not found'}. Offers found: ${payload.summary?.offers_count ?? payload.offers?.length ?? 0}.`,
        message_order: current.reduce((max, item) => Math.max(max, Number(item.message_order ?? 0)), 0) + 1,
        created_at: new Date().toISOString(),
      },
    ]);
    setMarketLoading(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setError('');
    setLoading(true);
    setMessage('');

    const optimisticOrder = messages.reduce((max, item) => Math.max(max, Number(item.message_order ?? 0)), 0) + 1;
    const optimisticMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: trimmed,
      message_order: optimisticOrder,
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    setMessages((current) => [...current, optimisticMessage]);

    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_session_id: chatSessionId || undefined,
        guest_session_id: guestSessionId || undefined,
        message: trimmed,
        chat_type: 'procurement',
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      if (Array.isArray(payload.messages)) {
        setMessages(payload.messages);
        setChatSessionId(payload.chat_session_id || chatSessionId);
        setChatNumber(payload.chat_number ?? chatNumber);
      }
      setError(payload.error || 'AI chat request failed.');
      setLoading(false);
      return;
    }

    setChatSessionId(payload.chat_session_id);
    setChatNumber(payload.chat_number);
    if (Array.isArray(payload.messages)) {
      setMessages(payload.messages);
    } else {
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticMessage.id),
        {
          id: payload.user_message?.id,
          role: 'user',
          content: payload.user_message?.content || trimmed,
          message_order: payload.user_message?.message_order ?? payload.message_order?.user,
          created_at: payload.user_message?.created_at ?? optimisticMessage.created_at,
        },
        {
          id: payload.assistant_message?.id,
          role: 'assistant',
          content: payload.assistant_message?.content || '',
          message_order: payload.assistant_message?.message_order ?? payload.message_order?.assistant,
          created_at: payload.assistant_message?.created_at ?? new Date().toISOString(),
        },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 py-6">
      <section className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Upload BOM / Get Quotes</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tell us what electronic components you need. Our AI assistant will help clarify your request and prepare it for RFQ.
            </p>
            {chatNumber && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Chat #{chatNumber}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form onSubmit={searchMarketData} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-blue-900">Search market data by Part Number</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Enter a Part Number to check market availability, manufacturer data, stock and reference prices from Octopart/Nexar.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Part Number</span>
                <input
                  value={marketPartNumber}
                  onChange={(event) => setMarketPartNumber(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Example: LM358DR"
                />
              </label>
              <button type="submit" disabled={marketLoading || !marketPartNumber.trim()} className="self-end rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {marketLoading ? 'Searching...' : 'Search Octopart'}
              </button>
            </div>

            {marketLoading && <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">Searching Octopart / Nexar...</div>}
            {marketError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{marketError}</div>}

            {marketResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request No</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{marketResult.request_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Part Number</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{marketResult.summary?.part_number || marketResult.part_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manufacturer</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{marketResult.summary?.manufacturer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offers Count</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{marketResult.summary?.offers_count ?? marketResult.offers.length}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{marketResult.summary?.description || 'No description returned.'}</p>
                {marketResult.summary?.datasheet_url && (
                  <a href={marketResult.summary.datasheet_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
                    Open datasheet
                  </a>
                )}

                {marketResult.offers.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-[680px] text-left text-sm">
                      <thead className="bg-blue-600 text-white">
                        <tr>
                          {['Seller', 'Stock', 'Price', 'Lead Time', 'Link'].map((heading) => (
                            <th key={heading} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {marketResult.offers.slice(0, 5).map((offer, index) => (
                          <tr key={`${offer.seller || 'seller'}-${index}`}>
                            <td className="px-3 py-2 font-medium text-slate-800">{offer.seller || '-'}</td>
                            <td className="px-3 py-2 text-slate-700">{offer.available_quantity ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-700">{offer.unit_price ? `${offer.currency || 'USD'} ${offer.unit_price}` : '-'}</td>
                            <td className="px-3 py-2 text-slate-700">{offer.lead_time_days ? `${offer.lead_time_days} days` : '-'}</td>
                            <td className="px-3 py-2">
                              {offer.product_url ? <a href={offer.product_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:text-blue-800">Open</a> : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No distributor offers found in Octopart/Nexar. You can still create RFQ.
                  </p>
                )}
              </div>
            )}
          </form>

          <form onSubmit={sendMessage} className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">What do you need to order?</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Example: 500 pcs STM32F103C8T6, delivery to Israel, alternatives allowed"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Link href={chatSessionId ? `/create-request?chat_session_id=${chatSessionId}` : '/create-request'} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                Advanced RFQ form
              </Link>
              <button type="submit" disabled={loading || !message.trim()} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                SEND
              </button>
            </div>
          </form>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="mt-5 space-y-3">
            <div ref={messagesStartRef} />
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-700">AI is preparing your sourcing request...</div>
              </div>
            )}
            {sortedMessages.map((item, index) => (
              <div key={item.id || `${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`w-fit max-w-[85%] rounded-2xl p-4 text-sm leading-6 sm:max-w-[60%] ${item.role === 'user' ? 'border border-blue-100 bg-blue-50 text-slate-900' : item.status === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-purple-700 bg-purple-800 text-white'}`}>
                  <p className={`mb-1 text-xs font-bold ${item.role === 'user' ? 'text-blue-700' : item.status === 'error' ? 'text-red-700' : 'text-purple-100'}`}>
                    {item.role === 'user' ? 'You' : 'AI Assistant'}
                  </p>
                  <div className="whitespace-pre-wrap">{item.status === 'error' ? item.error_message || item.content : item.content}</div>
                  <p className={`mt-2 text-xs ${item.role === 'user' ? 'text-slate-500' : item.status === 'error' ? 'text-red-600' : 'text-purple-100'}`}>
                    {formatMessageDateTime(item.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {chatSessionId && (
          <footer className="border-t border-slate-200 px-5 py-4">
            <Link href={`/create-request?chat_session_id=${chatSessionId}`} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Continue to RFQ form
            </Link>
          </footer>
        )}
      </section>
    </div>
  );
}
