import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../../../../lib/supabase/server';
import { getProcurementDocumentFile } from '../../../../../../../../lib/procurement-documents/document-chain';

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

  const { data: header, error: headerError } = await supabase.from('customer_bom_uploads').select('id, user_id, procurement_chain_id, file_path, file_url, original_file_name, file_type').eq('procurement_chain_id', chainId).eq('user_id', user.id).maybeSingle();
  if (headerError) { console.error('BOM document lookup failed:', headerError.message); return error('Download could not be prepared.', 500); }
  const file = getProcurementDocumentFile('bom', header);
  if (!header || header.procurement_chain_id !== chainId || !file) return error('Document file not found.', 404);

  const { data: signed, error: signedError } = await supabase.storage.from(file.storageBucket).createSignedUrl(file.storagePath, 120, { download: file.originalFileName || true });
  if (signedError || !signed?.signedUrl) { console.error('BOM signed URL creation failed:', signedError?.message || 'No URL returned'); return error('Document file not found.', 404); }
  return NextResponse.redirect(signed.signedUrl);
}
