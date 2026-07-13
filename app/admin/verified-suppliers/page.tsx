'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import HubButton from '../../components/ui/HubButton';

type SupplierRow = {
  supplier_id: string;
  name: string | null;
  pic: string | null;
  delivery_product: string | null;
};

type SupplierForm = {
  name: string;
  pic: string;
  delivery_product: string;
};

const emptyForm: SupplierForm = {
  name: '',
  pic: '',
  delivery_product: '',
};

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const maxImageSize = 2 * 1024 * 1024;

const toFormValue = (value: string | null) => value ?? '';
const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
const isImagePath = (value: string) => value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('blob:');

function ImagePreview({ src }: { src: string }) {
  return (
    <div className="mt-3 flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {src && isImagePath(src) ? (
        <img src={src} alt="Supplier logo preview" className="h-full w-full object-contain p-3" />
      ) : src ? (
        <span className="px-4 text-center text-sm font-semibold text-slate-600">{src}</span>
      ) : (
        <span className="text-sm text-slate-400">No image selected</span>
      )}
    </div>
  );
}

export default function AdminVerifiedSuppliersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [newSupplier, setNewSupplier] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SupplierForm>(emptyForm);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('verified_supplier')
      .select('supplier_id, name, pic, delivery_product')
      .order('name', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setSuppliers([]);
    } else {
      setSuppliers(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    return () => {
      if (createPreview.startsWith('blob:')) URL.revokeObjectURL(createPreview);
      if (editPreview.startsWith('blob:')) URL.revokeObjectURL(editPreview);
    };
  }, [createPreview, editPreview]);

  const validateImageFile = (file: File) => {
    if (!acceptedImageTypes.includes(file.type)) {
      return 'Please select a PNG, JPEG, or WebP image.';
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

  const createSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const body = new FormData();
      body.set('name', newSupplier.name);
      body.set('pic', newSupplier.pic);
      body.set('delivery_product', newSupplier.delivery_product);
      if (createFile) body.set('file', createFile);
      const response = await fetch('/api/admin/verified-suppliers', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(' '));

      setNewSupplier(emptyForm);
      resetCreateImage();
      await loadSuppliers();
      setSuccess(`Verified supplier created successfully. ID: ${result.supplier.supplier_id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (supplier: SupplierRow) => {
    setEditingId(supplier.supplier_id);
    setEditForm({
      name: toFormValue(supplier.name),
      pic: toFormValue(supplier.pic),
      delivery_product: toFormValue(supplier.delivery_product),
    });
    resetEditImage();
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
    resetEditImage();
  };

  const saveEdit = async (supplierId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.set('name', editForm.name); body.set('pic', editForm.pic); body.set('delivery_product', editForm.delivery_product);
      if (editFile) body.set('file', editFile);
      const response = await fetch(`/api/admin/verified-suppliers/${encodeURIComponent(supplierId)}`, { method: 'PUT', body });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(' '));

      cancelEdit();
      await loadSuppliers();
      setSuccess(`Verified supplier ${supplierId} updated successfully.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update supplier.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    const confirmed = window.confirm(`Delete verified supplier ${supplierId}?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/admin/verified-suppliers/${encodeURIComponent(supplierId)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) {
      setError([result.error, result.detail].filter(Boolean).join(' '));
    } else {
      await loadSuppliers();
      setSuccess(`Verified supplier ${supplierId} deleted successfully.`);
    }

    setSaving(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_30%),linear-gradient(135deg,#061b3f_0%,#082a63_48%,#071632_100%)] py-10 text-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">Administrator access required</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Verified Suppliers Admin</h1>
          <p className="mt-2 text-blue-100">Manage records from the Supabase table verified_supplier.</p>
          <p className="mt-1 text-sm text-blue-200">Actual fields: supplier_id, name, pic, delivery_product.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
          <h2 className="text-xl font-bold">Create Verified Supplier</h2>
          <form onSubmit={createSupplier} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 md:col-span-2">supplier_id is generated automatically by the database and shown after creation.</div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">name</span>
              <input
                value={newSupplier.name}
                onChange={(event) => setNewSupplier((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>

            <div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">pic</span>
                <input
                  value={newSupplier.pic}
                  onChange={(event) => setNewSupplier((current) => ({ ...current, pic: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="URL, path, initials, or short logo text"
                />
              </label>
              <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                Upload image/logo
                <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleCreateFileChange} className="sr-only" />
              </label>
              <ImagePreview src={createPreview || newSupplier.pic} />
            </div>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">delivery_product</span>
              <textarea
                value={newSupplier.delivery_product}
                onChange={(event) => setNewSupplier((current) => ({ ...current, delivery_product: event.target.value }))}
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="md:col-span-2">
              <HubButton type="submit" loading={saving} loadingText="Saving...">Create Verified Supplier</HubButton>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">Existing Verified Suppliers</h2>
              <p className="mt-1 text-sm text-slate-500">supplier_id is used as the record identifier and is not edited after creation.</p>
            </div>
            <HubButton onClick={loadSuppliers} disabled={saving} loading={loading} loadingText="Refreshing...">Refresh</HubButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">supplier_id</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">name</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">pic</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">delivery_product</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading verified suppliers...</td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No verified suppliers found.</td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => {
                    const isEditing = editingId === supplier.supplier_id;
                    return (
                      <tr key={supplier.supplier_id} className="align-top hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-semibold text-slate-900">{supplier.supplier_id}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <input
                              value={editForm.name}
                              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              required
                            />
                          ) : (
                            <span className="font-medium text-slate-900">{supplier.name || '-'}</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="min-w-64">
                              <input
                                value={editForm.pic}
                                onChange={(event) => setEditForm((current) => ({ ...current, pic: event.target.value }))}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                              <label className="mt-3 inline-flex cursor-pointer rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                                Upload image/logo
                                <input type="file" accept={acceptedImageTypes.join(',')} onChange={handleEditFileChange} className="sr-only" />
                              </label>
                              <ImagePreview src={editPreview || editForm.pic} />
                            </div>
                          ) : (
                            <div className="max-w-56">
                              <ImagePreview src={supplier.pic || ''} />
                              <p className="mt-2 break-all text-xs text-slate-500">{supplier.pic || '-'}</p>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <textarea
                              value={editForm.delivery_product}
                              onChange={(event) => setEditForm((current) => ({ ...current, delivery_product: event.target.value }))}
                              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          ) : (
                            <span className="text-slate-700">{supplier.delivery_product || '-'}</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(supplier.supplier_id)}
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
                                onClick={() => startEdit(supplier)}
                                className="rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSupplier(supplier.supplier_id)}
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
