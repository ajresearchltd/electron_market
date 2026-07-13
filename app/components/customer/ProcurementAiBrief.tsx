'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import HubButton from '../ui/HubButton';

type Message = {
  id: string;
  role: string;
  content: string;
  created_at?: string | null;
  metadata?: {
    preference_proposal?: Record<string, unknown> | null;
    data_unavailable?: Array<{ dataType: string; reason: string; nextAction: string }>;
    clarification_draft?: { recipients: string[]; question: string; bomLineNumbers: number[] } | null;
  };
};

type Snapshot = {
  identity: { procurementNumber: string | null };
  stage: { currentStageLabel: string; actionRequiredDescription: string | null };
  bom: { originalFileName: string | null; itemCount: number };
  verification: { completed: boolean; started: boolean; verifiedLines: number; totalLines: number };
  rfq: { count: number; anonymousSuppliersResponded: number };
  quotes: { count: number };
};

const formatMessageTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
};

function InlineContent({ value, customer }: { value: string; customer: boolean }) {
  return <>{value.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') && part.endsWith('`')
    ? <code key={index} className={`rounded px-1.5 py-0.5 font-mono text-[0.92em] ${customer ? 'bg-white/60 text-slate-950' : 'bg-black/20 text-white'}`}>{part.slice(1, -1)}</code>
    : <span key={index}>{part}</span>)}</>;
}

function MessageContent({ content, customer }: { content: string; customer: boolean }) {
  return <div className="space-y-1.5 break-words [overflow-wrap:anywhere]">
    {content.split('\n').map((line, index) => {
      const bullet = line.match(/^\s*[-*]\s+(.+)/);
      const numbered = line.match(/^\s*(\d+[.)])\s+(.+)/);
      const heading = line.match(/^\s*#{1,4}\s+(.+)/);
      if (!line.trim()) return <div key={index} className="h-1" aria-hidden="true" />;
      if (heading) return <p key={index} className="font-semibold"><InlineContent value={heading[1]} customer={customer} /></p>;
      if (bullet) return <p key={index} className="flex gap-2"><span aria-hidden="true">•</span><span><InlineContent value={bullet[1]} customer={customer} /></span></p>;
      if (numbered) return <p key={index} className="flex gap-2"><span className="shrink-0">{numbered[1]}</span><span><InlineContent value={numbered[2]} customer={customer} /></span></p>;
      return <p key={index}><InlineContent value={line} customer={customer} /></p>;
    })}
  </div>;
}

export default function ProcurementAiBrief({
  open,
  onClose,
  uploadId,
  onApplyProposal,
}: {
  open: boolean;
  onClose: () => void;
  uploadId: string;
  onApplyProposal: (proposal: Record<string, unknown>) => Promise<void>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [failedMessage, setFailedMessage] = useState('');
  const [applying, setApplying] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<Record<string, string>>({});
  const [draftAction, setDraftAction] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const loadCurrentState = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/${uploadId}/ai-brief`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI Brief could not be loaded.');
      setMessages(result.messages ?? []);
      setSnapshot(result.snapshot ?? null);
      setSuggestions(result.suggestions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI Brief could not be loaded.');
    } finally {
      setRefreshing(false);
    }
  }, [uploadId]);

  useEffect(() => {
    if (!open) return;
    shouldAutoScrollRef.current = true;
    void loadCurrentState(true);
  }, [open, loadCurrentState]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list || !shouldAutoScrollRef.current) return;
    window.requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }, [messages, sending, error]);

  const resizeComposer = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  };

  const send = async (message = text) => {
    const value = message.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    setFailedMessage('');
    shouldAutoScrollRef.current = true;
    try {
      const response = await fetch(`/api/customer/bom/${uploadId}/ai-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI request failed.');
      setMessages(result.messages ?? []);
      setSnapshot(result.snapshot ?? null);
      setSuggestions(result.suggestions ?? []);
      setText('');
      window.requestAnimationFrame(resizeComposer);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'AI request failed.');
      setFailedMessage(value);
      setText(value);
      window.requestAnimationFrame(resizeComposer);
    } finally {
      setSending(false);
    }
  };

  const decideClarification = async (message: Message, action: 'confirm' | 'cancel') => {
    const draft = message.metadata?.clarification_draft;
    if (!draft || draftAction) return;
    setDraftAction(`${message.id}:${action}`);
    setError('');
    try {
      const response = await fetch(`/api/customer/bom/${uploadId}/ai-brief/clarification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: message.id, action, question: draftQuestions[message.id] ?? draft.question }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Clarification decision could not be recorded.');
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, metadata: { ...item.metadata, clarification_draft: null } } : item));
      if (action === 'confirm') setText('Clarification sent to the selected anonymous suppliers.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Clarification decision could not be recorded.');
    } finally { setDraftAction(''); }
  };

  if (!open) return null;
  const verificationLabel = snapshot?.verification.completed
    ? `Completed (${snapshot.verification.verifiedLines}/${snapshot.verification.totalLines})`
    : snapshot?.verification.started ? 'In progress' : 'Not completed';
  const stateRows = snapshot ? [
    ['Stage', snapshot.stage.currentStageLabel],
    ['BOM lines', snapshot.bom.itemCount],
    ['Verification', verificationLabel],
    ['RFQs', snapshot.rfq.count],
    ['Responses', snapshot.rfq.anonymousSuppliersResponded],
    ['Quotes', snapshot.quotes.count],
  ] : [];

  return <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-slate-950/60 p-2 sm:p-4 md:p-6" role="presentation">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="procurement-ai-brief-title" tabIndex={-1} className="flex h-[calc(100vh-16px)] w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[calc(100vh-32px)] sm:w-[calc(100vw-32px)] md:h-[min(760px,calc(100vh-48px))] md:w-[650px] md:max-w-[calc(100vw-48px)]">
      <header className="shrink-0 bg-blue-800 p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="procurement-ai-brief-title" className="font-bold">AI Procurement Brief</h2>
            <p className="mt-1 truncate text-xs text-blue-100">{snapshot?.identity.procurementNumber || 'Procurement order'} · {snapshot?.bom.originalFileName || 'BOM'}</p>
          </div>
          <button type="button" onClick={onClose} className="hub-unstyled rounded-lg px-2 text-2xl leading-none text-white hover:bg-white/10" aria-label="Close AI Procurement Brief">×</button>
        </div>
      </header>

      <section className="shrink-0 border-b border-blue-100 bg-blue-50 p-3" aria-label="Current procurement state">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">Current order state</h3>
          <button type="button" onClick={() => loadCurrentState()} disabled={refreshing || sending} className="hub-unstyled text-xs font-bold text-blue-700 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh status'}</button>
        </div>
        {snapshot ? <>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {stateRows.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-white px-2.5 py-2 shadow-sm"><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-bold text-slate-900">{value}</dd></div>)}
          </dl>
          <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-xs text-slate-700"><b>Next action:</b> {snapshot.stage.actionRequiredDescription || 'No customer action is currently required.'}</p>
        </> : <p className="mt-2 text-xs text-blue-700">Loading the latest database state…</p>}
      </section>

      <section className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5" aria-label="Suggested questions">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((prompt) => <button type="button" key={prompt} onClick={() => send(prompt)} disabled={sending} className="hub-unstyled rounded-xl border border-white bg-[#5B4DB7] px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-sky-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{prompt}</button>)}
        </div>
      </section>

      <div ref={messageListRef} onScroll={(event) => { const element = event.currentTarget; shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4" aria-live="polite">
        {messages.length === 0 && !error ? <p className="rounded-xl bg-white p-3 text-sm text-blue-900 shadow-sm">Ask about the confirmed state of this BOM. Commercial answers are available only after real supplier responses and Quotes exist.</p> : null}
        {messages.map((message) => {
          const customer = message.role === 'user';
          const time = formatMessageTime(message.created_at);
          return <article key={message.id} className={`w-fit ${customer ? 'ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[#BAE6FD] px-4 py-3 text-sm leading-6 text-[#020617] shadow-sm' : 'mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-[#5B4DB7] px-4 py-3 text-sm leading-6 text-white shadow-md'}`}>
            <p className={`mb-1 text-[11px] font-semibold leading-4 ${customer ? 'text-slate-700' : 'text-white/80'}`}>{customer ? 'You' : 'AI Procurement Agent'}{time ? ` · ${time}` : ''}</p>
            <MessageContent content={message.content} customer={customer} />
            {!customer && message.metadata?.data_unavailable?.length ? <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-2.5 text-xs text-white">
              <b>Currently unavailable</b>
              {message.metadata.data_unavailable.map((item, index) => <p key={`${item.dataType}-${index}`} className="mt-1 text-white/90">{item.reason} Next: {item.nextAction}</p>)}
            </div> : null}
            {!customer && message.metadata?.preference_proposal ? <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-2.5 text-xs text-white">
              <b>Proposed preference changes</b>
              <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap font-mono text-white/90">{JSON.stringify(message.metadata.preference_proposal, null, 2)}</pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <HubButton size="sm" loading={applying === message.id} loadingText="Applying..." onClick={async () => {
                  setApplying(message.id);
                  try { await onApplyProposal(message.metadata!.preference_proposal!); await loadCurrentState(true); }
                  catch (applyError) { setError(applyError instanceof Error ? applyError.message : 'Changes could not be applied.'); }
                  finally { setApplying(''); }
                }}>Apply changes</HubButton>
                <button type="button" onClick={() => setApplying('')} className="hub-unstyled text-xs font-semibold text-white/80 hover:text-white">Keep current preferences</button>
              </div>
            </div> : null}
            {!customer && message.metadata?.clarification_draft ? <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-2.5 text-xs text-white">
              <b>Clarification request prepared</b>
              <p className="mt-1 text-white/90"><b>Recipients:</b> {message.metadata.clarification_draft.recipients.join(', ')}</p>
              <label className="mt-2 block font-semibold">Question
                <textarea rows={3} value={draftQuestions[message.id] ?? message.metadata.clarification_draft.question} onChange={(event) => setDraftQuestions((current) => ({ ...current, [message.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/20 bg-black/20 p-2 font-normal text-white outline-none focus:ring-2 focus:ring-white/60" />
              </label>
              <p className="mt-2 text-white/80">This is a draft only and has not been sent.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <HubButton size="sm" loading={draftAction === `${message.id}:confirm`} loadingText="Sending..." onClick={() => decideClarification(message, 'confirm')}>Confirm and send</HubButton>
                <button type="button" disabled={Boolean(draftAction)} onClick={() => decideClarification(message, 'cancel')} className="hub-unstyled text-xs font-semibold text-white/80 hover:text-white disabled:opacity-50">Cancel</button>
              </div>
            </div> : null}
          </article>;
        })}
        {sending ? <div className="mr-auto flex w-fit max-w-[90%] items-center gap-2 rounded-2xl rounded-bl-md bg-[#5B4DB7] px-4 py-3 text-sm text-white shadow-md" role="status">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          <span>AI is analysing the current order...</span>
        </div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p>{error}</p>
          {failedMessage ? <button type="button" disabled={sending} onClick={() => send(failedMessage)} className="hub-unstyled mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100">Retry</button> : null}
        </div> : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea ref={textareaRef} rows={2} value={text} onChange={(event) => { setText(event.target.value); resizeComposer(); }} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (text.trim() && !sending) void send(); }
          }} className="max-h-36 min-h-[64px] min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="Ask about this BOM, verification, sourcing status, prices, lead times, documents, or the next action..." />
          <HubButton size="sm" className="w-full sm:w-auto" loading={sending} loadingText="Sending..." disabled={!text.trim()} aria-busy={sending || undefined} onClick={() => send()}>Send</HubButton>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  </div>;
}
