'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type DiscountRow = {
  id: string;
  company_name: string | null;
  title: string;
  subtitle: string | null;
  image_url: string;
  discount_text: string;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type DiscountForm = {
  company_name: string;
  title: string;
  subtitle: string;
  image_url: string;
  discount_text: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: DiscountForm = {
  company_name: '',
  title: '',
  subtitle: '',
  image_url: '',
  discount_text: '',
  sort_order: '0',
  is_active: true,
};

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 5 * 1024 * 1024;
const bucketName = 'homepage-discount-images';
const bucketErrorMessage = 'Supabase Storage bucket homepage-discount-images is missing or upload policy is missing. Run database/run_in_supabase_sql_editor_create_homepage_discount_images_bucket.sql in Supabase SQL Editor.';

const toFormValue = (value: string | null) => value ?? '';
const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
const isImagePath = (value: string) => value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('blob:');
const sanitizeFileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');

function ImagePreview({ src }: { src: string }) {
  return (
    <div className="mt-3 flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {src && isImagePath(src) ? (
        <img src={src} alt="Special offer preview" className="h-full w-full object-contain p-3" />
      ) : src ? (
        <span className="px-4 text-center text-sm font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="text-sm text-slate-400">No image selected</span>
      )}
    </div>
  );
}

export default function AdminDiscountPricesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [formData, setFormData] = useState<DiscountForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>('Create or edit Special Offers shown under Shop by Categories.');

  const loadDiscounts = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('homepage_marketing_discounts')
      .select('id, company_name, title, subtitle, image_url, discount_text, sort_order, is_active, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setDiscounts([]);
    } else {
      setDiscounts((data ?? []) as DiscountRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  useEffect(() => {
    return () => {
      if (filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) return 'Please select a PNG, JPEG, WebP, or SVG image.';
    if (file.size > maxImageSize) return 'Image must be 5 MB or smaller.';
    return null;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    if (filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setError(null);
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const uploadDiscountImage = async (file: File, hint: string) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
    const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'discount-offer';
    const idPart = sanitizeFileName(hint) || crypto.randomUUID();
    const path = `homepage-discounts/${idPart}/${Date.now()}-${baseName}.${extension}`;

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

  const resetFile = () => {
    if (filePreview.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview('');
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm);
    resetFile();
  };

  const startEdit = (discount: DiscountRow) => {
    setEditingId(discount.id);
    setFormData({
      company_name: toFormValue(discount.company_name),
      title: toFormValue(discount.title),
      subtitle: toFormValue(discount.subtitle),
      image_url: toFormValue(discount.image_url),
      discount_text: toFormValue(discount.discount_text),
      sort_order: String(discount.sort_order ?? 0),
      is_active: Boolean(discount.is_active),
    });
    resetFile();
    setError(null);
    setNotice(`Editing Special Offer: ${discount.title}`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    setNotice(editingId ? 'Saving changes...' : 'Creating Special Offer...');

    try {
      const nextFormData = { ...formData };
      let imageUrl = toNullable(nextFormData.image_url);

      if (selectedFile) {
        imageUrl = await uploadDiscountImage(selectedFile, nextFormData.title || editingId || 'discount-offer');
        nextFormData.image_url = imageUrl ?? '';
        setFormData(nextFormData);
      }

      if (!toNullable(nextFormData.company_name)) throw new Error('Company / participant name is required.');
      if (!toNullable(nextFormData.title)) throw new Error('Title is required.');
      if (!toNullable(nextFormData.discount_text)) throw new Error('Discount text is required.');
      if (!imageUrl || imageUrl.startsWith('blob:')) throw new Error('Offer image must be uploaded before saving.');

      const sortOrderNumber = Number.parseInt(nextFormData.sort_order || '0', 10);
      const payload = {
        company_name: toNullable(nextFormData.company_name),
        title: toNullable(nextFormData.title),
        subtitle: toNullable(nextFormData.subtitle),
        image_url: imageUrl,
        discount_text: toNullable(nextFormData.discount_text),
        sort_order: Number.isNaN(sortOrderNumber) ? 0 : sortOrderNumber,
        is_active: Boolean(nextFormData.is_active),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('homepage_marketing_discounts')
          .update(payload)
          .eq('id', editingId);

        if (updateError) throw new Error(updateError.message);
        setNotice('Special Offer updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('homepage_marketing_discounts')
          .insert(payload);

        if (insertError) throw new Error(insertError.message);
        setNotice('Special Offer created successfully.');
      }

      await loadDiscounts();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save Special Offer.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateDiscount = async (discount: DiscountRow) => {
    const confirmed = window.confirm(`Deactivate Special Offer "${discount.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice('Deactivating...');

    const { error: updateError } = await supabase
      .from('homepage_marketing_discounts')
      .update({ is_active: false })
      .eq('id', discount.id);

    if (updateError) {
      setError(updateError.message);
      setNotice(null);
    } else {
      setNotice('Special Offer deactivated.');
      await loadDiscounts();
      if (editingId === discount.id) resetForm();
    }

    setSaving(false);
  };

  const previewSource = filePreview || formData.image_url;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="bg-[#07152f] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">Admin Control Center</p>
            <h1 className="mt-2 text-3xl font-bold">Discount Prices</h1>
            <p className="mt-2 text-blue-100">Manage the Special Offers cards shown under Shop by Categories.</p>
          </div>
          <Link href="/admin" className="inline-flex h-10 items-center justify-center rounded-md border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10">
            Back to Admin
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:px-8">
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">{editingId ? 'Edit Special Offer' : 'Add Special Offer'}</h2>
              <p className="mt-1 text-sm text-slate-500">Upload an image, set the ribbon text, and control homepage visibility.</p>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>

          {notice && <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Company / participant name</span>
              <input
                value={formData.company_name ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, company_name: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="ElectroMarket Deals"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Title</span>
              <input
                value={formData.title ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Microcontrollers"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Subtitle</span>
              <input
                value={formData.subtitle ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, subtitle: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Bulk MCU sourcing deals"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Discount text</span>
              <input
                value={formData.discount_text ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, discount_text: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="15% OFF"
                required
              />
            </label>

            <div>
              <span className="text-sm font-semibold text-slate-700">Offer image</span>
              <input
                type="file"
                accept={acceptedImageTypes.join(',')}
                onChange={handleFileChange}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />
              <input
                value={formData.image_url ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, image_url: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Uploaded public URL appears here"
              />
              <p className="mt-1 text-xs text-slate-500">Selecting a file uploads it when you save. The saved value must be a public URL, not a blob URL.</p>
              <ImagePreview src={previewSource} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Sort order</span>
                <input
                  type="number"
                  value={formData.sort_order ?? ''}
                  onChange={(event) => setFormData((current) => ({ ...current, sort_order: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_active)}
                  onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving} className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create Special Offer'}
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-950">Existing Special Offers</h2>
            <p className="mt-1 text-sm text-slate-500">Loaded from homepage_marketing_discounts.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Offer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading Special Offers...</td></tr>
                ) : discounts.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No Special Offers found.</td></tr>
                ) : (
                  discounts.map((discount) => (
                    <tr key={discount.id}>
                      <td className="px-4 py-3">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {discount.image_url ? <img src={discount.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No image</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-950">{discount.title}</p>
                        <p className="text-xs font-semibold text-blue-600">{discount.company_name || '-'}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{discount.subtitle || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{discount.discount_text}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{discount.sort_order}</td>
                      <td className="px-4 py-3">
                        <span className={discount.is_active ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600'}>
                          {discount.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => startEdit(discount)} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                            Edit
                          </button>
                          {discount.is_active && (
                            <button type="button" onClick={() => deactivateDiscount(discount)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
