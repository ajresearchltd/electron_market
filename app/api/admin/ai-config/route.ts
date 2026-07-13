import { NextRequest, NextResponse } from 'next/server';
import { defaultAiConfig, encryptApiKey, getCurrentUserAndAdmin, loadAiConfig, safeAiConfig } from '../../../../lib/ai/config';

const errorJson = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const { isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin) return errorJson(error || 'Admin access required.', 403);

  const { config, error: configError } = await loadAiConfig();
  if (configError) return errorJson(configError, 500);
  return NextResponse.json({ config: safeAiConfig(config) });
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin || !user) return errorJson(error || 'Admin access required.', 403);

  const body = await request.json().catch(() => ({}));
  const { config: existing } = await loadAiConfig();
  const apiKey = String(body.api_key || '').trim();
  const payload: Record<string, unknown> = {
    provider: 'openai',
    is_enabled: Boolean(body.is_enabled),
    api_endpoint: String(body.api_endpoint || defaultAiConfig.api_endpoint),
    default_model: String(body.default_model || defaultAiConfig.default_model),
    default_system_prompt: body.default_system_prompt ? String(body.default_system_prompt) : null,
    procurement_system_prompt: body.procurement_system_prompt ? String(body.procurement_system_prompt) : null,
    max_input_characters: Number(body.max_input_characters || defaultAiConfig.max_input_characters),
    max_output_tokens: body.max_output_tokens ? Number(body.max_output_tokens) : null,
    temperature: body.temperature !== '' && body.temperature !== null && body.temperature !== undefined ? Number(body.temperature) : null,
    top_p: body.top_p !== '' && body.top_p !== null && body.top_p !== undefined ? Number(body.top_p) : null,
    reasoning_effort: body.reasoning_effort ? String(body.reasoning_effort) : null,
    response_format_json: body.response_format_json || null,
    allow_guest_chat: Boolean(body.allow_guest_chat),
    allow_file_uploads: Boolean(body.allow_file_uploads),
    allow_bom_analysis: Boolean(body.allow_bom_analysis),
    daily_message_limit_per_user: Number(body.daily_message_limit_per_user || 50),
    monthly_token_limit_per_user: body.monthly_token_limit_per_user ? Number(body.monthly_token_limit_per_user) : null,
    monthly_budget_usd: body.monthly_budget_usd ? Number(body.monthly_budget_usd) : null,
    updated_by: user.id,
  };

  if (apiKey) {
    if (!apiKey.startsWith('sk-')) return errorJson('OpenAI API key must start with sk-.');
    const secret = process.env.AI_CONFIG_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) return errorJson('AI_CONFIG_ENCRYPTION_KEY is missing or too short. API key was not saved.', 500);
    payload.api_key_source = 'encrypted';
    payload.api_key_encrypted = encryptApiKey(apiKey, secret);
    payload.api_key_last4 = apiKey.slice(-4);
    payload.api_key_is_configured = true;
  } else {
    payload.api_key_source = process.env.OPENAI_API_KEY ? 'env' : existing.api_key_source;
    payload.api_key_encrypted = existing.api_key_encrypted;
    payload.api_key_last4 = existing.api_key_last4;
    payload.api_key_is_configured = Boolean(process.env.OPENAI_API_KEY) || Boolean(existing.api_key_is_configured);
  }

  const query = existing.id
    ? supabase.from('ai_api_config').update(payload).eq('id', existing.id).select('*').single()
    : supabase.from('ai_api_config').insert(payload).select('*').single();

  const { data, error: saveError } = await query;
  if (saveError) return errorJson(saveError.message, 500);
  return NextResponse.json({ config: safeAiConfig({ ...defaultAiConfig, ...data }) });
}
