import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../../../lib/supabase/server';
import { getProcurementDocumentFile } from '../../../../../../../../lib/procurement-documents/document-chain';
import * as XLSX from 'xlsx';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function GET(_: NextRequest, { params }: { params: Promise<{ chainId: string; documentType: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return error('Authentication required.', 401);
  const values = await params;
  let chainId = ''; let documentType = '';
  try { chainId = decodeURIComponent(values.chainId).trim(); documentType = decodeURIComponent(values.documentType).trim().toLowerCase(); } catch { return error('Invalid document request.', 400); }
  if (!uuidPattern.test(chainId) || !['bom','rfq','quote','invoice','waybill','receive_order'].includes(documentType)) return error('Invalid document type or procurement chain.', 400);

  const { data: chain, error: chainError } = await supabase.from('procurement_chains').select('id, customer_user_id').eq('id', chainId).eq('customer_user_id', user.id).maybeSingle();
  if (chainError) { console.error('Document download ownership lookup failed:', chainError.message); return error('Download could not be prepared.', 500); }
  if (!chain) return error('You are not authorized to download this document.', 403);
  if (documentType !== 'bom') return error('Document file not found.', 404);

  const { data: header, error: headerError } = await supabase.from('customer_bom_uploads').select('id, user_id, procurement_chain_id, procurement_number, preliminary_order_id, file_path, file_url, original_file_name, file_type').eq('procurement_chain_id', chainId).eq('user_id', user.id).maybeSingle();
  if (headerError) { console.error('BOM document lookup failed:', headerError.message); return error('Download could not be prepared.', 500); }
  const file = getProcurementDocumentFile('bom', header);
  if (!header || header.procurement_chain_id !== chainId) return error('Document file not found.', 404);
  if (!file && header.preliminary_order_id) {
    const items = await supabase.from('customer_bom_upload_items').select('row_number,part_number,product_name,manufacturer,description,quantity,unit,target_unit_price,target_currency,package_case,specification,notes').eq('upload_id', header.id).eq('user_id', user.id).order('row_number');
    if (items.error || !items.data?.length) return error('Document file not found.', 404);
    const sheet = XLSX.utils.json_to_sheet(items.data.map((row:any)=>({Position:row.row_number,'Part Number':row.part_number,'Product Name':row.product_name,Manufacturer:row.manufacturer,Description:row.description,Quantity:row.quantity,Unit:row.unit,'Target Unit Price':row.target_unit_price,Currency:row.target_currency,Package:row.package_case,'Technical Requirements':row.specification,Notes:row.notes})));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook,sheet,'BOM');
    const bytes = XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
    return new NextResponse(bytes,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="${header.original_file_name||`${header.procurement_number}_BOM.xlsx`}"`,'cache-control':'private, no-store'}});
  }
  if (!file) return error('Document file not found.', 404);

  const { data: signed, error: signedError } = await supabase.storage.from(file.storageBucket).createSignedUrl(file.storagePath, 120, { download: file.originalFileName || true });
  if (signedError || !signed?.signedUrl) { console.error('BOM signed URL creation failed:', signedError?.message || 'No URL returned'); return error('Document file not found.', 404); }
  return NextResponse.redirect(signed.signedUrl);
}
