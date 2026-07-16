import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '../../../../lib/supabase/admin';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const database=createAdminClient();if(!database)return NextResponse.json({error:'Supplier directory is temporarily unavailable.'},{status:503});
 const scope=request.nextUrl.searchParams.get('scope')==='homepage'?'homepage':'directory';
 let query=database.from('verified_supplier').select('supplier_id,canonical_supplier_id,public_slug,name,pic,delivery_product,public_short_description,public_country,homepage_sort_order').eq('is_active',true).eq('is_public',true);
 query=scope==='homepage'?query.eq('show_on_homepage',true).limit(4):query.eq('show_public_website',true);
 const suppliers=await query.order(scope==='homepage'?'homepage_sort_order':'public_directory_sort_order',{ascending:true,nullsFirst:false}).order('name',{ascending:true});
 if(suppliers.error){console.error('Public suppliers query failed:',suppliers.error.message);return NextResponse.json({error:'Supplier directory is temporarily unavailable.'},{status:500})}
 const visible=suppliers.data??[];const canonicalIds=visible.map(row=>row.canonical_supplier_id).filter(Boolean) as string[];
 const ids=visible.map(row=>row.supplier_id);const detailMap=new Map<string,any>();const countMap=new Map<string,number>();
 if(ids.length){const details=await database.from('verified_supplier_details').select('supplier_id,display_name,city,product_categories').in('supplier_id',ids);if(details.error)console.error('Public supplier profile query failed:',details.error.message);for(const row of details.data??[])detailMap.set(row.supplier_id,row)}
 if(canonicalIds.length){const products=await database.from('products').select('supplier_id').in('supplier_id',canonicalIds).eq('is_public',true).eq('review_status','approved').eq('product_status','active');for(const row of products.data??[])countMap.set(row.supplier_id,(countMap.get(row.supplier_id)??0)+1)}
 const publicRows=visible.map(row=>{const detail=detailMap.get(row.supplier_id);return {slug:row.public_slug,name:detail?.display_name||row.name||'Verified Supplier',logoUrl:row.pic||null,description:row.public_short_description||null,country:row.public_country||null,city:detail?.city||null,categories:detail?.product_categories||null,specialization:row.delivery_product||null,productCount:row.canonical_supplier_id?countMap.get(row.canonical_supplier_id)??0:0,verified:true}});
 return NextResponse.json({suppliers:publicRows},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
}
