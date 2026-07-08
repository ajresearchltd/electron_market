'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, FileLink, formatMoney, formatValue, GenericRow, KeyValueGrid, SectionCard, SimpleTable, humanize } from '../../_components/detailShared';

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerUserId = params.id;
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [account, setAccount] = useState<GenericRow | null>(null);
  const [profile, setProfile] = useState<GenericRow | null>(null);
  const [rfqs, setRfqs] = useState<GenericRow[]>([]);
  const [rfqItems, setRfqItems] = useState<GenericRow[]>([]);
  const [bomFiles, setBomFiles] = useState<GenericRow[]>([]);
  const [orders, setOrders] = useState<GenericRow[]>([]);

  useEffect(() => {
    const loadCustomer = async () => {
      setLoading(true);
      const nextErrors: string[] = [];

      const [
        accountResult,
        profileResult,
        rfqResult,
        ordersResult,
      ] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', customerUserId).maybeSingle(),
        supabase.from('customer_company_profiles').select('*').eq('user_id', customerUserId).maybeSingle(),
        supabase.from('rfq_orders0').select('*').eq('customer_id', customerUserId).order('created_at', { ascending: false }),
        supabase.from('active_orders').select('*').eq('customer_id', customerUserId).order('created_at', { ascending: false }),
      ]);

      if (accountResult.error) nextErrors.push(`user_profiles: ${accountResult.error.message}`);
      if (profileResult.error) nextErrors.push(`customer_company_profiles: ${profileResult.error.message}`);
      if (rfqResult.error) nextErrors.push(`rfq_orders0: ${rfqResult.error.message}`);
      if (ordersResult.error) nextErrors.push(`active_orders: ${ordersResult.error.message}`);

      const rfqRows = (rfqResult.data ?? []) as GenericRow[];
      const rfqIds = rfqRows.map((rfq) => String(rfq.rfq_id || '')).filter(Boolean);
      let itemRows: GenericRow[] = [];
      let bomRows: GenericRow[] = [];

      if (rfqIds.length > 0) {
        const [itemsResult, bomResult] = await Promise.all([
          supabase.from('rfq_order_items0').select('*').in('rfq_id', rfqIds).order('line_number', { ascending: true }),
          supabase.from('rfq_bom_files').select('*').in('rfq_id', rfqIds).order('uploaded_date', { ascending: false }),
        ]);
        if (itemsResult.error) nextErrors.push(`rfq_order_items0: ${itemsResult.error.message}`);
        if (bomResult.error) nextErrors.push(`rfq_bom_files: ${bomResult.error.message}`);
        itemRows = (itemsResult.data ?? []) as GenericRow[];
        bomRows = (bomResult.data ?? []) as GenericRow[];
      }

      setAccount((accountResult.data ?? null) as GenericRow | null);
      setProfile((profileResult.data ?? null) as GenericRow | null);
      setRfqs(rfqRows);
      setRfqItems(itemRows);
      setBomFiles(bomRows);
      setOrders((ordersResult.data ?? []) as GenericRow[]);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadCustomer();
  }, [customerUserId, supabase]);

  const itemsByRfq = useMemo(() => {
    const map = new Map<string, GenericRow[]>();
    rfqItems.forEach((item) => map.set(String(item.rfq_id), [...(map.get(String(item.rfq_id)) ?? []), item]));
    return map;
  }, [rfqItems]);

  const bomCountByRfq = useMemo(() => {
    const map = new Map<string, number>();
    bomFiles.forEach((file) => map.set(String(file.rfq_id), (map.get(String(file.rfq_id)) ?? 0) + 1));
    return map;
  }, [bomFiles]);

  const title = String(profile?.company_name || account?.company_name || account?.full_name || account?.email || 'Customer Detail');
  const subtitle = [
    profile?.contact_name || account?.full_name,
    profile?.contact_email || account?.email,
    profile?.country_name,
  ].filter(Boolean).map(String).join(' | ');
  const customerContacts = profile && (profile.contact_name || profile.contact_email || profile.contact_phone)
    ? [{
        contact_name: profile.contact_name,
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
        source: 'customer_company_profiles',
      }]
    : [];

  return (
    <AdminShell>
      <AdminHeader eyebrow="Customer Detail" title={title} subtitle={subtitle} status={String(profile?.customer_status || account?.role || '')} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading customer detail...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Overview">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Company</p><p className="mt-1 font-bold">{formatValue(profile?.company_name || account?.company_name)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Contact</p><p className="mt-1 font-bold">{formatValue(profile?.contact_name || account?.full_name)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Email</p><p className="mt-1 font-bold">{formatValue(profile?.contact_email || account?.email)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Country</p><p className="mt-1 font-bold">{formatValue(profile?.country_name)}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Customer RFQs">
          <SimpleTable
            rows={rfqs}
            emptyText="No RFQs found for this customer."
            columns={[
              { key: 'order_number', label: 'Order' },
              { key: 'rfq_id', label: 'RFQ ID' },
              { key: 'customer_company_name', label: 'Company' },
              { key: 'rfq_status', label: 'Status', render: (row) => humanize(row.rfq_status) },
              { key: 'total_items_count', label: 'Item Count', render: (row) => formatValue(row.total_items_count || itemsByRfq.get(String(row.rfq_id))?.length || 0) },
              { key: 'bom_files', label: 'BOM Files', render: (row) => formatValue(bomCountByRfq.get(String(row.rfq_id)) || 0) },
              { key: 'deadline_at', label: 'Deadline' },
              { key: 'created_at', label: 'Created' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Active Orders">
          <SimpleTable
            rows={orders}
            emptyText="No active orders found."
            columns={[
              { key: 'order_number', label: 'Order' },
              { key: 'supplier_company_name', label: 'Supplier' },
              { key: 'order_status', label: 'Status', render: (row) => humanize(row.order_status) },
              { key: 'current_stage', label: 'Stage', render: (row) => humanize(row.current_stage) },
              { key: 'order_total', label: 'Total', render: (row) => formatMoney(row.order_total, row.currency) },
              { key: 'expected_delivery_at', label: 'Expected Delivery' },
              { key: 'updated_at', label: 'Updated' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Uploaded Files / BOM Documents">
          <SimpleTable
            rows={bomFiles}
            emptyText="No files uploaded yet."
            columns={[
              { key: 'bom_file_name', label: 'File', render: (row) => <FileLink row={row} /> },
              { key: 'rfq_id', label: 'RFQ ID' },
              { key: 'bom_file_type', label: 'Type' },
              { key: 'bom_file_size', label: 'Size' },
              { key: 'ai_analysis_status', label: 'AI Status', render: (row) => humanize(row.ai_analysis_status) },
              { key: 'uploaded_date', label: 'Uploaded' },
            ]}
          />
        </SectionCard>

        <SectionCard title="RFQ Items">
          <SimpleTable
            rows={rfqItems}
            emptyText="No RFQ items found."
            columns={[
              { key: 'order_number', label: 'Order' },
              { key: 'line_number', label: 'Line' },
              { key: 'category_name', label: 'Category' },
              { key: 'part_number', label: 'Part Number' },
              { key: 'manufacturer', label: 'Manufacturer' },
              { key: 'requested_quantity', label: 'Quantity' },
              { key: 'target_total_price', label: 'Target Total', render: (row) => formatMoney(row.target_total_price, row.currency) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Customer Company / Profile Information">
          <KeyValueGrid row={profile} />
        </SectionCard>

        <SectionCard title="Customer Account">
          <KeyValueGrid row={account} />
        </SectionCard>

        <SectionCard title="Customer Contacts">
          <SimpleTable
            rows={customerContacts}
            emptyText="No contacts found."
            columns={[
              { key: 'contact_name', label: 'Name' },
              { key: 'contact_email', label: 'Email' },
              { key: 'contact_phone', label: 'Phone' },
              { key: 'source', label: 'Source' },
            ]}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
