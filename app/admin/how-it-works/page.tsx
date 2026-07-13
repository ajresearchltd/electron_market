'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import HubButton from '../../components/ui/HubButton';

type HomepageContentRow = {
  homepage_content_id: string;
  section_2_pic_1: string | null;
  section_2_name_1: string | null;
  section_2_text_1: string | null;
  section_2_pic_2: string | null;
  section_2_name_2: string | null;
  section_2_text_2: string | null;
  section_2_pic_3: string | null;
  section_2_name_3: string | null;
  section_2_text_3: string | null;
  section_2_pic_4: string | null;
  section_2_name_4: string | null;
  section_2_text_4: string | null;
  section_2_link_button: string | null;
};

type FormState = Omit<HomepageContentRow, 'homepage_content_id'>;
type FieldKey = keyof FormState;
type PicFieldKey = 'section_2_pic_1' | 'section_2_pic_2' | 'section_2_pic_3' | 'section_2_pic_4' | 'section_2_link_button';
type FieldConfig = { key: FieldKey; label: string; textarea?: boolean; upload?: boolean };

const emptyForm: FormState = {
  section_2_pic_1: '',
  section_2_name_1: '',
  section_2_text_1: '',
  section_2_pic_2: '',
  section_2_name_2: '',
  section_2_text_2: '',
  section_2_pic_3: '',
  section_2_name_3: '',
  section_2_text_3: '',
  section_2_pic_4: '',
  section_2_name_4: '',
  section_2_text_4: '',
  section_2_link_button: '',
};

const emptyFiles: Record<PicFieldKey, File | null> = {
  section_2_pic_1: null,
  section_2_pic_2: null,
  section_2_pic_3: null,
  section_2_pic_4: null,
  section_2_link_button: null,
};

const emptyPreviews: Record<PicFieldKey, string> = {
  section_2_pic_1: '',
  section_2_pic_2: '',
  section_2_pic_3: '',
  section_2_pic_4: '',
  section_2_link_button: '',
};

const fields: FieldConfig[] = [
  { key: 'section_2_pic_1', label: 'section_2_pic_1', upload: true },
  { key: 'section_2_name_1', label: 'section_2_name_1' },
  { key: 'section_2_text_1', label: 'section_2_text_1', textarea: true },
  { key: 'section_2_pic_2', label: 'section_2_pic_2', upload: true },
  { key: 'section_2_name_2', label: 'section_2_name_2' },
  { key: 'section_2_text_2', label: 'section_2_text_2', textarea: true },
  { key: 'section_2_pic_3', label: 'section_2_pic_3', upload: true },
  { key: 'section_2_name_3', label: 'section_2_name_3' },
  { key: 'section_2_text_3', label: 'section_2_text_3', textarea: true },
  { key: 'section_2_pic_4', label: 'section_2_pic_4', upload: true },
  { key: 'section_2_name_4', label: 'section_2_name_4' },
  { key: 'section_2_text_4', label: 'section_2_text_4', textarea: true },
  { key: 'section_2_link_button', label: 'section_2_link_button', upload: true },
];

const picFields: PicFieldKey[] = ['section_2_pic_1', 'section_2_pic_2', 'section_2_pic_3', 'section_2_pic_4', 'section_2_link_button'];
const selectFields = ['homepage_content_id', ...fields.map((field) => field.key)].join(', ');
const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 2 * 1024 * 1024;
const bucketName = 'homepage-icons';
const bucketErrorMessage = 'Supabase Storage bucket homepage-icons is missing or not public, or upload policy is missing.';

const toFormValue = (value: string | null) => value ?? '';
const toNullable = (value: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};
const isImagePath = (value: string) => value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('blob:');
const sanitizeFileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const isPicField = (key: FieldKey): key is PicFieldKey => picFields.includes(key as PicFieldKey);

function ImagePreview({ src }: { src: string }) {
  return (
    <div className="mt-3 flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {src && isImagePath(src) ? (
        <img src={src} alt="How it works icon preview" className="h-20 w-20 object-contain" />
      ) : src ? (
        <span className="px-3 text-center text-sm font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="px-3 text-center text-xs text-slate-400">No image selected</span>
      )}
    </div>
  );
}

