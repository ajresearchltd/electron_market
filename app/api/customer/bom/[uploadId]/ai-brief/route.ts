import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, extractResponseText, extractUsage, loadAiConfig, resolveOpenAIKey } from '../../../../../../lib/ai/config';
import { CustomerAiContext, getProcurementOrderSnapshotForAI, suggestedQuestionsForStage } from '../../../../../../lib/ai/procurement-order-snapshot';
import { guardAssistantOutput, isSupplierIdentityRequest, redactSupplierIdentity, SUPPLIER_IDENTITY_REFUSAL } from '../../../../../../lib/ai/supplier-confidentiality';
import { createAdminClient } from '../../../../../../lib/supabase/admin';
import { createClient } from '../../../../../../lib/supabase/server';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const asObject = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const preferenceKeys = ['search_priority', 'max_lead_time_days', 'supplier_countries', 'allow_independent_suppliers', 'allow_alternatives', 'allow_split_delivery', 'budget_amount', 'budget_currency', 'certificate_requirements'];
const actionTypes = new Set(['verify_bom', 'review_issue', 'change_preferences', 'prepare_rfq', 'compare_quotes', 'review_document', 'no_action']);

async function resolveOwnedContext(uploadId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: fail('Authentication required.', 401) };
  const { data: upload, error } = await supabase.from('customer_bom_uploads')
    .select('id,user_id,procurement_chain_id,document_name')
    .eq('id', uploadId).eq('user_id', user.id).maybeSingle();
  if (error) return { error: fail('AI Procurement Brief could not load this BOM.', 500) };
  if (!upload?.procurement_chain_id) return { error: fail('BOM upload not found.', 404) };
  const { data: chain } = await supabase.from('procurement_chains')
    .select('id,procurement_number,customer_user_id')
    .eq('id', upload.procurement_chain_id).eq('customer_user_id', user.id).maybeSingle();
  if (!chain) return { error: fail('BOM upload not found.', 404) };
  return { supabase, database: createAdminClient() ?? supabase, user, upload, chain };
}

async function loadMessages(supabase: any, sessionId: string, identifiers: string[]) {
  const { data, error } = await supabase.from('ai_chat_messages')
    .select('id,role,content,metadata,status,created_at,message_order')
    .eq('chat_session_id', sessionId).order('message_order');
  return {
    data: (data ?? []).map((message: any) => ({ ...message, content: redactSupplierIdentity(String(message.content ?? ''), identifiers) })),
    error,
  };
}

function publicState(context: CustomerAiContext) {
  return {
    snapshot: context.snapshot,
    suggestions: suggestedQuestionsForStage(context.snapshot),
  };
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    currentStage: {
      type: 'object', additionalProperties: false,
      properties: { code: { type: 'string' }, label: { type: 'string' } },
      required: ['code', 'label'],
    },
    factsUsed: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'],
      },
    },
    dataUnavailable: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { dataType: { type: 'string' }, reason: { type: 'string' }, nextAction: { type: 'string' } },
        required: ['dataType', 'reason', 'nextAction'],
      },
    },
    supplierReferences: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { alias: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } } }, required: ['alias', 'facts'],
      },
    },
    recommendedActions: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { type: { type: 'string' }, label: { type: 'string' }, requiresConfirmation: { type: 'boolean' } },
        required: ['type', 'label', 'requiresConfirmation'],
      },
    },
    proposedPreferenceChanges: { anyOf: [{
      type: 'object', additionalProperties: false,
      properties: {
        search_priority: { type: 'string', enum: ['price', 'delivery_time', 'balanced'] },
        max_lead_time_days: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
        supplier_countries: { type: 'array', items: { type: 'string' } },
        allow_independent_suppliers: { type: 'boolean' },
        allow_alternatives: { type: 'boolean' },
        allow_split_delivery: { type: 'boolean' },
        budget_amount: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
        budget_currency: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        certificate_requirements: { type: 'string' },
      },
      required: ['search_priority', 'max_lead_time_days', 'supplier_countries', 'allow_independent_suppliers', 'allow_alternatives', 'allow_split_delivery', 'budget_amount', 'budget_currency', 'certificate_requirements'],
    }, { type: 'null' }] },
    clarificationDraft: {
      anyOf: [{ type: 'null' }, {
        type: 'object', additionalProperties: false,
        properties: {
          recipients: { type: 'array', items: { type: 'string' } },
          question: { type: 'string' },
          bomLineNumbers: { type: 'array', items: { type: 'number' } },
        },
        required: ['recipients', 'question', 'bomLineNumbers'],
      }],
    },
  },
  required: ['answer', 'currentStage', 'factsUsed', 'dataUnavailable', 'supplierReferences', 'recommendedActions', 'proposedPreferenceChanges', 'clarificationDraft'],
};

