'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import HubButton from '../../../components/ui/HubButton';

type CategoryRow = {
  cat_id: string;
  name: string;
  type_of_product: string | null;
};

type TypeProductRow = {
  type_id: string;
  title: string;
  description: string | null;
};

type ManufacturerRow = {
  manufacturer_id: string;
  manufacturer_name: string;
};

type SupplierProfileRow = {
  company_name: string | null;
  country_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  main_contact_name: string | null;
};

type ProductForm = {
  productName: string;
  sku: string;
  manufacturerId: string;
  manufacturerName: string;
  mpn: string;
  category: string;
  subcategory: string;
  productType: string;
  condition: string;
  shortDescription: string;
  fullDescription: string;
  price: string;
  currency: string;
  compareAtPrice: string;
  moq: string;
  stockQuantity: string;
  leadTime: string;
  unitType: string;
  originCountry: string;
  hsCode: string;
  warranty: string;
  rohsCompliant: boolean;
  reachCompliant: boolean;
  certificationText: string;
  datasheetUrl: string;
  productVideoUrl: string;
  productVideoDescription: string;
  tags: string;
  isActive: boolean;
};

type SpecRow = {
  name: string;
  value: string;
  unit: string;
};

type ImageSlot = {
  file: File | null;
  previewUrl: string;
};

const initialForm: ProductForm = {
  productName: '',
  sku: '',
  manufacturerId: '',
  manufacturerName: '',
  mpn: '',
  category: '',
  subcategory: '',
  productType: '',
  condition: 'New',
  shortDescription: '',
  fullDescription: '',
  price: '',
  currency: 'USD',
  compareAtPrice: '',
  moq: '1',
  stockQuantity: '0',
  leadTime: '',
  unitType: 'pcs',
  originCountry: '',
  hsCode: '',
  warranty: '',
  rohsCompliant: false,
  reachCompliant: false,
  certificationText: '',
  datasheetUrl: '',
  productVideoUrl: '',
  productVideoDescription: '',
  tags: '',
  isActive: false,
};

const emptyImageSlots = () => Array.from({ length: 9 }, () => ({ file: null, previewUrl: '' }));
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-sm font-semibold text-slate-700';
const sectionClass = 'rounded-2xl border border-blue-100 bg-blue-50 p-5';

const sanitizeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'product-image';
const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};
const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const calculateDiscount = (priceText: string, compareText: string) => {
  const price = Number(priceText);
  const compare = Number(compareText);
  if (!Number.isFinite(price) || !Number.isFinite(compare) || compare <= price || compare <= 0) return null;
  return Number((((compare - price) / compare) * 100).toFixed(2));
};

const requiredStar = <span className="text-red-500">*</span>;

