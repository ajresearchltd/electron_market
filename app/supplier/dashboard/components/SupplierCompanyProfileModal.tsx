'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import HubButton from '../../../components/ui/HubButton';

const PROFILE_TABLE = 'supplier_company_profiles';
const CONTACTS_TABLE = 'supplier_company_contacts';
const DOCUMENTS_TABLE = 'supplier_company_documents';
const STORAGE_BUCKET = 'supplier-company-documents';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

type ProfileFormData = {
  company_name: string;
  business_registration_number: string;
  tax_vat_number: string;
  country_iso2: string;
  country_name: string;
  legal_address: string;
  office_address: string;
  website: string;
  company_phone: string;
  company_email: string;
  main_contact_name: string;
  main_contact_position: string;
  main_contact_email: string;
  main_contact_phone: string;
  company_description: string;
  product_categories_text: string;
  years_in_business: string;
  bank_account_holder_name: string;
  bank_name: string;
  bank_country_iso2: string;
  bank_country_name: string;
  bank_address: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  payment_currency: string;
  payment_notes: string;
};

type ContactFormData = {
  contact_index: number;
  contact_name: string;
  contact_position: string;
  contact_email: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_notes: string;
};

type CountryRow = {
  country_id: number;
  iso2: string;
  iso3: string | null;
  name: string;
};

type DocumentMetadata = {
  document_slot: number;
  document_type: string;
  document_title: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  document_status: string | null;
  uploaded_at: string | null;
};

type DocumentSlot = {
  slot: number;
  type: string;
  label: string;
};

type SupplierCompanyProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (companyName: string) => void;
};

const emptyFormData: ProfileFormData = {
  company_name: '',
  business_registration_number: '',
  tax_vat_number: '',
  country_iso2: '',
  country_name: '',
  legal_address: '',
  office_address: '',
  website: '',
  company_phone: '',
  company_email: '',
  main_contact_name: '',
  main_contact_position: '',
  main_contact_email: '',
  main_contact_phone: '',
  company_description: '',
  product_categories_text: '',
  years_in_business: '',
  bank_account_holder_name: '',
  bank_name: '',
  bank_country_iso2: '',
  bank_country_name: '',
  bank_address: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  payment_currency: 'USD',
  payment_notes: '',
};

const emptyContacts: ContactFormData[] = [1, 2, 3].map((index) => ({
  contact_index: index,
  contact_name: '',
  contact_position: '',
  contact_email: '',
  contact_phone: '',
  contact_whatsapp: '',
  contact_notes: '',
}));

const documentSlots: DocumentSlot[] = [
  { slot: 1, type: 'articles_of_association', label: 'Articles / Company Charter' },
  { slot: 2, type: 'company_registration', label: 'Company registration document' },
  { slot: 3, type: 'tax_certificate', label: 'Tax authority document' },
  { slot: 4, type: 'other', label: 'Additional document' },
];

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-sm font-semibold text-slate-700';
const sectionClass = 'rounded-xl border border-blue-100 bg-blue-50 p-4';
const sectionTitleClass = 'text-lg font-bold text-blue-700';

const isMissingSetupError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('could not find the table') || normalized.includes('does not exist') || normalized.includes('schema cache');
};

const buildSetupMessage = (message: string) => {
  if (!message || !isMissingSetupError(message)) return message;
  return `Supplier company profile tables are not available yet. Please run the Supabase SQL setup file. ${message}`;
};

const cleanString = (value: unknown) => (typeof value === 'string' ? value : '');

const safeFileName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'document';

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea value={value ?? ''} onChange={(event) => onChange(event.target.value)} rows={3} className={inputClass} />
    </label>
  );
}

function DocumentPreview({
  file,
  metadata,
  signedUrl,
}: {
  file?: File;
  metadata?: DocumentMetadata;
  signedUrl?: string;
}) {
  const objectUrl = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const previewUrl = objectUrl || signedUrl || '';
  const mimeType = file?.type || metadata?.file_mime_type || '';
  const fileName = file?.name || metadata?.file_name || '';

  if (mimeType.startsWith('image/') && previewUrl) {
    return (
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <img src={previewUrl} alt={fileName || 'Document preview'} className="h-full w-full object-cover" />
      </div>
    );
  }

  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return (
      <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-700">
        <span className="text-xl font-bold">PDF</span>
        <span className="mt-1 max-w-[150px] truncate text-xs">{fileName || 'PDF document'}</span>
      </div>
    );
  }

  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
      No preview
    </div>
  );
}

