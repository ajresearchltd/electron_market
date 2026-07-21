import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const panel = () => read('app/components/product-finder/ProductFinderPanel.tsx');
const listRoute = () => read('app/api/product-finder/sessions/route.ts');
const detailRoute = () => read('app/api/product-finder/sessions/[sessionId]/route.ts');
const newRoute = () => read('app/api/product-finder/sessions/new/route.ts');

test('history is upper-right and positions are lower-right on desktop, with mobile history first', () => {
  const source = panel();
  assert.ok(source.indexOf('Conversation History') < source.indexOf('AI Product Finder'));
  assert.ok(source.indexOf('AI Product Finder') < source.indexOf('Found Positions'));
  assert.match(source, /lg:col-start-2 lg:row-start-1/);
  assert.match(source, /lg:col-start-2 lg:row-start-2/);
  assert.match(source, /lg:col-start-1 lg:row-span-2/);
});

test('conversation list is authenticated, owner-scoped, stably ordered and paginated', () => {
  const source = listRoute();
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /\.eq\('owner_user_id', user\.id\)/);
  assert.match(source, /Math\.min\(50/);
  assert.match(source, /pageSize.*'20'/);
  assert.match(source, /order\('updated_at', \{ ascending: false \}\)\.order\('id', \{ ascending: true \}\)/);
  assert.match(source, /\{ items: items\.map/);
});

test('history payload exposes safe local metadata and no OpenAI or supplier-discovery fields', () => {
  const source = listRoute();
  for (const field of ['sessionId', 'title', 'preview', 'messageCount', 'candidateCount', 'isActive']) assert.match(source, new RegExp(field));
  const getHandler = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'));
  assert.doesNotMatch(getHandler, /product_supplier_candidates|product_sourcing_outreach|public_sales_email/);
  assert.doesNotMatch(getHandler, /openai_conversation_id|openai_last_response_id/);
});

test('session detail is owner-scoped and filters both messages and candidates by local session', () => {
  const source = detailRoute();
  assert.match(source, /\.eq\('id',sessionId\)\.eq\('owner_user_id',user\.id\)/);
  assert.equal((source.match(/\.eq\('session_id',sessionId\)/g) ?? []).length, 2);
  assert.match(source, /finder_user_message','finder_assistant_message/);
  assert.match(source, /order\('created_at'\)\.order\('id'\)/);
});

test('detail response excludes private conversation and response identifiers', () => {
  const source = detailRoute();
  const response = source.slice(source.indexOf('const session='));
  assert.doesNotMatch(response, /openai_conversation_id|openai_last_response_id|previous_response_id/);
  assert.doesNotMatch(response, /product_supplier_candidates|product_sourcing_outreach/);
});

test('selecting a legacy session reconstructs its conversation once server-side', () => {
  const source = detailRoute();
  assert.match(source, /if\(!row\.data\.openai_conversation_id\)/);
  assert.match(source, /ensureProductFinderConversation/);
  assert.doesNotMatch(panel(), /conversations\.create|openaiConversationId/);
});

test('new conversation creates an empty owned session and initializes a server conversation', () => {
  const source = newRoute();
  assert.match(source, /owner_user_id:user\.id/);
  assert.match(source, /ensureProductFinderConversation/);
  assert.match(source, /messages:\[\],candidates:\[\]/);
  assert.match(source, /initial_client_turn_id:clientTurnId/);
});

test('new-conversation endpoint rejects browser-managed conversation identifiers', () => {
  const source = newRoute();
  for (const field of ['openaiConversationId', 'conversation_id', 'responseId', 'previousResponseId']) assert.match(source, new RegExp(field));
  assert.match(source, /Conversation identifiers are server-managed/);
});

test('support access remains explicit on list, detail and create endpoints', () => {
  for (const source of [listRoute(), detailRoute(), newRoute()]) {
    assert.match(source, /product_finder_internal_authorizations/);
    assert.match(source, /can_access_discovery/);
  }
});

test('selection clears stale messages and candidates and ignores stale responses', () => {
  const source = panel();
  assert.match(source, /selectionAbort\.current\?\.abort\(\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /version!==selectionVersion\.current\|\|selectedId\.current!==id/);
  assert.match(source, /setMessages\(\[\]\);setResponse\(null\);setSession\(null\)/);
});

test('continuation captures the selected local session and sends only safe turn fields', () => {
  const source = panel();
  assert.match(source, /targetSessionId=session\?\.id\?\?null/);
  assert.match(source, /JSON\.stringify\(\{message,sessionId:targetSessionId,clientTurnId\}\)/);
  assert.doesNotMatch(source, /previousResponseId|openaiConversationId|ownerUserId/);
});

test('empty New conversation state creates no server session or history row', () => {
  const source = panel(), action = source.slice(source.indexOf('const newConversation='), source.indexOf('return <section'));
  assert.doesNotMatch(action, /fetch\(|updateHistoryPreview|setHistory/);
  assert.match(action, /setSession\(null\);setMessages\(\[\]\);setResponse\(null\)/);
});

test('first saved user message creates and selects its titled history row', () => {
  const source = panel(), ok = source.indexOf("if(!request.ok)throw"), row = source.indexOf('updateHistoryPreview(value.session.id,message', ok);
  assert.ok(ok > -1 && row > ok);
  assert.match(source, /title:session\?\.title\|\|message\.slice\(0,100\)/);
  assert.match(source, /selectedId\.current=value\.session\.id/);
  assert.match(source, /updateUrl\(value\.session\.id,true\)/);
});

test('history preview updates for the saved user turn and assistant reply', () => {
  const source = panel();
  assert.match(source, /updateHistoryPreview\(value\.session\.id,message/);
  assert.match(source, /updateHistoryPreview\(value\.session\.id,value\.response\.assistantMessage/);
  assert.match(source, /return\[next,\.\.\.current\.filter/);
});

test('each history row is exactly two clamped high-contrast text lines', () => {
  const source = panel();
  const row = source.slice(source.indexOf('filteredHistory.map'), source.indexOf('</button>})', source.indexOf('filteredHistory.map')));
  assert.equal((row.match(/line-clamp-1/g) ?? []).length, 2);
  assert.doesNotMatch(row, /line-clamp-2/);
  assert.match(row, /text-white/);
  assert.match(row, /text-blue-100/);
});

test('Conversation History uses light text on a dark-blue background', () => {
  const source = panel(), history = source.slice(source.indexOf('Conversation History') - 500, source.indexOf('AI Product Finder'));
  assert.match(history, /bg-blue-950/);
  assert.match(history, /text-blue-50/);
  assert.match(history, /text-cyan-100/);
});

test('composer renders above the newest-first message history', () => {
  const source = panel(), chat = source.indexOf('AI Product Finder'), composer = source.indexOf('<form onSubmit={submit}', chat), history = source.indexOf('aria-label="Product Finder conversation"', chat);
  assert.ok(composer > chat && history > composer);
  assert.match(source, /setMessages\(current=>\[\{id:crypto\.randomUUID\(\),role:'assistant'[^]*role:'user'[^]*\.\.\.current\]\)/);
  assert.match(source, /\.map\(\(message:any\)=>[^]*\)\.reverse\(\)/);
  assert.match(source, /conversationStart\.current\?\.scrollIntoView\(\{block:'start'\}\)/);
  assert.match(source, /Save and continue/);
});

test('user and AI bubbles use distinct accessible light-blue and dark-purple palettes', () => {
  const source = panel();
  assert.match(source, /bg-blue-100 text-slate-950/);
  assert.match(source, /bg-purple-900 text-white/);
  assert.doesNotMatch(source, /message\.role==='user'\?'[^']*bg-blue-700 text-white/);
});

test('refresh and browser navigation use only the local Product Finder session ID', () => {
  const source = panel();
  assert.match(source, /searchParams\.set\('productFinderSession',id\)/);
  assert.match(source, /replaceState/);
  assert.match(source, /pushState/);
  assert.match(source, /popstate/);
  assert.doesNotMatch(source, /conv_/);
});

test('conversation rows and loading states are keyboard and screen-reader accessible', () => {
  const source = panel();
  assert.match(source, /aria-current=\{active\?'true':undefined\}/);
  assert.match(source, /aria-label="Start a new Product Finder conversation"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /focus:ring-2/);
});

test('existing migration 047 already provides unique conversation and turn idempotency storage', () => {
  const sql = read('database/047_run_in_supabase_sql_editor_add_product_finder_openai_conversation_state.sql');
  assert.match(sql, /openai_conversation_uidx/);
  assert.match(sql, /owner_user_id, initial_client_turn_id/);
  assert.match(sql, /product_search_events_user_turn_uidx/);
  assert.match(sql, /product_search_events_assistant_turn_uidx/);
  assert.equal(fs.existsSync('database/048_run_in_supabase_sql_editor_add_product_finder_conversation_history.sql'), false);
});
