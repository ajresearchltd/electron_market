import {NextResponse} from 'next/server';
import {requireAdminApi} from '../../../../../../lib/auth/require-admin-api';
import {resolveCanonicalSupplierId} from '../../../../../../lib/suppliers/canonical';
const denied={error:'admin_authorization_required',message:'Administrator authorization is required.'};
export async function POST(request:Request,{params}:{params:Promise<{supplierId:string}>}){
 const auth=await requireAdminApi();if('error'in auth)return NextResponse.json(auth.status===403?denied:{error:auth.status===401?'authentication_required':'server_error',message:auth.error},{status:auth.status});
 let identity;try{identity=await resolveCanonicalSupplierId(auth.admin,(await params).supplierId)}catch{return NextResponse.json({error:'Supplier relationship could not be resolved.'},{status:409})}
 if(!identity)return NextResponse.json({error:'Supplier relationship could not be resolved.'},{status:404});
 const body=await request.json().catch(()=>({}));const result=await auth.sessionClient.rpc('promote_supply_hub_supplier',{p_profile_id:identity.sourceProfileId,p_settings:body.settings??{}});
 if(result.error){
  console.error('Supplier promotion failed:',result.error);
  if(result.error.message==='Admin authorization required')return NextResponse.json(denied,{status:403});
  if(result.error.message==='Supplier must be approved before promotion'||result.error.message==='Mandatory verification checklist items are incomplete')return NextResponse.json({error:'validation_error',message:result.error.message},{status:400});
  if(result.error.message==='Supplier profile not found')return NextResponse.json({error:'supplier_not_found',message:'Supplier profile was not found.'},{status:404});
  return NextResponse.json({error:'supplier_promotion_failed',message:'Supplier could not be promoted.'},{status:500});
 }
 return NextResponse.json({canonicalSupplierId:identity.canonicalSupplierId,promotion:result.data});
}
