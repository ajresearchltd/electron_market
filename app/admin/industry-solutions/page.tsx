'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type IndustrySolutionRow = {
  ind_id: string;
  title: string | null;
  text: string | null;
  pic: string | null;
};

type IndustrySolutionForm = {
  title: string;
  text: string;
  pic: string;
};

const emptyForm: IndustrySolutionForm = {
  title: '',
  text: '',
  pic: '',
};

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const maxImageSize = 2 * 1024 * 1024;
const bucketName = 'industry-solution-images';
const bucketErrorMessage = 'Supabase Storage bucket industry-solution-images is missing or not public, or upload policy is missing.';

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
        <img src={src} alt="Industry solution preview" className="h-full w-full object-contain p-3" />
      ) : src ? (
        <span className="px-4 text-center text-sm font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="text-sm text-slate-400">No image selected</span>
      )}
    </div>
  );
}

export default function AdminIndustrySolutionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [solutions, setSolutions] = useState<IndustrySolutionRow[]>([]);
  const [formData, setFormData] = useState<IndustrySolutionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>('Select a record or create a new industry solution.');
  const [idInfo, setIdInfo] = useState('ID is generated automatically by the database.');

  const loadSolutions = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('industry_solution')
      .select('ind_id, title, text, pic')
      .order('ind_id', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setSolutions([]);
    } else {
      setSolutions((data ?? []) as IndustrySolutionRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSolutions();
  }, []);

  useEffect(() => {
    return () => {
      if (createPreview.startsWith('blob:')) URL.revokeObjectURL(createPreview);
      if (editPreview.startsWith('blob:')) URL.revokeObjectURL(editPreview);
    };
  }, [createPreview, editPreview]);

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) return 'Please select a PNG, JPEG, WebP, or SVG image.';
    if (file.size > maxImageSize) return 'Image must be 2 MB or smaller.';
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

  const uploadSolutionImage = async (file: File, hint: string) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
    const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')) || 'industry-solution';
    const idPart = sanitizeFileName(hint) || 'temp';
    const path = `industry-solutions/${idPart}/${Date.now()}-${baseName}.${extension}`;

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

  const clearForm = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIdInfo('ID is generated automatically by the database.');
    resetCreateImage();
    resetEditImage();
  };

  const startEdit = (solution: IndustrySolutionRow) => {
    setEditingId(solution.ind_id);
    setFormData({
      title: toFormValue(solution.title),
      text: toFormValue(solution.text),
      pic: toFormValue(solution.pic),
    });
    setIdInfo(`Editing record: ${solution.ind_id}`);
    resetCreateImage();
    resetEditImage();
    setError(null);
    setNotice('Editing existing industry solution.');
  };

  const cancelEdit = () => {
    clearForm();
    setNotice('Edit canceled.');
  };

  const previewSource = editingId ? (editPreview || formData.pic) : (createPreview || formData.pic);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    setNotice(editingId ? 'Saving...' : 'Saving...');

    try {
      const nextFormData: IndustrySolutionForm = { ...formData };
      let picValue = toNullable(nextFormData.pic);

      if (editingId && editFile) {
        picValue = await uploadSolutionImage(editFile, editingId);
        nextFormData.pic = picValue ?? '';
        setFormData(nextFormData);
      }

      if (!editingId && createFile) {
        picValue = await uploadSolutionImage(createFile, nextFormData.title || 'temp');
        nextFormData.pic = picValue ?? '';
        setFormData(nextFormData);
      }

      const payload = {
        title: toNullable(nextFormData.title),
        text: toNullable(nextFormData.text),
        pic: picValue,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('industry_solution')
          .update(payload)
          .eq('ind_id', editingId);

        if (updateError) throw new Error(updateError.message);
        setNotice('Industry Solution updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('industry_solution')
          .insert(payload);

        if (insertError) throw new Error(insertError.message);
        setNotice('Industry Solution created successfully.');
      }

      await loadSolutions();
      clearForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save industry solution.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSolution = async (indId: string) => {
    const confirmed = window.confirm(`Delete industry solution ${indId}?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice('Deleting...');

    const { error: deleteError } = await supabase
      .from('industry_solution')
      .delete()
      .eq('ind_id', indId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setNotice('Deleted successfully');
      await loadSolutions();
      if (editingId === indId) clearForm();
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Industry Solutions Admin</h1>
          <p className="mt-2 text-blue-100">Manage records from the Supabase table industry_solution.</p>
          <p className="mt-1 text-sm text-blue-200">Actual fields: ind_id, title, text, pic.</p>
          <p className="mt-1 text-sm text-blue-200">{idInfo}</p>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
          <h2 className="text-xl font-bold">{editingId ? 'Update Industry Solution' : 'Create Industry Solution'}</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 md:col-span-2">
              ID is generated automatically by the database and is not editable.
            </div>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">title</span>
              <input
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>

            <div className="md:col-span-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">pic</span>
                <input
                  value={formData.pic}
                  onChange={(event) => setFormData((current) => ({ ...current, pic: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="URL, path, or image link"
                />
              </label>
              <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                Upload image
                <input type="file" accept={acceptedImageTypes.join(',')} onChange={editingId ? handleEditFileChange : handleCreateFileChange} className="sr-only" />
              </label>
              <ImagePreview src={previewSource} />
            </div>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">text</span>
              <textarea
                value={formData.text}
                onChange={(event) => setFormData((current) => ({ ...current, text: event.target.value }))}
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Update Industry Solution' : 'Create Industry Solution'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">Existing Industry Solutions</h2>
              <p className="mt-1 text-sm text-slate-500">Records are loaded from industry_solution and edited by ind_id.</p>
            </div>
            <button
              type="button"
              onClick={loadSolutions}
              disabled={loading || saving}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">ind_id</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">pic</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">title</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">text</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading industry solutions...</td>
                  </tr>
                ) : solutions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No industry solutions found.</td>
                  </tr>
                ) : (
                  solutions.map((solution) => (
                    <tr key={solution.ind_id} className="align-top hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-semibold text-slate-900">{solution.ind_id}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="max-w-48">
                          <ImagePreview src={solution.pic || ''} />
                          <p className="mt-2 break-all text-xs text-slate-500">{solution.pic || '-'}</p>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <span className="font-medium text-slate-900">{solution.title || '-'}</span>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <span className="text-slate-700">{solution.text || '-'}</span>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(solution)}
                            className="rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSolution(solution.ind_id)}
                            disabled={saving}
                            className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}


