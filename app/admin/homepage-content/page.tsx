'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { createDefaultHomepageVisibility, HOMEPAGE_SECTIONS, type HomepageSectionKey } from '../../../lib/homepage/sections';
import HubButton from '../../components/ui/HubButton';
import WebsiteFooterEditor from './WebsiteFooterEditor';
import AdminHubHeader from '../../components/admin/AdminHubHeader';
import WhyBuyersDetailsEditor from './WhyBuyersDetailsEditor';

type FieldConfig = { key: string; label: string };
type FieldGroup = { title: string; description: string; fields: FieldConfig[]; sectionKey?: HomepageSectionKey };
type HomepageContentRow = Record<string, string | null> & { homepage_content_id: string };

const languageField = 'section_1_language';
const languageOptions = ['English', 'Russian', 'Hebrew', 'French', 'German', 'Spanish', 'Arabic', 'Chinese', 'Other'];

const groups: FieldGroup[] = [
  {
    title: 'Header / Hero',
    description: 'Section 1 header, hero, navigation, buttons, and hero stats.',
    sectionKey: 'hero',
    fields: [
      'section_1_country', 'section_1_name', 'section_1_description',
      'section_1_title_of_site', 'section_1_subtitle_of_site', 'section_1_link_to_get_bom', 'section_1_link_to_supplier',
      'section_1_under_title_1', 'section_1_under_title_2', 'section_1_under_title_3', 'section_1_under_title_4',
      'section_1_menu_1', 'section_1_menu_1_link', 'section_1_menu_2', 'section_1_menu_2_link',
      'section_1_menu_3', 'section_1_menu_3_link', 'section_1_menu_4', 'section_1_menu_4_link',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'How it works',
    description: 'Section 2 workflow cards and button/image fields.',
    sectionKey: 'how_it_works',
    fields: [
      'section_2_title_1', 'section_2_title_2', 'section_2_pic_1', 'section_2_name_1', 'section_2_text_1',
      'section_2_pic_2', 'section_2_name_2', 'section_2_text_2', 'section_2_pic_3', 'section_2_name_3', 'section_2_text_3',
      'section_2_pic_4', 'section_2_name_4', 'section_2_text_4', 'section_2_link_button',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Industry Solutions',
    description: 'Section 4 homepage heading and description. Individual cards remain managed in Industry Solutions Admin.',
    sectionKey: 'industry_solutions',
    fields: [
      'section_4_title', 'section_4_description',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Top Verified Suppliers',
    description: 'Section 10 homepage heading and description. Supplier records remain managed in Verified Suppliers Admin.',
    sectionKey: 'top_verified_suppliers',
    fields: [
      'section_10_title', 'section_10_description',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Recent RFQ Requests / Global Logistics Support',
    description: 'Section 9 homepage heading and description. Live RFQ rows remain database-driven.',
    sectionKey: 'recent_rfq',
    fields: [
      'section_9_title', 'section_9_description',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Why buyers choose ElectroMarket',
    description: 'Section 5 buyer benefit cards.',
    sectionKey: 'why_buyers',
    fields: [
      'section_5_title', 'section_5_description',
      'section_5_name_1', 'section_5_text_1', 'section_5_pic_1', 'section_5_name_2', 'section_5_text_2', 'section_5_pic_2',
      'section_5_name_3', 'section_5_text_3', 'section_5_pic_3', 'section_5_name_4', 'section_5_text_4', 'section_5_pic_4',
      'section_5_name_5', 'section_5_text_5', 'section_5_pic_5', 'section_5_name_6', 'section_5_text_6', 'section_5_pic_6',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'For Suppliers: Join Our Network',
    description: 'Section 6 supplier CTA content and cards.',
    sectionKey: 'suppliers_network',
    fields: [
      'section_6_title', 'section_6_description',
      'section_6_title_1', 'section_6_text_1', 'section_6_pic_1', 'section_6_title_2', 'section_6_text_2', 'section_6_pic_2',
      'section_6_title_3', 'section_6_text_3', 'section_6_pic_3', 'section_6_title_4', 'section_6_text_4', 'section_6_pic_4',
      'section_6_simple_1', 'section_6_simple_2', 'section_6_simple_3', 'section_6_simple_4',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Official suppliers and manufacturers',
    description: 'Section 7 official supplier/manufacturer cards.',
    sectionKey: 'official_suppliers',
    fields: [
      'section_7_title', 'section_7_description',
      'section_7_title_1', 'section_7_text_1', 'section_7_pic_1', 'section_7_title_2', 'section_7_text_2', 'section_7_pic_2',
      'section_7_title_3', 'section_7_text_3', 'section_7_pic_3', 'section_7_title_4', 'section_7_text_4', 'section_7_pic_4',
      'section_7_title_5', 'section_7_text_5', 'section_7_pic_5',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Process: From Request to Delivery',
    description: 'Section 8 process steps.',
    sectionKey: 'process',
    fields: [
      'section_8_title', 'section_8_description',
      'section_8_title_1', 'section_8_text_1', 'section_8_pic_1', 'section_8_title_2', 'section_8_text_2', 'section_8_pic_2',
      'section_8_title_3', 'section_8_text_3', 'section_8_pic_3', 'section_8_title_4', 'section_8_text_4', 'section_8_pic_4',
      'section_8_title_5', 'section_8_text_5', 'section_8_pic_5', 'section_8_title_6', 'section_8_text_6', 'section_8_pic_6',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'ElectroMarket in Numbers',
    description: 'Section 11 marketplace numbers.',
    sectionKey: 'marketplace_numbers',
    fields: [
      'section_11_title', 'section_11_description',
      'section_11_pic_1', 'section_11_digit_1', 'section_11_text_1', 'section_11_pic_2', 'section_11_digit_2', 'section_11_text_2',
      'section_11_pic_3', 'section_11_digit_3', 'section_11_text_3', 'section_11_pic_4', 'section_11_digit_4', 'section_11_text_4',
      'section_11_pic_5', 'section_11_digit_5', 'section_11_text_5', 'section_11_pic_6', 'section_11_digit_6', 'section_11_text_6',
    ].map((key) => ({ key, label: key })),
  },
];

const fields = groups.flatMap((group) => group.fields);
const fieldKeys = [languageField, ...fields.map((field) => field.key)];
const imageFieldKeys = fieldKeys.filter((key) => /pic|logo|image/i.test(key));
const textareaPattern = /description|text|deviz|subtitle/i;
const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 2 * 1024 * 1024;
const selectFields = ['homepage_content_id', ...fieldKeys].join(', ');

const managementActions: Partial<Record<HomepageSectionKey, { label: string; href: string }>> = {
  how_it_works: { label: 'Manage How It Works', href: '/admin/how-it-works' },
  categories: { label: 'Manage Categories', href: '/admin/categories' },
  marketing_discounts: { label: 'Manage Discount Prices', href: '/admin/discount-prices' },
  top_verified_suppliers: { label: 'Manage Verified Suppliers', href: '/admin/verified-suppliers' },
  industry_solutions: { label: 'Manage Industry Solutions', href: '/admin/industry-solutions' },
};

const emptyForm = fieldKeys.reduce<Record<string, string>>((current, key) => {
  current[key] = '';
  return current;
}, {});
const emptyFiles = imageFieldKeys.reduce<Record<string, File | null>>((current, key) => {
  current[key] = null;
  return current;
}, {});
const emptyPreviews = imageFieldKeys.reduce<Record<string, string>>((current, key) => {
  current[key] = '';
  return current;
}, {});

const rowToFormData = (row: Record<string, string | null>) => fieldKeys.reduce<Record<string, string>>((current, key) => {
  current[key] = row[key] ?? '';
  return current;
}, {});

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
const isImageLikeField = (key: string) => imageFieldKeys.includes(key);
const isWhyBuyersPhotoField = (key: string) => /^section_5_pic_[1-6]$/.test(key);
const isImagePreviewPath = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('blob:') || /\.(png|jpe?g|webp|svg)(\?.*)?$/.test(trimmed) || trimmed.includes('/storage/v1/object/public/');
};
function ImagePreview({ src, photo = false }: { src: string; photo?: boolean }) {
  return (
    <div className={`mt-3 flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${photo ? 'min-h-[180px] w-full max-w-md' : 'h-24 w-24'}`}>
      {src && isImagePreviewPath(src) ? (
        <img src={src} alt={photo ? 'Why Buyers card photo preview' : 'Homepage content preview'} className={photo ? 'h-[180px] w-full object-cover object-center' : 'h-20 w-20 object-contain'} />
      ) : src ? (
        <span className="px-2 text-center text-xs font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="px-2 text-center text-xs text-slate-400">{photo ? 'Photo not uploaded' : 'No image selected'}</span>
      )}
    </div>
  );
}

type HomepageAdminSectionHeaderProps = {
  title: string;
  description: string;
  sectionKey: HomepageSectionKey;
  isEnabled: boolean;
  savedIsEnabled: boolean;
  isSaving: boolean;
  disabled: boolean;
  action?: { label: string; href: string };
  onEnabledChange: (sectionKey: HomepageSectionKey, isEnabled: boolean) => void;
};

function HomepageAdminSectionHeader({
  title,
  description,
  sectionKey,
  isEnabled,
  savedIsEnabled,
  isSaving,
  disabled,
  action,
  onEnabledChange,
}: HomepageAdminSectionHeaderProps) {
  const isSaved = isEnabled === savedIsEnabled;

  return (
    <div className={`flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between ${isEnabled ? 'border-slate-200' : 'border-slate-300'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${savedIsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
            {isSaving ? 'Saving…' : !isSaved ? 'Save failed' : savedIsEnabled ? 'Visible' : 'Hidden from homepage'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-within:ring-2 focus-within:ring-blue-300 focus-within:ring-offset-2">
        <input
          type="checkbox"
          checked={isEnabled}
          disabled={disabled}
          onChange={(event) => onEnabledChange(sectionKey, event.target.checked)}
          aria-label={`Show ${title} section on homepage`}
          className="h-5 w-5 rounded border-white/60 accent-blue-400"
        />
        Show on homepage
      </label>
      {action && <Link href={action.href} className="admin-primary-button admin-primary-button-compact whitespace-nowrap">{action.label}</Link>}
      </div>
    </div>
  );
}

export default function AdminHomepageContentPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loadedRow, setLoadedRow] = useState<HomepageContentRow | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [formData, setFormData] = useState<Record<string, string>>({ ...emptyForm, [languageField]: 'English' });
  const [files, setFiles] = useState<Record<string, File | null>>(emptyFiles);
  const [previews, setPreviews] = useState<Record<string, string>>(emptyPreviews);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [visibility, setVisibility] = useState(createDefaultHomepageVisibility);
  const [savedVisibility, setSavedVisibility] = useState(createDefaultHomepageVisibility);
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<HomepageSectionKey | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [whyBuyersVisibility, setWhyBuyersVisibility] = useState<boolean[]>(Array<boolean>(6).fill(true));
  const [whyBuyersVisibilityLoading, setWhyBuyersVisibilityLoading] = useState(true);
  const [popupDetailsCard, setPopupDetailsCard] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>('Select a language, then load or create its homepage_content row.');

  const revokeBlobPreviews = (previewMap: Record<string, string>) => {
    Object.values(previewMap).forEach((value) => {
      if (value.startsWith('blob:')) URL.revokeObjectURL(value);
    });
  };

  const resetUploads = () => {
    revokeBlobPreviews(previews);
    setFiles(emptyFiles);
    setPreviews(emptyPreviews);
  };

  const clearLoadedRow = (language: string) => {
    setLoadedRow(null);
    setFormData({ ...emptyForm, [languageField]: language });
    resetUploads();
  };

  const hydrateSavedRow = (row: Record<string, string | null>, _result: string, _savedAt?: string) => {
    const language = row[languageField] ?? selectedLanguage;
    setLoadedRow(row as HomepageContentRow);
    setSelectedLanguage(language);
    setFormData(rowToFormData(row));
    resetUploads();
  };

  const loadContentByLanguage = async (languageOverride?: string, successMessage?: string) => {
    const language = (languageOverride ?? formData[languageField] ?? selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice('Loading...');

    const { data, error: queryError } = await supabase
      .from('homepage_content')
      .select(selectFields)
      .eq(languageField, language)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      clearLoadedRow(language);
    } else if (!data) {
      clearLoadedRow(language);
      setNotice('No homepage_content row found for this language.');
    } else {
      const row = data as unknown as Record<string, string | null>;
      hydrateSavedRow(row, successMessage ?? 'Language content loaded.');
      setNotice(successMessage ?? 'Language content loaded.');
    }

    setLoading(false);
  };

  const handleLoadLanguage = async () => {
    setNotice('Load button clicked');
    await loadContentByLanguage(undefined, 'Language content loaded successfully');
  };

  useEffect(() => {
    return () => revokeBlobPreviews(previews);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setWhyBuyersVisibilityLoading(true);
      try {
        const response = await fetch('/api/admin/homepage-content/save', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.visibility)) throw new Error(result.error || 'Why Buyers card visibility could not be loaded.');
        if (active) setWhyBuyersVisibility(result.visibility.map(Boolean).slice(0, 6));
      } catch (loadError) {
        if (active) setVisibilityError(loadError instanceof Error ? loadError.message : 'Why Buyers card visibility could not be loaded.');
      } finally {
        if (active) setWhyBuyersVisibilityLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadVisibility = async () => {
      setVisibilityLoading(true);
      setVisibilityError(null);
      try {
        const response = await fetch('/api/admin/homepage-content/visibility', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Failed to load homepage section visibility.');
        if (!active) return;
        const next = { ...createDefaultHomepageVisibility(), ...result.settings };
        setVisibility(next);
        setSavedVisibility(next);
      } catch (loadError) {
        if (active) setVisibilityError(loadError instanceof Error ? loadError.message : 'Failed to load homepage section visibility.');
      } finally {
        if (active) setVisibilityLoading(false);
      }
    };

    loadVisibility();
    return () => { active = false; };
  }, []);

  const updateSectionVisibility = async (sectionKey: HomepageSectionKey, isEnabled: boolean) => {
    setVisibility((current) => ({ ...current, [sectionKey]: isEnabled }));
    setSavingSection(sectionKey);
    setVisibilityError(null);

    try {
      const response = await fetch('/api/admin/homepage-content/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionKey, isEnabled }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to save homepage section visibility.');
      setVisibility((current) => ({ ...current, [sectionKey]: result.isEnabled }));
      setSavedVisibility((current) => ({ ...current, [sectionKey]: result.isEnabled }));
    } catch (saveError) {
      setVisibilityError(saveError instanceof Error ? saveError.message : 'Failed to save homepage section visibility.');
    } finally {
      setSavingSection(null);
    }
  };

  const createContentRow = async () => {
    setNotice('Create button clicked');

    const language = (formData[languageField] || selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      return;
    }

    setCreating(true);
    setError(null);
    setNotice('Creating homepage_content row...');

    const { data: insertedRow, error: insertError } = await supabase
      .from('homepage_content')
      .insert({ [languageField]: language })
      .select(selectFields)
      .single();

    if (insertError) {
      setError(insertError.message);
      setError('Homepage content could not be created. Please try again.');
    } else {
      hydrateSavedRow(insertedRow as unknown as Record<string, string | null>, 'Created successfully', new Date().toLocaleString());
      setNotice('Created successfully');
    }

    setCreating(false);
  };

  const updateField = (fieldKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
    if (fieldKey === languageField) setSelectedLanguage(value);
  };

  const handleLanguageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const language = event.target.value;
    updateField(languageField, language);
    if (loadedRow) {
      setNotice('Changing section_1_language changes the logical language identity of this row. Save to apply, or load another language to switch rows.');
    }
  };

  const validateImageFile = (file: File, key: string) => {
    if (!acceptedImageTypes.includes(file.type)) return 'Please select a PNG, JPEG, WebP, or SVG image.';
    if (isWhyBuyersPhotoField(key) && file.type === 'image/svg+xml') return 'Please select a PNG, JPEG, or WebP photograph.';
    if (file.size > maxImageSize) return 'Image must be 2 MB or smaller.';
    return null;
  };

  const handleFileChange = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateImageFile(file, key);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setError(null);
    setFiles((current) => ({ ...current, [key]: file }));
    setPreviews((current) => {
      if (current[key]?.startsWith('blob:')) URL.revokeObjectURL(current[key]);
      return { ...current, [key]: URL.createObjectURL(file) };
    });
  };

  const saveContent = async () => {
    setNotice('Save button clicked');

    const language = (formData[languageField] || selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice('Saving…');

    try {
      if (!loadedRow?.homepage_content_id) {
        const message = 'No homepage_content row loaded. Load or create language row first.';
        setError(message);
        setNotice(message);
        return;
      }

      const payload = fieldKeys.reduce<Record<string, string | null>>((current, key) => {
        current[key] = toNullable(formData[key] ?? '');
        return current;
      }, {});
      const requestBody = new FormData();
      requestBody.set('homepageContentId', loadedRow.homepage_content_id);
      requestBody.set('payload', JSON.stringify(payload));
      requestBody.set('whyBuyersVisibility', JSON.stringify(whyBuyersVisibility));
      for (const key of imageFieldKeys) {
        const file = files[key];
        if (file) requestBody.set(`file:${key}`, file);
      }
      const response = await fetch('/api/admin/homepage-content/save', { method: 'PATCH', body: requestBody });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.row) throw new Error(result.error || 'Homepage content could not be saved. Please try again.');
      if (Array.isArray(result.whyBuyersVisibility)) setWhyBuyersVisibility(result.whyBuyersVisibility.map(Boolean).slice(0, 6));
      hydrateSavedRow(result.row as Record<string, string | null>, 'Saved successfully', new Date().toLocaleString());
      setNotice('Saved successfully');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Homepage content could not be saved. Please try again.';
      setError(message);
      setNotice(message.includes('image') ? 'Upload failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const editingLanguage = formData[languageField] || selectedLanguage;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] text-white">
      <AdminHubHeader title="Homepage Content Admin" description="Manage language-specific homepage content and section visibility." />
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-xl font-bold">Homepage language</h2>
              <p className="mt-1 text-sm text-slate-500">One homepage_content row represents one language version of the homepage.</p>
              <label className="mt-4 block max-w-md">
                <span className="text-sm font-semibold text-slate-700">section_1_language</span>
                <input
                  list="homepage-language-options"
                  value={formData[languageField] ?? ''}
                  onChange={handleLanguageChange}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="English"
                />
                <datalist id="homepage-language-options">
                  {languageOptions.map((language) => <option key={language} value={language} />)}
                </datalist>
              </label>
              <p className="mt-3 text-sm font-semibold text-blue-800">Editing language: {editingLanguage || 'None selected'}</p>
              <p className="mt-1 text-xs text-amber-700">section_1_language is editable, but changing it changes the logical language identity of this row.</p>
              <p className="mt-2 text-sm text-slate-500">{loadedRow?.homepage_content_id ? `homepage_content_id: ${loadedRow.homepage_content_id}` : 'No homepage_content row loaded.'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HubButton onClick={handleLoadLanguage} disabled={saving || creating} loading={loading} loadingText="Loading...">Load language content</HubButton>
              <HubButton onClick={createContentRow} disabled={saving || loading} loading={creating} loadingText="Creating...">Create homepage_content row</HubButton>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-xl shadow-blue-950/20">Loading...</div>
        ) : (
          <div className="space-y-8">
            {visibilityError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{visibilityError}</p>
            )}
            {visibilityLoading && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Loading visibility settings…</p>
            )}

            {HOMEPAGE_SECTIONS.map((section) => {
              const group = groups.find((candidate) => candidate.sectionKey === section.key);
              const title = group?.title ?? section.label;
              const description = group?.description ?? 'Manage whether this complete block is published on the homepage.';

              return (
                <section key={section.key} className={`rounded-xl border bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20 ${visibility[section.key] ? 'border-slate-200' : 'border-slate-300'}`}>
                  <HomepageAdminSectionHeader
                    title={title}
                    description={description}
                    sectionKey={section.key}
                    isEnabled={visibility[section.key]}
                    savedIsEnabled={savedVisibility[section.key]}
                    isSaving={savingSection === section.key}
                    disabled={visibilityLoading || savingSection !== null}
                    action={managementActions[section.key]}
                    onEnabledChange={updateSectionVisibility}
                  />
                  {section.key === 'why_buyers' && whyBuyersVisibility.every((isEnabled) => !isEnabled) && <p role="alert" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">No cards are currently selected for display on the homepage.</p>}
                  {section.key === 'why_buyers' && <div className="mt-6 space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block"><span className="text-sm font-semibold text-slate-700">section_5_title</span><input value={formData.section_5_title ?? ''} onChange={(event) => updateField('section_5_title', event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                      <label className="block"><span className="text-sm font-semibold text-slate-700">section_5_description</span><textarea value={formData.section_5_description ?? ''} onChange={(event) => updateField('section_5_description', event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                    </div>
                    {Array.from({ length: 6 }, (_, cardIndex) => {
                      const cardNumber = cardIndex + 1;
                      const nameKey = `section_5_name_${cardNumber}`;
                      const textKey = `section_5_text_${cardNumber}`;
                      const picKey = `section_5_pic_${cardNumber}`;
                      const currentTitle = formData[nameKey]?.trim();
                      return <section key={cardNumber} data-why-buyers-card-editor={cardNumber} className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50/70">
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                          <h3 className="min-w-0 break-words text-base font-bold text-slate-950">Card {cardNumber}{currentTitle ? ` — ${currentTitle}` : ''}</h3>
                          <div className="flex flex-wrap items-center gap-2"><label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900"><input type="checkbox" aria-label={`Show Card ${cardNumber} on homepage`} checked={whyBuyersVisibility[cardIndex]} disabled={whyBuyersVisibilityLoading || saving} onChange={(event) => setWhyBuyersVisibility((current) => current.map((value, index) => index === cardIndex ? event.target.checked : value))} className="h-5 w-5 accent-violet-700" />Show on homepage</label><button type="button" disabled={!loadedRow?.homepage_content_id} onClick={()=>setPopupDetailsCard(cardNumber)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Edit popup details</button></div>
                        </header>
                        <div className="grid gap-5 p-4 md:grid-cols-2">
                          <label className="block"><span className="text-sm font-semibold text-slate-700">Title</span><input value={formData[nameKey] ?? ''} onChange={(event) => updateField(nameKey, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                          <label className="block"><span className="text-sm font-semibold text-slate-700">Description</span><textarea value={formData[textKey] ?? ''} onChange={(event) => updateField(textKey, event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                          <div className="md:col-span-2"><label className="block"><span className="text-sm font-semibold text-slate-700">Photo URL / path</span><input value={formData[picKey] ?? ''} onChange={(event) => updateField(picKey, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Homepage photo URL or storage path" /></label>
                            <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">{previews[picKey] || formData[picKey] ? 'Replace Photo' : 'Choose Photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange(picKey)} className="sr-only" /></label>
                            <p className="mt-2 text-xs text-slate-500">PNG, JPG/JPEG, or WebP | maximum 2 MB.{files[picKey] ? ' Selected and ready to upload when you save.' : ''}</p>
                            <ImagePreview src={previews[picKey] || formData[picKey] || ''} photo />
                          </div>
                        </div>
                      </section>;
                    })}
                  </div>}
                  {group && section.key !== 'why_buyers' && (
                    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                      {group.fields.map((field) => {
                        const imageLike = isImageLikeField(field.key);
                        const whyBuyersPhoto = isWhyBuyersPhotoField(field.key);
                        const textarea = textareaPattern.test(field.key);
                        return (
                          <label key={field.key} className={textarea ? 'block md:col-span-2' : 'block'}>
                        <span className="text-sm font-semibold text-slate-700">{whyBuyersPhoto ? `Card ${field.key.slice(-1)} photograph` : field.label}</span>
                        {textarea ? (
                          <textarea value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        ) : (
                          <input value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={imageLike ? 'URL, path, or icon text' : undefined} />
                        )}
                        {imageLike && (
                          <div>
                            <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                              {previews[field.key] || formData[field.key] ? (whyBuyersPhoto ? 'Replace Photo' : 'Replace image/icon') : (whyBuyersPhoto ? 'Choose Photo' : 'Upload image/icon')}
                              <input type="file" accept={(whyBuyersPhoto ? acceptedImageTypes.filter((type) => type !== 'image/svg+xml') : acceptedImageTypes).join(',')} onChange={handleFileChange(field.key)} className="sr-only" />
                            </label>
                            {whyBuyersPhoto && <p className="mt-2 text-xs text-slate-500">PNG, JPG/JPEG, or WebP | maximum 2 MB.{files[field.key] ? ' Selected and ready to upload when you save.' : ''}</p>}
                            <ImagePreview src={previews[field.key] || formData[field.key] || ''} photo={whyBuyersPhoto} />
                          </div>
                        )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {groups.filter((group) => !group.sectionKey).map((group) => (
              <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
                <div className="border-b border-slate-200 pb-5">
                  <h2 className="text-xl font-bold">{group.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {group.fields.map((field) => {
                    const imageLike = isImageLikeField(field.key);
                    const whyBuyersPhoto = isWhyBuyersPhotoField(field.key);
                    const textarea = textareaPattern.test(field.key);
                    return (
                      <label key={field.key} className={textarea ? 'block md:col-span-2' : 'block'}>
                        <span className="text-sm font-semibold text-slate-700">{whyBuyersPhoto ? `Card ${field.key.slice(-1)} photograph` : field.label}</span>
                        {textarea ? (
                          <textarea value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        ) : (
                          <input value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={imageLike ? 'URL, path, or icon text' : undefined} />
                        )}
                        {imageLike && (
                          <div>
                            {whyBuyersPhoto && <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900"><input type="checkbox" checked={whyBuyersVisibility[Number(field.key.slice(-1)) - 1]} disabled={whyBuyersVisibilityLoading || saving} onChange={(event) => { const cardIndex = Number(field.key.slice(-1)) - 1; setWhyBuyersVisibility((current) => current.map((value, index) => index === cardIndex ? event.target.checked : value)); }} className="h-5 w-5 accent-violet-700" />Show on homepage</label>}
                            <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                              {previews[field.key] || formData[field.key] ? (whyBuyersPhoto ? 'Replace Photo' : 'Replace image/icon') : (whyBuyersPhoto ? 'Choose Photo' : 'Upload image/icon')}
                              <input type="file" accept={(whyBuyersPhoto ? acceptedImageTypes.filter((type) => type !== 'image/svg+xml') : acceptedImageTypes).join(',')} onChange={handleFileChange(field.key)} className="sr-only" />
                            </label>
                            {whyBuyersPhoto && <p className="mt-2 text-xs text-slate-500">PNG, JPG/JPEG, or WebP | maximum 2 MB.{files[field.key] ? ' Selected and ready to upload when you save.' : ''}</p>}
                            <ImagePreview src={previews[field.key] || formData[field.key] || ''} photo={whyBuyersPhoto} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <WebsiteFooterEditor language={editingLanguage || 'English'} />

            <div className="sticky bottom-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 text-slate-950 shadow-xl backdrop-blur">
              <HubButton onClick={saveContent} loading={saving} loadingText="Saving...">Save homepage_content</HubButton>
            </div>
          </div>
        )}
      </div>
      {popupDetailsCard && loadedRow?.homepage_content_id && <WhyBuyersDetailsEditor homepageContentId={loadedRow.homepage_content_id} cardNumber={popupDetailsCard} cardTitle={formData[`section_5_name_${popupDetailsCard}`] || `Card ${popupDetailsCard}`} onClose={()=>setPopupDetailsCard(null)} />}
    </main>
  );
}










