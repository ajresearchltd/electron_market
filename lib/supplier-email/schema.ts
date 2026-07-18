export const responseTypes = ['full_offer','partial_offer','availability_only','clarification','decline','amendment','replacement','other'] as const;
export const relationships = ['new','replacement','amendment','clarification','unknown'] as const;
export const remainingStatuses = ['explicitly_unavailable','not_mentioned','unknown'] as const;
export const itemStatuses = ['offered','partial_quantity','unavailable','alternative_proposed','clarification_required','rejected'] as const;
export const leadUnits = ['days','business_days','weeks','months','unknown'] as const;

const nullableString = {type:['string','null']} as const;
const nullableNumber = {type:['number','null']} as const;
const nullableBoolean = {type:['boolean','null']} as const;
const strictObject=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)} as const);
const nullableEnum=(values:readonly string[])=>({anyOf:[{type:'string',enum:values},{type:'null'}]} as const);

const sourceReferenceSchema=strictObject({attachmentId:nullableString,sheetName:nullableString,sourceRowNumber:nullableNumber,pageNumber:nullableNumber,sourceText:nullableString});
const technicalParameterSchema=strictObject({name:nullableString,value:nullableString,unit:nullableString,sourceText:nullableString});
const commercialTermsSchema=strictObject({incoterms:nullableString,paymentTerms:nullableString,quotationValidity:nullableString,freightTerms:nullableString,insuranceTerms:nullableString,taxTerms:nullableString,packaging:nullableString,deliveryConditions:nullableString});
const priceBreakSchema=strictObject({minimumQuantity:nullableNumber,priceAmount:nullableNumber,currency:nullableString});

const supplierItemSchema=strictObject({
  sourceReference:sourceReferenceSchema,
  requestedMpn:nullableString,requestedManufacturer:nullableString,
  originalProductName:nullableString,productType:nullableString,
  technicalParameters:{type:'array',items:technicalParameterSchema},
  commercialTerms:commercialTermsSchema,
  requestedQuantityRaw:nullableString,requestedQuantityNormalized:nullableNumber,
  responseStatus:{type:'string',enum:itemStatuses},
  offeredMpn:nullableString,offeredManufacturer:nullableString,
  offeredQuantityRaw:nullableString,offeredQuantityNormalized:nullableNumber,
  availableQuantityRaw:nullableString,availableQuantityNormalized:nullableNumber,
  priceRaw:nullableString,priceAmount:nullableNumber,priceBasisQuantity:nullableNumber,
  priceBasisUnit:nullableString,packageQuantity:nullableNumber,calculatedUnitPrice:nullableNumber,
  currency:nullableString,priceBreaks:{type:'array',items:priceBreakSchema},
  moqRaw:nullableString,moqNormalized:nullableNumber,
  leadTimeRaw:nullableString,leadTimeValue:nullableNumber,leadTimeUnit:nullableEnum(leadUnits),
  leadTimeDaysNormalized:nullableNumber,stockConfirmed:nullableBoolean,
  dateCodeRaw:nullableString,dateCodeNormalized:nullableString,
  condition:nullableEnum(['new','used','refurbished','unknown']),
  certificateAvailable:nullableBoolean,traceabilityAvailable:nullableBoolean,
  supplierComment:nullableString,extractionConfidence:{type:'number',minimum:0,maximum:1},
  extractionWarnings:{type:'array',items:{type:'string'}},
});

export const supplierEmailResponseSchema = strictObject({
  procurementNumber:nullableString,
  responseType:{type:'string',enum:responseTypes},
  responseRelationship:{type:'string',enum:relationships},
  defaultCurrency:nullableString,
  quoteValidUntilRaw:nullableString,
  quoteValidUntilNormalized:nullableString,
  remainingItemsStatus:{type:'string',enum:remainingStatuses},
  supplierGeneralMessage:nullableString,
  items:{type:'array',items:supplierItemSchema},
  generalWarnings:{type:'array',items:{type:'string'}},
});

