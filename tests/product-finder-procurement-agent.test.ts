import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseProductIntent } from '../lib/product-finder/intent.ts';
import { runProductFinder } from '../lib/product-finder/orchestrator.ts';

const read=(path:string)=>fs.readFileSync(path,'utf8');
const baseTools={
 searchInternalProducts:async()=>[],
 searchCachedProducts:async()=>[],
 searchOctopartProducts:async()=>[],
 researchPublicProductSources:async()=>[],
 discoverPotentialSuppliers:async()=>[],
};

test('exact MPN punctuation is normalized without a clarification turn',async()=>{
 for(const query of['DRV8353SRTAR','DRV8353SRTAR*','DRV8353SRTAR?','what is DRV8353SRTAR','find DRV8353SRTAR']){
  const intent=parseProductIntent(query);
  assert.equal(intent.partNumber,'DRV8353SRTAR');
  const result=await runProductFinder(intent,baseTools,{candidateFirst:true});
  assert.equal(result.clarificationQuestions.length,0);
  assert.deepEqual(result.sourcingProgress.stagesExecuted.slice(0,4),['internal','cache','octopart','internet']);
 }
});

test('one failed source does not terminate complementary research',async()=>{
 const calls:string[]=[];
 const result=await runProductFinder(parseProductIntent('DRV8353SRTAR'),{
  searchInternalProducts:async()=>{calls.push('internal');throw new Error('catalog unavailable')},
  searchCachedProducts:async()=>{calls.push('cache');return[]},
  searchOctopartProducts:async()=>{calls.push('nexar');throw new Error('quota')},
  researchPublicProductSources:async()=>{calls.push('web');return[{source:'public_manufacturer',sourceReference:'https://ti.com/product/DRV8353',manufacturer:'Texas Instruments',partNumber:'DRV8353SRTAR',productName:'Three-phase smart gate driver',category:'motor gate driver',technicalParameters:{package:'WQFN'},evidenceUrls:['https://ti.com/product/DRV8353'],evidenceTitles:['TI product page'],evidenceExtracts:['DRV8353 product'],verificationStatus:'verified_from_public_source'}]},
  discoverPotentialSuppliers:async()=>[],
 },{candidateFirst:true});
 assert.deepEqual([...calls].sort(),['cache','internal','nexar','web']);
 assert.equal(result.productCandidates[0]?.partNumber,'DRV8353SRTAR');
 assert.equal(result.productCandidates[0]?.compatibility.exactPartNumber,true);
});

test('Responses procurement research requires built-in web search and preserves citations',()=>{
 const source=read('lib/product-finder/server-tools.ts');
 assert.match(source,/tools:\[\{type:'web_search'\}\]/);
 assert.match(source,/tool_choice:'required'/);
 assert.match(source,/include:\['web_search_call\.action\.sources'\]/);
 assert.match(source,/url_citation/);
 assert.match(source,/manufacturer product page and datasheet/);
 for(const distributor of['Mouser','DigiKey','Arrow','Avnet','Newark','Farnell','RS','Future','Findchips','Octopart'])assert.match(source,new RegExp(distributor));
});

test('Found Positions renders persisted source URLs as safe clickable links',()=>{
 const panel=read('app/components/product-finder/ProductFinderPanel.tsx'),detail=read('app/api/product-finder/sessions/[sessionId]/route.ts');
 assert.match(panel,/evidenceUrls/);
 assert.match(panel,/target="_blank" rel="noopener noreferrer"/);
 assert.match(detail,/technical_parameters,evidence,verification_status/);
});

test('Responses agent executes custom calls and returns matching function outputs',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/name:'search_internal_catalog'/);
 assert.match(source,/name:'search_nexar_products'/);
 assert.match(source,/item\?\.type==='function_call'/);
 assert.match(source,/type:'function_call_output',call_id:call\.call_id/);
 assert.match(source,/previous_response_id:response\.id,input:outputs/);
 assert.match(source,/Promise\.all\(calls\.map/);
 assert.match(source,/never stop because one source is empty or failed/);
});

test('strict function schemas contain no arbitrary object properties',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/technicalParameters:\{type:'array',items:technicalParameterSchema\}/);
 assert.match(source,/technicalParameterSchema=.*additionalProperties:false/);
 assert.doesNotMatch(source,/technicalParameters:\{type:'object',additionalProperties:/);
});

