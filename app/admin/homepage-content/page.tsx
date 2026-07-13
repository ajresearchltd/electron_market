'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import HubButton from '../../components/ui/HubButton';

type FieldConfig = { key: string; label: string };
type FieldGroup = { title: string; description: string; fields: FieldConfig[] };
type HomepageContentRow = Record<string, string | null> & { homepage_content_id: string };

const languageField = 'section_1_language';
const languageOptions = ['English', 'Russian', 'Hebrew', 'French', 'German', 'Spanish', 'Arabic', 'Chinese', 'Other'];

const groups: FieldGroup[] = [
  {
    title: 'Header / Hero',
    description: 'Section 1 header, hero, navigation, buttons, and hero stats.',
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
    fields: [
      'section_2_title_1', 'section_2_title_2', 'section_2_pic_1', 'section_2_name_1', 'section_2_text_1',
      'section_2_pic_2', 'section_2_name_2', 'section_2_text_2', 'section_2_pic_3', 'section_2_name_3', 'section_2_text_3',
      'section_2_pic_4', 'section_2_name_4', 'section_2_text_4', 'section_2_link_button',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Why buyers choose ElectroMarket',
    description: 'Section 5 buyer benefit cards.',
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
    fields: [
      'section_11_title', 'section_11_description',
      'section_11_pic_1', 'section_11_digit_1', 'section_11_text_1', 'section_11_pic_2', 'section_11_digit_2', 'section_11_text_2',
      'section_11_pic_3', 'section_11_digit_3', 'section_11_text_3', 'section_11_pic_4', 'section_11_digit_4', 'section_11_text_4',
      'section_11_pic_5', 'section_11_digit_5', 'section_11_text_5', 'section_11_pic_6', 'section_11_digit_6', 'section_11_text_6',
    ].map((key) => ({ key, label: key })),
  },
  {
    title: 'Footer / Bottom',
    description: 'Section 12 footer, logo, payment/card images, and footer links.',
    fields: [
      'section_12_title', 'section_12_deviz', 'section_12_logo',
      'section_12_pic_card_1', 'section_12_pic_card_1_link', 'section_12_pic_card_2', 'section_12_pic_card_2_link',
      'section_12_pic_card_3', 'section_12_pic_card_3_link', 'section_12_pic_card_4', 'section_12_pic_card_4_link',
      'section_12_pic_card_5', 'section_12_pic_card_5_link', 'section_12_pic_card_6', 'section_12_pic_card_6_link',
      'section_12_how_it_work', 'section_12_how_it_work_link', 'section_12_submit_rfq', 'section_12_submit_rfq_link',
      'section_12_find_supplier', 'section_12_find_supplier_link', 'section_12_help_center', 'section_12_help_center_link',
      'section_12_join_as_supplier', 'section_12_join_as_supplier_link', 'section_12_supplier_guide', 'section_12_supplier_guide_link',
      'section_12_benefit', 'section_12_benefit_link', 'section_12_resources', 'section_12_resources_link',
      'section_12_about_us', 'section_12_about_us_link', 'section_12_news', 'section_12_news_link',
      'section_12_careers', 'section_12_careers_link', 'section_12_partners', 'section_12_partners_link',
      'section_12_contact_us', 'section_12_contact_us_link',
    ].map((key) => ({ key, label: key })),
  },
];

const fields = groups.flatMap((group) => group.fields);
const fieldKeys = [languageField, ...fields.map((field) => field.key)];
const imageFieldKeys = fieldKeys.filter((key) => /pic|logo|image/i.test(key) || /^section_12_pic_card_\d+_link$/.test(key));
const textareaPattern = /description|text|deviz|subtitle/i;
const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 2 * 1024 * 1024;
const bucketName = 'homepage-icons';
const bucketErrorMessage = 'Supabase Storage bucket homepage-icons is missing or not public, or upload policy is missing.';
const selectFields = ['homepage_content_id', ...fieldKeys].join(', ');

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
const isImagePreviewPath = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('blob:') || /\.(png|jpe?g|webp|svg)(\?.*)?$/.test(trimmed) || trimmed.includes('/storage/v1/object/public/');
};
const sanitizeFileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');