export default function SupplierCompanyProfileModal({ isOpen, onClose, onSaved }: SupplierCompanyProfileModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [formData, setFormData] = useState<ProfileFormData>(emptyFormData);
  const [contacts, setContacts] = useState<ContactFormData[]>(emptyContacts);
  const [documents, setDocuments] = useState<Record<number, DocumentMetadata>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File>>({});
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState('');
  const [documentPreviewUrls, setDocumentPreviewUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setSaving(false);
      setError('');
      setMessage('');
      setSelectedFiles({});
      setCountriesError('');
      setDocumentPreviewUrls({});

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        setError(authError?.message || 'You must be signed in to manage your supplier company profile.');
        setLoading(false);
        return;
      }

      const user = authData.user;
      setUserId(user.id);

      setCountriesLoading(true);
      const [userProfileResult, countriesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('company_name, full_name, email')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('countries')
          .select('country_id, iso2, iso3, name')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (!active) return;

      setCountriesLoading(false);
      if (countriesResult.error) {
        setCountries([]);
        setCountriesError(countriesResult.error.message);
      } else {
        setCountries((countriesResult.data ?? []) as CountryRow[]);
      }

      const userProfile = userProfileResult.data;

      const metadata = user.user_metadata ?? {};
      const fallbackForm: ProfileFormData = {
        ...emptyFormData,
        company_name: cleanString(metadata.company_name) || cleanString(userProfile?.company_name) || '',
        business_registration_number: cleanString(metadata.business_registration_number),
        country_iso2: cleanString(metadata.supply_country_iso2),
        country_name: cleanString(metadata.supply_country_name),
        company_email: user.email || cleanString(userProfile?.email),
        main_contact_name: cleanString(metadata.full_name) || cleanString(userProfile?.full_name),
        main_contact_email: user.email || cleanString(userProfile?.email),
      };

      const { data: profile, error: profileError } = await supabase
        .from(PROFILE_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setFormData(fallbackForm);
        setContacts(emptyContacts);
        setDocuments({});
        setProfileId('');
        setError(buildSetupMessage(profileError.message));
        setLoading(false);
        return;
      }

      if (!profile) {
        setFormData(fallbackForm);
        setContacts(emptyContacts);
        setDocuments({});
        setProfileId('');
        setLoading(false);
        return;
      }

      setProfileId(cleanString(profile.profile_id));
      setFormData({
        company_name: cleanString(profile.company_name),
        business_registration_number: cleanString(profile.business_registration_number),
        tax_vat_number: cleanString(profile.tax_vat_number),
        country_iso2: cleanString(profile.country_iso2),
        country_name: cleanString(profile.country_name),
        legal_address: cleanString(profile.legal_address),
        office_address: cleanString(profile.office_address),
        website: cleanString(profile.website),
        company_phone: cleanString(profile.company_phone),
        company_email: cleanString(profile.company_email),
        main_contact_name: cleanString(profile.main_contact_name),
        main_contact_position: cleanString(profile.main_contact_position),
        main_contact_email: cleanString(profile.main_contact_email),
        main_contact_phone: cleanString(profile.main_contact_phone),
        company_description: cleanString(profile.company_description),
        product_categories_text: cleanString(profile.product_categories_text),
        years_in_business: profile.years_in_business === null || profile.years_in_business === undefined ? '' : String(profile.years_in_business),
        bank_account_holder_name: cleanString(profile.bank_account_holder_name),
        bank_name: cleanString(profile.bank_name),
        bank_country_iso2: cleanString(profile.bank_country_iso2),
        bank_country_name: cleanString(profile.bank_country_name),
        bank_address: cleanString(profile.bank_address),
        account_number: cleanString(profile.account_number),
        iban: cleanString(profile.iban),
        swift_bic: cleanString(profile.swift_bic),
        payment_currency: cleanString(profile.payment_currency) || 'USD',
        payment_notes: cleanString(profile.payment_notes),
      });

      const [contactsResult, documentsResult] = await Promise.all([
        supabase.from(CONTACTS_TABLE).select('*').eq('profile_id', profile.profile_id).order('contact_index', { ascending: true }),
        supabase.from(DOCUMENTS_TABLE).select('*').eq('profile_id', profile.profile_id).order('document_slot', { ascending: true }),
      ]);

      if (!active) return;

      if (contactsResult.error) {
        setError(buildSetupMessage(contactsResult.error.message));
      } else {
        const contactRows = (contactsResult.data ?? []) as any[];
        setContacts(
          emptyContacts.map((emptyContact) => {
            const row = contactRows.find((item) => item.contact_index === emptyContact.contact_index);
            return row
              ? {
                  contact_index: emptyContact.contact_index,
                  contact_name: cleanString(row.contact_name),
                  contact_position: cleanString(row.contact_position),
                  contact_email: cleanString(row.contact_email),
                  contact_phone: cleanString(row.contact_phone),
                  contact_whatsapp: cleanString(row.contact_whatsapp),
                  contact_notes: cleanString(row.contact_notes),
                }
              : emptyContact;
          })
        );
      }

      if (documentsResult.error) {
        setError(buildSetupMessage(documentsResult.error.message));
      } else {
        const documentRows = (documentsResult.data ?? []) as DocumentMetadata[];
        const previewEntries = await Promise.all(
          documentRows
            .filter((documentRow) => documentRow.file_mime_type?.startsWith('image/') && documentRow.storage_path)
            .map(async (documentRow) => {
              const { data: signedUrlData } = await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(documentRow.storage_path as string, 60 * 10);
              return [documentRow.document_slot, signedUrlData?.signedUrl || ''] as const;
            })
        );

        if (!active) return;

        setDocumentPreviewUrls(
          previewEntries.reduce<Record<number, string>>((current, [slot, signedUrl]) => {
            if (signedUrl) current[slot] = signedUrl;
            return current;
          }, {})
        );
        setDocuments(
          documentRows.reduce<Record<number, DocumentMetadata>>((current, documentRow) => {
            current[documentRow.document_slot] = documentRow;
            return current;
          }, {})
        );
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  const updateProfileField = (field: keyof ProfileFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const updateCompanyCountry = (iso2: string) => {
    const selectedCountry = countries.find((country) => country.iso2 === iso2);
    setFormData((current) => ({
      ...current,
      country_iso2: selectedCountry?.iso2 ?? '',
      country_name: selectedCountry?.name ?? '',
    }));
  };

  const updateContactField = (contactIndex: number, field: keyof ContactFormData, value: string) => {
    setContacts((current) =>
      current.map((contact) => (contact.contact_index === contactIndex ? { ...contact, [field]: value } : contact))
    );
  };

  const handleFileChange = (slot: number, event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setMessage('');
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFiles((current) => {
        const next = { ...current };
        delete next[slot];
        return next;
      });
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload PDF, JPG, JPEG, or PNG files only.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File is too large. Maximum file size is 10 MB per file.');
      event.target.value = '';
      return;
    }

    setSelectedFiles((current) => ({ ...current, [slot]: file }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id || userId;

    if (authError || !currentUserId) {
      setError(authError?.message || 'You must be signed in to save your supplier company profile.');
      setSaving(false);
      return;
    }

    const yearsValue = formData.years_in_business.trim();
    const profilePayload = {
      user_id: currentUserId,
      company_name: formData.company_name.trim() || null,
      business_registration_number: formData.business_registration_number.trim() || null,
      tax_vat_number: formData.tax_vat_number.trim() || null,
      country_iso2: formData.country_iso2.trim() || null,
      country_name: formData.country_name.trim() || null,
      legal_address: formData.legal_address.trim() || null,
      office_address: formData.office_address.trim() || null,
      website: formData.website.trim() || null,
      company_phone: formData.company_phone.trim() || null,
      company_email: formData.company_email.trim() || null,
      main_contact_name: formData.main_contact_name.trim() || null,
      main_contact_position: formData.main_contact_position.trim() || null,
      main_contact_email: formData.main_contact_email.trim() || null,
      main_contact_phone: formData.main_contact_phone.trim() || null,
      company_description: formData.company_description.trim() || null,
      product_categories_text: formData.product_categories_text.trim() || null,
      years_in_business: yearsValue ? Number(yearsValue) : null,
      bank_account_holder_name: formData.bank_account_holder_name.trim() || null,
      bank_name: formData.bank_name.trim() || null,
      bank_country_iso2: formData.bank_country_iso2.trim() || null,
      bank_country_name: formData.bank_country_name.trim() || null,
      bank_address: formData.bank_address.trim() || null,
      account_number: formData.account_number.trim() || null,
      iban: formData.iban.trim() || null,
      swift_bic: formData.swift_bic.trim() || null,
      payment_currency: formData.payment_currency.trim() || 'USD',
      payment_notes: formData.payment_notes.trim() || null,
    };

    const { data: savedProfile, error: profileError } = await supabase
      .from(PROFILE_TABLE)
      .upsert(profilePayload, { onConflict: 'user_id' })
      .select('profile_id, company_name')
      .single();

    if (profileError || !savedProfile) {
      setError(buildSetupMessage(profileError?.message || 'Unable to save supplier company profile.'));
      setSaving(false);
      return;
    }

    const savedProfileId = savedProfile.profile_id as string;
    setProfileId(savedProfileId);

    const contactPayload = contacts.map((contact) => ({
      profile_id: savedProfileId,
      user_id: currentUserId,
      contact_index: contact.contact_index,
      contact_name: contact.contact_name.trim() || null,
      contact_position: contact.contact_position.trim() || null,
      contact_email: contact.contact_email.trim() || null,
      contact_phone: contact.contact_phone.trim() || null,
      contact_whatsapp: contact.contact_whatsapp.trim() || null,
      contact_notes: contact.contact_notes.trim() || null,
    }));

    const { error: contactsError } = await supabase
      .from(CONTACTS_TABLE)
      .upsert(contactPayload, { onConflict: 'profile_id,contact_index' });

    if (contactsError) {
      setError(buildSetupMessage(contactsError.message));
      setSaving(false);
      return;
    }

    const uploadedDocuments: Record<number, DocumentMetadata> = { ...documents };

    for (const slotConfig of documentSlots) {
      const file = selectedFiles[slotConfig.slot];
      if (!file) continue;

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
      const storagePath = `supplier-documents/${currentUserId}/${slotConfig.slot}-${timestamp}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const documentPayload = {
        profile_id: savedProfileId,
        user_id: currentUserId,
        document_slot: slotConfig.slot,
        document_type: slotConfig.type,
        document_title: slotConfig.label,
        file_name: file.name,
        file_mime_type: file.type,
        file_size_bytes: file.size,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        document_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      };

      const { data: savedDocument, error: documentError } = await supabase
        .from(DOCUMENTS_TABLE)
        .upsert(documentPayload, { onConflict: 'profile_id,document_slot' })
        .select('*')
        .single();

      if (documentError || !savedDocument) {
        setError(buildSetupMessage(documentError?.message || 'Unable to save document metadata.'));
        setSaving(false);
        return;
      }

      uploadedDocuments[slotConfig.slot] = savedDocument as DocumentMetadata;

      if (file.type.startsWith('image/')) {
        const { data: signedUrlData } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 60 * 10);
        setDocumentPreviewUrls((current) => ({ ...current, [slotConfig.slot]: signedUrlData?.signedUrl || '' }));
      }
    }

    setDocuments(uploadedDocuments);
    setSelectedFiles({});
    setMessage('Company profile saved successfully.');
    onSaved((savedProfile.company_name as string | null) || formData.company_name || 'Supplier Account');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Supplier Company Profile</h2>
            <p className="mt-1 text-sm text-slate-600">
              Manage your company information, bank account details, contacts, and verification documents.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {loading && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Loading supplier company profile...</div>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Company Information</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField label="Company name" value={formData.company_name ?? ''} onChange={(value) => updateProfileField('company_name', value)} />
                <TextField label="Business registration number" value={formData.business_registration_number ?? ''} onChange={(value) => updateProfileField('business_registration_number', value)} />
                <TextField label="Tax / VAT number" value={formData.tax_vat_number ?? ''} onChange={(value) => updateProfileField('tax_vat_number', value)} />
                <label className="block">
                  <span className={labelClass}>Company country</span>
                  <select
                    value={formData.country_iso2 ?? ''}
                    onChange={(event) => updateCompanyCountry(event.target.value)}
                    disabled={countriesLoading || Boolean(countriesError)}
                    className={inputClass}
                  >
                    <option value="">{countriesLoading ? 'Loading countries...' : 'Select company country'}</option>
                    {countries.map((country) => (
                      <option key={country.country_id} value={country.iso2}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {countriesError && <span className="mt-1 block text-xs font-semibold text-red-600">{countriesError}</span>}
                </label>
                <TextField label="Website" value={formData.website ?? ''} onChange={(value) => updateProfileField('website', value)} />
                <TextField label="Company phone" value={formData.company_phone ?? ''} onChange={(value) => updateProfileField('company_phone', value)} />
                <TextField label="Company email" value={formData.company_email ?? ''} onChange={(value) => updateProfileField('company_email', value)} type="email" />
                <TextField label="Years in business" value={formData.years_in_business ?? ''} onChange={(value) => updateProfileField('years_in_business', value)} type="number" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextAreaField label="Legal address" value={formData.legal_address ?? ''} onChange={(value) => updateProfileField('legal_address', value)} />
                <TextAreaField label="Office address" value={formData.office_address ?? ''} onChange={(value) => updateProfileField('office_address', value)} />
                <TextAreaField label="Company description" value={formData.company_description ?? ''} onChange={(value) => updateProfileField('company_description', value)} />
                <TextAreaField label="Product categories / supplied product groups" value={formData.product_categories_text ?? ''} onChange={(value) => updateProfileField('product_categories_text', value)} />
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Main Contact</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField label="Main contact name" value={formData.main_contact_name ?? ''} onChange={(value) => updateProfileField('main_contact_name', value)} />
                <TextField label="Main contact position" value={formData.main_contact_position ?? ''} onChange={(value) => updateProfileField('main_contact_position', value)} />
                <TextField label="Main contact email" value={formData.main_contact_email ?? ''} onChange={(value) => updateProfileField('main_contact_email', value)} type="email" />
                <TextField label="Main contact phone" value={formData.main_contact_phone ?? ''} onChange={(value) => updateProfileField('main_contact_phone', value)} />
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Additional Contacts</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {contacts.map((contact) => (
                  <div key={contact.contact_index} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">Contact {contact.contact_index}</p>
                    <div className="mt-3 space-y-3">
                      <TextField label="Contact name" value={contact.contact_name ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_name', value)} />
                      <TextField label="Position" value={contact.contact_position ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_position', value)} />
                      <TextField label="Email" value={contact.contact_email ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_email', value)} type="email" />
                      <TextField label="Phone" value={contact.contact_phone ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_phone', value)} />
                      <TextField label="WhatsApp" value={contact.contact_whatsapp ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_whatsapp', value)} />
                      <TextAreaField label="Notes" value={contact.contact_notes ?? ''} onChange={(value) => updateContactField(contact.contact_index, 'contact_notes', value)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Bank Account / Payout Details</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField label="Bank account holder name" value={formData.bank_account_holder_name ?? ''} onChange={(value) => updateProfileField('bank_account_holder_name', value)} />
                <TextField label="Bank name" value={formData.bank_name ?? ''} onChange={(value) => updateProfileField('bank_name', value)} />
                <TextField label="Bank country" value={formData.bank_country_name ?? ''} onChange={(value) => updateProfileField('bank_country_name', value)} />
                <TextField label="Bank country ISO2" value={formData.bank_country_iso2 ?? ''} onChange={(value) => updateProfileField('bank_country_iso2', value.toUpperCase())} />
                <TextField label="Account number" value={formData.account_number ?? ''} onChange={(value) => updateProfileField('account_number', value)} />
                <TextField label="IBAN" value={formData.iban ?? ''} onChange={(value) => updateProfileField('iban', value.toUpperCase())} />
                <TextField label="SWIFT / BIC" value={formData.swift_bic ?? ''} onChange={(value) => updateProfileField('swift_bic', value.toUpperCase())} />
                <TextField label="Payment currency" value={formData.payment_currency ?? ''} onChange={(value) => updateProfileField('payment_currency', value.toUpperCase())} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextAreaField label="Bank address" value={formData.bank_address ?? ''} onChange={(value) => updateProfileField('bank_address', value)} />
                <TextAreaField label="Payment notes" value={formData.payment_notes ?? ''} onChange={(value) => updateProfileField('payment_notes', value)} />
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Documents</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {documentSlots.map((slotConfig) => {
                  const metadata = documents[slotConfig.slot];
                  const selectedFile = selectedFiles[slotConfig.slot];
                  return (
                    <div key={slotConfig.slot} className="rounded-xl border border-slate-200 bg-white p-4">
                      <DocumentPreview file={selectedFile} metadata={metadata} signedUrl={documentPreviewUrls[slotConfig.slot]} />
                      <div>
                        <p className="mt-3 font-semibold text-slate-900">{slotConfig.label}</p>
                        <p className="mt-1 text-xs text-slate-500">Allowed: PDF, JPG, JPEG, PNG. Max 10 MB.</p>
                      </div>
                      <label className="mt-3 block">
                        <span className={labelClass}>Upload / replace file</span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => handleFileChange(slotConfig.slot, event)} className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
                      </label>
                      <div className="mt-3 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-800">File:</span> {selectedFile?.name || metadata?.file_name || 'No file uploaded'}</p>
                        <p className="mt-1"><span className="font-semibold text-slate-800">Status:</span> {selectedFile ? 'Ready to upload' : metadata?.document_status || 'missing'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <HubButton type="submit" loading={saving} loadingText="Saving..." disabled={loading}>Save Changes</HubButton>
          </div>
        </form>
      </div>
    </div>
  );
}