export default function AdminHowItWorksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<Record<PicFieldKey, File | null>>(emptyFiles);
  const [previews, setPreviews] = useState<Record<PicFieldKey, string>>(emptyPreviews);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const revokeBlobPreviews = (previewMap: Record<PicFieldKey, string>) => {
    picFields.forEach((field) => {
      if (previewMap[field].startsWith('blob:')) {
        URL.revokeObjectURL(previewMap[field]);
      }
    });
  };

  const resetUploads = () => {
    revokeBlobPreviews(previews);
    setFiles(emptyFiles);
    setPreviews(emptyPreviews);
  };

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: queryError } = await supabase
      .from('homepage_content')
      .select(selectFields)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setRecordId(null);
      setForm(emptyForm);
    } else if (!data) {
      setNotice('No homepage_content row found. Create one in Supabase first.');
      setRecordId(null);
      setForm(emptyForm);
    } else {
      const row = data as unknown as HomepageContentRow;
      setRecordId(row.homepage_content_id);
      setForm({
        section_2_pic_1: toFormValue(row.section_2_pic_1),
        section_2_name_1: toFormValue(row.section_2_name_1),
        section_2_text_1: toFormValue(row.section_2_text_1),
        section_2_pic_2: toFormValue(row.section_2_pic_2),
        section_2_name_2: toFormValue(row.section_2_name_2),
        section_2_text_2: toFormValue(row.section_2_text_2),
        section_2_pic_3: toFormValue(row.section_2_pic_3),
        section_2_name_3: toFormValue(row.section_2_name_3),
        section_2_text_3: toFormValue(row.section_2_text_3),
        section_2_pic_4: toFormValue(row.section_2_pic_4),
        section_2_name_4: toFormValue(row.section_2_name_4),
        section_2_text_4: toFormValue(row.section_2_text_4),
        section_2_link_button: toFormValue(row.section_2_link_button),
      });
      resetUploads();
    }

    setLoading(false);
  };

  useEffect(() => {
    loadContent();

    return () => {
      revokeBlobPreviews(previews);
    };
  }, []);

  const updateField = (key: FieldKey) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) {
      return 'Please select a PNG, JPEG, WebP, or SVG image.';
    }

    if (file.size > maxImageSize) {
      return 'Image must be 2 MB or smaller.';
    }

    return null;
  };

  const handleFileChange = (key: PicFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
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
      if (current[key].startsWith('blob:')) {
        URL.revokeObjectURL(current[key]);
      }
      return { ...current, [key]: URL.createObjectURL(file) };
    });
  };

  const uploadIcon = async (key: PicFieldKey, file: File) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
    const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'homepage-icon';
    const path = `how-it-works/${key}/${Date.now()}-${baseName}.${extension}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(`${bucketErrorMessage} ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return publicUrlData.publicUrl || data.path;
  };

  const saveContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(recordId ? 'Saving...' : 'No homepage_content row found, creating first row...');

    try {
      const payload = fields.reduce<Record<string, string | null>>((current, field) => {
        current[field.key] = toNullable(form[field.key]);
        return current;
      }, {});

      for (const field of picFields) {
        if (files[field]) {
          payload[field] = await uploadIcon(field, files[field]);
        }
      }

      if (recordId) {
        const { error: updateError } = await supabase
          .from('homepage_content')
          .update(payload)
          .eq('homepage_content_id', recordId);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('homepage_content')
          .insert(payload);

        if (insertError) throw new Error(insertError.message);
      }

      setNotice('Saved successfully');
      await loadContent();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save How it works content.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] py-10 text-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            Temporary admin page. Authentication will be added later.
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">How it Works Admin</h1>
          <p className="mt-2 text-blue-100">Manage section 2 fields from the Supabase table homepage_content.</p>
          <p className="mt-1 text-sm text-blue-200">Actual fields: {fields.map((field) => field.key).join(', ')}.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {notice}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-xl font-bold">Edit How it works</h2>
              <p className="mt-1 text-sm text-slate-500">
                {recordId ? `homepage_content_id: ${recordId}` : 'No homepage_content row loaded.'}
              </p>
            </div>
            <HubButton onClick={loadContent} disabled={saving} loading={loading} loadingText="Refreshing...">Refresh</HubButton>
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-500">Loading homepage content...</p>
          ) : (
            <form onSubmit={saveContent} className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className={field.textarea ? 'block md:col-span-2' : 'block'}>
                  <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                  {field.textarea ? (
                    <textarea
                      value={form[field.key] ?? ''}
                      onChange={updateField(field.key)}
                      className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  ) : (
                    <input
                      value={form[field.key] ?? ''}
                      onChange={updateField(field.key)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder={field.upload ? 'URL, path, or short icon text' : undefined}
                    />
                  )}

                  {field.upload && isPicField(field.key) && (
                    <div>
                      <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                        Upload icon/image
                        <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleFileChange(field.key)} className="sr-only" />
                      </label>
                      <ImagePreview src={previews[field.key] || form[field.key] || ''} />
                    </div>
                  )}
                </label>
              ))}

              <div className="md:col-span-2">
                <HubButton type="submit" loading={saving} loadingText="Saving...">Save How it works</HubButton>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}