function ImagePreview({ src }: { src: string }) {
  return (
    <div className="mt-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {src && isImagePreviewPath(src) ? (
        <img src={src} alt="Homepage content preview" className="h-20 w-20 object-contain" />
      ) : src ? (
        <span className="px-2 text-center text-xs font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="px-2 text-center text-xs text-slate-400">No image selected</span>
      )}
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>('Select a language, then load or create its homepage_content row.');
  const [debugStatus, setDebugStatus] = useState({ rowId: '-', language: 'English', lastSavedAt: '-', lastAction: 'None', lastStatus: 'Idle', lastError: '', result: 'No save yet', payloadName1: '-', payloadText1: '-', returnedName1: '-', returnedText1: '-' });

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
    setDebugStatus((current) => ({ ...current, rowId: '-', language, result: 'No row loaded' }));
    resetUploads();
  };

  const hydrateSavedRow = (row: Record<string, string | null>, result: string, savedAt?: string) => {
    const rowId = String(row.homepage_content_id ?? '');
    const language = row[languageField] ?? selectedLanguage;
    setLoadedRow(row as HomepageContentRow);
    setSelectedLanguage(language);
    setFormData(rowToFormData(row));
    setDebugStatus((current) => ({ ...current, rowId: rowId || '-', language, lastSavedAt: savedAt ?? current.lastSavedAt, lastAction: result, lastStatus: result, lastError: '', result, returnedName1: row.section_2_name_1 ?? '-', returnedText1: row.section_2_text_1 ?? '-' }));
    resetUploads();
  };

  const loadContentByLanguage = async (languageOverride?: string, successMessage?: string) => {
    const language = (languageOverride ?? formData[languageField] ?? selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      setDebugStatus((current) => ({ ...current, result: 'Select language first.' }));
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
    setDebugStatus((current) => ({ ...current, lastAction: 'Load button clicked', lastStatus: 'Load button clicked', lastError: '', result: 'Load button clicked', language: selectedLanguage || current.language }));
    await loadContentByLanguage(undefined, 'Language content loaded successfully');
  };

  useEffect(() => {
    return () => revokeBlobPreviews(previews);
  }, []);

  const createContentRow = async () => {
    setNotice('Create button clicked');
    setDebugStatus((current) => ({ ...current, lastAction: 'Create button clicked', lastStatus: 'Create button clicked', lastError: '', result: 'Create button clicked', language: selectedLanguage || current.language }));

    const language = (formData[languageField] || selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      setDebugStatus((current) => ({ ...current, lastStatus: 'Select language first.', lastError: 'Select language first.', result: 'Select language first.' }));
      return;
    }

    setCreating(true);
    setError(null);
    setNotice('Creating homepage_content row...');
    setDebugStatus((current) => ({ ...current, lastAction: 'Create homepage_content row', lastStatus: 'Creating homepage_content row...', lastError: '', result: 'Creating homepage_content row...', language }));

    const { data: insertedRow, error: insertError } = await supabase
      .from('homepage_content')
      .insert({ [languageField]: language })
      .select(selectFields)
      .single();

    if (insertError) {
      setError(insertError.message);
      setDebugStatus((current) => ({ ...current, lastStatus: insertError.message, lastError: insertError.message, result: insertError.message }));
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

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) return 'Please select a PNG, JPEG, WebP, or SVG image.';
    if (file.size > maxImageSize) return 'Image must be 2 MB or smaller.';
    return null;
  };

  const handleFileChange = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateImageFile(file);
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

  const uploadImageField = async (key: string, file: File) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
    const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'homepage-icon';
    const path = `homepage-content/${key}/${Date.now()}-${baseName}.${extension}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });

    if (uploadError) throw new Error(`${bucketErrorMessage} ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return publicUrlData.publicUrl || data.path;
  };

  const saveContent = async () => {
    setNotice('Save button clicked');
    setDebugStatus((current) => ({ ...current, lastAction: 'Save button clicked', lastStatus: 'Save button clicked', lastError: '', result: 'Save button clicked', language: selectedLanguage || current.language }));

    const language = (formData[languageField] || selectedLanguage).trim();
    if (!language) {
      setError('Select language first.');
      setDebugStatus((current) => ({ ...current, lastStatus: 'Select language first.', lastError: 'Select language first.', result: 'Select language first.' }));
      return;
    }

    setSaving(true);
    setError(null);
    setNotice('Saving homepage_content...');
    setDebugStatus((current) => ({ ...current, lastAction: 'Save homepage_content', lastStatus: 'Saving homepage_content...', lastError: '', result: 'Saving homepage_content...', language }));

    try {
      if (!loadedRow?.homepage_content_id) {
        const message = 'No homepage_content row loaded. Load or create language row first.';
        setError(message);
        setNotice(message);
        setDebugStatus((current) => ({ ...current, lastStatus: message, lastError: message, result: message }));
        return;
      }

      const payload = fieldKeys.reduce<Record<string, string | null>>((current, key) => {
        current[key] = toNullable(formData[key] ?? '');
        return current;
      }, {});
      setDebugStatus((current) => ({ ...current, payloadName1: String(payload.section_2_name_1 ?? '-'), payloadText1: String(payload.section_2_text_1 ?? '-'), lastStatus: 'Payload built from formData', result: 'Payload built from formData' }));

      for (const key of imageFieldKeys) {
        const file = files[key];
        if (file) {
          const publicUrl = await uploadImageField(key, file);
          payload[key] = publicUrl;
          updateField(key, publicUrl);
        }
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('homepage_content')
        .update(payload)
        .eq('homepage_content_id', loadedRow.homepage_content_id)
        .select(selectFields)
        .single();
      if (updateError) throw new Error(updateError.message);
      if (!updatedRow) throw new Error('Save failed: no row was updated.');
      hydrateSavedRow(updatedRow as unknown as Record<string, string | null>, 'Saved successfully', new Date().toLocaleString());
      setNotice('Saved successfully');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save homepage content.';
      setError(message);
      setDebugStatus((current) => ({ ...current, lastStatus: message, lastError: message, result: message }));
    } finally {
      setSaving(false);
    }
  };

  const editingLanguage = formData[languageField] || selectedLanguage;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] py-10 text-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            Temporary admin page. Authentication will be added later.
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Homepage Content Admin</h1>
          <p className="mt-2 text-blue-100">Manage language-specific homepage_content records for non-table homepage sections.</p>
          <p className="mt-1 text-sm text-blue-200">Image-like fields are detected by pic, logo, image, or link in the field name.</p>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 text-slate-950 shadow-xl shadow-blue-950/20">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Temporary save debug</h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="font-semibold text-slate-700">Selected language:</span><br />{selectedLanguage || '-'}</div>
            <div><span className="font-semibold text-slate-700">Loaded row ID:</span><br />{debugStatus.rowId}</div>
            <div><span className="font-semibold text-slate-700">Last action:</span><br />{debugStatus.lastAction}</div>
            <div><span className="font-semibold text-slate-700">Last status:</span><br />{debugStatus.lastStatus}</div>
            <div><span className="font-semibold text-slate-700">Last Supabase error:</span><br />{debugStatus.lastError || '-'}</div>
            <div><span className="font-semibold text-slate-700">Last saved:</span><br />{debugStatus.lastSavedAt}</div>
            <div><span className="font-semibold text-slate-700">Loaded language:</span><br />{debugStatus.language}</div>
            <div><span className="font-semibold text-slate-700">local formData section_2_name_1:</span><br />{formData.section_2_name_1 || '-'}</div>
            <div><span className="font-semibold text-slate-700">local formData section_2_text_1:</span><br />{formData.section_2_text_1 || '-'}</div>
            <div><span className="font-semibold text-slate-700">payload section_2_name_1:</span><br />{debugStatus.payloadName1}</div>
            <div><span className="font-semibold text-slate-700">payload section_2_text_1:</span><br />{debugStatus.payloadText1}</div>
            <div><span className="font-semibold text-slate-700">returned section_2_name_1:</span><br />{debugStatus.returnedName1}</div>
            <div><span className="font-semibold text-slate-700">returned section_2_text_1:</span><br />{debugStatus.returnedText1}</div>
          </div>
        </section>

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
            {groups.map((group) => (
              <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
                <div className="border-b border-slate-200 pb-5">
                  <h2 className="text-xl font-bold">{group.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {group.fields.map((field) => {
                    const imageLike = isImageLikeField(field.key);
                    const textarea = textareaPattern.test(field.key);
                    return (
                      <label key={field.key} className={textarea ? 'block md:col-span-2' : 'block'}>
                        <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                        {textarea ? (
                          <textarea value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        ) : (
                          <input value={formData[field.key] ?? ''} onChange={(event) => updateField(field.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={imageLike ? 'URL, path, or icon text' : undefined} />
                        )}
                        {imageLike && (
                          <div>
                            <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                              Upload image/icon
                              <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleFileChange(field.key)} className="sr-only" />
                            </label>
                            <ImagePreview src={previews[field.key] || formData[field.key] || ''} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className="sticky bottom-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 text-slate-950 shadow-xl backdrop-blur">
              <HubButton onClick={saveContent} loading={saving} loadingText="Saving...">Save homepage_content</HubButton>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}










