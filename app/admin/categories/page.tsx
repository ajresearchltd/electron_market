'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import HubButton from '../../components/ui/HubButton';

type CategoryRow = {
  cat_id: string;
  pic: string | null;
  name: string | null;
  text: string | null;
};

type CategoryForm = {
  pic: string;
  name: string;
  text: string;
};

const emptyForm: CategoryForm = {
  pic: '',
  name: '',
  text: '',
};

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 2 * 1024 * 1024;
const bucketName = 'category-images';
const bucketErrorMessage = 'Supabase Storage bucket category-images is missing or not public. Create it in Supabase Storage and allow public read access.';

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
        <img src={src} alt="Category preview" className="h-full w-full object-cover" />
      ) : src ? (
        <span className="px-4 text-center text-sm font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="text-sm text-slate-400">No image selected</span>
      )}
    </div>
  );
}

export default function AdminCategoriesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategory, setNewCategory] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<CategoryForm, 'cat_id'>>({ pic: '', name: '', text: '' });
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('category')
      .select('cat_id, pic, name, text')
      .order('name', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setCategories([]);
    } else {
      setCategories(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (createPreview.startsWith('blob:')) URL.revokeObjectURL(createPreview);
      if (editPreview.startsWith('blob:')) URL.revokeObjectURL(editPreview);
    };
  }, [createPreview, editPreview]);

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) {
      return 'Please select a PNG, JPEG, WebP, or SVG image.';
    }

    if (file.size > maxImageSize) {
      return 'Image must be 2 MB or smaller.';
    }

    return null;
  };

  const handleCreateFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    if (createPreview.startsWith('blob:')) URL.revokeObjectURL(createPreview);
    setError(null);
    setCreateFile(file);
    setCreatePreview(URL.createObjectURL(file));
  };

  const handleEditFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    if (editPreview.startsWith('blob:')) URL.revokeObjectURL(editPreview);
    setError(null);
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  };

  const uploadCategoryImage = async (file: File, catIdHint: string) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
    const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'category-image';
    const idPart = catIdHint.trim() || crypto.randomUUID();
    const path = `${idPart}/${Date.now()}-${baseName}.${extension}`;

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

  const resetCreateImage = () => {
    if (createPreview.startsWith('blob:')) URL.revokeObjectURL(createPreview);
    setCreateFile(null);
    setCreatePreview('');
  };

  const resetEditImage = () => {
    if (editPreview.startsWith('blob:')) URL.revokeObjectURL(editPreview);
    setEditFile(null);
    setEditPreview('');
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let picValue = toNullable(newCategory.pic);
      if (createFile) {
        picValue = await uploadCategoryImage(createFile, newCategory.name);
      }

      const payload: Partial<CategoryRow> = {
        pic: picValue,
        name: toNullable(newCategory.name),
        text: toNullable(newCategory.text),
      };


      const { error: insertError } = await supabase.from('category').insert(payload);
      if (insertError) throw new Error(insertError.message);

      setNewCategory(emptyForm);
      resetCreateImage();
      await loadCategories();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create category.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: CategoryRow) => {
    setEditingId(category.cat_id);
    setEditForm({
      pic: toFormValue(category.pic),
      name: toFormValue(category.name),
      text: toFormValue(category.text),
    });
    resetEditImage();
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ pic: '', name: '', text: '' });
    resetEditImage();
  };

  const saveEdit = async (catId: string) => {
    setSaving(true);
    setError(null);

    try {
      let picValue = toNullable(editForm.pic);
      if (editFile) {
        picValue = await uploadCategoryImage(editFile, catId);
      }

      const { error: updateError } = await supabase
        .from('category')
        .update({
          pic: picValue,
          name: toNullable(editForm.name),
          text: toNullable(editForm.text),
        })
        .eq('cat_id', catId);

      if (updateError) throw new Error(updateError.message);

      cancelEdit();
      await loadCategories();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update category.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (catId: string) => {
    const confirmed = window.confirm(`Delete category ${catId}?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from('category')
      .delete()
      .eq('cat_id', catId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      await loadCategories();
    }

    setSaving(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] py-10 text-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            Temporary admin page. Authentication will be added later.
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Homepage Categories Admin</h1>
          <p className="mt-2 text-blue-100">Manage records from the Supabase table category.</p>
          <p className="mt-1 text-sm text-blue-200">Actual fields: cat_id, pic, name, text.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
          <h2 className="text-xl font-bold">Create Category</h2>
          <form onSubmit={createCategory} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 md:col-span-2">cat_id is generated automatically by the database and shown after creation.</div>

            <div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">pic</span>
                <input
                  value={newCategory.pic}
                  onChange={(event) => setNewCategory((current) => ({ ...current, pic: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="URL, path, or short icon text"
                />
              </label>
              <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                Upload image
                <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleCreateFileChange} className="sr-only" />
              </label>
              <ImagePreview src={createPreview || newCategory.pic} />
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">name</span>
              <input
                value={newCategory.name}
                onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">text</span>
              <textarea
                value={newCategory.text}
                onChange={(event) => setNewCategory((current) => ({ ...current, text: event.target.value }))}
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="md:col-span-2">
              <HubButton type="submit" loading={saving} loadingText="Saving...">Create Category</HubButton>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">Existing Categories</h2>
              <p className="mt-1 text-sm text-slate-500">cat_id is used as the record identifier and is not edited after creation.</p>
            </div>
            <HubButton onClick={loadCategories} disabled={saving} loading={loading} loadingText="Refreshing...">Refresh</HubButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">cat_id</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">pic</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">name</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">text</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading categories...</td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No categories found.</td>
                  </tr>
                ) : (
                  categories.map((category) => {
                    const isEditing = editingId === category.cat_id;
                    return (
                      <tr key={category.cat_id} className="align-top hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-semibold text-slate-900">{category.cat_id}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="min-w-64">
                              <input
                                value={editForm.pic}
                                onChange={(event) => setEditForm((current) => ({ ...current, pic: event.target.value }))}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                              <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                                Upload image
                                <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleEditFileChange} className="sr-only" />
                              </label>
                              <ImagePreview src={editPreview || editForm.pic} />
                            </div>
                          ) : (
                            <div className="max-w-56">
                              <ImagePreview src={category.pic || ''} />
                              <p className="mt-2 break-all text-xs text-slate-500">{category.pic || '-'}</p>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <input
                              value={editForm.name}
                              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              required
                            />
                          ) : (
                            <span className="font-medium text-slate-900">{category.name || '-'}</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <textarea
                              value={editForm.text}
                              onChange={(event) => setEditForm((current) => ({ ...current, text: event.target.value }))}
                              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          ) : (
                            <span className="text-slate-700">{category.text || '-'}</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(category.cat_id)}
                                disabled={saving}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 hover:text-white active:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(category)}
                                className="rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCategory(category.cat_id)}
                                disabled={saving}
                                className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