export default function SupplierAddProductPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [specs, setSpecs] = useState<SpecRow[]>([{ name: '', value: '', unit: '' }]);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>(emptyImageSlots);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [types, setTypes] = useState<TypeProductRow[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      setLoadingLookups(true);
      const [categoryResult, typeResult, manufacturerResult] = await Promise.all([
        supabase.from('category').select('cat_id, name, type_of_product').order('name', { ascending: true }),
        supabase.from('type_product').select('type_id, title, description').order('title', { ascending: true }),
        supabase.from('manufacturers').select('manufacturer_id, manufacturer_name').order('manufacturer_name', { ascending: true }),
      ]);

      if (!active) return;
      if (categoryResult.error) setError(categoryResult.error.message);
      setCategories((categoryResult.data ?? []) as CategoryRow[]);
      setTypes((typeResult.data ?? []) as TypeProductRow[]);
      setManufacturers((manufacturerResult.data ?? []) as ManufacturerRow[]);
      setLoadingLookups(false);
    };

    loadLookups();

    return () => {
      active = false;
      imageSlots.forEach((slot) => {
        if (slot.previewUrl.startsWith('blob:')) URL.revokeObjectURL(slot.previewUrl);
      });
    };
  }, [supabase]);

  const updateForm = (field: keyof ProductForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMissingFields((current) => current.filter((missing) => missing !== field && !((field === 'manufacturerName' || field === 'manufacturerId') && missing === 'manufacturer')));
  };

  const fieldClass = (field: keyof ProductForm | 'manufacturer') => {
    const hasError = missingFields.includes(field);
    return `${inputClass} ${hasError ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' : ''}`;
  };

  const labelText = (text: string, required = false) => (
    <span className={labelClass}>
      {text} {required && requiredStar}
    </span>
  );

  const validateForm = () => {
    const missing: string[] = [];
    if (!form.productName.trim()) missing.push('productName');
    if (!form.sku.trim()) missing.push('sku');
    if (!form.category.trim()) missing.push('category');
    if (!form.condition.trim()) missing.push('condition');
    if (!form.shortDescription.trim()) missing.push('shortDescription');
    if (!form.price.trim()) missing.push('price');
    if (!form.currency.trim()) missing.push('currency');
    if (!form.moq.trim()) missing.push('moq');
    if (!form.stockQuantity.trim()) missing.push('stockQuantity');
    if (!form.manufacturerId && !form.manufacturerName.trim()) missing.push('manufacturer');
    return missing;
  };

  const fieldLabel = (field: string) => ({
    productName: 'Product Name',
    sku: 'Part Number / SKU',
    category: 'Category',
    manufacturer: 'Manufacturer',
    condition: 'Product Condition',
    shortDescription: 'Short Description',
    price: 'Price',
    currency: 'Currency',
    moq: 'MOQ',
    stockQuantity: 'Available Stock',
  }[field] ?? field);

  const updateSpec = (index: number, field: keyof SpecRow, value: string) => {
    setSpecs((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const addSpec = () => setSpecs((current) => [...current, { name: '', value: '', unit: '' }]);
  const removeSpec = (index: number) => setSpecs((current) => current.filter((_, rowIndex) => rowIndex !== index));

  const updateImage = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!acceptedImageTypes.includes(file.type)) {
      setError('Please upload JPG, PNG, or WEBP product images.');
      event.target.value = '';
      return;
    }

    setImageSlots((current) => current.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      if (slot.previewUrl.startsWith('blob:')) URL.revokeObjectURL(slot.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    }));
  };

  const removeImage = (index: number) => {
    setImageSlots((current) => current.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      if (slot.previewUrl.startsWith('blob:')) URL.revokeObjectURL(slot.previewUrl);
      return { file: null, previewUrl: '' };
    }));
  };

  const resolveSupplierId = async (userId: string, email: string | undefined) => {
    const { data: profile } = await supabase
      .from('supplier_company_profiles')
      .select('company_name, country_name, company_email, company_phone, main_contact_name')
      .eq('user_id', userId)
      .maybeSingle();

    const supplierProfile = profile as SupplierProfileRow | null;
    const supplierEmail = supplierProfile?.company_email || email || '';
    const companyName = supplierProfile?.company_name || 'Supplier Account';

    if (supplierEmail) {
      const { data: contactEmailSupplier } = await supabase
        .from('suppliers')
        .select('supplier_id')
        .eq('contact_email', supplierEmail)
        .maybeSingle();
      if (contactEmailSupplier?.supplier_id) return contactEmailSupplier.supplier_id as string;

      const { data: emailSupplier } = await supabase
        .from('suppliers')
        .select('supplier_id')
        .eq('email', supplierEmail)
        .maybeSingle();
      if (emailSupplier?.supplier_id) return emailSupplier.supplier_id as string;
    }

    const { data: companySupplier } = await supabase
      .from('suppliers')
      .select('supplier_id')
      .eq('company_name', companyName)
      .maybeSingle();
    if (companySupplier?.supplier_id) return companySupplier.supplier_id as string;

    const { data, error: insertError } = await supabase
      .from('suppliers')
      .insert({
        supplier_name: companyName,
        company_name: companyName,
        country: supplierProfile?.country_name || null,
        contact_email: supplierEmail || null,
        email: supplierEmail || null,
        contact_phone: supplierProfile?.company_phone || null,
        contact_person: supplierProfile?.main_contact_name || null,
        supplier_status: 'active',
      })
      .select('supplier_id')
      .single();

    if (insertError) throw new Error(`Supplier profile: ${insertError.message}`);
    return data.supplier_id as string;
  };

  const uploadImages = async (userId: string, productId: string) => {
    const selectedImages = imageSlots.map((slot, index) => ({ ...slot, index })).filter((slot) => slot.file);
    const rows = [];

    for (const slot of selectedImages) {
      const file = slot.file as File;
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'img';
      const path = `supplier-products/${userId}/${productId}/${slot.index + 1}-${Date.now()}-${sanitizeFileName(file.name.replace(/\.[^.]+$/, ''))}.${extension}`;
      const { data, error: uploadError } = await supabase.storage.from('product-images').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) throw new Error(`Product image ${slot.index + 1}: ${uploadError.message}`);
      const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(data.path);
      rows.push({
        product_id: productId,
        image_url: publicUrl.publicUrl || data.path,
        image_title: file.name,
        alt_text: `${form.productName} image ${slot.index + 1}`,
        sort_order: slot.index + 1,
        is_main_image: slot.index === selectedImages[0].index,
      });
    }

    if (rows.length === 0) return null;
    const { error: imageError } = await supabase.from('product_images').insert(rows);
    if (imageError) throw new Error(`Product images: ${imageError.message}`);
    return rows[0].image_url as string;
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const missing = validateForm();
    setMissingFields(missing);
    if (missing.length > 0) {
      setError('Please fill in the required fields before saving.');
      window.requestAnimationFrame(() => document.getElementById('product-form-error-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    if (form.productVideoUrl.trim() && !/^https?:\/\//i.test(form.productVideoUrl.trim())) {
      setError('Product Video URL must start with http:// or https://');
      window.requestAnimationFrame(() => document.getElementById('product-form-error-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('You must be signed in as a supplier to add products.');

      const supplierId = await resolveSupplierId(authData.user.id, authData.user.email);
      const selectedManufacturer = manufacturers.find((manufacturer) => manufacturer.manufacturer_id === form.manufacturerId);
      const selectedCategory = categories.find((category) => category.name === form.category);
      const price = toNumber(form.price);
      const compareAtPrice = toNumber(form.compareAtPrice);
      const status = form.isActive ? 'active' : 'draft';
      const discount = calculateDiscount(form.price, form.compareAtPrice);

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          supplier_id: supplierId,
          manufacturer_id: form.manufacturerId || null,
          product_name: form.productName.trim(),
          sku_internal: form.sku.trim(),
          part_number_mpn: form.mpn.trim() || form.sku.trim(),
          brand_manufacturer: form.manufacturerName.trim() || selectedManufacturer?.manufacturer_name || null,
          category: form.category,
          category_id: selectedCategory?.cat_id || null,
          subcategory: toNullable(form.subcategory),
          product_type: toNullable(form.productType),
          condition: form.condition,
          short_description: form.shortDescription.trim(),
          full_description: toNullable(form.fullDescription),
          base_price: price,
          base_currency: form.currency,
          compare_at_price: compareAtPrice,
          discount_percent: discount,
          moq_quantity: toNumber(form.moq),
          moq_unit: form.unitType,
          stock_quantity: Math.round(Number(form.stockQuantity)),
          availability: Number(form.stockQuantity) > 0 ? 'in_stock' : 'out_of_stock',
          lead_time: toNullable(form.leadTime),
          unit_type: toNullable(form.unitType),
          country_of_origin: toNullable(form.originCountry),
          hs_code: toNullable(form.hsCode),
          warranty: toNullable(form.warranty),
          rohs_compliant: form.rohsCompliant,
          reach_compliant: form.reachCompliant,
          certification_text: toNullable(form.certificationText),
          product_video_url: toNullable(form.productVideoUrl),
          product_video_description: toNullable(form.productVideoDescription),
          tags: toNullable(form.tags),
          is_active: form.isActive,
          status,
          product_status: status,
        })
        .select('product_id')
        .single();

      if (productError) throw new Error(`Product: ${productError.message}`);

      const productId = product.product_id as string;
      const mainImageUrl = await uploadImages(authData.user.id, productId);
      if (mainImageUrl) {
        const { error: imageUpdateError } = await supabase.from('products').update({ main_image_url: mainImageUrl }).eq('product_id', productId);
        if (imageUpdateError) throw new Error(`Main product image: ${imageUpdateError.message}`);
      }

      const specRows = specs
        .map((spec, index) => ({ spec, index }))
        .filter(({ spec }) => spec.name.trim() && spec.value.trim())
        .map(({ spec, index }) => ({
          product_id: productId,
          specification_name: spec.name.trim(),
          specification_value: spec.value.trim(),
          unit: toNullable(spec.unit),
          sort_order: index + 1,
        }));

      if (specRows.length > 0) {
        const { error: specError } = await supabase.from('product_specifications').insert(specRows);
        if (specError) throw new Error(`Product specifications: ${specError.message}`);
      }

      if (form.datasheetUrl.trim()) {
        const { error: documentError } = await supabase.from('product_documents').insert({
          product_id: productId,
          document_type: 'datasheet',
          document_name: 'Datasheet',
          file_name: form.datasheetUrl.trim().split('/').pop() || 'datasheet',
          file_url: form.datasheetUrl.trim(),
          sort_order: 1,
        });
        if (documentError) throw new Error(`Product document: ${documentError.message}`);
      }

      setMessage('Product saved successfully.');
      router.push('/supplier/products');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Electron Market Supplier</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Add New Product</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Fill in the details below to create a new product listing.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/supplier/dashboard" className="site-button rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Cancel</Link>
            <HubButton type="submit" form="supplier-product-form" loading={saving} loadingText="Saving..." size="sm">Save Product</HubButton>
          </div>
        </div>

        <form id="supplier-product-form" onSubmit={saveProduct} className="space-y-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          {loadingLookups && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">Loading categories and product types...</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
          {error && (
            <div id="product-form-error-summary" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">{error}</p>
              {missingFields.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {missingFields.map((field) => <li key={field}>{fieldLabel(field)}</li>)}
                </ul>
              )}
            </div>
          )}

          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-blue-900">Basic Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label>{labelText('Product Name', true)}<input className={fieldClass('productName')} value={form.productName} onChange={(event) => updateForm('productName', event.target.value)} /></label>
              <label>{labelText('Part Number / SKU', true)}<input className={fieldClass('sku')} value={form.sku} onChange={(event) => updateForm('sku', event.target.value)} /></label>
              <label>
                {labelText('Category', true)}
                <select className={fieldClass('category')} value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.cat_id} value={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label>
                {labelText('Manufacturer', true)}
                <select className={fieldClass('manufacturer')} value={form.manufacturerId} onChange={(event) => {
                  const manufacturer = manufacturers.find((row) => row.manufacturer_id === event.target.value);
                  updateForm('manufacturerId', event.target.value);
                  updateForm('manufacturerName', manufacturer?.manufacturer_name || form.manufacturerName);
                }}>
                  <option value="">Typed manufacturer / not listed</option>
                  {manufacturers.map((manufacturer) => <option key={manufacturer.manufacturer_id} value={manufacturer.manufacturer_id}>{manufacturer.manufacturer_name}</option>)}
                </select>
              </label>
              <label>{labelText('Manufacturer text', !form.manufacturerId)}<input className={fieldClass('manufacturer')} value={form.manufacturerName} onChange={(event) => updateForm('manufacturerName', event.target.value)} /></label>
              <label>{labelText('Manufacturer Part Number / MPN')}<input className={inputClass} value={form.mpn} onChange={(event) => updateForm('mpn', event.target.value)} /></label>
              <label>
                {labelText('Product Type')}
                <select className={inputClass} value={form.productType} onChange={(event) => updateForm('productType', event.target.value)}>
                  <option value="">Select product type</option>
                  {types.map((type) => <option key={type.type_id} value={type.title}>{type.title}</option>)}
                </select>
              </label>
              <label>{labelText('Subcategory')}<input className={inputClass} value={form.subcategory} onChange={(event) => updateForm('subcategory', event.target.value)} /></label>
              <label>
                {labelText('Product Condition', true)}
                <select className={fieldClass('condition')} value={form.condition} onChange={(event) => updateForm('condition', event.target.value)}>
                  <option>New</option>
                  <option>New surplus</option>
                  <option>Refurbished</option>
                  <option>Used</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label>{labelText('Short Description', true)}<textarea rows={4} className={fieldClass('shortDescription')} value={form.shortDescription} onChange={(event) => updateForm('shortDescription', event.target.value)} /></label>
              <label>{labelText('Full Description')}<textarea rows={4} className={inputClass} value={form.fullDescription} onChange={(event) => updateForm('fullDescription', event.target.value)} /></label>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-6">
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-blue-900">Technical Specifications</h2>
            <div className="mt-4 space-y-3">
              {specs.map((spec, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_130px_auto] md:items-end">
                  <input className={inputClass} placeholder="Parameter Name" value={spec.name} onChange={(event) => updateSpec(index, 'name', event.target.value)} />
                  <input className={inputClass} placeholder="Parameter Value" value={spec.value} onChange={(event) => updateSpec(index, 'value', event.target.value)} />
                  <input className={inputClass} placeholder="Unit / Type" value={spec.unit} onChange={(event) => updateSpec(index, 'unit', event.target.value)} />
                  <button type="button" onClick={() => removeSpec(index)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Delete</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addSpec} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add Another Specification</button>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-blue-900">Pricing & Stock</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label>{labelText('Price', true)}<input type="number" step="0.0001" className={fieldClass('price')} value={form.price} onChange={(event) => updateForm('price', event.target.value)} /></label>
              <label>{labelText('Currency', true)}<input className={fieldClass('currency')} value={form.currency} onChange={(event) => updateForm('currency', event.target.value.toUpperCase())} /></label>
              <label>{labelText('Compare At Price / Old Price')}<input type="number" step="0.0001" className={inputClass} value={form.compareAtPrice} onChange={(event) => updateForm('compareAtPrice', event.target.value)} /></label>
              <div className="rounded-lg bg-white p-3 text-sm text-slate-700 md:self-end"><span className="font-semibold">Discount %:</span> {calculateDiscount(form.price, form.compareAtPrice) ?? '-'}</div>
              <label>{labelText('MOQ', true)}<input type="number" className={fieldClass('moq')} value={form.moq} onChange={(event) => updateForm('moq', event.target.value)} /></label>
              <label>{labelText('Available Stock', true)}<input type="number" className={fieldClass('stockQuantity')} value={form.stockQuantity} onChange={(event) => updateForm('stockQuantity', event.target.value)} /></label>
              <label>{labelText('Lead Time')}<input className={inputClass} value={form.leadTime} onChange={(event) => updateForm('leadTime', event.target.value)} /></label>
              <label>{labelText('Unit Type')}<input className={inputClass} value={form.unitType} onChange={(event) => updateForm('unitType', event.target.value)} /></label>
              <label>{labelText('Country of Origin')}<input className={inputClass} value={form.originCountry} onChange={(event) => updateForm('originCountry', event.target.value)} /></label>
              <label>{labelText('HS Code')}<input className={inputClass} value={form.hsCode} onChange={(event) => updateForm('hsCode', event.target.value)} /></label>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-blue-900">Additional Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label>{labelText('Warranty')}<input className={inputClass} value={form.warranty} onChange={(event) => updateForm('warranty', event.target.value)} /></label>
              <label>{labelText('Datasheet URL')}<input className={inputClass} value={form.datasheetUrl} onChange={(event) => updateForm('datasheetUrl', event.target.value)} /></label>
              <label>{labelText('Product Video URL')}<input className={inputClass} value={form.productVideoUrl} onChange={(event) => updateForm('productVideoUrl', event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
              <label className="md:col-span-2 xl:col-span-3">{labelText('Product Video Title / Description')}<input className={inputClass} value={form.productVideoDescription} onChange={(event) => updateForm('productVideoDescription', event.target.value)} placeholder="Short description of the product video, demo, test, or installation guide" /></label>
              <label>{labelText('Tags')}<input className={inputClass} value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="semiconductors, industrial, in stock" /></label>
              <label className="md:col-span-2 xl:col-span-3">{labelText('Certification text')}<textarea rows={3} className={inputClass} value={form.certificationText} onChange={(event) => updateForm('certificationText', event.target.value)} /></label>
              <label className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.rohsCompliant} onChange={(event) => updateForm('rohsCompliant', event.target.checked)} /> RoHS Compliant</label>
              <label className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.reachCompliant} onChange={(event) => updateForm('reachCompliant', event.target.checked)} /> REACH Compliant</label>
              <label className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} /> Active Product</label>
            </div>
          </section>
            </div>

            <aside className="rounded-2xl border border-blue-100 bg-blue-50 p-4 xl:sticky xl:top-6 xl:self-start">
              <h2 className="text-xl font-bold text-blue-900">Product Images</h2>
              <p className="mt-1 text-sm text-slate-600">First image will be used as the main product image.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {imageSlots.map((slot, index) => (
                  <div key={index} className="rounded-xl border border-blue-100 bg-white p-2 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">Image {index + 1}</span>
                      {index === 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Main</span>}
                    </div>
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {slot.previewUrl ? <img src={slot.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">Preview</span>}
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => updateImage(index, event)} className="mt-2 w-full text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white hover:file:bg-blue-700" />
                    {slot.file && <button type="button" onClick={() => removeImage(index)} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700">Remove</button>}
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link href="/supplier/dashboard" className="site-button rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</Link>
            <HubButton type="submit" loading={saving} loadingText="Saving...">Save Product</HubButton>
          </div>
        </form>
      </div>
    </main>
  );
}
