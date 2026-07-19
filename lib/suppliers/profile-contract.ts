export const PUBLIC_PROFILE_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'suspended'] as const;
export type PublicProfileStatus = (typeof PUBLIC_PROFILE_STATUSES)[number];

export type SupplierProfileColumns = {
  public_display_name: string | null;
  public_short_description: string | null;
  public_detailed_description: string | null;
  country_name: string | null;
  public_city: string | null;
  public_supplier_type: string | null;
  public_brands: string | null;
  public_categories: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  regions_served: string | null;
  delivery_countries: string | null;
  preferred_currencies: string | null;
  website: string | null;
  employee_count: number | null;
  supported_languages: string[] | null;
  minimum_order_value: number | null;
  minimum_order_currency: string | null;
  typical_lead_time_min_days: number | null;
  typical_lead_time_max_days: number | null;
  response_time_hours: number | null;
  public_incoterms: string[] | null;
  public_payment_terms: string | null;
  manufacturing_capabilities: string[] | null;
  engineering_capabilities: string[] | null;
  testing_capabilities: string[] | null;
  quality_control_capabilities: string[] | null;
  custom_sourcing_capabilities: string[] | null;
  additional_capabilities: string[] | null;
  public_profile_status: PublicProfileStatus;
  pending_review_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  decision_reason: string | null;
  admin_notes: string | null;
};

export type SupplierCompanyProfileEditableData = {
  publicDisplayName: string;
  publicShortDescription: string;
  publicDetailedDescription: string;
  country: string;
  city: string;
  supplierType: string;
  brands: string;
  categories: string;
  logoUrl: string;
  coverImageUrl: string;
  regionsServed: string;
  deliveryCountries: string;
  preferredCurrencies: string;
  website: string;
  employeeCount: number | null;
  supportedLanguages: string[];
  minimumOrderValue: number | null;
  minimumOrderCurrency: string;
  typicalLeadTimeMinDays: number | null;
  typicalLeadTimeMaxDays: number | null;
  responseTimeHours: number | null;
  publicIncoterms: string[];
  publicPaymentTerms: string;
  manufacturingCapabilities: string[];
  engineeringCapabilities: string[];
  testingCapabilities: string[];
  qualityControlCapabilities: string[];
  customSourcingCapabilities: string[];
  additionalCapabilities: string[];
};

export type AdminPublicProfileReviewData = SupplierCompanyProfileEditableData & {
  status: PublicProfileStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  rejectionReason: string;
  reviewNotes: string;
  completionPercent: number;
};

export type ApprovedVerifiedSupplierPublicData = SupplierCompanyProfileEditableData;

export type VerifiedSupplierPublicColumns = {
  public_display_name:string|null; public_short_description:string|null; public_detailed_description:string|null;
  public_country:string|null; public_city:string|null; public_supplier_type:string|null; public_brands:string|null;
  public_categories:string|null; pic:string|null; cover_image_url:string|null; regions_served:string|null;
  delivery_countries:string|null; preferred_currencies:string|null; public_website_url:string|null; employee_count:number|null;
  supported_languages:string[]|null; minimum_order_value:number|null; minimum_order_currency:string|null;
  typical_lead_time_min_days:number|null; typical_lead_time_max_days:number|null; response_time_hours:number|null;
  public_incoterms:string[]|null; public_payment_terms:string|null; manufacturing_capabilities:string[]|null;
  engineering_capabilities:string[]|null; testing_capabilities:string[]|null; quality_control_capabilities:string[]|null;
  custom_sourcing_capabilities:string[]|null; additional_capabilities:string[]|null;
};

const text = (value: unknown) => typeof value === 'string' ? value : '';
const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function mapSupplierProfile(row: Partial<SupplierProfileColumns>): SupplierCompanyProfileEditableData {
  return {
    publicDisplayName:text(row.public_display_name), publicShortDescription:text(row.public_short_description),
    publicDetailedDescription:text(row.public_detailed_description), country:text(row.country_name), city:text(row.public_city),
    supplierType:text(row.public_supplier_type), brands:text(row.public_brands), categories:text(row.public_categories),
    logoUrl:text(row.logo_url), coverImageUrl:text(row.cover_image_url), regionsServed:text(row.regions_served),
    deliveryCountries:text(row.delivery_countries), preferredCurrencies:text(row.preferred_currencies), website:text(row.website),
    employeeCount:numberOrNull(row.employee_count), supportedLanguages:list(row.supported_languages),
    minimumOrderValue:numberOrNull(row.minimum_order_value), minimumOrderCurrency:text(row.minimum_order_currency),
    typicalLeadTimeMinDays:numberOrNull(row.typical_lead_time_min_days), typicalLeadTimeMaxDays:numberOrNull(row.typical_lead_time_max_days),
    responseTimeHours:numberOrNull(row.response_time_hours), publicIncoterms:list(row.public_incoterms),
    publicPaymentTerms:text(row.public_payment_terms), manufacturingCapabilities:list(row.manufacturing_capabilities),
    engineeringCapabilities:list(row.engineering_capabilities), testingCapabilities:list(row.testing_capabilities),
    qualityControlCapabilities:list(row.quality_control_capabilities), customSourcingCapabilities:list(row.custom_sourcing_capabilities),
    additionalCapabilities:list(row.additional_capabilities),
  };
}

