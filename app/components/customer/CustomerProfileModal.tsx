'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HubButton, { ButtonSpinner } from '../ui/HubButton';
import { hubButtonClassName } from '../ui/hubButtonStyles';

type ProfileForm = {
  email: string;
  full_name: string;
  company_name: string;
  contact_phone: string;
  website: string;
  country_name: string;
  city: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  state_region: string;
  business_registration_number: string;
  tax_vat_number: string;
  profile_photo_url: string;
  profile_photo_path: string;
};

type ProfilePayload = {
  user?: { email?: string };
  profile?: Record<string, any> | null;
  user_profile?: Record<string, any> | null;
  documents?: CustomerDocument[];
};

type CustomerDocument = {
  document_type: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string | null;
  updated_at: string | null;
  preview_url: string;
  download_url: string;
};

const documentSlots = [
  { type: 'company_registration', title: 'Company Registration Certificate' },
  { type: 'tax_vat_document', title: 'Tax / VAT Document' },
  { type: 'proof_of_address', title: 'Proof of Address' },
  { type: 'other_customer_document', title: 'Other Customer Document' },
] as const;
const allowedDocumentTypes: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
};
const documentMaxBytes = 10 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB` : '-';
const formatDocumentDate = (input: string | null) => {
  if (!input) return '-';
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const emptyForm: ProfileForm = {
  email: '', full_name: '', company_name: '', contact_phone: '', website: '', country_name: '', city: '',
  address_line1: '', address_line2: '', postal_code: '', state_region: '', business_registration_number: '',
  tax_vat_number: '', profile_photo_url: '', profile_photo_path: '',
};
const value = (input: unknown) => String(input ?? '');
const buildForm = (payload: ProfilePayload): ProfileForm => {
  const profile = payload.profile || {};
  const userProfile = payload.user_profile || {};
  return {
    email: value(payload.user?.email || userProfile.email || profile.contact_email),
    full_name: value(userProfile.full_name || profile.contact_name),
    company_name: value(profile.company_name || userProfile.company_name),
    contact_phone: value(profile.contact_phone),
    website: value(profile.website),
    country_name: value(profile.country_name),
    city: value(profile.city),
    address_line1: value(profile.address_line1 || profile.company_address),
    address_line2: value(profile.address_line2),
    postal_code: value(profile.postal_code),
    state_region: value(profile.state_region),
    business_registration_number: value(profile.business_registration_number),
    tax_vat_number: value(profile.tax_vat_number),
    profile_photo_url: value(profile.profile_photo_url),
    profile_photo_path: value(profile.profile_photo_path),
  };
};

function Field({ label, field, form, setForm, type = 'text', required = false, readOnly = false }: {
  label: string; field: keyof ProfileForm; form: ProfileForm; setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  type?: string; required?: boolean; readOnly?: boolean;
}) {
  return <label className="block min-w-0 text-sm font-semibold text-slate-700">
    <span>{label}{required ? <span className="text-red-600"> *</span> : null}</span>
    <input
      type={type}
      value={form[field]}
      required={required}
      readOnly={readOnly}
      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
      className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${readOnly ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300 bg-white text-slate-950'}`}
    />
  </label>;
}