test('web search is omitted when internet access is disabled',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/webSearchEnabled\?\[\{type:'web_search',search_context_size:'low'\}\]:\[\]/);
 assert.equal((source.match(/type:'function',name:'search_/g)??[]).length,2);
});

test('agent always receives all enabled tools with automatic sequential routing and JSON output',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/availableTools:any\[\]=\[\.\.\.PRODUCT_FINDER_AGENT_TOOLS,\.\.\.\(input\.configuration\.webSearchEnabled\?\[\{type:'web_search',search_context_size:'low'\}\]/);
 assert.match(source,/tool_choice:'auto',parallel_tool_calls:false/);
 assert.match(source,/webSearchEnabled\?\{\}:\{format:\{type:'json_object'\}\}/);
});

test('OpenAI Web Search is never combined with unsupported JSON mode',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.doesNotMatch(source,/webSearchEnabled\?\['web_search_call\.action\.sources'\]:\[\][^\n]*text:\{format:\{type:'json_object'\}/);
});

test('useful ordinary model text is preserved without a separate formatter call',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/displayText=Array\.isArray\(parsed\.products\).*:finalText/);
 assert.doesNotMatch(source,/Convert the preceding procurement answer into the requested Product Finder JSON object/);
 assert.match(source,/MAX_RESPONSES_CALLS=3/);
 assert.match(source,/assistantMessage:normalizeText\(displayText,12000\)/);
});

test('Found Positions persistence matches the expression index instead of invalid onConflict columns',()=>{
 const route=read('app/api/product-finder/sessions/route.ts');
 assert.doesNotMatch(route,/onConflict:\s*'session_id,source,source_reference'/);
 assert.match(route,/eq\('session_id',session\.id\)\.eq\('source',candidate\.source\)/);
 assert.match(route,/candidate\.sourceReference\?existing\.eq\('source_reference'/);
 assert.match(route,/Product Finder candidate persistence failed/);
});

test('new agent field names preserve an exact public MPN candidate',()=>{
 const source=read('lib/product-finder/discovery.ts');
 assert.match(source,/value\?\.manufacturer\?\?value\?\.proposedManufacturer/);
 assert.match(source,/value\?\.partNumber\?\?value\?\.proposedPartNumber/);
 assert.match(read('lib/product-finder/procurement-agent.ts'),/!normalized\.length&&input\.intent\.partNumber&&citedUrls\.size/);
});

test('Nexar failures are safe and one uncached position cannot trigger a second request',()=>{
 const source=read('lib/product-finder/procurement-agent.ts');
 assert.match(source,/let nexarExecuted=false/);
 assert.match(source,/if\(nexarExecuted\).*Nexar was already queried/s);
 assert.match(source,/nexarExecuted=true;const result=await Promise\.race\(\[searchNexarProducts/);
 assert.match(source,/NEXAR_DEADLINE_MS=3_000/);
 assert.match(source,/Source is temporarily unavailable\. Continue with other tools\./);
 for(const mode of['exact_mpn','partial_mpn','parametric','bom_multi_match'])assert.match(source,new RegExp(mode));
});

test('fast mode is bounded, non-retrying, timed by stage, and preserves partial results',()=>{
 const agent=read('lib/product-finder/procurement-agent.ts'),route=read('app/api/product-finder/sessions/route.ts'),client=read('lib/product-finder/conversation.ts'),panel=read('app/components/product-finder/ProductFinderPanel.tsx');
 for(const marker of['MAX_RESPONSES_CALLS=3','AGENT_DEADLINE_MS=29_000','NEXAR_DEADLINE_MS=3_000','responses.create.','agent.step','agent.total','tool.${call.name}'])assert.match(agent,new RegExp(marker.replace(/[.$]/g,'\\$&')));
 for(const marker of['config.load','supabase.turn_claim','supabase.user_message_save','supabase.result_save','request.total'])assert.match(route,new RegExp(marker));
 assert.match(agent,/maxRetries:0/);assert.match(client,/maxRetries:0/);assert.match(agent,/Search reached its 30-second limit/);
 assert.match(panel,/submitting\.current/);assert.match(route,/PF_TURN_IN_PROGRESS/);
});

test('chat preserves a concise multi-line Product Finder answer',()=>{
 const agent=read('lib/product-finder/procurement-agent.ts'),styles=read('app/globals.css');
 assert.match(agent,/short plain-text paragraphs or labeled lines/);
 assert.match(styles,/Product Finder conversation/);
 assert.match(styles,/white-space: pre-wrap/);
 assert.match(styles,/overflow-wrap: anywhere/);
});
