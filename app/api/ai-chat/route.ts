import { NextRequest, NextResponse } from 'next/server';
import { buildResponseRequest, createOpenAIClient, extractResponseText, extractUsage, loadAiConfig, resolveOpenAIKey } from '../../../lib/ai/config';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const selectVisibleMessages = async (supabase: any, chatSessionId: string) => {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, message_order, turn_number, openai_response_id, previous_response_id, status, error_message, created_at')
    .eq('chat_session_id', chatSessionId)
    .order('message_order', { ascending: true });
  return { data: data ?? [], error };
};

export async function GET(request: NextRequest) {
  const chatSessionId = request.nextUrl.searchParams.get('chat_session_id') || '';
  if (!chatSessionId) return jsonError('chat_session_id is required.');

  const userSupabase = await createClient();
  const supabase = createAdminClient() ?? userSupabase;
  const { data: session, error: sessionError } = await supabase
    .from('ai_chat_sessions')
    .select('id, chat_number, latest_response_id')
    .eq('id', chatSessionId)
    .maybeSingle();
  if (sessionError) return jsonError(`ai_chat_sessions: ${sessionError.message}`, 500);
  if (!session) return jsonError('Chat session not found.', 404);

  const { data: messages, error: messagesError } = await selectVisibleMessages(supabase, chatSessionId);
  if (messagesError) return jsonError(`ai_chat_messages: ${messagesError.message}`, 500);

  return NextResponse.json({
    chat_session_id: session.id,
    chat_number: session.chat_number,
    latest_response_id: session.latest_response_id,
    messages,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  const chatSessionId = body.chat_session_id ? String(body.chat_session_id) : '';
  const guestSessionId = body.guest_session_id ? String(body.guest_session_id) : '';
  const chatType = String(body.chat_type || 'procurement');

  const { config, error: configError } = await loadAiConfig();
  if (configError && !config) return jsonError(configError, 500);
  if (!config.is_enabled) return jsonError('AI chat is disabled.', 403);
  if (!message) return jsonError('Message is required.');
  if (message.length > config.max_input_characters) return jsonError(`Message is too long. Maximum is ${config.max_input_characters} characters.`);

  const userSupabase = await createClient();
  const supabase = createAdminClient() ?? userSupabase;
  const { data: authData } = await userSupabase.auth.getUser();
  const userId = authData.user?.id ?? null;
  if (!userId && !config.allow_guest_chat) return jsonError('Please sign in to use AI chat.', 401);
  if (!userId && !guestSessionId) return jsonError('Guest session is required.', 400);

  let apiKey = '';
  try {
    apiKey = resolveOpenAIKey(config);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to resolve OpenAI API key.', 500);
  }
  if (!apiKey) return jsonError('OpenAI API key is not configured.', 500);

  let session: any = null;
  if (chatSessionId) {
    const { data, error } = await supabase.from('ai_chat_sessions').select('*').eq('id', chatSessionId).maybeSingle();
    if (error) return jsonError(`ai_chat_sessions: ${error.message}`, 500);
    if (!data) return jsonError('Chat session not found.', 404);
    session = data;
  } else {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .insert({
        user_id: userId,
        guest_session_id: userId ? null : guestSessionId,
        title: message.slice(0, 80),
        chat_type: chatType,
        model: config.default_model,
        api_provider: config.provider,
        system_prompt_snapshot: config.procurement_system_prompt || config.default_system_prompt,
        model_parameters_snapshot: {
          max_output_tokens: config.max_output_tokens,
          temperature: config.temperature,
          top_p: config.top_p,
          reasoning_effort: config.reasoning_effort,
          response_format_json: config.response_format_json,
        },
        metadata: {},
      })
      .select('*')
      .single();
    if (error) return jsonError(`ai_chat_sessions insert: ${error.message}`, 500);
    session = data;
  }

  const previousResponseId = session.latest_response_id || null;
  const currentCount = Number(session.message_count || 0);
  const userMessageOrder = currentCount + 1;
  const assistantMessageOrder = currentCount + 2;
  const turnNumber = Math.floor(currentCount / 2) + 1;
  const requestPayload = buildResponseRequest(config, message, previousResponseId);

  const { data: userMessage, error: userMessageError } = await supabase
    .from('ai_chat_messages')
    .insert({
      chat_session_id: session.id,
      chat_number: session.chat_number,
      user_id: userId,
      guest_session_id: userId ? null : guestSessionId,
      message_order: userMessageOrder,
      turn_number: turnNumber,
      role: 'user',
      content: message,
      previous_response_id: previousResponseId,
      model: config.default_model,
      request_payload_json: requestPayload,
      status: 'completed',
    })
    .select('*')
    .single();
  if (userMessageError) return jsonError(`ai_chat_messages user insert: ${userMessageError.message}`, 500);

  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create(requestPayload as any);
    const responseId = response.id;
    const assistantText = extractResponseText(response) || 'I could not generate a response.';
    const usage = extractUsage(response);

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('ai_chat_messages')
      .insert({
        chat_session_id: session.id,
        chat_number: session.chat_number,
        user_id: userId,
        guest_session_id: userId ? null : guestSessionId,
        message_order: assistantMessageOrder,
        turn_number: turnNumber,
        role: 'assistant',
        content: assistantText,
        openai_response_id: responseId,
        previous_response_id: previousResponseId,
        model: config.default_model,
        request_payload_json: requestPayload,
        response_payload_json: response,
        status: 'completed',
        input_tokens: usage.input,
        output_tokens: usage.output,
        total_tokens: usage.total,
      })
      .select('*')
      .single();
    if (assistantMessageError) return jsonError(`ai_chat_messages assistant insert: ${assistantMessageError.message}`, 500);

    const { error: updateError } = await supabase
      .from('ai_chat_sessions')
      .update({
        first_response_id: session.first_response_id || responseId,
        latest_response_id: responseId,
        message_count: assistantMessageOrder,
        total_input_tokens: Number(session.total_input_tokens || 0) + usage.input,
        total_output_tokens: Number(session.total_output_tokens || 0) + usage.output,
        total_tokens: Number(session.total_tokens || 0) + usage.total,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
    if (updateError) return jsonError(`ai_chat_sessions update: ${updateError.message}`, 500);

    const { data: messages, error: messagesError } = await selectVisibleMessages(supabase, session.id);
    if (messagesError) return jsonError(`ai_chat_messages: ${messagesError.message}`, 500);

    return NextResponse.json({
      chat_session_id: session.id,
      chat_number: session.chat_number,
      messages,
      user_message: userMessage,
      assistant_message: assistantMessage,
      response_id: responseId,
      latest_response_id: responseId,
      previous_response_id: previousResponseId,
      message_order: { user: userMessageOrder, assistant: assistantMessageOrder },
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'OpenAI request failed.';
    const { data: assistantErrorMessage } = await supabase.from('ai_chat_messages').insert({
      chat_session_id: session.id,
      chat_number: session.chat_number,
      user_id: userId,
      guest_session_id: userId ? null : guestSessionId,
      message_order: assistantMessageOrder,
      turn_number: turnNumber,
      role: 'assistant',
      content: 'OpenAI request failed.',
      previous_response_id: previousResponseId,
      model: config.default_model,
      request_payload_json: requestPayload,
      status: 'error',
      error_message: messageText,
    }).select('*').single();

    const { data: messages } = await selectVisibleMessages(supabase, session.id);
    return NextResponse.json({
      error: messageText,
      chat_session_id: session.id,
      chat_number: session.chat_number,
      messages: messages ?? [userMessage, assistantErrorMessage].filter(Boolean),
      user_message: userMessage,
      assistant_message: assistantErrorMessage,
      latest_response_id: previousResponseId,
      previous_response_id: previousResponseId,
      message_order: { user: userMessageOrder, assistant: assistantMessageOrder },
    }, { status: 500 });
  }
}
