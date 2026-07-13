import { NextResponse } from 'next/server';
import { buildResponseRequest, createOpenAIClient, extractResponseText, getCurrentUserAndAdmin, loadAiConfig, resolveOpenAIKey } from '../../../../../lib/ai/config';

const errorJson = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST() {
  const { isAdmin, error } = await getCurrentUserAndAdmin();
  if (!isAdmin) return errorJson(error || 'Admin access required.', 403);

  const { config, error: configError } = await loadAiConfig();
  if (configError) return errorJson(configError, 500);

  let apiKey = '';
  try {
    apiKey = resolveOpenAIKey(config);
  } catch (resolveError) {
    return errorJson(resolveError instanceof Error ? resolveError.message : 'Unable to resolve OpenAI API key.', 500);
  }
  if (!apiKey) return errorJson('OpenAI API key is not configured.', 500);

  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.responses.create(buildResponseRequest(config, 'Reply with OK') as any);
    return NextResponse.json({ success: true, response_id: response.id, text: extractResponseText(response) });
  } catch (testError) {
    return errorJson(testError instanceof Error ? testError.message : 'OpenAI test failed.', 500);
  }
}