const tools = [
  'get_current_order_snapshot', 'get_current_procurement_stage', 'get_order_preferences', 'get_bom_summary',
  'get_bom_verification_summary', 'get_bom_issues', 'search_bom_items', 'get_anonymized_rfq_activity',
  'get_anonymized_supplier_responses', 'get_anonymized_quotes', 'get_quote_comparison', 'get_order_bottlenecks',
  'get_document_status', 'get_order_timeline', 'get_customer_decision_history', 'get_claim_return_refund_status',
].map((name) => ({
  type: 'function',
  name,
  description: `Read the authorized selected procurement chain using ${name}. Supplier identity is never returned.`,
  strict: true,
  parameters: name === 'search_bom_items'
    ? { type: 'object', additionalProperties: false, properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 25 } }, required: ['query', 'limit'] }
    : name === 'get_bom_issues'
      ? { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }, required: ['limit'] }
      : { type: 'object', additionalProperties: false, properties: {}, required: [] },
}));

async function executeTool(name: string, args: Record<string, any>, context: CustomerAiContext, database: any, ownerId: string) {
  const snapshot = context.snapshot;
  switch (name) {
    case 'get_current_order_snapshot': return snapshot;
    case 'get_current_procurement_stage': return snapshot.stage;
    case 'get_order_preferences': return snapshot.preferences;
    case 'get_bom_summary': return snapshot.bom;
    case 'get_bom_verification_summary': return snapshot.verification;
    case 'get_bom_issues': return context.bomIssues.slice(0, Math.min(50, Math.max(1, Number(args.limit) || 20)));
    case 'search_bom_items': {
      const query = String(args.query ?? '').trim().slice(0, 120).replace(/[^a-zA-Z0-9.+/-]/g, '');
      const limit = Math.min(25, Math.max(1, Number(args.limit) || 10));
      if (!query) return [];
      const { data } = await database.from('customer_bom_upload_items')
        .select('row_number,part_number,normalized_part_number,manufacturer,quantity,unit,validation_status,part_number_check_status,part_number_check_message')
        .eq('upload_id', snapshot.identity.bomUploadId).eq('user_id', ownerId).eq('procurement_chain_id', snapshot.identity.procurementChainId)
        .or(`part_number.ilike.%${query}%,normalized_part_number.ilike.%${query}%`).limit(limit);
      return data ?? [];
    }
    case 'get_anonymized_rfq_activity': return snapshot.rfq;
    case 'get_anonymized_supplier_responses': return { counts: snapshot.rfq, communications: context.communications.slice(0, 20) };
    case 'get_anonymized_quotes': return context.anonymousQuotes;
    case 'get_quote_comparison': return { availability: snapshot.dataAvailability, summary: snapshot.quotes, quotes: context.anonymousQuotes };
    case 'get_order_bottlenecks': return { uncoveredBomLines: snapshot.quotes.uncoveredBomLines, shortestCompleteLeadTimeDays: snapshot.quotes.shortestCompleteLeadTimeDays, verificationIssues: context.bomIssues.slice(0, 30) };
    case 'get_document_status': return snapshot.documents;
    case 'get_order_timeline': return snapshot.timeline;
    case 'get_customer_decision_history': return { preferences: snapshot.preferences, approved: snapshot.order.approved, note: 'Canonical action records are authoritative; chat prose is not treated as a decision.' };
    case 'get_claim_return_refund_status': return snapshot.claims;
    default: return { error: 'Tool is not permitted.' };
  }
}

