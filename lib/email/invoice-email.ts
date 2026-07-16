import 'server-only';
import path from 'path';
import {sendSmtp, safeMailError} from './smtp';
import {loadCanonicalInvoiceForDocument} from '../invoices/invoice-document';
import {renderInvoiceDocument} from '../invoices/render-invoice-document.mjs';
import {getOrCreateInvoicePdf} from '../invoices/invoice-pdf-storage';

type Database = any;

export async function renderCanonicalInvoiceEmail(db: Database, invoiceId: string) {
  const model = await loadCanonicalInvoiceForDocument(db, invoiceId);
  const rendered = renderInvoiceDocument(model);
  let pdfAttachment: {filename:string;content:Buffer;contentType:string}|null=null;
  try {
    const pdf=await getOrCreateInvoicePdf(model);
    if(pdf.buffer.length<=10*1024*1024)pdfAttachment={filename:pdf.filename,content:pdf.buffer,contentType:'application/pdf'};
    else console.warn('Invoice PDF attachment omitted because it exceeds the email size threshold.', {invoiceId});
  } catch(error) {
    console.warn('Invoice email will use the protected PDF link without an attachment.', {invoiceId,code:'pdf_attachment_unavailable'});
  }
  return {
    ...rendered,
    recipient: model.customer.billingEmail,
    invoiceNumber: model.invoice.invoiceNumber,
    itemCount: model.items.length,
    attachments: [{
      filename: 'electron-market-logo.png',
      path: path.join(process.cwd(), 'public', 'reference', 'web_logo_em.png'),
      cid: 'electron-market-logo',
    },...(pdfAttachment?[pdfAttachment]:[])],
    pdfAttachmentIncluded:Boolean(pdfAttachment),
  };
}

export async function sendTestInvoiceEmail(db: Database, invoiceId: string) {
  try {
    // Always reload the selected canonical Invoice immediately before rendering.
    const document = await renderCanonicalInvoiceEmail(db, invoiceId);
    if (!document.recipient) return {status: 'not_attempted' as const, recipient: null,
      messageId: null, error: 'buyer_email_missing', invoiceNumber: document.invoiceNumber};
    const sent = await sendSmtp({to: document.recipient, subject: document.subject,
      html: document.html, text: document.text, attachments: document.attachments});
    return {status: 'sent' as const, recipient: document.recipient, messageId: sent.messageId,
      error: null, invoiceNumber: document.invoiceNumber};
  } catch (error) {
    console.error('Proforma Invoice email failed:', safeMailError(error));
    return {status: 'failed' as const, recipient: null, messageId: null,
      error: safeMailError(error).message, invoiceNumber: null};
  }
}
