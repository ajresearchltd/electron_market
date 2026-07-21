import type OpenAI from 'openai';
import { createOpenAIClient, loadAiConfig, resolveOpenAIKey } from '../ai/config';
import{loadProductFinderAiConfiguration}from'./ai-configuration';
export { PRODUCT_FINDER_CONVERSATION_INSTRUCTIONS, createProductFinderVisibleResponse, safeConversationResponse } from './conversation-response';

type Database = any;
type Session = { id: string; intent?: unknown; openai_conversation_id?: string | null; openai_initialization_token?: string | null };
type OpenAIClient = Pick<OpenAI, 'conversations' | 'responses'>;

export class ProductFinderConversationError extends Error {
  code: string;
  constructor(code: string, message = 'Product Finder conversation is temporarily unavailable.') { super(message); this.code = code; }
}

async function legacyItems(database: Database, session: Session) {
  const result = await database.from('product_search_events').select('event_type,safe_payload,created_at').eq('session_id', session.id).in('event_type', ['finder_user_message', 'finder_assistant_message', 'finder_turn']).order('created_at').limit(40);
  if (result.error) throw new ProductFinderConversationError('PF_HISTORY_LOAD_FAILED');
  const items: any[] = [];
  const rows = result.data ?? [];
  if (rows.length && !rows.some((row: any) => row.event_type === 'finder_user_message')) items.push({ type: 'message', role: 'user', content: `Continue this existing Product Finder session from its confirmed structured intent: ${JSON.stringify(session.intent ?? {})}`.slice(0, 12000) });
  for (const row of rows) {
    const text = row.event_type === 'finder_user_message' ? row.safe_payload?.message : row.safe_payload?.assistantMessage;
    if (typeof text === 'string' && text.trim()) items.push({ type: 'message', role: row.event_type === 'finder_user_message' ? 'user' : 'assistant', content: text.slice(0, 12000) });
  }
  return items.slice(-40);
}

export async function ensureProductFinderConversation(input: { database: Database; openai: OpenAIClient; session: Session; initializationToken: string }) {
  if (input.session.openai_conversation_id) return input.session.openai_conversation_id;
  const claimed = await input.database.from('product_search_sessions').update({ openai_initialization_token: input.initializationToken, openai_failure_code: null }).eq('id', input.session.id).is('openai_conversation_id', null).is('openai_initialization_token', null).select('id').maybeSingle();
  if (claimed.error) throw new ProductFinderConversationError('PF_CONVERSATION_CLAIM_FAILED');
  if (!claimed.data) {
    const current = await input.database.from('product_search_sessions').select('openai_conversation_id,openai_initialization_token').eq('id', input.session.id).single();
    if (current.data?.openai_conversation_id) return current.data.openai_conversation_id;
    throw new ProductFinderConversationError('PF_CONVERSATION_INITIALIZING');
  }
  try {
    const items = await legacyItems(input.database, input.session);
    const conversation = await input.openai.conversations.create(items.length ? { items } as any : {});
    if (!conversation?.id || !String(conversation.id).startsWith('conv_')) throw new ProductFinderConversationError('PF_INVALID_CONVERSATION');
    const saved = await input.database.from('product_search_sessions').update({ openai_conversation_id: conversation.id, openai_conversation_created_at: new Date().toISOString(), openai_initialization_token: null, openai_failure_code: null }).eq('id', input.session.id).eq('openai_initialization_token', input.initializationToken).is('openai_conversation_id', null).select('openai_conversation_id').single();
    if (saved.error || saved.data?.openai_conversation_id !== conversation.id) throw new ProductFinderConversationError('PF_CONVERSATION_SAVE_FAILED');
    return conversation.id;
  } catch (error) {
    const code = error instanceof ProductFinderConversationError ? error.code : 'PF_CONVERSATION_CREATE_FAILED';
    await input.database.from('product_search_sessions').update({ ...(code === 'PF_CONVERSATION_SAVE_FAILED' ? {} : { openai_initialization_token: null }), openai_failure_code: code }).eq('id', input.session.id).eq('openai_initialization_token', input.initializationToken);
    if (error instanceof ProductFinderConversationError) throw error;
    throw new ProductFinderConversationError('PF_CONVERSATION_CREATE_FAILED');
  }
}

export async function createProductFinderConversationClient(database?:Database,configurationVersionId?:string|null) {
  const { config } = await loadAiConfig();
  const key = resolveOpenAIKey(config);
  if (!key) throw new ProductFinderConversationError('PF_OPENAI_NOT_CONFIGURED');
  const finder=database?await loadProductFinderAiConfiguration(database,configurationVersionId):null,settings=finder?.configuration.api;
  return { openai: createOpenAIClient(key,settings?{timeout:Math.min(settings.timeoutMs,30000),maxRetries:0}:{timeout:30000,maxRetries:0}), config, finder };
}
