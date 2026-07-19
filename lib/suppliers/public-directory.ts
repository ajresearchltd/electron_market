export const DIRECTORY_PAGE_SIZES=[12,24,48] as const;
export const DIRECTORY_SORTS=['recommended','verified','response','minimum-order','lead-time','newest','name-asc','name-desc'] as const;
export type DirectorySort=(typeof DIRECTORY_SORTS)[number];

const text=(value:unknown,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
const integer=(value:unknown,fallback:number)=>{if(value===null||value===undefined||value==='')return fallback;const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=0?parsed:fallback};
const list=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0):[];

export function parseDirectoryQuery(params:URLSearchParams){
 const pageSizeValue=integer(params.get('pageSize'),24);
 const sortValue=text(params.get('sort'),30);
 return{q:text(params.get('q'),80).replace(/[^\p{L}\p{N}\s.&/+\-]/gu,' '),country:text(params.get('country'),80),supplierType:text(params.get('supplierType'),80),category:text(params.get('category'),100),brand:text(params.get('brand'),100),capability:text(params.get('capability'),120),language:text(params.get('language'),40),currency:text(params.get('currency'),3).toUpperCase(),deliveryRegion:text(params.get('deliveryRegion'),100),verified:params.get('verified')==='true',minOrderMax:integer(params.get('minOrderMax'),-1),leadTimeMax:integer(params.get('leadTimeMax'),-1),sort:(DIRECTORY_SORTS as readonly string[]).includes(sortValue)?sortValue as DirectorySort:'recommended',page:Math.max(1,integer(params.get('page'),1)),pageSize:(DIRECTORY_PAGE_SIZES as readonly number[]).includes(pageSizeValue)?pageSizeValue:24};
}

export function publicDirectorySupplier(row:any,productCount=0){
 const capabilities=[...list(row.manufacturing_capabilities),...list(row.engineering_capabilities),...list(row.testing_capabilities),...list(row.quality_control_capabilities),...list(row.custom_sourcing_capabilities),...list(row.additional_capabilities)];
 return{publicSlug:text(row.public_slug,180),displayName:text(row.public_display_name||row.name,250)||'Verified Supplier',logoUrl:text(row.pic,2000)||null,shortDescription:text(row.public_short_description,500)||null,country:text(row.public_country,120)||null,city:text(row.public_city,120)||null,supplierType:text(row.public_supplier_type,120)||null,categories:text(row.public_categories,1000)||null,brands:text(row.public_brands,1000)||null,languages:list(row.supported_languages),minimumOrder:typeof row.minimum_order_value==='number'?row.minimum_order_value:null,minimumOrderCurrency:text(row.minimum_order_currency,3)||null,leadTimeMinDays:Number.isInteger(row.typical_lead_time_min_days)?row.typical_lead_time_min_days:null,leadTimeMaxDays:Number.isInteger(row.typical_lead_time_max_days)?row.typical_lead_time_max_days:null,responseTimeHours:Number.isInteger(row.response_time_hours)?row.response_time_hours:null,incoterms:list(row.public_incoterms),currencies:text(row.preferred_currencies,200)||null,deliveryCoverage:text(row.delivery_countries||row.regions_served,1000)||null,capabilities:capabilities.slice(0,8),verified:true,publicProductCount:productCount};
}

export const DIRECTORY_PUBLIC_COLUMNS='supplier_id,canonical_supplier_id,public_slug,name,pic,public_display_name,public_short_description,public_country,public_city,public_supplier_type,public_categories,public_brands,supported_languages,minimum_order_value,minimum_order_currency,typical_lead_time_min_days,typical_lead_time_max_days,response_time_hours,public_incoterms,preferred_currencies,regions_served,delivery_countries,manufacturing_capabilities,engineering_capabilities,testing_capabilities,quality_control_capabilities,custom_sourcing_capabilities,additional_capabilities,is_active,is_public,show_public_website,show_on_homepage,public_directory_sort_order,public_profile_updated_at,suppliers!inner(supplier_status)';
