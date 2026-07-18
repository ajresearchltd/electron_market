import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierEmailResponseSchema,validateStrictStructuredOutputSchema,validateStructuredSupplierEmail} from '../lib/supplier-email/schema.ts';

test('supplier email schema is recursively strict',()=>{
  assert.deepEqual(validateStrictStructuredOutputSchema(supplierEmailResponseSchema),[]);
  const item=(supplierEmailResponseSchema.properties.items as any).items;
  assert.ok(item.properties.technicalParameters);
  assert.ok(item.required.includes('technicalParameters'));
  const parameter=item.properties.technicalParameters.items;
  assert.deepEqual([...parameter.required].sort(),Object.keys(parameter.properties).sort());
  assert.equal(parameter.additionalProperties,false);
});

test('missing part number and incomplete commercial terms are valid',()=>{
  const schema:any=supplierEmailResponseSchema;
  const nullableObject=(node:any):any=>Object.fromEntries(Object.entries(node.properties).map(([key,value]:any)=>[key,value.type==='array'?[]:value.type==='object'?nullableObject(value):value.enum?value.enum[0]:value.anyOf?null:value.type==='number'?key==='extractionConfidence'?0.8:null:null]));
  const value=nullableObject(schema);const item=nullableObject(schema.properties.items.items);
  item.responseStatus='offered';item.extractionConfidence=.9;item.originalProductName='N-channel power MOSFET';item.offeredMpn=null;
  item.technicalParameters=[{name:'Voltage',value:'100',unit:'V',sourceText:'100 V'},{name:'Package',value:'TO-220AB',unit:null,sourceText:'TO-220AB'}];
  value.responseType='partial_offer';value.responseRelationship='new';value.remainingItemsStatus='not_mentioned';value.items=[item];
  assert.deepEqual(validateStructuredSupplierEmail(value).errors,[]);
});