export function mapVerifiedSupplierPublic(row: Partial<VerifiedSupplierPublicColumns>): ApprovedVerifiedSupplierPublicData {
  return mapSupplierProfile({
    public_display_name:row.public_display_name,public_short_description:row.public_short_description,
    public_detailed_description:row.public_detailed_description,country_name:row.public_country,public_city:row.public_city,
    public_supplier_type:row.public_supplier_type,public_brands:row.public_brands,public_categories:row.public_categories,
    logo_url:row.pic,cover_image_url:row.cover_image_url,regions_served:row.regions_served,
    delivery_countries:row.delivery_countries,preferred_currencies:row.preferred_currencies,website:row.public_website_url,
    employee_count:row.employee_count,supported_languages:row.supported_languages,minimum_order_value:row.minimum_order_value,
    minimum_order_currency:row.minimum_order_currency,typical_lead_time_min_days:row.typical_lead_time_min_days,
    typical_lead_time_max_days:row.typical_lead_time_max_days,response_time_hours:row.response_time_hours,
    public_incoterms:row.public_incoterms,public_payment_terms:row.public_payment_terms,
    manufacturing_capabilities:row.manufacturing_capabilities,engineering_capabilities:row.engineering_capabilities,
    testing_capabilities:row.testing_capabilities,quality_control_capabilities:row.quality_control_capabilities,
    custom_sourcing_capabilities:row.custom_sourcing_capabilities,additional_capabilities:row.additional_capabilities,
  });
}

/** Supplier-editable columns only; workflow and private review fields are excluded. */
export function toSupplierProfileColumns(data: SupplierCompanyProfileEditableData) {
  return {
    public_display_name:data.publicDisplayName,public_short_description:data.publicShortDescription,
    public_detailed_description:data.publicDetailedDescription,country_name:data.country,public_city:data.city,
    public_supplier_type:data.supplierType,public_brands:data.brands,public_categories:data.categories,
    logo_url:data.logoUrl,cover_image_url:data.coverImageUrl,regions_served:data.regionsServed,
    delivery_countries:data.deliveryCountries,preferred_currencies:data.preferredCurrencies,website:data.website,
    employee_count:data.employeeCount,supported_languages:data.supportedLanguages,minimum_order_value:data.minimumOrderValue,
    minimum_order_currency:data.minimumOrderCurrency||null,typical_lead_time_min_days:data.typicalLeadTimeMinDays,
    typical_lead_time_max_days:data.typicalLeadTimeMaxDays,response_time_hours:data.responseTimeHours,
    public_incoterms:data.publicIncoterms,public_payment_terms:data.publicPaymentTerms,
    manufacturing_capabilities:data.manufacturingCapabilities,engineering_capabilities:data.engineeringCapabilities,
    testing_capabilities:data.testingCapabilities,quality_control_capabilities:data.qualityControlCapabilities,
    custom_sourcing_capabilities:data.customSourcingCapabilities,additional_capabilities:data.additionalCapabilities,
  };
}

export function mapAdminPublicProfileReview(row: SupplierProfileColumns): AdminPublicProfileReviewData {
  const editable = mapSupplierProfile(row);
  return {...editable,status:row.public_profile_status,submittedAt:row.pending_review_at,reviewedAt:row.reviewed_at,
    updatedAt:row.updated_at,rejectionReason:text(row.decision_reason),reviewNotes:text(row.admin_notes),
    completionPercent:derivePublicProfileCompletion(editable)};
}

const completionFields: (keyof SupplierCompanyProfileEditableData)[] = [
  'publicDisplayName','publicShortDescription','publicDetailedDescription','country','supplierType','categories','supportedLanguages',
  'minimumOrderValue','typicalLeadTimeMinDays','typicalLeadTimeMaxDays','publicIncoterms','regionsServed','deliveryCountries',
];

/** Derived, never accepted from a browser or persisted during Phase 2. */
export function derivePublicProfileCompletion(data: SupplierCompanyProfileEditableData): number {
  const completed=completionFields.filter(key=>{const value=data[key];return Array.isArray(value)?value.length>0:value!==null&&value!==''}).length;
  return Math.round(completed/completionFields.length*100);
}

export type ProfileValidationResult = {ok:true;value:SupplierCompanyProfileEditableData}|{ok:false;errors:string[]};
const arrayRules: Array<[keyof SupplierCompanyProfileEditableData,number,number]> = [
  ['supportedLanguages',20,40],['publicIncoterms',20,40],['manufacturingCapabilities',30,120],
  ['engineeringCapabilities',30,120],['testingCapabilities',30,120],['qualityControlCapabilities',30,120],
  ['customSourcingCapabilities',30,120],['additionalCapabilities',30,120],
];

