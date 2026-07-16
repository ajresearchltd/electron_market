import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Node's strip-types test runner requires the explicit extension.
import {renderCanonicalInvoicePdf} from '../lib/invoices/render-invoice-pdf.ts';

const items=Array.from({length:45},(_,index)=>({requestedMpn:`DYNAMIC-${index+1}`,offeredMpn:`OFFER-${index+1}`,
 description:`A long canonical commercial description for position ${index+1} that must wrap without clipping across a multi-page Invoice document.`,manufacturer:'Fixture Manufacturer',quantity:index+1,quantityUnit:'pcs',currency:'EUR',selectedUnitPrice:2.5,priceBasisQuantity:1,priceBasisUnit:'pcs',lineTotal:(index+1)*2.5,leadTimeDays:7,condition:'New'}));
const model:any={invoice:{invoiceNumber:'PDF-DYNAMIC-900',procurementNumber:'PROC-PDF-900',generatedAt:'2027-02-03T10:00:00Z',status:'draft',currency:'EUR',subtotal:2587.5,total:2587.5},customer:{companyName:'Dynamic PDF Customer',billingAddress:'Test address',registrationNumber:null,vatNumber:null,billingEmail:'buyer@example.test'},issuer:{companyName:'Electron Market',legalCompanyName:'AIG Research Ltd.',registrationNumber:'16265657',address:'128 City Road, London, EC1V 2NX, United Kingdom',accountHolder:'EURO',iban:'BE40905303790263',swiftBic:'TRWIBEB1XXX',bankAddress:'Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium'},items};
test('renders a valid multi-page A4 PDF from a dynamic document model',async()=>{const pdf=await renderCanonicalInvoicePdf(model);assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>15000);assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1)});
