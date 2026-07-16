import test from 'node:test';
import assert from 'node:assert/strict';
import {renderInvoiceDocument} from '../lib/invoices/render-invoice-document.mjs';

const fixture = {
  invoice: {invoiceNumber:'PF-DYNAMIC-902',procurementNumber:'ORDER-ALT-77',generatedAt:'2027-02-03T10:00:00Z',
    status:'draft',currency:'EUR',subtotal:50,total:50},
  customer: {companyName:'Different & Co <script>',billingAddress:'Berlin',registrationNumber:'REG-77',
    vatNumber:null,billingEmail:'buyer@example.test',bankAccount:null,iban:null},
  issuer: {companyName:'Electron Market',legalCompanyName:'AIG Research Ltd.',registrationNumber:'16265657',vatNumber:null,
    address:'128 City Road, London, EC1V 2NX, United Kingdom',contactEmail:null,
    accountHolder:'EURO',bankName:null,bankAddress:'Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium',
    iban:'BE40905303790263',swiftBic:'TRWIBEB1XXX'},
  items: [
    {requestedMpn:'PART-A<&',offeredMpn:'ALT-A',description:'First <b>part</b>',manufacturer:'Maker One',quantity:2,
      quantityUnit:'pcs',currency:'EUR',selectedUnitPrice:10,priceBasisQuantity:1,priceBasisUnit:'pcs',lineTotal:20},
    {requestedMpn:'PART-B',offeredMpn:'PART-B',description:'Second part',manufacturer:null,quantity:3,
      quantityUnit:'pcs',currency:'EUR',selectedUnitPrice:10,priceBasisQuantity:1,priceBasisUnit:'pcs',lineTotal:30},
  ], applicationUrl:'https://example.test/customer/dashboard#customer-invoices',
  pdfDownloadUrl:'https://example.test/api/customer/invoices/dynamic-id/pdf',
};

test('renders every supplied canonical item and dynamic header values', () => {
  const output = renderInvoiceDocument(fixture);
  assert.match(output.subject,/PF-DYNAMIC-902/);
  assert.match(output.html,/ORDER-ALT-77/);
  assert.match(output.html,/PART-A&lt;&amp;/);
  assert.match(output.html,/PART-B/);
  assert.match(output.html,/EUR 50\.00/);
  assert.match(output.html,/COMPANY DETAILS/);
  assert.match(output.html,/BE40905303790263/);
  assert.match(output.html,/PROFORMA INVOICE #<br>PF-DYNAMIC-902/);
  assert.match(output.html,/Download PDF Invoice/);
  assert.match(output.html,/AIG Research Ltd\./);
  assert.doesNotMatch(output.html,/<script>|<b>part<\/b>/);
  assert.doesNotMatch(output.html,/PR-2026-000002-INV-001|LM358DR|AJ Research Ltd|USD 114\.00/);
  assert.doesNotMatch(output.html,/supplier.*email|source_message_id|admin notes/i);
});

test('plain text is produced from the same model', () => {
  const output = renderInvoiceDocument(fixture);
  assert.match(output.text,/PF-DYNAMIC-902/);
  assert.match(output.text,/Different & Co/);
  assert.match(output.text,/PART-A<&/);
  assert.match(output.text,/PART-B/);
  assert.match(output.text,/Total: EUR 50\.00/);
});