const systemInstruction = `You are the Electron Market AI Procurement Agent for one authorized procurement chain.
Answer only from the fresh CURRENT ORDER STATE, approved tool results, and customer-visible conversation history. Always distinguish confirmed facts, calculated analysis, recommendations, and unavailable information. Never invent supplier responses, prices, stock, MOQ, lead times, certificates, verification results, documents, or stages. The stage is authoritative database state and never advances because the customer says it did.

Supplier confidentiality is absolute. Refer to suppliers only by the supplied aliases (Supplier A, Supplier B, and so on). Never reveal, repeat, infer, reconstruct, or confirm supplier/company/legal/trading names, contacts, emails, phones, websites, addresses, registrations, tax/bank data, IDs, private documents, paths, filenames, or raw messages. Never guess identity from products, geography, formatting, certificates, or prior knowledge. If asked for identity or direct contact, say exactly: "${SUPPLIER_IDENTITY_REFUSAL}"

Respect every data-availability flag. For unavailable data, state what is missing, why it is unavailable at this stage, and the next action needed. Do not change preferences or conduct transaction actions. You may propose preference changes or prepare a supplier clarification draft, but it always requires explicit application confirmation. Return the required structured JSON only.`;

function parseStructuredResponse(raw: string, context: CustomerAiContext) {
  let parsed: Record<string, any> = {};
  try { parsed = asObject(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''))); } catch { parsed = {}; }
  return {
    answer: String(parsed.answer || raw || 'No response was generated.'),
    currentStage: asObject(parsed.currentStage).code ? parsed.currentStage : { code: context.snapshot.stage.currentStageCode, label: context.snapshot.stage.currentStageLabel },
    factsUsed: Array.isArray(parsed.factsUsed) ? parsed.factsUsed : [],
    dataUnavailable: Array.isArray(parsed.dataUnavailable) ? parsed.dataUnavailable : [],
    supplierReferences: Array.isArray(parsed.supplierReferences) ? parsed.supplierReferences : [],
    recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
    proposedPreferenceChanges: asObject(parsed.proposedPreferenceChanges),
    clarificationDraft: parsed.clarificationDraft && typeof parsed.clarificationDraft === 'object' ? parsed.clarificationDraft : null,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const owned = await resolveOwnedContext(uploadId);
  if (owned.error) return owned.error;
  try {
    const context = await getProcurementOrderSnapshotForAI({ database: owned.database, authenticatedUserId: owned.user!.id, procurementChainId: owned.chain!.id, bomUploadId: owned.upload!.id });
    const { data: session, error } = await owned.supabase!.from('ai_chat_sessions')
      .select('id,chat_number,procurement_chain_id').eq('procurement_chain_id', owned.chain!.id).eq('user_id', owned.user!.id).maybeSingle();
    if (error) return fail('AI Procurement Brief database setup is required.', 503);
    const history = session ? await loadMessages(owned.supabase, session.id, context.internalSupplierIdentifiers) : { data: [], error: null };
    if (history.error) return fail('AI message history could not be loaded.', 500);
    return NextResponse.json({ session_id: session?.id ?? null, messages: history.data, ...publicState(context) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'AI Procurement Brief could not load current order state.', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const owned = await resolveOwnedContext(uploadId);
  if (owned.error) return owned.error;
  const body = await request.json().catch(() => ({}));
  const question = String(body.message ?? '').trim();
  if (!question) return fail('Message is required.');
  if (question.length > 4000) return fail('Message is too long.');

  try {
    // This is deliberately fresh on every POST and resolved from the owned route BOM, never a browser chain ID.
    const context = await getProcurementOrderSnapshotForAI({ database: owned.database, authenticatedUserId: owned.user!.id, procurementChainId: owned.chain!.id, bomUploadId: owned.upload!.id });
    const { config } = await loadAiConfig();
    if (!config.is_enabled) return fail('AI Procurement Brief is not configured.', 503);
    let key = '';
    try { key = resolveOpenAIKey(config); } catch { /* safe configuration error below */ }
    if (!key) return fail('AI Procurement Brief is not configured.', 503);

    let { data: session, error: sessionError } = await owned.supabase!.from('ai_chat_sessions')
      .select('*').eq('procurement_chain_id', owned.chain!.id).eq('user_id', owned.user!.id).maybeSingle();
    if (sessionError) return fail('AI Procurement Brief database setup is required.', 503);
    if (!session) {
      const created = await owned.supabase!.from('ai_chat_sessions').insert({
        user_id: owned.user!.id,
        title: `AI Brief - ${owned.chain!.procurement_number || owned.upload!.document_name}`,
        chat_type: 'procurement_brief', model: config.default_model, api_provider: 'openai',
        related_entity_type: 'procurement_chain', related_entity_id: owned.chain!.id,
        procurement_chain_id: owned.chain!.id, bom_upload_id: owned.upload!.id,
        system_prompt_snapshot: systemInstruction, metadata: { upload_id: owned.upload!.id },
      }).select('*').single();
      if (created.error) return fail('AI Procurement Brief database setup is required.', 503);
      session = created.data;
    }

    const history = await loadMessages(owned.supabase, session.id, context.internalSupplierIdentifiers);
    if (history.error) return fail('AI message history could not be loaded.', 500);
    const lastOrder = history.data.reduce((max: number, message: any) => Math.max(max, Number(message.message_order ?? 0)), 0);
    const userOrder = lastOrder + 1;
    const assistantOrder = lastOrder + 2;
    const turn = Math.floor(lastOrder / 2) + 1;
    const { error: userError } = await owned.supabase!.from('ai_chat_messages').insert({
      chat_session_id: session.id, chat_number: session.chat_number, user_id: owned.user!.id,
      procurement_chain_id: owned.chain!.id, message_order: userOrder, turn_number: turn,
      role: 'user', content: redactSupplierIdentity(question, context.internalSupplierIdentifiers), status: 'completed',
    });
    if (userError) return fail('Message could not be saved.', 500);

    let structured: Record<string, any>;
    let responseId: string | null = null;
    let usage = { input: 0, output: 0, total: 0 };
    if (isSupplierIdentityRequest(question)) {
      structured = parseStructuredResponse(JSON.stringify({
        answer: SUPPLIER_IDENTITY_REFUSAL,
        currentStage: { code: context.snapshot.stage.currentStageCode, label: context.snapshot.stage.currentStageLabel },
        factsUsed: [], dataUnavailable: [], supplierReferences: [], recommendedActions: [], proposedPreferenceChanges: null, clarificationDraft: null,
      }), context);
    } else {
      const recentHistory = history.data.slice(-12).map((message: any) => ({ role: message.role, content: message.content }));
      const openai = createOpenAIClient(key);
      const baseRequest: Record<string, any> = {
        model: config.default_model,
        instructions: systemInstruction,
        input: `CURRENT ORDER STATE\n${JSON.stringify(context.snapshot)}\n\nRECENT CUSTOMER-VISIBLE HISTORY\n${JSON.stringify(recentHistory)}\n\nCUSTOMER QUESTION\n${redactSupplierIdentity(question, context.internalSupplierIdentifiers)}`,
        tools,
        tool_choice: 'auto',
        text: { format: { type: 'json_schema', name: 'procurement_ai_reply', strict: true, schema: responseSchema } },
        ...(config.max_output_tokens ? { max_output_tokens: config.max_output_tokens } : {}),
      };
      let response = await openai.responses.create(baseRequest as any);
      for (let loop = 0; loop < 3; loop += 1) {
        const calls = (response.output ?? []).filter((item: any) => item.type === 'function_call');
        if (!calls.length) break;
        const outputs = await Promise.all(calls.map(async (call: any) => {
          let args = {};
          try { args = asObject(JSON.parse(call.arguments || '{}')); } catch { args = {}; }
          const result = await executeTool(call.name, args, context, owned.database, owned.user!.id);
          return { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) };
        }));
        response = await openai.responses.create({ ...baseRequest, input: outputs, previous_response_id: response.id } as any);
      }
      responseId = response.id;
      usage = extractUsage(response);
      structured = parseStructuredResponse(extractResponseText(response), context);
    }

    const guardedPayload = guardAssistantOutput(JSON.stringify(structured), context.internalSupplierIdentifiers);
    const guarded = guardAssistantOutput(String(structured.answer), context.internalSupplierIdentifiers);
    if (!guarded.safe || !guardedPayload.safe) console.warn('[procurement-ai-security] Supplier-identifying assistant output was withheld.');
    structured.answer = guarded.safe && guardedPayload.safe ? guarded.value : guardedPayload.value;
    structured.currentStage = { code: context.snapshot.stage.currentStageCode, label: context.snapshot.stage.currentStageLabel };
    structured.supplierReferences = Array.isArray(structured.supplierReferences)
      ? structured.supplierReferences.filter((reference: any) => context.supplierAliases.includes(String(reference?.alias)))
      : [];
    structured.recommendedActions = Array.isArray(structured.recommendedActions)
      ? structured.recommendedActions.filter((action: any) => actionTypes.has(String(action?.type))).map((action: any) => ({ type: action.type, label: String(action.label ?? ''), requiresConfirmation: true }))
      : [];
    if (structured.clarificationDraft) {
      const recipients = Array.isArray(structured.clarificationDraft.recipients)
        ? [...new Set<string>((structured.clarificationDraft.recipients as unknown[]).map((value) => String(value)))].filter((alias) => context.supplierAliases.includes(alias))
        : [];
      structured.clarificationDraft = recipients.length ? {
        recipients,
        question: String(structured.clarificationDraft.question ?? '').slice(0, 2000),
        bomLineNumbers: Array.isArray(structured.clarificationDraft.bomLineNumbers) ? structured.clarificationDraft.bomLineNumbers.map(Number).filter(Number.isFinite).slice(0, 100) : [],
      } : null;
    }
    if (!guardedPayload.safe) {
      structured.factsUsed = [];
      structured.dataUnavailable = [];
      structured.supplierReferences = [];
      structured.recommendedActions = [];
      structured.proposedPreferenceChanges = null;
      structured.clarificationDraft = null;
    }
    const rawProposal = asObject(structured.proposedPreferenceChanges);
    const proposal = Object.keys(rawProposal).length
      ? Object.fromEntries(preferenceKeys.filter((key) => Object.prototype.hasOwnProperty.call(rawProposal, key)).map((key) => [key, rawProposal[key]]))
      : null;
    const metadata = {
      current_stage: structured.currentStage,
      facts_used: structured.factsUsed,
      data_unavailable: structured.dataUnavailable,
      supplier_references: structured.supplierReferences,
      recommended_actions: structured.recommendedActions,
      preference_proposal: proposal,
      clarification_draft: structured.clarificationDraft,
    };
    const { error: assistantError } = await owned.supabase!.from('ai_chat_messages').insert({
      chat_session_id: session.id, chat_number: session.chat_number, user_id: owned.user!.id,
      procurement_chain_id: owned.chain!.id, message_order: assistantOrder, turn_number: turn,
      role: 'assistant', content: structured.answer, content_json: structured, metadata,
      openai_response_id: responseId, model: config.default_model, status: 'completed',
      input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total,
    });
    if (assistantError) return fail('AI response could not be saved.', 500);
    await owned.supabase!.from('ai_chat_sessions').update({
      latest_response_id: responseId, first_response_id: session.first_response_id || responseId,
      message_count: assistantOrder, last_message_at: new Date().toISOString(),
      total_input_tokens: Number(session.total_input_tokens ?? 0) + usage.input,
      total_output_tokens: Number(session.total_output_tokens ?? 0) + usage.output,
      total_tokens: Number(session.total_tokens ?? 0) + usage.total,
    }).eq('id', session.id).eq('user_id', owned.user!.id);
    const refreshed = await getProcurementOrderSnapshotForAI({ database: owned.database, authenticatedUserId: owned.user!.id, procurementChainId: owned.chain!.id, bomUploadId: owned.upload!.id });
    const updatedHistory = await loadMessages(owned.supabase, session.id, refreshed.internalSupplierIdentifiers);
    return NextResponse.json({ session_id: session.id, messages: updatedHistory.data, ...publicState(refreshed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI Procurement Brief request failed.';
    return fail(message.includes('access was rejected') ? 'BOM upload not found.' : 'AI Procurement Brief request failed.', message.includes('access was rejected') ? 404 : 502);
  }
}