export default function CustomerProfileModal({ isOpen, onClose, onProfileUpdated, fallbackInitials }: {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: Record<string, any>) => void;
  fallbackInitials: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [savedForm, setSavedForm] = useState<ProfileForm>(emptyForm);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [documentBusy, setDocumentBusy] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [error, setError] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm) || Boolean(selectedPhoto), [form, savedForm, selectedPhoto]);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving || photoRemoving || Boolean(documentBusy));
  dirtyRef.current = dirty;
  savingRef.current = saving || photoRemoving || Boolean(documentBusy);

  useEffect(() => {
    if (!selectedPhoto) { setPreviewUrl(''); return; }
    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhoto]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true); setError(''); setSelectedPhoto(null);
    fetch('/api/customer/profile', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to load customer profile.');
        const next = buildForm(payload);
        setForm(next); setSavedForm(next); setDocuments(payload.documents || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load customer profile.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (savingRef.current) return;
    if (dirtyRef.current && !window.confirm('Discard your unsaved profile changes?')) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const firstItem = focusable[0]; const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Profile photo must be JPG, PNG, or WEBP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Profile photo must be 5 MB or smaller.'); return; }
    setError(''); setSelectedPhoto(file);
  };

  const save = async () => {
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError('');
    try {
      let photoUrl = form.profile_photo_url;
      let photoPath = form.profile_photo_path;
      if (selectedPhoto) {
        const data = new FormData(); data.append('file', selectedPhoto);
        const response = await fetch('/api/customer/profile/photo', { method: 'POST', body: data });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Profile photo upload failed.');
        photoUrl = value(payload.photo_url); photoPath = value(payload.photo_path);
      }
      const response = await fetch('/api/customer/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, profile_photo_url: photoUrl, profile_photo_path: photoPath }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Profile update failed.');
      const next = buildForm({ user: { email: form.email }, profile: payload.profile, user_profile: payload.user_profile });
      setForm(next); setSavedForm(next); setSelectedPhoto(null);
      onProfileUpdated?.({ ...payload.profile, full_name: payload.user_profile?.full_name, profile_photo_url: next.profile_photo_url });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save profile changes.');
    } finally { setSaving(false); }
  };

  const removePhoto = async () => {
    if (saving || photoRemoving || !window.confirm('Remove your profile photo?')) return;
    setPhotoRemoving(true); setError('');
    try {
      const response = await fetch('/api/customer/profile/photo/delete', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Profile photo removal failed.');
      const next = { ...form, profile_photo_url: '', profile_photo_path: '' };
      setForm(next); setSavedForm({ ...savedForm, profile_photo_url: '', profile_photo_path: '' }); setSelectedPhoto(null);
      onProfileUpdated?.({ full_name: form.full_name, company_name: form.company_name, profile_photo_url: '' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Profile photo removal failed.'); }
    finally { setPhotoRemoving(false); }
  };

  const uploadDocument = async (documentType: string, file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedDocumentTypes[file.type]?.includes(extension)) { setError('File type is not supported. Use PDF, JPG, JPEG, or PNG.'); return; }
    if (file.size > documentMaxBytes) { setError('File exceeds the maximum size of 10 MB.'); return; }
    setDocumentBusy(`${documentType}:upload`); setError('');
    try {
      const data = new FormData(); data.append('document_type', documentType); data.append('file', file);
      const response = await fetch('/api/customer/profile/documents', { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Document upload failed.');
      setDocuments((current) => [...current.filter((document) => document.document_type !== documentType), payload.document]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Document upload failed.'); }
    finally { setDocumentBusy(''); }
  };

  const deleteDocument = async (documentType: string) => {
    if (!window.confirm('Delete this company document?')) return;
    setDocumentBusy(`${documentType}:delete`); setError('');
    try {
      const response = await fetch('/api/customer/profile/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_type: documentType }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Document could not be deleted.');
      setDocuments((current) => current.filter((document) => document.document_type !== documentType));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Document could not be deleted.'); }
    finally { setDocumentBusy(''); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="customer-profile-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div><h2 id="customer-profile-title" className="text-xl font-bold text-blue-950">Customer Profile</h2><p className="mt-1 text-sm text-slate-500">Update your personal and company information.</p></div>
        <HubButton onClick={requestClose} disabled={saving}>Close</HubButton>
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {loading ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Loading profile...</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!loading ? <>
          <section><h3 className="font-bold text-blue-950">Profile Photo</h3><div className="mt-3 flex flex-wrap items-center gap-4">
            {previewUrl || form.profile_photo_url ? <img src={previewUrl || form.profile_photo_url} alt="Profile preview" className="h-20 w-20 rounded-full border border-slate-200 object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">{fallbackInitials.slice(0, 2)}</div>}
            <div className="flex flex-wrap gap-2"><input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choosePhoto} /><HubButton onClick={() => photoInputRef.current?.click()} disabled={saving || photoRemoving}>{form.profile_photo_url ? 'Replace Photo' : 'Upload Photo'}</HubButton>{form.profile_photo_url ? <HubButton onClick={removePhoto} loading={photoRemoving} loadingText="Removing..." disabled={saving}>Remove Photo</HubButton> : null}</div>
          </div><p className="mt-2 text-xs text-slate-500">JPG, PNG, or WEBP. Maximum 5 MB.</p></section>
          <section><h3 className="font-bold text-blue-950">Profile Information</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Full Name" field="full_name" form={form} setForm={setForm} required /><Field label="Phone" field="contact_phone" form={form} setForm={setForm} type="tel" /><Field label="Email" field="email" form={form} setForm={setForm} type="email" readOnly /></div></section>
          <section><h3 className="font-bold text-blue-950">Company Information</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Company Name" field="company_name" form={form} setForm={setForm} required /><Field label="Registration Number" field="business_registration_number" form={form} setForm={setForm} /><Field label="Tax / VAT Number" field="tax_vat_number" form={form} setForm={setForm} /><Field label="Country" field="country_name" form={form} setForm={setForm} /><Field label="City" field="city" form={form} setForm={setForm} /><Field label="Website" field="website" form={form} setForm={setForm} type="url" /><Field label="Address Line 1" field="address_line1" form={form} setForm={setForm} /><Field label="Address Line 2" field="address_line2" form={form} setForm={setForm} /><Field label="State / Region" field="state_region" form={form} setForm={setForm} /><Field label="Postal Code" field="postal_code" form={form} setForm={setForm} /></div></section>
          <section>
            <div><h3 className="font-bold text-blue-950">Company Documents</h3><p className="mt-1 text-xs text-slate-500">Private PDF, JPG, JPEG, or PNG files. Maximum 10 MB each.</p></div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {documentSlots.map((slot) => {
                const document = documents.find((item) => item.document_type === slot.type);
                const busy = documentBusy.startsWith(`${slot.type}:`);
                const uploadingDocument = documentBusy === `${slot.type}:upload`;
                const deletingDocument = documentBusy === `${slot.type}:delete`;
                const isImage = document?.mime_type?.startsWith('image/');
                return <article key={slot.type} className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-950">{slot.title}</h4>
                  <div className="mt-3 flex h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {document && isImage ? <img src={document.preview_url} alt={`${slot.title} preview`} className="h-full w-full object-contain" /> : null}
                    {document && !isImage ? <span className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">PDF</span> : null}
                    {!document ? <span className="text-sm text-slate-400">No file uploaded</span> : null}
                  </div>
                  {document ? <div className="mt-3 space-y-1 text-xs text-slate-600"><p className="break-all font-semibold text-slate-800">{document.file_name}</p><p>{formatBytes(document.size_bytes)} · {formatDocumentDate(document.uploaded_at)}</p></div> : <p className="mt-3 text-xs text-slate-500">Upload a document for this slot.</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <label aria-busy={uploadingDocument || undefined} className={`${hubButtonClassName('sm')} ${busy ? 'pointer-events-none opacity-70' : ''}`}>
                      {uploadingDocument ? <><ButtonSpinner />{document ? 'Replacing...' : 'Uploading...'}</> : document ? 'Replace' : 'Upload'}
                      <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" disabled={busy} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; uploadDocument(slot.type, file); }} />
                    </label>
                    {document ? <><HubButton href={document.preview_url} target="_blank" size="sm">Open</HubButton><HubButton href={document.download_url} size="sm">Download</HubButton><HubButton size="sm" onClick={() => deleteDocument(slot.type)} loading={deletingDocument} loadingText="Deleting..." disabled={uploadingDocument}>Delete</HubButton></> : null}
                  </div>
                </article>;
              })}
            </div>
          </section>
        </> : null}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"><HubButton onClick={requestClose} disabled={saving || photoRemoving || Boolean(documentBusy)}>Cancel</HubButton><HubButton onClick={save} disabled={loading || !dirty || photoRemoving || Boolean(documentBusy)} loading={saving} loadingText={selectedPhoto ? 'Uploading photo...' : 'Saving...'}>Save Changes</HubButton></div>
    </div>
  </div>;
}
