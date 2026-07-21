import { NextResponse } from 'next/server';
import { getCurrentUserAndAdmin } from '../../../../lib/ai/config';
import { createRequiredAdminClient } from '../../../../lib/supabase/admin';
import { defaultProductFinderResponsesApiConfiguration, getEffectiveProductFinderResponsesApiConfiguration, normalizeProductFinderResponsesApiConfiguration, productFinderSafeRequestPreview, PRODUCT_FINDER_APPROVED_MODELS, validateProductFinderResponsesApiConfiguration } from '../../../../lib/product-finder/ai-configuration';

const fail = (error:string, status=400, errors?:string[]) => NextResponse.json({ error, ...(errors ? { errors } : {}) }, { status, headers:{ 'cache-control':'private, no-store' } });
async function admin(){const actor=await getCurrentUserAndAdmin();return actor.isAdmin&&actor.user?actor:null}
const rpcRow=(data:any)=>Array.isArray(data)?data[0]??null:data??null;
const safeDatabaseFailure=(error:any,operation:string)=>console.error('Product Finder AI configuration database failure',{operation,code:String(error?.code??''),message:String(error?.message??'').slice(0,500)});
function activationFailure(error:any){
  const code=String(error?.code??'');
  const message=String(error?.message??'');
  if(code==='PGRST202'||code==='42883'||/publish_product_finder_ai_configuration/i.test(message)&&/schema cache|does not exist|could not find/i.test(message))return fail('Product Finder configuration database update is required. Ask an administrator to apply the latest Supabase migration, then try again.',503);
  if(code==='42501'||/Admin access required/i.test(message))return fail('Your administrator session could not authorize this change. Sign in again and retry.',403);
  if(code==='23505'||code==='40001'||code==='40P01')return fail('The configuration changed during saving. Reload the page and try again.',409);
  return fail('The configuration could not be activated. The previous active configuration is still in use.',500);
}

export async function GET(){
  const actor=await admin();if(!actor)return fail('Admin access required.',403);
  const db=createRequiredAdminClient(),effective=await getEffectiveProductFinderResponsesApiConfiguration(db);
  return NextResponse.json({configuration:effective.responsesApi,defaults:defaultProductFinderResponsesApiConfiguration,approvedModels:PRODUCT_FINDER_APPROVED_MODELS,capabilities:{reasoningEffort:['','low','medium','high'],verbosity:['low','medium','high'],webSearch:true,toolChoice:['auto','required'],parallelToolCalls:true,storeResponses:true,temperature:false,topP:false},effectiveRequest:productFinderSafeRequestPreview(effective.responsesApi),sdkVersion:'6.45.0',publishedAt:effective.metadata?.published_at??null},{headers:{'cache-control':'private, no-store'}});
}

export async function POST(request:Request){
  const actor=await admin();if(!actor)return fail('Admin access required.',403);
  const body=await request.json().catch(()=>({})),action=String(body.action||''),checked=validateProductFinderResponsesApiConfiguration(body.configuration);
  if(action==='validate')return NextResponse.json(checked,{status:checked.valid?200:422});
  if(action==='defaults')return NextResponse.json({configuration:defaultProductFinderResponsesApiConfiguration,effectiveRequest:productFinderSafeRequestPreview(defaultProductFinderResponsesApiConfiguration)});
  if(action!=='save')return fail('Unsupported configuration action.',400);
  if(!checked.valid)return fail('Configuration is invalid.',422,checked.errors);

  const stored={responsesApi:normalizeProductFinderResponsesApiConfiguration(checked.configuration)};
  // Use the authenticated user's client: the SECURITY DEFINER RPC deliberately verifies auth.uid().
  const published=await actor.supabase.rpc('publish_product_finder_ai_configuration',{p_configuration:stored});
  if(published.error){safeDatabaseFailure(published.error,'atomic_publish');return activationFailure(published.error)}
  const returned=rpcRow(published.data);
  if(!returned?.id){safeDatabaseFailure({code:'PF_EMPTY_RPC_RESULT',message:'RPC returned no active row'},'atomic_publish');return fail('The configuration activation could not be verified. The previous active configuration is still in use.',500)}

  // Re-read through the server client so refresh and Product Finder runtime use the same published row.
  const db=createRequiredAdminClient(),active=await db.from('product_finder_ai_config_versions').select('id,status,configuration,published_at').eq('configuration_key','product_finder').eq('status','published');
  if(active.error){safeDatabaseFailure(active.error,'verify_active');return fail('The configuration was saved, but its activation could not be verified. Reload the page before retrying.',500)}
  if(active.data?.length!==1||active.data[0].id!==returned.id){safeDatabaseFailure({code:'PF_ACTIVE_INVARIANT',message:`Expected one active row; received ${active.data?.length??0}`},'verify_active');return fail('The configuration was saved, but the active version is inconsistent. The Product Finder has not switched settings.',500)}
  const configuration=normalizeProductFinderResponsesApiConfiguration(active.data[0].configuration);
  return NextResponse.json({configuration,effectiveRequest:productFinderSafeRequestPreview(configuration),publishedAt:active.data[0].published_at,message:'Finder AI configuration saved and activated.'},{headers:{'cache-control':'private, no-store'}});
}
