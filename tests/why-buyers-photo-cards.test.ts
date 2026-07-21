import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('Why Buyers cards preserve six saved records in title-photo-description order', () => {
  const source = read('app/components/homepage/WhyBuyersSection.tsx');
  for (let index = 1; index <= 6; index += 1) {
    assert.match(source, new RegExp(`section_5_name_${index}`));
    assert.match(source, new RegExp(`section_5_text_${index}`));
    assert.match(source, new RegExp(`section_5_pic_${index}`));
  }
  assert.match(source, /<h3[\s\S]*<BenefitPhoto[\s\S]*<p className=/);
  assert.doesNotMatch(source, /lucide-react|<Icon|line-clamp/);
});

test('Why Buyers photos are large cover images with a stable non-broken fallback', () => {
  const source = read('app/components/homepage/WhyBuyersSection.tsx');
  assert.match(source, /min-h-\[180px\]/);
  assert.match(source, /h-\[180px\] w-full object-cover object-center/);
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(source, /Photo placeholder for/);
  assert.match(source, /min-h-\[330px\]/);
  assert.match(source, /pb-3/);
});

test('Why Buyers hover and keyboard focus provide matching high-contrast states', () => {
  const source = read('app/components/homepage/WhyBuyersSection.tsx');
  for (const token of ['hover:bg-indigo-950', 'focus-visible:bg-indigo-950', 'focus-within:bg-indigo-950', 'hover:-translate-y-1', 'focus-visible:ring-2', 'group-hover:text-white', 'group-focus-visible:text-white', 'group-hover:text-blue-50']) assert.match(source, new RegExp(token.replace(/[\[\]]/g, '\\$&')));
  assert.match(source, /group-hover:scale-\[1\.04\]/);
  assert.match(source, /tabIndex=\{0\}/);
});

test('Admin reuses section_5_pic fields and protected homepage storage save for photographs', () => {
  const admin = read('app/admin/homepage-content/page.tsx');
  const route = read('app/api/admin/homepage-content/save/route.ts');
  assert.match(admin, /isWhyBuyersPhotoField/);
  assert.match(admin, /Choose Photo/);
  assert.match(admin, /Replace Photo/);
  assert.match(admin, /PNG, JPG\/JPEG, or WebP/);
  assert.match(admin, /photo=\{whyBuyersPhoto\}/);
  assert.match(route, /requireAdminApi\(\)/);
  assert.match(route, /const BUCKET = 'homepage-icons'/);
  assert.match(route, /why-buyers-choose\/card-/);
  assert.match(route, /WHY_BUYERS_PHOTO_FIELD/);
  assert.doesNotMatch(admin, /storage\.from\([\s\S]*\.upload\(/);
});
