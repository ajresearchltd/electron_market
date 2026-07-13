import crypto from 'crypto';
import OpenAI from 'openai';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';

export type AiConfig = {
  id?: string;
  provider: string;
  is_enabled: boolean;
  api_endpoint: string;
  api_key_source: string;
  api_key_encrypted: string | null;
  api_key_last4: string | null;
  api_key_is_configured: boolean;
  default_model: string;
  default_system_prompt: string | null;
  procurement_system_prompt: string | null;
  max_input_characters: number;
  max_output_tokens: number | null;
  temperature: number | null;
  top_p: number | null;
  reasoning_effort: string | null;
  response_format_json: unknown | null;
  allow_guest_chat: boolean;
  allow_file_uploads: boolean;
  allow_bom_analysis: boolean;
  daily_message_limit_per_user: number;
  monthly_token_limit_per_user: number | null;
  monthly_budget_usd: number | null;
  metadata?: Record<string, unknown>;
};

export const defaultAiConfig: AiConfig = {
  provider: 'openai',
  is_enabled: true,
  api_endpoint: 'https://api.openai.com/v1/responses',
  api_key_source: 'env',
  api_key_encrypted: null,
  api_key_last4: null,
  api_key_is_configured: false,
  default_model: 'gpt-5.5',
  default_system_prompt: 'You are a helpful procurement assistant for electronic components.',
  procurement_system_prompt:
    'You help buyers clarify electronic component sourcing requests, BOM details, quantities, delivery country, acceptable alternatives, urgency, and RFQ-ready requirements.',
  max_input_characters: 12000,
  max_output_tokens: null,
  temperature: null,
  top_p: null,
  reasoning_effort: null,
  response_format_json: null,
  allow_guest_chat: true,
  allow_file_uploads: false,
  allow_bom_analysis: false,
  daily_message_limit_per_user: 50,
  monthly_token_limit_per_user: null,
  monthly_budget_usd: null,
  metadata: {},
};

const keyToBuffer = (key: string) => crypto.createHash('sha256').update(key).digest();

export const encryptApiKey = (plainText: string, secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyToBuffer(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const decryptApiKey = (encrypted: string, secret: string) => {
  const [ivText, tagText, encryptedText] = encrypted.split(':');
  if (!ivText || !tagText || !encryptedText) throw new Error('Saved API key cannot be decrypted.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyToBuffer(secret), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8');
};

export const getCurrentUserAndAdmin = async () => {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { supabase, user: null, isAdmin: false, error: authError?.message || 'Not authenticated.' };

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  return {
    supabase,
    user: authData.user,
    isAdmin: profile?.role === 'admin',
    error: profileError?.message || '',
  };
};

export const loadAiConfig = async () => {
  const supabase = createAdminClient() ?? (await createClient());
  const { data, error } = await supabase
    .from('ai_api_config')
    .select('*')
    .eq('provider', 'openai')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { config: defaultAiConfig, error: error.message };
  }

  return { config: { ...defaultAiConfig, ...(data ?? {}) } as AiConfig, error: '' };
};

export const safeAiConfig = (config: AiConfig) => ({
  provider: config.provider,
  is_enabled: config.is_enabled,
  api_endpoint: config.api_endpoint,
  api_key_source: config.api_key_source,
  api_key_last4: config.api_key_last4,
  api_key_is_configured: config.api_key_is_configured,
  env_key_configured: Boolean(process.env.OPENAI_API_KEY),
  default_model: config.default_model,
  default_system_prompt: config.default_system_prompt,
  procurement_system_prompt: config.procurement_system_prompt,
  max_input_characters: config.max_input_characters,
  max_output_tokens: config.max_output_tokens,
  temperature: config.temperature,
  top_p: config.top_p,
  reasoning_effort: config.reasoning_effort,
  response_format_json: config.response_format_json,
  allow_guest_chat: config.allow_guest_chat,
  allow_file_uploads: config.allow_file_uploads,
  allow_bom_analysis: config.allow_bom_analysis,
  daily_message_limit_per_user: config.daily_message_limit_per_user,
  monthly_token_limit_per_user: config.monthly_token_limit_per_user,
  monthly_budget_usd: config.monthly_budget_usd,
});

export const resolveOpenAIKey = (config: AiConfig) => {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (!config.api_key_encrypted) return '';
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('AI_CONFIG_ENCRYPTION_KEY is missing or too short.');
  return decryptApiKey(config.api_key_encrypted, secret);
};

export const createOpenAIClient = (apiKey: string) => new OpenAI({ apiKey });

export const buildResponseRequest = (config: AiConfig, message: string, previousResponseId?: string | null) => {
  const request: Record<string, unknown> = {
    model: config.default_model,
    instructions: config.procurement_system_prompt || config.default_system_prompt || defaultAiConfig.procurement_system_prompt,
    input: message,
  };
  if (previousResponseId) request.previous_response_id = previousResponseId;
  if (config.max_output_tokens) request.max_output_tokens = config.max_output_tokens;
  if (config.temperature !== null && config.temperature !== undefined) request.temperature = Number(config.temperature);
  if (config.top_p !== null && config.top_p !== undefined) request.top_p = Number(config.top_p);
  if (config.reasoning_effort) request.reasoning = { effort: config.reasoning_effort };
  if (config.response_format_json) request.text = { format: config.response_format_json };
  return request;
};

export const extractResponseText = (response: any) => {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
    .map((content: any) => content.text || content.output_text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
};

export const extractUsage = (response: any) => {
  const usage = response.usage ?? {};
  const input = Number(usage.input_tokens ?? 0);
  const output = Number(usage.output_tokens ?? 0);
  return { input, output, total: Number(usage.total_tokens ?? input + output) };
};
