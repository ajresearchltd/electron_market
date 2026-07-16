'use client';

import { useEffect, useState } from 'react';
import type { FooterConfig, FooterMenuItem } from '../../../lib/footer/config';
import HubButton from '../../components/ui/HubButton';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const checkboxClass = 'h-5 w-5 rounded border-slate-300 accent-violet-700';

export default function WebsiteFooterEditor({ language }: { language: string }) {
  const [footer, setFooter] = useState<FooterConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ groupIndex: number; itemIndex: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/homepage-content/footer?language=${encodeURIComponent(language || 'English')}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Failed to load footer content.');
        if (active) setFooter(result.footer);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load footer content.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [language]);

  const setValue = <K extends keyof FooterConfig>(key: K, value: FooterConfig[K]) => setFooter((current) => current ? { ...current, [key]: value } : current);
  const updateGroup = (groupIndex: number, patch: Partial<FooterConfig['groups'][number]>) => setFooter((current) => current ? { ...current, groups: current.groups.map((group, index) => index === groupIndex ? { ...group, ...patch } : group) } : current);
  const updateItem = (groupIndex: number, itemIndex: number, patch: Partial<FooterMenuItem>) => setFooter((current) => current ? { ...current, groups: current.groups.map((group, index) => index === groupIndex ? { ...group, items: group.items.map((item, nestedIndex) => nestedIndex === itemIndex ? { ...item, ...patch } : item) } : group) } : current);
  const updateSocial = (socialIndex: number, patch: Partial<FooterConfig['socialLinks'][number]>) => setFooter((current) => current ? { ...current, socialLinks: current.socialLinks.map((link, index) => index === socialIndex ? { ...link, ...patch } : link) } : current);

  const addItem = (groupIndex: number) => {
    if (!footer) return;
    const group = footer.groups[groupIndex];
    const suffix = Date.now().toString(36);
    updateGroup(groupIndex, { items: [...group.items, { key: `item_${suffix}`, label: 'New item', href: '#', sortOrder: group.items.length + 1, isEnabled: true, openInNewTab: false }] });
  };

  const addSocialLink = () => setFooter((current) => current ? {
    ...current,
    socialLinks: [...current.socialLinks, { key: `social_${Date.now().toString(36)}`, displayName: 'New social link', url: '', sortOrder: current.socialLinks.length + 1, isEnabled: true, openInNewTab: true }],
  } : current);

  const removeItem = () => {
    if (!footer || !removeTarget) return;
    const group = footer.groups[removeTarget.groupIndex];
    updateGroup(removeTarget.groupIndex, { items: group.items.filter((_, index) => index !== removeTarget.itemIndex) });
    setRemoveTarget(null);
  };

  const saveFooter = async () => {
    if (!footer || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/homepage-content/footer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: language || 'English', footer }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to save footer content.');
      setFooter(result.footer);
      setNotice(result.message || 'Footer content saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save footer content.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl shadow-blue-950/20">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Website Footer</h2>
            {footer && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${footer.isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{footer.isEnabled ? 'Visible' : 'Hidden from public pages'}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Localized text for {language || 'English'}; contact details, URLs, order, and visibility are global.</p>
        </div>
        {footer && (
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-within:ring-2 focus-within:ring-blue-300 focus-within:ring-offset-2 sm:self-auto">
            <input type="checkbox" checked={footer.isEnabled} onChange={(event) => setValue('isEnabled', event.target.checked)} aria-label="Show Website Footer on public pages" className="h-5 w-5 accent-blue-400" />
            Show footer
          </label>
        )}
      </div>

      {loading && <p className="py-6 text-sm font-semibold text-blue-700">Loading footer content…</p>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      {footer && !loading && (
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="font-bold">Brand and contact</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label><span className="text-sm font-semibold">Website name</span><input value={footer.brandName} onChange={(event) => setValue('brandName', event.target.value)} className={inputClass} /></label>
              <label><span className="text-sm font-semibold">Contact email</span><input type="email" value={footer.contactEmail} onChange={(event) => setValue('contactEmail', event.target.value)} className={inputClass} /></label>
              <label className="md:col-span-2"><span className="text-sm font-semibold">Description</span><textarea value={footer.description} onChange={(event) => setValue('description', event.target.value)} className={`${inputClass} min-h-24`} /></label>
              <label><span className="text-sm font-semibold">Contact phone</span><input value={footer.contactPhone} onChange={(event) => setValue('contactPhone', event.target.value)} className={inputClass} /></label>
              <label><span className="text-sm font-semibold">Copyright text</span><input value={footer.copyrightText} onChange={(event) => setValue('copyrightText', event.target.value)} className={inputClass} /></label>
            </div>
          </div>

          <div className="space-y-5">
            <h3 className="font-bold">Footer menu columns</h3>
            {footer.groups.map((group, groupIndex) => (
              <div key={group.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
                  <label><span className="text-sm font-semibold">Column title</span><input value={group.title} onChange={(event) => updateGroup(groupIndex, { title: event.target.value })} className={inputClass} /></label>
                  <label><span className="text-sm font-semibold">Order</span><input type="number" min="0" value={group.sortOrder} onChange={(event) => updateGroup(groupIndex, { sortOrder: Number(event.target.value) })} className={inputClass} /></label>
                  <label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={group.isEnabled} onChange={(event) => updateGroup(groupIndex, { isEnabled: event.target.checked })} className={checkboxClass} /> Enabled</label>
                </div>
                <div className="mt-4 space-y-3">
                  {group.items.map((item, itemIndex) => (
                    <div key={item.key} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_1.3fr_90px_auto_auto_auto] lg:items-end">
                      <label><span className="text-xs font-semibold">Label</span><input value={item.label} onChange={(event) => updateItem(groupIndex, itemIndex, { label: event.target.value })} className={inputClass} /></label>
                      <label><span className="text-xs font-semibold">URL</span><input value={item.href} onChange={(event) => updateItem(groupIndex, itemIndex, { href: event.target.value })} className={inputClass} /></label>
                      <label><span className="text-xs font-semibold">Order</span><input type="number" min="0" value={item.sortOrder} onChange={(event) => updateItem(groupIndex, itemIndex, { sortOrder: Number(event.target.value) })} className={inputClass} /></label>
                      <label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={item.isEnabled} onChange={(event) => updateItem(groupIndex, itemIndex, { isEnabled: event.target.checked })} className={checkboxClass} /> Enabled</label>
                      <label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={item.openInNewTab} onChange={(event) => updateItem(groupIndex, itemIndex, { openInNewTab: event.target.checked })} className={checkboxClass} /> New tab</label>
                      <button type="button" onClick={() => setRemoveTarget({ groupIndex, itemIndex })} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addItem(groupIndex)} className="mt-4 rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Add menu item</button>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-bold">Social links</h3>
            <div className="mt-3 space-y-3">
              {footer.socialLinks.map((link, index) => (
                <div key={link.key} className="grid gap-3 rounded-md border border-slate-200 p-3 lg:grid-cols-[1fr_1.5fr_90px_auto_auto] lg:items-end">
                  <label><span className="text-xs font-semibold">Display name</span><input value={link.displayName} onChange={(event) => updateSocial(index, { displayName: event.target.value })} className={inputClass} /></label>
                  <label><span className="text-xs font-semibold">URL</span><input value={link.url} onChange={(event) => updateSocial(index, { url: event.target.value })} className={inputClass} /></label>
                  <label><span className="text-xs font-semibold">Order</span><input type="number" min="0" value={link.sortOrder} onChange={(event) => updateSocial(index, { sortOrder: Number(event.target.value) })} className={inputClass} /></label>
                  <label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={link.isEnabled} onChange={(event) => updateSocial(index, { isEnabled: event.target.checked })} className={checkboxClass} /> Enabled</label>
                  <label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={link.openInNewTab} onChange={(event) => updateSocial(index, { openInNewTab: event.target.checked })} className={checkboxClass} /> New tab</label>
                </div>
              ))}
            </div>
            <button type="button" onClick={addSocialLink} className="mt-4 rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Add social link</button>
          </div>

          <HubButton onClick={saveFooter} loading={saving} loadingText="Saving Footer...">Save Footer</HubButton>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="remove-footer-item-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 id="remove-footer-item-title" className="text-lg font-bold">Remove menu item?</h3>
            <p className="mt-2 text-sm text-slate-600">This removes the item when you save the footer. Disable it instead if you may need it later.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setRemoveTarget(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={removeItem} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Remove item</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
