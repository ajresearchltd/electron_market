import { NextRequest, NextResponse } from 'next/server';
import { defaultProcurementPreferences, normalizeProcurementPreferences } from '../../../../../../lib/procurement-preferences';
import { createClient } from '../../../../../../lib/supabase/server';

const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
async function context(uploadId:string){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {error:fail('Authentication required.',401)};
  const {data:upload,error}=await supabase.from('customer_bom_uploads').select('id,user_id,procurement_chain_id').eq('id',uploadId).eq('user_id',user.id).maybeSingle();
  if(error)return {error:fail('Order preferences could not be loaded.',500)}; if(!upload?.procurement_chain_id)return {error:fail('This BOM is not linked to a procurement chain.',409)};
  const {data:chain}=await supabase.from('procurement_chains').select('id,customer_user_id').eq('id',upload.procurement_chain_id).eq('customer_user_id',user.id).maybeSingle();
  if(!chain)return {error:fail('BOM upload not found.',404)};
  return {supabase,user,upload,chain};
}
export async function GET(_:NextRequest,{params}:{params:Promise<{uploadId:string}>}){
  const {uploadId}=await params; const ctx=await context(uploadId); if(ctx.error)return ctx.error;
  const {data,error}=await ctx.supabase!.from('procurement_order_preferences').select('*').eq('procurement_chain_id',ctx.chain!.id).maybeSingle();
  if(error)return fail('Order preferences could not be loaded.',500);
  const {data:countries}=await ctx.supabase!.from('countries').select('iso2,name').order('name');
  return NextResponse.json({preferences:data?normalizeProcurementPreferences(data):defaultProcurementPreferences,procurement_chain_id:ctx.chain!.id,exists:Boolean(data),countries:countries||[]});
}
export async function PUT(request:NextRequest,{params}:{params:Promise<{uploadId:string}>}){
  const {uploadId}=await params; const ctx=await context(uploadId); if(ctx.error)return ctx.error;
  let preferences; try{preferences=normalizeProcurementPreferences(await request.json());}catch(error){return fail(error instanceof Error?error.message:'Invalid preferences.');}
  if(preferences.supplier_countries.length){const {data,error}=await ctx.supabase!.from('countries').select('iso2').in('iso2',preferences.supplier_countries);if(error||new Set((data||[]).map((row:any)=>String(row.iso2).toUpperCase())).size!==preferences.supplier_countries.length)return fail('One or more supplier countries are invalid.');}
  const {data,error}=await ctx.supabase!.from('procurement_order_preferences').upsert({...preferences,procurement_chain_id:ctx.chain!.id,bom_upload_id:ctx.upload!.id,customer_user_id:ctx.user!.id},{onConflict:'procurement_chain_id'}).select('*').single();
  if(error)return fail('Order preferences could not be saved.',500);
  return NextResponse.json({preferences:normalizeProcurementPreferences(data),procurement_chain_id:ctx.chain!.id});
}
