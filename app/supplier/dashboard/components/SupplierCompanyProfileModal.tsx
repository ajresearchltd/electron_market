'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import { derivePublicProfileCompletion, validateSupplierProfile, type SupplierCompanyProfileEditableData } from '../../../../lib/suppliers/profile-contract';
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
  employee_count: string;
  public_display_name: string;
  public_short_description: string;
  public_detailed_description: string;
  public_city: string;
  public_supplier_type: string;
  public_brands: string;
  public_categories: string;
  logo_url: string;
  cover_image_url: string;
  regions_served: string;
  delivery_countries: string;
  preferred_currencies: string;
  supported_languages: string[];
  minimum_order_value: string;
  minimum_order_currency: string;
  typical_lead_time_min_days: string;
  typical_lead_time_max_days: string;
  response_time_hours: string;
  public_incoterms: string[];
  public_payment_terms: string;
  manufacturing_capabilities: string[];
  engineering_capabilities: string[];
  testing_capabilities: string[];
  quality_control_capabilities: string[];
  custom_sourcing_capabilities: string[];
  additional_capabilities: string[];
  public_profile_status: 'draft'|'pending_review'|'approved'|'rejected'|'suspended';
  pending_review_at: string;
  updated_at: string;
  decision_reason: string;
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

const optionalNumber=(value:string)=>value.trim()===''?null:Number(value);
const publicProfileFromForm=(form:ProfileFormData):SupplierCompanyProfileEditableData=>({
  publicDisplayName:form.public_display_name,publicShortDescription:form.public_short_description,publicDetailedDescription:form.public_detailed_description,country:form.country_name,city:form.public_city,supplierType:form.public_supplier_type,brands:form.public_brands,categories:form.public_categories,logoUrl:form.logo_url,coverImageUrl:form.cover_image_url,regionsServed:form.regions_served,deliveryCountries:form.delivery_countries,preferredCurrencies:form.preferred_currencies,website:form.website,employeeCount:optionalNumber(form.employee_count),supportedLanguages:form.supported_languages,minimumOrderValue:optionalNumber(form.minimum_order_value),minimumOrderCurrency:form.minimum_order_currency,typicalLeadTimeMinDays:optionalNumber(form.typical_lead_time_min_days),typicalLeadTimeMaxDays:optionalNumber(form.typical_lead_time_max_days),responseTimeHours:optionalNumber(form.response_time_hours),publicIncoterms:form.public_incoterms,publicPaymentTerms:form.public_payment_terms,manufacturingCapabilities:form.manufacturing_capabilities,engineeringCapabilities:form.engineering_capabilities,testingCapabilities:form.testing_capabilities,qualityControlCapabilities:form.quality_control_capabilities,customSourcingCapabilities:form.custom_sourcing_capabilities,additionalCapabilities:form.additional_capabilities,
});

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
  employee_count:'',public_display_name:'',public_short_description:'',public_detailed_description:'',public_city:'',public_supplier_type:'',public_brands:'',public_categories:'',logo_url:'',cover_image_url:'',regions_served:'',delivery_countries:'',preferred_currencies:'',supported_languages:[],minimum_order_value:'',minimum_order_currency:'',typical_lead_time_min_days:'',typical_lead_time_max_days:'',response_time_hours:'',public_incoterms:[],public_payment_terms:'',manufacturing_capabilities:[],engineering_capabilities:[],testing_capabilities:[],quality_control_capabilities:[],custom_sourcing_capabilities:[],additional_capabilities:[],public_profile_status:'draft',pending_review_at:'',updated_at:'',decision_reason:'',
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

