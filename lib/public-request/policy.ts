export const EMAIL_OTP_LENGTH=8;
export function validCanonicalEmailOtp(value:unknown){return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(String(value??''))}
export function normalizePublicRequestEmail(value:unknown){return String(value??'').trim().toLowerCase()}
export function validPublicRequestEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254}
export function validatePublicEnquiry(type:string,payload:any){
 if(type==='individual_product'){
  if(!String(payload.partNumber??'').trim()&&!String(payload.description??'').trim())return'Enter a Part Number or a clearly identifying product description.';
  if(payload.quantity!==undefined&&(!Number.isInteger(Number(payload.quantity))||Number(payload.quantity)<=0||Number(payload.quantity)>1000000000))return'Quantity must be a positive whole number.';
  if(payload.targetPrice&&(!Number.isFinite(Number(payload.targetPrice))||Number(payload.targetPrice)<0))return'Target price must be zero or greater.';
  if(payload.currency&&!/^[A-Z]{3}$/.test(String(payload.currency).trim().toUpperCase()))return'Currency must be a three-letter code.';
  if(payload.requiredDeliveryDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.requiredDeliveryDate))||new Date(`${payload.requiredDeliveryDate}T00:00:00Z`).getTime()<Date.now()-86400000))return'Required delivery date must be today or later.';
  for(const key of['title','manufacturer','partNumber','destinationCountry'])if(String(payload[key]??'').length>200)return`${key} is too long.`;
  if(String(payload.description??'').length>5000)return'Description is too long.';
  return null;
 }
 if(type==='general_goods'){if(Number(payload.estimatedBudget)<7500)return'The minimum estimated order value for this request type is USD 7,500.';for(const key of['productName','description','quantity','country','timeframe'])if(!String(payload[key]??'').trim())return'Complete all required general-goods fields.';return null}
 if(type==='project'){if(Number(payload.estimatedBudget)<40000)return'The minimum estimated project value is USD 40,000.';for(const key of['title','description','objective','equipment','engineeringScope','country','timeframe'])if(!String(payload[key]??'').trim())return'Complete all required project fields.';return null}
 return'Unsupported request type.';
}
