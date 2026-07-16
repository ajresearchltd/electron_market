import 'server-only';
import {normalizeInvoiceStatus} from './status';

type Database = any;
type Role = 'customer' | 'admin';

const letter = (index: number) => String.fromCharCode(65 + (index % 26));
const value = (input: unknown) => input === null || input === undefined ? null : input;

async function supplierNames(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const result = await db.from('supplier_company_profiles').select('user_id,company_name').in('user_id', ids);
  if (result.error) throw result.error;
  return new Map((result.data ?? []).map((row: any) => [row.user_id, row.company_name || 'Unnamed supplier']));
}

function aliases(rows: any[]) {
  const byChain = new Map<string, string[]>();
  for (const row of rows) {
    const key = String(row.procurement_chain_id ?? '');
    const id = String(row.supplier_user_id ?? '');
    if (!id) continue;
    const current = byChain.get(key) ?? [];
    if (!current.includes(id)) current.push(id);
    byChain.set(key, current.sort());
  }
  return (row: any) => {
    const ids = byChain.get(String(row.procurement_chain_id ?? '')) ?? [];
    const index = Math.max(0, ids.indexOf(String(row.supplier_user_id ?? '')));
    return `Supplier ${letter(index)}`;
  };
}

export async function listInvoices(db: Database, role: Role, customerId?: string, limit = 50) {
  let query = db.from('procurement_invoices').select('id,invoice_number,invoice_sequence,procurement_chain_id,procurement_number,source_rfq_id,customer_user_id,supplier_user_id,customer_company_name,invoice_status,subtotal,total_amount,currency,generated_at,created_at,created_by,created_by_role,paid_boolean,paid_at,paid_document_original_name,paid_document_mime_type,paid_document_size_bytes,paid_document_uploaded_at,paid_document_uploaded_by').order('generated_at',{ascending:false}).order('created_at',{ascending:false}).order('invoice_sequence',{ascending:false}).order('id',{ascending:false}).limit(limit);
  if (role === 'customer') query = query.eq('customer_user_id', customerId);
  const invoiceResult = await query;
  if (invoiceResult.error) throw invoiceResult.error;
  const rows = invoiceResult.data ?? [];
  const ids = rows.map((row:any)=>row.id);
  const itemResult = ids.length ? await db.from('procurement_invoice_items').select('invoice_id').in('invoice_id',ids) : {data:[],error:null};
  if (itemResult.error) throw itemResult.error;
  const counts = new Map<string,number>();
  for (const item of itemResult.data ?? []) counts.set(item.invoice_id,(counts.get(item.invoice_id)??0)+1);
  const names = role === 'admin' ? await supplierNames(db,[...new Set(rows.map((row:any)=>row.supplier_user_id).filter(Boolean))] as string[]) : new Map<string,string>();
  const aliasFor = aliases(rows);
  return rows.map((row:any)=>({id:row.id,invoiceNumber:row.invoice_number||row.id,invoiceSequence:row.invoice_sequence,procurementChainId:row.procurement_chain_id,procurementNumber:row.procurement_number,sourceRfqId:row.source_rfq_id,generatedAt:row.generated_at||row.created_at,customer:row.customer_company_name||'Customer',supplier:role==='admin'?(names.get(row.supplier_user_id)||'Unnamed supplier'):aliasFor(row),supplierId:role==='admin'?row.supplier_user_id:undefined,itemCount:counts.get(row.id)??0,subtotal:value(row.subtotal),total:value(row.total_amount),currency:row.currency||'USD',status:normalizeInvoiceStatus(row),paid:Boolean(row.paid_boolean),paidAt:row.paid_at,paymentDocumentAvailable:Boolean(row.paid_document_original_name),createdByRole:role==='admin'?row.created_by_role:undefined,createdBy:role==='admin'?row.created_by:undefined}));
}