function TagEditor({label,values,onChange,maxItems=30,maxLength=120,uppercase=false,help}:{label:string;values:string[];onChange:(values:string[])=>void;maxItems?:number;maxLength?:number;uppercase?:boolean;help?:string}) {
  const [draft,setDraft]=useState('');const [localError,setLocalError]=useState('');
  const add=()=>{let value=draft.trim();if(uppercase)value=value.toUpperCase();if(!value)return;if(value.length>maxLength){setLocalError(`Maximum ${maxLength} characters per item.`);return}if(values.some(item=>item.toLowerCase()===value.toLowerCase())){setLocalError('This item has already been added.');return}if(values.length>=maxItems){setLocalError(`Maximum ${maxItems} items.`);return}onChange([...values,value]);setDraft('');setLocalError('')};
  return <fieldset className="rounded-xl border border-slate-200 bg-white p-4"><legend className={labelClass}>{label}</legend>{help&&<p className="mt-1 text-xs text-slate-500">{help}</p>}<div className="mt-3 flex gap-2"><input aria-label={`Add ${label}`} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} className={inputClass.replace('mt-1 ','')} /><button type="button" onClick={add} className="rounded-lg bg-blue-950 px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-400">Add</button></div>{localError&&<p role="alert" className="mt-2 text-xs font-semibold text-red-600">{localError}</p>}<div className="mt-3 flex flex-wrap gap-2">{values.map(value=><span key={value} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-950">{value}<button type="button" aria-label={`Remove ${value}`} onClick={()=>onChange(values.filter(item=>item!==value))} className="rounded-full px-1 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500">×</button></span>)}</div></fieldset>;
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
  const [submitting,setSubmitting]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [submitOpen,setSubmitOpen]=useState(false);
  const [imageUploading,setImageUploading]=useState<'logo'|'cover'|''>('');
  const [imagePreviews,setImagePreviews]=useState<{logo:string;cover:string}>({logo:'',cover:''});
  const [fieldErrors,setFieldErrors]=useState<string[]>([]);
  const [initialState,setInitialState]=useState('');
  const previewButtonRef=useRef<HTMLButtonElement>(null);
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

      const profileResponse=await fetch('/api/supplier/profile',{cache:'no-store'});
      const profileBody=await profileResponse.json().catch(()=>({}));
      const profile=profileBody.profile;
      const profileError=profileResponse.ok?null:{message:profileBody.error||'Supplier Company Profile could not be loaded.'};

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

      setProfileId(cleanString(profileBody.profileKey));
      const loadedForm:ProfileFormData={
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
        employee_count:profile.employee_count==null?'':String(profile.employee_count),public_display_name:cleanString(profile.public_display_name),public_short_description:cleanString(profile.public_short_description),public_detailed_description:cleanString(profile.public_detailed_description),public_city:cleanString(profile.public_city),public_supplier_type:cleanString(profile.public_supplier_type),public_brands:cleanString(profile.public_brands),public_categories:cleanString(profile.public_categories),logo_url:cleanString(profile.logo_url),cover_image_url:cleanString(profile.cover_image_url),regions_served:cleanString(profile.regions_served),delivery_countries:cleanString(profile.delivery_countries),preferred_currencies:cleanString(profile.preferred_currencies),supported_languages:Array.isArray(profile.supported_languages)?profile.supported_languages:[],minimum_order_value:profile.minimum_order_value==null?'':String(profile.minimum_order_value),minimum_order_currency:cleanString(profile.minimum_order_currency),typical_lead_time_min_days:profile.typical_lead_time_min_days==null?'':String(profile.typical_lead_time_min_days),typical_lead_time_max_days:profile.typical_lead_time_max_days==null?'':String(profile.typical_lead_time_max_days),response_time_hours:profile.response_time_hours==null?'':String(profile.response_time_hours),public_incoterms:Array.isArray(profile.public_incoterms)?profile.public_incoterms:[],public_payment_terms:cleanString(profile.public_payment_terms),manufacturing_capabilities:Array.isArray(profile.manufacturing_capabilities)?profile.manufacturing_capabilities:[],engineering_capabilities:Array.isArray(profile.engineering_capabilities)?profile.engineering_capabilities:[],testing_capabilities:Array.isArray(profile.testing_capabilities)?profile.testing_capabilities:[],quality_control_capabilities:Array.isArray(profile.quality_control_capabilities)?profile.quality_control_capabilities:[],custom_sourcing_capabilities:Array.isArray(profile.custom_sourcing_capabilities)?profile.custom_sourcing_capabilities:[],additional_capabilities:Array.isArray(profile.additional_capabilities)?profile.additional_capabilities:[],public_profile_status:['draft','pending_review','approved','rejected','suspended'].includes(profile.public_profile_status)?profile.public_profile_status:'draft',pending_review_at:cleanString(profile.pending_review_at),updated_at:cleanString(profile.updated_at),decision_reason:cleanString(profile.decision_reason),
      };
      setFormData(loadedForm);setInitialState(JSON.stringify({form:loadedForm,contacts:emptyContacts}));setImagePreviews({logo:cleanString(profileBody.imagePreviews?.logo),cover:cleanString(profileBody.imagePreviews?.cover)});

      const [contactsResult, documentsResult] = await Promise.all([
        supabase.from(CONTACTS_TABLE).select('*').eq('profile_id', profileBody.profileKey).order('contact_index', { ascending: true }),
        supabase.from(DOCUMENTS_TABLE).select('*').eq('profile_id', profileBody.profileKey).order('document_slot', { ascending: true }),
      ]);

      if (!active) return;

      if (contactsResult.error) {
        setError(buildSetupMessage(contactsResult.error.message));
      } else {
        const contactRows = (contactsResult.data ?? []) as any[];
        const loadedContacts=emptyContacts.map((emptyContact) => {
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
          });setContacts(loadedContacts);setInitialState(JSON.stringify({form:loadedForm,contacts:loadedContacts}));
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

  const editableProfile=useMemo(()=>publicProfileFromForm(formData),[formData]);
  const completionPercent=useMemo(()=>derivePublicProfileCompletion(editableProfile),[editableProfile]);
  const missingRequired=useMemo(()=>{const values=[['Public display name',editableProfile.publicDisplayName],['Public short description',editableProfile.publicShortDescription],['Public full description',editableProfile.publicDetailedDescription],['Country',editableProfile.country],['Supplier type',editableProfile.supplierType],['Product category or specialization',editableProfile.categories],['Supported language',editableProfile.supportedLanguages.length?'yes':'']];const result=values.filter(([,value])=>!value).map(([label])=>label);if(!editableProfile.regionsServed&&!editableProfile.deliveryCountries)result.push('Delivery region or country');return result},[editableProfile]);
  const dirty=Boolean(initialState)&&JSON.stringify({form:formData,contacts})!==initialState||Object.keys(selectedFiles).length>0;
  useEffect(()=>{if(!isOpen||!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty,isOpen]);
  useEffect(()=>{if(!previewOpen&&!submitOpen)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setPreviewOpen(false);setSubmitOpen(false);previewButtonRef.current?.focus();return}if(event.key==='Tab'){const dialog=document.querySelector<HTMLElement>('[role="dialog"]');const controls=dialog?Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')):[];if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[previewOpen,submitOpen]);

  if (!isOpen) return null;

  const requestClose=()=>{if(dirty&&!window.confirm('You have unsaved changes. Close without saving?'))return;onClose()};

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

  const saveProfile=async(action:'draft'|'submit')=>{const setBusy=action==='submit'?setSubmitting:setSaving;setBusy(true);setError('');setMessage('');setFieldErrors([]);const publicProfile=publicProfileFromForm(formData);const local=validateSupplierProfile(publicProfile);if('errors' in local){setFieldErrors(local.errors);setError('Please correct the public profile fields.');setBusy(false);return false}const privateProfile=Object.fromEntries(['company_name','business_registration_number','tax_vat_number','country_iso2','country_name','legal_address','office_address','website','company_phone','company_email','main_contact_name','main_contact_position','main_contact_email','main_contact_phone','company_description','product_categories_text','years_in_business','bank_account_holder_name','bank_name','bank_country_iso2','bank_country_name','bank_address','account_number','iban','swift_bic','payment_currency','payment_notes'].map(key=>[key,(formData as any)[key]]));const response=await fetch('/api/supplier/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action,privateProfile,publicProfile,contacts})});const body=await response.json().catch(()=>({}));if(!response.ok){setError(body.error||'Supplier Company Profile could not be saved.');setFieldErrors(body.errors||[]);setBusy(false);return false}setProfileId(body.profileKey||profileId);setFormData(current=>({...current,public_profile_status:body.profile.public_profile_status,pending_review_at:body.profile.pending_review_at||'',updated_at:body.profile.updated_at||''}));
    const uploaded={...documents};for(const slot of documentSlots){const file=selectedFiles[slot.slot];if(!file)continue;const data=new FormData();data.set('slot',String(slot.slot));data.set('file',file);const upload=await fetch('/api/supplier/profile/document',{method:'POST',body:data});const uploadBody=await upload.json().catch(()=>({}));if(!upload.ok){setError(uploadBody.error||'Document could not be uploaded.');setBusy(false);return false}uploaded[slot.slot]=uploadBody.document;if(uploadBody.previewUrl)setDocumentPreviewUrls(current=>({...current,[slot.slot]:uploadBody.previewUrl}))}setDocuments(uploaded);setSelectedFiles({});const nextForm={...formData,public_profile_status:body.profile.public_profile_status,pending_review_at:body.profile.pending_review_at||'',updated_at:body.profile.updated_at||''};setInitialState(JSON.stringify({form:nextForm,contacts}));setMessage(body.message||'Supplier Company Profile saved.');onSaved(formData.company_name||'Supplier Account');setBusy(false);return true};
  const handleSubmit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();await saveProfile('draft')};
  const confirmSubmit=async()=>{setSubmitOpen(false);await saveProfile('submit')};
  const uploadImage=async(kind:'logo'|'cover',file?:File)=>{if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024){setError('Use a PNG or JPEG image up to 2 MB.');return}setImageUploading(kind);setError('');const data=new FormData();data.set('kind',kind);data.set('file',file);const response=await fetch('/api/supplier/profile/image',{method:'POST',body:data});const body=await response.json().catch(()=>({}));if(response.ok){setFormData(current=>({...current,[kind==='logo'?'logo_url':'cover_image_url']:body.path,public_profile_status:'draft',pending_review_at:''}));setImagePreviews(current=>({...current,[kind]:body.previewUrl||''}));setMessage(`${kind==='logo'?'Logo':'Cover image'} uploaded.`)}else setError(body.error||'Image could not be uploaded.');setImageUploading('')};
  const removeImage=async(kind:'logo'|'cover')=>{setImageUploading(kind);const response=await fetch(`/api/supplier/profile/image?kind=${kind}`,{method:'DELETE'});if(response.ok){setFormData(current=>({...current,[kind==='logo'?'logo_url':'cover_image_url']:'',public_profile_status:'draft',pending_review_at:''}));setImagePreviews(current=>({...current,[kind]:''}))}else{const body=await response.json().catch(()=>({}));setError(body.error||'Image could not be removed.')}setImageUploading('')};

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
          <button type="button" onClick={requestClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {loading && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Loading supplier company profile...</div>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            {fieldErrors.length>0&&<ul className="rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">{fieldErrors.map(item=><li key={item} className="list-disc">{item}</li>)}</ul>}

            <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-950 to-blue-800 p-5 text-white" aria-labelledby="profile-overview-heading">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h3 id="profile-overview-heading" className="text-xl font-bold">Profile overview</h3><p className="mt-1 text-blue-100">{formData.company_name||'Supplier Company Profile'}</p></div><span className="w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-bold">Status: {formData.public_profile_status.replace('_',' ').replace(/\b\w/g,value=>value.toUpperCase())}</span></div>
              <div className="mt-5"><div className="flex justify-between text-sm font-semibold"><span>Public profile completion</span><span>{completionPercent}%</span></div><div role="progressbar" aria-label={`Public profile completion ${completionPercent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent} className="mt-2 h-3 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{width:`${completionPercent}%`}}/></div></div>
              <div className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><p className="font-bold">Last updated</p><p className="text-blue-100">{formData.updated_at?new Date(formData.updated_at).toLocaleString():'Not saved yet'}</p></div><div><p className="font-bold">Missing required information</p><p className="text-blue-100">{missingRequired.length?missingRequired.join(', '):'All minimum submission fields are complete.'}</p></div></div><p className="mt-4 text-sm text-blue-100">Saving creates a private draft. Public information appears in the Supplier Directory only after a later Admin approval.</p>
            </section>
            {formData.public_profile_status==='pending_review'&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Pending review: your approved public snapshot remains unchanged. Further edits must be saved and resubmitted.</div>}
            {formData.public_profile_status==='rejected'&&<div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><strong>Profile returned for changes.</strong>{formData.decision_reason&&<p className="mt-2">Reason: {formData.decision_reason}</p>}<p className="mt-2">Edit the draft, save it, and submit again when ready.</p></div>}
            {formData.public_profile_status==='suspended'&&<div className="rounded-xl border border-slate-400 bg-slate-100 p-4 text-sm font-semibold text-slate-900">This public profile is suspended. Your data is preserved, but Supplier-side changes and publication are unavailable.</div>}

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
                <TextField label="Employee count" value={formData.employee_count} onChange={(value)=>updateProfileField('employee_count',value)} type="number" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextAreaField label="Legal address" value={formData.legal_address ?? ''} onChange={(value) => updateProfileField('legal_address', value)} />
                <TextAreaField label="Office address" value={formData.office_address ?? ''} onChange={(value) => updateProfileField('office_address', value)} />
                <TextAreaField label="Company description" value={formData.company_description ?? ''} onChange={(value) => updateProfileField('company_description', value)} />
                <TextAreaField label="Product categories / supplied product groups" value={formData.product_categories_text ?? ''} onChange={(value) => updateProfileField('product_categories_text', value)} />
              </div>
            </section>

            <section className={sectionClass} aria-labelledby="public-profile-heading"><h3 id="public-profile-heading" className={sectionTitleClass}>Public Supplier Profile</h3><p className="mt-1 text-sm text-slate-600">This information may be displayed in the public Supplier Directory after Admin approval.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><TextField label="Public display name" value={formData.public_display_name} onChange={value=>updateProfileField('public_display_name',value)}/><TextField label="Public city" value={formData.public_city} onChange={value=>updateProfileField('public_city',value)}/><TextField label="Supplier type" value={formData.public_supplier_type} onChange={value=>updateProfileField('public_supplier_type',value)}/><TextField label="Public website" value={formData.website} onChange={value=>updateProfileField('website',value)}/><TextAreaField label="Public short description" value={formData.public_short_description} onChange={value=>updateProfileField('public_short_description',value)}/><TextAreaField label="Public product categories" value={formData.public_categories} onChange={value=>updateProfileField('public_categories',value)}/><TextAreaField label="Public full description" value={formData.public_detailed_description} onChange={value=>updateProfileField('public_detailed_description',value)}/><TextAreaField label="Brands / manufacturers" value={formData.public_brands} onChange={value=>updateProfileField('public_brands',value)}/></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">{(['logo','cover'] as const).map(kind=><div key={kind} className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-bold text-slate-900">{kind==='logo'?'Company logo':'Public cover image'}</p><div className="mt-3 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-100">{imagePreviews[kind]?<img src={imagePreviews[kind]} alt={kind==='logo'?'Current company logo':'Current public cover'} className="h-full w-full object-contain"/>:<span className="text-sm text-slate-500">No image selected</span>}</div><p className="mt-2 text-xs text-slate-500">PNG or JPEG, maximum 2 MB. Stored privately until Admin approval.</p><div className="mt-3 flex flex-wrap gap-2"><label className="cursor-pointer rounded-lg bg-blue-950 px-3 py-2 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-blue-500">{imagePreviews[kind]?'Replace image':'Choose image'}<input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={Boolean(imageUploading)} onChange={event=>uploadImage(kind,event.target.files?.[0])}/></label>{imagePreviews[kind]&&<button type="button" onClick={()=>removeImage(kind)} disabled={Boolean(imageUploading)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700">Remove image</button>}</div>{imageUploading===kind&&<p role="status" className="mt-2 text-sm text-blue-700">Uploading image...</p>}</div>)}</div>
            </section>

            <section className={sectionClass}><h3 className={sectionTitleClass}>Products and Capabilities</h3><p className="mt-1 text-sm text-slate-600">Describe capabilities only; stock and product rows remain managed in their existing workflows.</p><div className="mt-4 grid gap-4 lg:grid-cols-2"><TagEditor label="Manufacturing capabilities" values={formData.manufacturing_capabilities} onChange={values=>setFormData(current=>({...current,manufacturing_capabilities:values}))}/><TagEditor label="Engineering capabilities" values={formData.engineering_capabilities} onChange={values=>setFormData(current=>({...current,engineering_capabilities:values}))}/><TagEditor label="Testing capabilities" values={formData.testing_capabilities} onChange={values=>setFormData(current=>({...current,testing_capabilities:values}))}/><TagEditor label="Quality-control capabilities" values={formData.quality_control_capabilities} onChange={values=>setFormData(current=>({...current,quality_control_capabilities:values}))}/><TagEditor label="Custom-sourcing capabilities" values={formData.custom_sourcing_capabilities} onChange={values=>setFormData(current=>({...current,custom_sourcing_capabilities:values}))}/><TagEditor label="Additional capabilities" values={formData.additional_capabilities} onChange={values=>setFormData(current=>({...current,additional_capabilities:values}))}/></div></section>

            <section className={sectionClass}><h3 className={sectionTitleClass}>Commercial Terms</h3><p className="mt-1 text-sm text-slate-600">Public terms are indicative and are not binding quotations.</p><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><TextField label="Minimum order value" value={formData.minimum_order_value} onChange={value=>updateProfileField('minimum_order_value',value)} type="number"/><TextField label="Minimum order currency" value={formData.minimum_order_currency} onChange={value=>updateProfileField('minimum_order_currency',value.toUpperCase())}/><TextField label="Response time (hours)" value={formData.response_time_hours} onChange={value=>updateProfileField('response_time_hours',value)} type="number"/><TextField label="Typical lead time minimum (days)" value={formData.typical_lead_time_min_days} onChange={value=>updateProfileField('typical_lead_time_min_days',value)} type="number"/><TextField label="Typical lead time maximum (days)" value={formData.typical_lead_time_max_days} onChange={value=>updateProfileField('typical_lead_time_max_days',value)} type="number"/><TextField label="Preferred currencies (uppercase, comma-separated existing field)" value={formData.preferred_currencies} onChange={value=>updateProfileField('preferred_currencies',value.toUpperCase())}/></div><div className="mt-4 grid gap-4 md:grid-cols-2"><TagEditor label="Public Incoterms" values={formData.public_incoterms} onChange={values=>setFormData(current=>({...current,public_incoterms:values}))} maxItems={20} maxLength={40} uppercase/><TextAreaField label="Public payment terms" value={formData.public_payment_terms} onChange={value=>updateProfileField('public_payment_terms',value)}/></div></section>

            <section className={sectionClass}><h3 className={sectionTitleClass}>Service and Delivery Coverage</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><TagEditor label="Supported languages" values={formData.supported_languages} onChange={values=>setFormData(current=>({...current,supported_languages:values}))} maxItems={20} maxLength={40}/><TextAreaField label="Regions served" value={formData.regions_served} onChange={value=>updateProfileField('regions_served',value)}/><TextAreaField label="Delivery countries" value={formData.delivery_countries} onChange={value=>updateProfileField('delivery_countries',value)}/></div></section>

            <section className={sectionClass}>
              <h3 className={sectionTitleClass}>Main Contact</h3>
              <p className="mt-1 text-sm text-slate-600">Contact information is used by Electron Market for supplier communication and is not automatically published in the public Supplier Directory.</p>
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
              <h3 className={sectionTitleClass}>Private Banking Information</h3>
              <p className="mt-1 text-sm font-semibold text-slate-700">Banking information is never displayed in the public Supplier Directory.</p>
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
              <h3 className={sectionTitleClass}>Documents and Verification</h3>
              <p className="mt-1 text-sm text-slate-600">Uploaded legal and verification documents remain private unless Admin explicitly approves a safe public certificate representation in a later phase.</p>
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

          <div className="sticky bottom-0 mt-6 flex flex-col items-stretch justify-end gap-3 border-t border-slate-200 bg-white py-4 sm:flex-row sm:items-center">
            <button type="button" onClick={requestClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Cancel
            </button>
            <button ref={previewButtonRef} type="button" onClick={()=>setPreviewOpen(true)} className="rounded-lg border border-blue-900 px-4 py-2.5 text-sm font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500">Preview public profile</button>
            <HubButton type="submit" loading={saving} loadingText="Saving..." disabled={loading||submitting||formData.public_profile_status==='suspended'}>Save draft</HubButton>
            <HubButton type="button" onClick={()=>setSubmitOpen(true)} loading={submitting} loadingText="Submitting..." disabled={loading||saving||formData.public_profile_status==='pending_review'||formData.public_profile_status==='suspended'}>Submit for review</HubButton>
          </div>
        </form>
      </div>
      {previewOpen&&<div role="dialog" aria-modal="true" aria-labelledby="supplier-preview-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><h3 id="supplier-preview-title" className="text-xl font-bold text-blue-950">Public profile preview</h3><button autoFocus type="button" onClick={()=>{setPreviewOpen(false);previewButtonRef.current?.focus()}} className="rounded-lg border px-3 py-2 font-bold focus:ring-2 focus:ring-blue-500">Close</button></div>{imagePreviews.cover&&<img src={imagePreviews.cover} alt="Public supplier cover preview" className="h-56 w-full object-cover"/>}<div className="p-6">{imagePreviews.logo&&<img src={imagePreviews.logo} alt="Public supplier logo preview" className="mb-4 h-24 w-24 rounded-xl object-contain"/>}<h4 className="text-3xl font-bold text-blue-950">{editableProfile.publicDisplayName||formData.company_name}</h4>{[editableProfile.country,editableProfile.city,editableProfile.supplierType].filter(Boolean).length>0&&<p className="mt-2 text-slate-600">{[editableProfile.country,editableProfile.city,editableProfile.supplierType].filter(Boolean).join(' · ')}</p>}{editableProfile.publicShortDescription&&<p className="mt-5 text-lg font-semibold text-slate-800">{editableProfile.publicShortDescription}</p>}{editableProfile.publicDetailedDescription&&<p className="mt-4 whitespace-pre-wrap text-slate-700">{editableProfile.publicDetailedDescription}</p>}<div className="mt-6 grid gap-4 md:grid-cols-2">{([['Categories',editableProfile.categories],['Brands / manufacturers',editableProfile.brands],['Languages',editableProfile.supportedLanguages.join(', ')],['Capabilities',[...editableProfile.manufacturingCapabilities,...editableProfile.engineeringCapabilities,...editableProfile.testingCapabilities,...editableProfile.qualityControlCapabilities,...editableProfile.customSourcingCapabilities,...editableProfile.additionalCapabilities].join(', ')],['Minimum order',editableProfile.minimumOrderValue===null?'':`${editableProfile.minimumOrderValue} ${editableProfile.minimumOrderCurrency}`],['Typical lead time',editableProfile.typicalLeadTimeMinDays===null&&editableProfile.typicalLeadTimeMaxDays===null?'':`${editableProfile.typicalLeadTimeMinDays??'—'}–${editableProfile.typicalLeadTimeMaxDays??'—'} days`],['Response target',editableProfile.responseTimeHours===null?'':`${editableProfile.responseTimeHours} hours`],['Incoterms',editableProfile.publicIncoterms.join(', ')],['Currencies',editableProfile.preferredCurrencies],['Delivery regions',editableProfile.regionsServed||editableProfile.deliveryCountries],['Public payment terms',editableProfile.publicPaymentTerms]] as [string,string][]).filter(([,value])=>Boolean(value)).map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-blue-700">{label}</p><p className="mt-2 text-slate-800">{value}</p></div>)}</div></div></div></div>}
      {submitOpen&&<div role="dialog" aria-modal="true" aria-labelledby="submit-review-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h3 id="submit-review-title" className="text-xl font-bold text-blue-950">Submit public profile for review?</h3><p className="mt-3 text-sm text-slate-600">Your valid draft will be saved and marked Pending review. This does not publish or approve the profile.</p>{missingRequired.length>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Still required: {missingRequired.join(', ')}</p>}<div className="mt-6 flex justify-end gap-3"><button autoFocus type="button" onClick={()=>setSubmitOpen(false)} className="rounded-lg border px-4 py-2 font-bold focus:ring-2 focus:ring-blue-500">Cancel</button><button type="button" onClick={confirmSubmit} disabled={missingRequired.length>0} className="rounded-lg bg-blue-950 px-4 py-2 font-bold text-white disabled:opacity-50 focus:ring-2 focus:ring-blue-500">Confirm submission</button></div></div></div>}
    </div>
  );
}
