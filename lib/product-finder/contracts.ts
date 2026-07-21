export const PRODUCT_SEARCH_STATES = ['interpreting','needs_clarification','searching_internal','internal_candidates_found','searching_octopart','octopart_candidates_found','researching_internet','identifying_potential_products','discovering_suppliers','verifying_supplier_contacts','preparing_outreach','awaiting_admin_approval','sending_outreach','awaiting_supplier_responses','comparing_candidates','awaiting_customer_selection','product_confirmed','sourcing_request_ready','completed','failed'] as const;
export type ProductSearchState = typeof PRODUCT_SEARCH_STATES[number];
export type ProductCandidateSource = 'internal'|'octopart'|'public_manufacturer'|'public_distributor'|'ai_unverified';
export type VerificationStatus = 'verified_from_public_source'|'partially_verified'|'unverified_ai_suggestion'|'rejected_conflict';
export type CandidateType = 'exact_match'|'compatible_match'|'possible_alternative';

export type ProductSearchIntent = {
 rawQuery:string; category:string|null; manufacturer:string|null; partNumber:string|null; productName:string|null; intendedFunction:string|null;
 quantity:number|null; targetPrice:number|null; currency:string|null; destinationCountry:string|null; requiredDate:string|null;
 parameters:Record<string,string>; preferredPackage:string|null; compliance:string[]; lifecyclePreference:string|null;
 alternativesAllowed:boolean|null; approvedManufacturers:string[]; excludedManufacturers:string[]; missingRequiredFields:string[]; confidence:number;
};
export type Compatibility = {overallScore:number;exactPartNumber:boolean;manufacturerMatch:boolean;categoryMatch:boolean;matchedParameters:string[];missingParameters:string[];conflicts:string[];candidateType:CandidateType};
export type ProductCandidate = {id?:string;source:ProductCandidateSource;sourceReference:string|null;manufacturer:string|null;partNumber:string|null;productName:string;category:string|null;technicalParameters:Record<string,string>;evidenceUrls:string[];evidenceTitles:string[];evidenceExtracts:string[];verificationStatus:VerificationStatus;compatibility:Compatibility};
export type SupplierCandidate = {id?:string;canonicalSupplierId:string|null;companyName:string;companyWebsite:string|null;supplierType:string;country:string|null;publicContactPage:string|null;publicSalesEmail:string|null;publicGeneralEmail:string|null;publicPhone:string|null;sourceUrls:string[];contactVerificationStatus:'verified_public'|'verified_existing'|'unverified'|'rejected';productEvidence:string[];discoveryConfidence:number;doNotContact:boolean};
export type ProductFinderResponse = {assistantMessage:string;nextState:ProductSearchState;extractedIntent:ProductSearchIntent;clarificationQuestions:string[];productCandidates:ProductCandidate[];sourcingProgress:{stagesExecuted:string[];potentialSources:number;outreachSent:number;responsesReceived:number};permittedActions:string[]};

const text=(value:unknown,max=500)=>{const result=String(value??'').trim();return result?result.slice(0,max):null};
const list=(value:unknown,max=20)=>Array.isArray(value)?[...new Set(value.map(v=>text(v,200)).filter(Boolean) as string[])].slice(0,max):[];
export function validateProductSearchIntent(value:any):ProductSearchIntent{
 const rawQuery=text(value?.rawQuery,4000);if(!rawQuery)throw new Error('A product requirement is required.');
 const number=(input:unknown)=>input===null||input===undefined||input===''?null:Number(input);
 const quantity=number(value?.quantity),targetPrice=number(value?.targetPrice);if(quantity!==null&&(!Number.isFinite(quantity)||!Number.isInteger(quantity)||quantity<=0||quantity>1_000_000_000))throw new Error('Quantity must be a positive whole number.');if(targetPrice!==null&&(!Number.isFinite(targetPrice)||targetPrice<0))throw new Error('Target price must be zero or greater.');
 const currencyRaw=String(value?.currency??'').trim().toUpperCase(),currency=currencyRaw||null;if(currency&&!/^[A-Z]{3}$/.test(currency))throw new Error('Currency must be a three-letter code.');
 const parameters:Record<string,string>={};if(value?.parameters&&typeof value.parameters==='object'&&!Array.isArray(value.parameters))for(const [key,item] of Object.entries(value.parameters).slice(0,40)){const k=text(key,80),v=text(item,300);if(k&&v)parameters[k]=v}
 const confidence=Math.max(0,Math.min(1,Number(value?.confidence)||0));
 return{rawQuery,category:text(value.category,120),manufacturer:text(value.manufacturer,200),partNumber:text(value.partNumber,200),productName:text(value.productName,250),intendedFunction:text(value.intendedFunction,1000),quantity,targetPrice,currency,destinationCountry:text(value.destinationCountry,120),requiredDate:text(value.requiredDate,10),parameters,preferredPackage:text(value.preferredPackage,120),compliance:list(value.compliance),lifecyclePreference:text(value.lifecyclePreference,120),alternativesAllowed:typeof value.alternativesAllowed==='boolean'?value.alternativesAllowed:null,approvedManufacturers:list(value.approvedManufacturers),excludedManufacturers:list(value.excludedManufacturers),missingRequiredFields:list(value.missingRequiredFields),confidence};
}

export function validateState(value:unknown):ProductSearchState{if(!PRODUCT_SEARCH_STATES.includes(value as ProductSearchState))throw new Error('Invalid product-search state transition.');return value as ProductSearchState}
const TERMINAL=new Set<ProductSearchState>(['completed']);
export function assertProductSearchTransition(from:ProductSearchState|null,to:ProductSearchState){validateState(to);if(from&&TERMINAL.has(from)&&to!==from)throw new Error('A completed product-search session cannot be reopened by the model.');return to}