export function validateSupplierProfile(input: SupplierCompanyProfileEditableData): ProfileValidationResult {
  const errors:string[]=[];
  const nonNegative:[keyof SupplierCompanyProfileEditableData,number|null][]=[
    ['employeeCount',input.employeeCount],['minimumOrderValue',input.minimumOrderValue],
    ['typicalLeadTimeMinDays',input.typicalLeadTimeMinDays],['typicalLeadTimeMaxDays',input.typicalLeadTimeMaxDays],
    ['responseTimeHours',input.responseTimeHours],
  ];
  for(const [key,value] of nonNegative)if(value!==null&&(!Number.isFinite(value)||value<0))errors.push(`${key} must be non-negative.`);
  for(const [key,value] of nonNegative.filter(([key])=>key!=='minimumOrderValue'))if(value!==null&&!Number.isInteger(value))errors.push(`${key} must be an integer.`);
  if(input.typicalLeadTimeMinDays!==null&&input.typicalLeadTimeMaxDays!==null&&input.typicalLeadTimeMinDays>input.typicalLeadTimeMaxDays)errors.push('typicalLeadTimeMinDays must not exceed typicalLeadTimeMaxDays.');
  if(input.minimumOrderCurrency&&!/^[A-Z]{3}$/.test(input.minimumOrderCurrency))errors.push('minimumOrderCurrency must be a three-letter uppercase code.');
  const currencies=input.preferredCurrencies.split(',').map(value=>value.trim()).filter(Boolean);
  if(currencies.length>20||currencies.some(value=>!/^[A-Z]{3}$/.test(value)))errors.push('preferredCurrencies must contain at most 20 uppercase three-letter codes.');
  if(input.publicShortDescription.length>500)errors.push('publicShortDescription is too long.');
  if(input.publicDetailedDescription.length>10000)errors.push('publicDetailedDescription is too long.');
  if(input.publicPaymentTerms.length>2000)errors.push('publicPaymentTerms is too long.');
  if(input.regionsServed.length>2000||input.deliveryCountries.length>2000)errors.push('Delivery coverage text is too long.');
  for(const [key,maxItems,maxLength] of arrayRules){const values=input[key] as string[];if(values.length>maxItems)errors.push(`${key} has too many items.`);if(values.some(value=>!value.trim()||value.length>maxLength))errors.push(`${key} contains an invalid item.`);if(new Set(values.map(value=>value.trim().toLowerCase())).size!==values.length)errors.push(`${key} contains duplicates.`)}
  return errors.length?{ok:false,errors}:{ok:true,value:input};
}

export const REQUIRED_PUBLIC_PROFILE_FIELDS: Array<[keyof SupplierCompanyProfileEditableData,string]> = [
  ['publicDisplayName','Public display name'],['publicShortDescription','Public short description'],
  ['publicDetailedDescription','Public full description'],['country','Country'],['supplierType','Supplier type'],
  ['categories','Product category or specialization'],['supportedLanguages','Supported language'],
];

export function missingRequiredPublicProfileFields(data:SupplierCompanyProfileEditableData):string[]{
  return REQUIRED_PUBLIC_PROFILE_FIELDS.filter(([key])=>{const value=data[key];return Array.isArray(value)?value.length===0:value===null||String(value).trim()===''}).map(([,label])=>label);
}

/** The only Supplier-owned values that may cross into an approved public snapshot. */
export function toVerifiedSupplierPublicColumns(data:SupplierCompanyProfileEditableData){
  return {name:data.publicDisplayName,public_display_name:data.publicDisplayName,public_short_description:data.publicShortDescription,
    public_detailed_description:data.publicDetailedDescription,public_country:data.country,public_city:data.city,
    public_supplier_type:data.supplierType,public_brands:data.brands,public_categories:data.categories,pic:data.logoUrl||null,
    cover_image_url:data.coverImageUrl||null,regions_served:data.regionsServed,delivery_countries:data.deliveryCountries,
    preferred_currencies:data.preferredCurrencies,public_website_url:data.website||null,employee_count:data.employeeCount,
    supported_languages:data.supportedLanguages,minimum_order_value:data.minimumOrderValue,minimum_order_currency:data.minimumOrderCurrency||null,
    typical_lead_time_min_days:data.typicalLeadTimeMinDays,typical_lead_time_max_days:data.typicalLeadTimeMaxDays,
    response_time_hours:data.responseTimeHours,public_incoterms:data.publicIncoterms,public_payment_terms:data.publicPaymentTerms,
    manufacturing_capabilities:data.manufacturingCapabilities,engineering_capabilities:data.engineeringCapabilities,
    testing_capabilities:data.testingCapabilities,quality_control_capabilities:data.qualityControlCapabilities,
    custom_sourcing_capabilities:data.customSourcingCapabilities,additional_capabilities:data.additionalCapabilities,
    public_profile_updated_at:new Date().toISOString(),has_pending_public_changes:false};
}

export function isPublicProfileStatus(value: unknown): value is PublicProfileStatus {
  return typeof value==='string'&&(PUBLIC_PROFILE_STATUSES as readonly string[]).includes(value);
}
