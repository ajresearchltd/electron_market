import type{ProductFinderResponse,SupplierCandidate}from'./contracts.ts';
const hidden=new Set(['companyName','companyWebsite','publicContactPage','publicSalesEmail','publicGeneralEmail','publicPhone','sourceUrls','canonicalSupplierId','openaiConversationId','openai_conversation_id','openaiLastResponseId','openai_last_response_id']);
export function anonymizeCustomerPayload<T>(value:T):T{return JSON.parse(JSON.stringify(value,(key,item)=>hidden.has(key)?undefined:item))}
export function customerSupplierProgress(suppliers:SupplierCandidate[],sent=0,replies=0){return{potentialSources:suppliers.length,outreachSent:sent,responsesReceived:replies,message:suppliers.length?`${suppliers.length} potential supply source${suppliers.length===1?' was':'s were'} identified.`:'Manual Procurement research is required.'}}
export function customerSafeResponse(response:ProductFinderResponse){return anonymizeCustomerPayload(response)}
export const supplierAlias=(index:number)=>`Supplier ${String.fromCharCode(65+Math.max(0,index))}`;
