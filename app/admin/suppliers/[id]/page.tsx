'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import { AdminHeader, AdminShell, ErrorList, FileLink, formatMoney, formatValue, GenericRow, KeyValueGrid, SectionCard, SimpleTable, humanize } from '../../_components/detailShared';

const ASSIGNMENTS_TABLE = 'rfq_supplier_assignments';
const DEFAULT_DOCUMENTS_BUCKET = 'supplier-company-documents';

export default function AdminSupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierProfileId = params.id;
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [profile, setProfile] = useState<GenericRow | null>(null);
  const [contacts, setContacts] = useState<GenericRow[]>([]);
  const [documents, setDocuments] = useState<GenericRow[]>([]);
  const [assignments, setAssignments] = useState<GenericRow[]>([]);
  const [rfqs, setRfqs] = useState<GenericRow[]>([]);
  const [orders, setOrders] = useState<GenericRow[]>([]);

  useEffect(() => {
    const loadSupplier = async () => {
      setLoading(true);
      setErrors([]);

      const nextErrors: string[] = [];
      const profileResult = await supabase
        .from('supplier_company_profiles')
        .select('*')
        .eq('profile_id', supplierProfileId)
        .maybeSingle();

      if (profileResult.error) {
        nextErrors.push(`supplier_company_profiles: ${profileResult.error.message}`);
        setProfile(null);
        setLoading(false);
        setErrors(nextErrors);
        return;
      }

      const supplierProfile = (profileResult.data ?? null) as GenericRow | null;
      setProfile(supplierProfile);

      if (!supplierProfile) {
        setLoading(false);
        return;
      }

      const supplierUserId = String(supplierProfile.user_id || '');
      const [
        contactsResult,
        documentsResult,
        assignmentsResult,
        ordersResult,
      ] = await Promise.all([
        supabase.from('supplier_company_contacts').select('*').eq('profile_id', supplierProfileId).order('contact_index', { ascending: true }),
        supabase.from('supplier_company_documents').select('*').eq('profile_id', supplierProfileId).order('document_slot', { ascending: true }),
        supabase.from(ASSIGNMENTS_TABLE).select('*').eq('supplier_id', supplierUserId).order('assigned_at', { ascending: false }),
        supabase.from('active_orders').select('*').eq('supplier_id', supplierUserId).order('created_at', { ascending: false }),
      ]);

      if (contactsResult.error) nextErrors.push(`supplier_company_contacts: ${contactsResult.error.message}`);
      if (documentsResult.error) nextErrors.push(`supplier_company_documents: ${documentsResult.error.message}`);
      if (assignmentsResult.error) nextErrors.push(`${ASSIGNMENTS_TABLE}: ${assignmentsResult.error.message}`);
      if (ordersResult.error) nextErrors.push(`active_orders: ${ordersResult.error.message}`);

      const assignmentRows = (assignmentsResult.data ?? []) as GenericRow[];
      const rfqIds = Array.from(new Set(assignmentRows.map((assignment) => String(assignment.rfq_id || '')).filter(Boolean)));
      let rfqRows: GenericRow[] = [];
      if (rfqIds.length > 0) {
        const rfqResult = await supabase.from('rfq_orders0').select('*').in('rfq_id', rfqIds).order('created_at', { ascending: false });
        if (rfqResult.error) nextErrors.push(`rfq_orders0: ${rfqResult.error.message}`);
        rfqRows = (rfqResult.data ?? []) as GenericRow[];
      }

      const documentRows = (documentsResult.data ?? []) as GenericRow[];
      const documentsWithSignedUrls = await Promise.all(
        documentRows.map(async (documentRow) => {
          const storagePath = String(documentRow.storage_path || '');
          if (!storagePath) return documentRow;

          const storageBucket = String(documentRow.storage_bucket || DEFAULT_DOCUMENTS_BUCKET);
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(storageBucket)
            .createSignedUrl(storagePath, 60 * 10);

          if (signedUrlError) {
            nextErrors.push(`supplier document storage (${documentRow.file_name || documentRow.document_title || storagePath}): ${signedUrlError.message}`);
            return documentRow;
          }

          return { ...documentRow, signed_url: signedUrlData?.signedUrl || '' };
        })
      );

      setContacts((contactsResult.data ?? []) as GenericRow[]);
      setDocuments(documentsWithSignedUrls);
      setAssignments(assignmentRows);
      setRfqs(rfqRows);
      setOrders((ordersResult.data ?? []) as GenericRow[]);
      setErrors(nextErrors);
      setLoading(false);
    };

    loadSupplier();
  }, [supplierProfileId, supabase]);

  const assignmentByRfq = useMemo(() => new Map(assignments.map((assignment) => [String(assignment.rfq_id), assignment])), [assignments]);
  const companyName = String(profile?.company_name || 'Supplier Detail');
  const subtitle = [
    profile?.main_contact_name,
    profile?.company_email || profile?.main_contact_email,
    profile?.country_name,
  ].filter(Boolean).map(String).join(' | ');

  return (
    <AdminShell>
      <AdminHeader eyebrow="Supplier Detail" title={companyName} subtitle={subtitle} status={String(profile?.verification_status || '')} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {loading && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading supplier detail...</div>}
        <ErrorList errors={errors} />

        <SectionCard title="Overview">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Company</p><p className="mt-1 font-bold">{formatValue(profile?.company_name)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Main Contact</p><p className="mt-1 font-bold">{formatValue(profile?.main_contact_name)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Email</p><p className="mt-1 font-bold">{formatValue(profile?.company_email || profile?.main_contact_email)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Country</p><p className="mt-1 font-bold">{formatValue(profile?.country_name)}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Related RFQs">
          <SimpleTable
            rows={rfqs}
            emptyText="No RFQs found for this supplier."
            columns={[
              { key: 'order_number', label: 'Order' },
              { key: 'rfq_id', label: 'RFQ ID' },
              { key: 'customer_company_name', label: 'Buyer' },
              { key: 'rfq_status', label: 'RFQ Status', render: (row) => humanize(row.rfq_status) },
              { key: 'assignment_status', label: 'Assignment', render: (row) => humanize(assignmentByRfq.get(String(row.rfq_id))?.assignment_status) },
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
              { key: 'customer_company_name', label: 'Buyer' },
              { key: 'order_status', label: 'Status', render: (row) => humanize(row.order_status) },
              { key: 'current_stage', label: 'Stage', render: (row) => humanize(row.current_stage) },
              { key: 'order_total', label: 'Total', render: (row) => formatMoney(row.order_total, row.currency) },
              { key: 'expected_delivery_at', label: 'Expected Delivery' },
              { key: 'updated_at', label: 'Updated' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Uploaded Files / Documents">
          <SimpleTable
            rows={documents}
            emptyText="No uploaded documents found."
            columns={[
              { key: 'document_title', label: 'Document' },
              { key: 'document_type', label: 'Type', render: (row) => humanize(row.document_type) },
              { key: 'file_name', label: 'File', render: (row) => <FileLink row={row} /> },
              { key: 'file_mime_type', label: 'MIME' },
              { key: 'file_size_bytes', label: 'Size' },
              { key: 'document_status', label: 'Status', render: (row) => humanize(row.document_status) },
              { key: 'uploaded_at', label: 'Uploaded' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Supplier Company Profile Information">
          <KeyValueGrid row={profile} />
        </SectionCard>

        <SectionCard title="Supplier Contacts">
          <SimpleTable
            rows={contacts}
            emptyText="No contacts found."
            columns={[
              { key: 'contact_index', label: 'Index' },
              { key: 'contact_name', label: 'Name' },
              { key: 'contact_position', label: 'Position' },
              { key: 'contact_email', label: 'Email' },
              { key: 'contact_phone', label: 'Phone' },
              { key: 'contact_whatsapp', label: 'WhatsApp' },
              { key: 'contact_notes', label: 'Notes' },
              { key: 'created_at', label: 'Created' },
            ]}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
