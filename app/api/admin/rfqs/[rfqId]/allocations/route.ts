import { NextResponse } from 'next/server';
import { requireInternalApi } from '../../../../../../lib/auth/require-internal-api';
import { approveSupplierOfferForRfqItem } from '../../../../../../lib/rfqs/approve-supplier-offer';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const auth = await requireInternalApi(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if(auth.role!=='admin')return NextResponse.json({error:'Admin authorization required.'},{status:403});
  const body = await request.json().catch(() => null); if (!body?.rfqItemId||!body?.supplierResponseItemId) return NextResponse.json({ error: 'RFQ position and supplier offer are required.' }, { status: 400 });
  const rfqId=(await params).rfqId,result=await approveSupplierOfferForRfqItem(auth.admin,{rfqId,rfqItemId:String(body.rfqItemId),offerItemId:String(body.supplierResponseItemId),actorUserId:auth.user.id,actorRole:'admin',approvedQuantity:Number(body.allocatedQuantity)});
  if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
  revalidatePath(`/admin/rfqs/${rfqId}`);revalidatePath('/admin');revalidatePath(`/customer/rfqs/${rfqId}`);revalidatePath('/customer/dashboard');revalidatePath(`/supplier/rfqs/${rfqId}`);revalidatePath('/supplier/dashboard');
  return NextResponse.json({success:true,allocation:result.data,isApproved:true,approvedQuantity:result.data.allocated_quantity,approvedByRole:'admin',invoiceEligible:result.data.invoiceEligible},{status:200});
}

export async function DELETE(request: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const auth = await requireInternalApi(); if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null); if (!body?.allocationId) return NextResponse.json({ error: 'Allocation id is required.' }, { status: 400 });
  const saved = await auth.admin.from('procurement_supplier_allocations').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', body.allocationId).eq('rfq_id', (await params).rfqId).select('id').maybeSingle();
  if (saved.error || !saved.data) return NextResponse.json({ error: 'Allocation could not be deselected.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