export async function invoiceDetails(db: Database, invoiceId: string, role: Role, customerId?: string) {
  let query=db.from('procurement_invoices').select('id,invoice_number,invoice_sequence,procurement_chain_id,procurement_number,source_rfq_id,customer_user_id,supplier_user_id,customer_company_name,invoice_status,subtotal,total_amount,currency,generated_at,created_at,created_by,created_by_role,paid_boolean,paid_at,paid_document_original_name,paid_document_mime_type,paid_document_size_bytes,paid_document_uploaded_at,paid_document_uploaded_by').eq('id',invoiceId);
  if(role==='customer')query=query.eq('customer_user_id',customerId);
  const header=await query.maybeSingle();
  if(header.error)throw header.error;if(!header.data)return null;
  const items=await db.from('procurement_invoice_items').select('id,line_number,requested_part_number,offered_part_number,part_number,manufacturer,description,quantity,unit,unit_price,normalized_unit_price,currency,price_basis_quantity,price_basis_unit,line_total,moq,available_quantity,lead_time_days,packaging,condition,date_code,incoterms,payment_terms,quotation_valid_until,delivery_conditions,certificate_available,traceability_available,source_allocation_id,source_rfq_item_id,source_supplier_response_item_id,supplier_id').eq('invoice_id',invoiceId).order('line_number',{ascending:true});
  if(items.error)throw items.error;
  const related=await db.from('procurement_invoices').select('procurement_chain_id,supplier_user_id').eq('procurement_chain_id',header.data.procurement_chain_id);
  if(related.error)throw related.error;
  const aliasFor=aliases(related.data??[]);
  const names=role==='admin'?await supplierNames(db,[header.data.supplier_user_id].filter(Boolean)):new Map<string,string>();
  const row=header.data;
  return {invoice:{id:row.id,invoiceNumber:row.invoice_number||row.id,invoiceSequence:row.invoice_sequence,procurementChainId:row.procurement_chain_id,procurementNumber:row.procurement_number,sourceRfqId:row.source_rfq_id,generatedAt:row.generated_at||row.created_at,customer:row.customer_company_name||'Customer',supplier:role==='admin'?(names.get(row.supplier_user_id)||'Unnamed supplier'):aliasFor(row),supplierId:role==='admin'?row.supplier_user_id:undefined,status:normalizeInvoiceStatus(row),itemCount:(items.data??[]).length,subtotal:value(row.subtotal),total:value(row.total_amount),currency:row.currency||'USD',paid:Boolean(row.paid_boolean),paidAt:row.paid_at,payment:{paid:Boolean(row.paid_boolean),paidAt:row.paid_at,originalName:row.paid_document_original_name,mimeType:row.paid_document_mime_type,sizeBytes:row.paid_document_size_bytes==null?null:Number(row.paid_document_size_bytes),uploadedAt:row.paid_document_uploaded_at,uploadedBy:role==='admin'?row.paid_document_uploaded_by:undefined,downloadAvailable:Boolean(row.paid_document_original_name)},createdByRole:role==='admin'?row.created_by_role:undefined,createdBy:role==='admin'?row.created_by:undefined},items:(items.data??[]).map((item:any)=>({id:item.id,lineNumber:item.line_number,requestedMpn:item.requested_part_number||item.part_number,offeredMpn:item.offered_part_number||item.part_number,manufacturer:item.manufacturer,description:item.description,quantity:item.quantity,unit:item.unit,unitPrice:item.unit_price,normalizedUnitPrice:item.normalized_unit_price,currency:item.currency,priceBasisQuantity:item.price_basis_quantity,priceBasisUnit:item.price_basis_unit,lineTotal:item.line_total,moq:item.moq,availableQuantity:item.available_quantity,leadTimeDays:item.lead_time_days,packaging:item.packaging,condition:item.condition,dateCode:item.date_code,incoterms:item.incoterms,paymentTerms:item.payment_terms,validity:item.quotation_valid_until,deliveryConditions:item.delivery_conditions,certificateAvailable:item.certificate_available,traceabilityAvailable:item.traceability_available,sourceAllocationId:role==='admin'?item.source_allocation_id:undefined,sourceRfqItemId:role==='admin'?item.source_rfq_item_id:undefined,sourceSupplierResponseItemId:role==='admin'?item.source_supplier_response_item_id:undefined}))};
}
