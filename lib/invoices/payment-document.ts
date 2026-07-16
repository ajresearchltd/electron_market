import 'server-only';

import {randomUUID} from 'crypto';

export const PAYMENT_DOCUMENT_BUCKET = 'customer-profile-documents';
export const PAYMENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_DOCUMENT_ERROR = 'Please upload a PDF, JPG, PNG or GIF file up to 10 MB.';

const accepted = new Map([
  ['application/pdf', new Set(['pdf'])],
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/gif', new Set(['gif'])],
]);

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
export const safePaymentFileName = (name: string) => {
  const extension = extensionOf(name).replace(/[^a-z0-9]/g, '');
  const base = name.replace(/\.[^.]+$/, '').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'payment-document';
  return `${base.slice(0, 80)}.${extension}`.replace(/["\\/\0\r\n]/g, '');
};

function signatureMatches(bytes: Uint8Array, mime: string) {
  if (mime === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);
  if (mime === 'image/gif') {
    const value = String.fromCharCode(...bytes.slice(0, 6));
    return value === 'GIF87a' || value === 'GIF89a';
  }
  return false;
}

export async function validatePaymentDocument(file: File) {
  const extensions = accepted.get(file.type);
  if (!file.size || file.size > PAYMENT_DOCUMENT_MAX_BYTES || !extensions?.has(extensionOf(file.name))) throw new Error(PAYMENT_DOCUMENT_ERROR);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type)) throw new Error(PAYMENT_DOCUMENT_ERROR);
  return {bytes, mimeType:file.type, originalName:safePaymentFileName(file.name), sizeBytes:file.size};
}

export function buildPaymentDocumentStoragePath(customerId: string, invoiceId: string, filename: string) {
  return `${customerId}/invoice-payments/${invoiceId}/${randomUUID()}-${filename}`;
}

export async function uploadInvoicePaymentDocument(db:any, invoice:any, userId:string, file:File) {
  const validated=await validatePaymentDocument(file);
  const path=buildPaymentDocumentStoragePath(userId,invoice.id,validated.originalName);
  const uploaded=await db.storage.from(PAYMENT_DOCUMENT_BUCKET).upload(path,validated.bytes,{contentType:validated.mimeType,cacheControl:'3600',upsert:false});
  if(uploaded.error)throw new Error('Payment document could not be uploaded.');
  const now=new Date().toISOString();
  const saved=await db.from('procurement_invoices').update({invoice_status:'paid',paid_boolean:true,paid_at:now,payment_status:'paid',paid_document_path:uploaded.data.path,paid_document_original_name:validated.originalName,paid_document_mime_type:validated.mimeType,paid_document_size_bytes:validated.sizeBytes,paid_document_uploaded_at:now,paid_document_uploaded_by:userId,updated_at:now}).eq('id',invoice.id).eq('customer_user_id',userId).select('id,invoice_number,invoice_status,paid_boolean,paid_at,paid_document_original_name,paid_document_mime_type,paid_document_size_bytes,paid_document_uploaded_at,paid_document_uploaded_by').single();
  if(saved.error){await db.storage.from(PAYMENT_DOCUMENT_BUCKET).remove([uploaded.data.path]);throw new Error('Payment document could not be uploaded.');}
  if(invoice.paid_document_path&&invoice.paid_document_path!==uploaded.data.path){const removed=await db.storage.from(PAYMENT_DOCUMENT_BUCKET).remove([invoice.paid_document_path]);if(removed.error)console.error('Replaced Invoice payment document cleanup failed.',{invoiceId:invoice.id});}
  return saved.data;
}

export async function loadInvoicePaymentDocument(db:any, invoice:any) {
  if(!invoice.paid_document_path)throw new Error('Payment document is not available.');
  const downloaded=await db.storage.from(PAYMENT_DOCUMENT_BUCKET).download(invoice.paid_document_path);
  if(downloaded.error)throw new Error('Payment document is not available.');
  return {blob:downloaded.data,filename:safePaymentFileName(invoice.paid_document_original_name||'payment-document'),mimeType:invoice.paid_document_mime_type||'application/octet-stream'};
}