export type TechnicalParameter={name:string|null;value:string|null;unit:string|null;sourceText:string|null};
export type ParsedSupplierEmail=Record<string,any>&{items:Array<Record<string,any>&{technicalParameters:TechnicalParameter[]}>;generalWarnings:string[]};

export function validateStrictStructuredOutputSchema(schema:unknown,path='schema'):string[]{
  const errors:string[]=[];
  const visit=(node:any,at:string)=>{
    if(!node||typeof node!=='object'||Array.isArray(node)){errors.push(`${at} must be a schema object.`);return}
    if(node.anyOf){if(!Array.isArray(node.anyOf)||!node.anyOf.length)errors.push(`${at}.anyOf must be a non-empty array.`);else node.anyOf.forEach((child:any,index:number)=>visit(child,`${at}.anyOf[${index}]`));return}
    const types=Array.isArray(node.type)?node.type:[node.type];
    if(types.includes('object')){
      if(!node.properties||typeof node.properties!=='object'||Array.isArray(node.properties))errors.push(`${at}.properties must be an object.`);
      const keys=Object.keys(node.properties??{}),required=node.required;
      if(!Array.isArray(required))errors.push(`${at}.required must be an array.`);
      else if([...keys].sort().join('|')!==[...required].sort().join('|'))errors.push(`${at}.required must contain every property exactly once and no unknown keys.`);
      if(node.additionalProperties!==false)errors.push(`${at}.additionalProperties must be false.`);
      for(const key of keys)visit(node.properties[key],`${at}.properties.${key}`);
    }
    if(types.includes('array')){if(!node.items||typeof node.items!=='object')errors.push(`${at}.items must be a schema object.`);else visit(node.items,`${at}.items`)}
  };
  visit(schema,path);return errors;
}

function validateValue(value:any,schema:any,path:string,errors:string[]){
  if(schema.anyOf){const valid=schema.anyOf.some((candidate:any)=>{const local:string[]=[];validateValue(value,candidate,path,local);return !local.length});if(!valid)errors.push(`${path} has an invalid value.`);return}
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  if(value===null){if(!types.includes('null'))errors.push(`${path} cannot be null.`);return}
  const actual=Array.isArray(value)?'array':typeof value;
  if(!types.includes(actual)){errors.push(`${path} must be ${types.join(' or ')}.`);return}
  if(actual==='object'){const keys=Object.keys(schema.properties??{});for(const key of keys)if(!Object.prototype.hasOwnProperty.call(value,key))errors.push(`${path}.${key} is required.`);for(const key of Object.keys(value))if(!keys.includes(key))errors.push(`${path}.${key} is not allowed.`);for(const key of keys)if(Object.prototype.hasOwnProperty.call(value,key))validateValue(value[key],schema.properties[key],`${path}.${key}`,errors)}
  if(actual==='array')value.forEach((entry:any,index:number)=>validateValue(entry,schema.items,`${path}[${index}]`,errors));
  if(schema.enum&&!schema.enum.includes(value))errors.push(`${path} has an unsupported value.`);
  if(typeof value==='number'&&(!Number.isFinite(value)||(schema.minimum!=null&&value<schema.minimum)||(schema.maximum!=null&&value>schema.maximum)))errors.push(`${path} has an invalid number.`);
}

export function validateStructuredSupplierEmail(value:unknown):{value?:ParsedSupplierEmail;errors:string[]}{
  const errors:string[]=[];validateValue(value,supplierEmailResponseSchema,'result',errors);
  return errors.length?{errors}:{value:value as ParsedSupplierEmail,errors:[]};
}

export function assertSupplierEmailSchemaIsStrict(){const errors=validateStrictStructuredOutputSchema(supplierEmailResponseSchema);if(errors.length)throw new Error(`Supplier email Structured Output schema is invalid: ${errors.join(' ')}`)}
