import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NexarQuotaError,getNexarRuntimeTokenStatus,nexarGraphqlRequest,resetNexarAuthenticationForTests} from '../lib/market-data/nexar.ts';

const originalFetch=globalThis.fetch;
const originalEnv={manual:process.env.NEXAR_ACCESS_TOKEN,id:process.env.NEXAR_CLIENT_ID,secret:process.env.NEXAR_CLIENT_SECRET};
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const restore=(key:string,value:string|undefined)=>{if(value===undefined)delete process.env[key];else process.env[key]=value};
afterEach(()=>{globalThis.fetch=originalFetch;restore('NEXAR_ACCESS_TOKEN',originalEnv.manual);restore('NEXAR_CLIENT_ID',originalEnv.id);restore('NEXAR_CLIENT_SECRET',originalEnv.secret);resetNexarAuthenticationForTests()});

test('NEXAR_ACCESS_TOKEN is ignored and client credentials always supply the Bearer token',async()=>{
  process.env.NEXAR_ACCESS_TOKEN='ignored-manual-token';process.env.NEXAR_CLIENT_ID='client';process.env.NEXAR_CLIENT_SECRET='secret';let oauthCalls=0,graphqlCalls=0;
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/connect/token')){oauthCalls++;assert.match(String(init?.body),/grant_type=client_credentials/);assert.match(String(init?.body),/scope=supply\.domain/);return jsonResponse({access_token:'generated-oauth-token',expires_in:3600})}graphqlCalls++;assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer generated-oauth-token');assert.notEqual(new Headers(init?.headers).get('Authorization'),'Bearer ignored-manual-token');return jsonResponse({data:{ok:true}})};
  assert.deepEqual(await nexarGraphqlRequest('query Test { ok }',{}),{ok:true});assert.equal(oauthCalls,1);assert.equal(graphqlCalls,1);assert.equal(getNexarRuntimeTokenStatus().tokenSource,'client_credentials');
});

test('OAuth token is cached until shortly before expiration',async()=>{
  process.env.NEXAR_CLIENT_ID='client';process.env.NEXAR_CLIENT_SECRET='secret';let oauthCalls=0,graphqlCalls=0;
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/connect/token')){oauthCalls++;return jsonResponse({access_token:'cached-oauth-token',expires_in:3600})}graphqlCalls++;assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer cached-oauth-token');return jsonResponse({data:{ok:true}})};
  await nexarGraphqlRequest('query One { ok }',{});await nexarGraphqlRequest('query Two { ok }',{});assert.equal(oauthCalls,1);assert.equal(graphqlCalls,2);
});

test('AuthExpiredToken clears OAuth cache, refreshes, and retries exactly once',async()=>{
  process.env.NEXAR_CLIENT_ID='client';process.env.NEXAR_CLIENT_SECRET='secret';let oauthCalls=0,graphqlCalls=0;
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/connect/token')){oauthCalls++;return jsonResponse({access_token:`oauth-token-${oauthCalls}`,expires_in:3600})}graphqlCalls++;const auth=new Headers(init?.headers).get('Authorization');return graphqlCalls===1?(assert.equal(auth,'Bearer oauth-token-1'),jsonResponse({errors:[{extensions:{code:'AuthExpiredToken'}}]},401)):(assert.equal(auth,'Bearer oauth-token-2'),jsonResponse({data:{ok:true}}))};
  assert.deepEqual(await nexarGraphqlRequest('query Test { ok }',{}),{ok:true});assert.equal(oauthCalls,2);assert.equal(graphqlCalls,2);
});

test('PART_LIMIT_EXCEEDED does not refresh OAuth',async()=>{
  process.env.NEXAR_CLIENT_ID='client';process.env.NEXAR_CLIENT_SECRET='secret';let oauthCalls=0,graphqlCalls=0;
  globalThis.fetch=async(url)=>{if(String(url).includes('/connect/token')){oauthCalls++;return jsonResponse({access_token:'oauth-token',expires_in:3600})}graphqlCalls++;return jsonResponse({errors:[{message:'Part limit exceeded',extensions:{code:'PART_LIMIT_EXCEEDED'}}]})};
  await assert.rejects(()=>nexarGraphqlRequest('query Test { ok }',{}),NexarQuotaError);assert.equal(oauthCalls,1);assert.equal(graphqlCalls,1);
});

test('tokens and credentials stay out of browser code, payload contracts, and logs',()=>{
  for(const file of['app/components/product-finder/ProductFinderPanel.tsx','app/api/product-finder/sessions/route.ts'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/NEXAR_(?:ACCESS_TOKEN|CLIENT_ID|CLIENT_SECRET)|Authorization\s*:/);
  const source=fs.readFileSync('lib/market-data/nexar.ts','utf8');assert.doesNotMatch(source,/process\.env\.NEXAR_ACCESS_TOKEN|manual_access_token|console\.(?:log|error|warn)\s*\(/);
});

test('all four router modes use the central OAuth GraphQL client',()=>{const router=fs.readFileSync('lib/product-finder/nexar-router.ts','utf8');assert.match(router,/options\.execute\?\?nexarGraphqlRequest/);for(const mode of['exact_mpn','partial_mpn','parametric','bom_multi_match'])assert.match(router,new RegExp(mode));assert.doesNotMatch(router,/NEXAR_(?:ACCESS_TOKEN|CLIENT_ID|CLIENT_SECRET)|Authorization\s*:/)});
