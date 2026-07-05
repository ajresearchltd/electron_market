'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type CategoryRow = {
  cat_id: string;
  pic: string | null;
  name: string | null;
  text: string | null;
};

type CategoryForm = {
  cat_id: string;
  pic: string;
  name: string;
  text: string;
};

const emptyForm: CategoryForm = {
  cat_id: '',
  pic: '',
  name: '',
  text: '',
};

const toFormValue = (value: string | null) => value ?? '';
const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function AdminCategoriesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategory, setNewCategory] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<CategoryForm, 'cat_id'>>({ pic: '', name: '', text: '' });
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

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload: Partial<CategoryRow> = {
      pic: toNullable(newCategory.pic),
      name: toNullable(newCategory.name),
      text: toNullable(newCategory.text),
    };

    if (newCategory.cat_id.trim()) {
      payload.cat_id = newCategory.cat_id.trim();
    }

    const { error: insertError } = await supabase.from('category').insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setNewCategory(emptyForm);
      await loadCategories();
    }

    setSaving(false);
  };

  const startEdit = (category: CategoryRow) => {
    setEditingId(category.cat_id);
    setEditForm({
      pic: toFormValue(category.pic),
      name: toFormValue(category.name),
      text: toFormValue(category.text),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ pic: '', name: '', text: '' });
  };

  const saveEdit = async (catId: string) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('category')
      .update({
        pic: toNullable(editForm.pic),
        name: toNullable(editForm.name),
        text: toNullable(editForm.text),
      })
      .eq('cat_id', catId);

    if (updateError) {
      setError(updateError.message);
    } else {
      cancelEdit();
      await loadCategories();
    }

    setSaving(false);
  };

  const deleteCategory = async (catId: string) => {
    const confirmed = window.confirm(`Delete category ${catId}?`);
    if (!confirmed) {
      return;
    }

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
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">cat_id</span>
              <input
                value={newCategory.cat_id}
                onChange={(event) => setNewCategory((current) => ({ ...current, cat_id: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Optional UUID; leave blank for default"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">pic</span>
              <input
                value={newCategory.pic}
                onChange={(event) => setNewCategory((current) => ({ ...current, pic: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="URL, path, or short icon text"
              />
            </label>
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
              <button
                type="submit"
                disabled={saving}
                className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Create Category'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-blue-950/20">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold">Existing Categories</h2>
              <p className="mt-1 text-sm text-slate-500">cat_id is used as the record identifier and is not edited after creation.</p>
            </div>
            <button
              type="button"
              onClick={loadCategories}
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
                            <input
                              value={editForm.pic}
                              onChange={(event) => setEditForm((current) => ({ ...current, pic: event.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          ) : (
                            <span className="text-slate-700">{category.pic || '-'}</span>
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
                                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                                className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
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
