import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('one through six enabled cards share one strict full-width row', () => {
  const source = read('app/components/homepage/WhyBuyersSection.tsx');
  assert.match(source, /flex w-full flex-nowrap items-stretch/);
  assert.match(source, /overflow-x-auto overflow-y-hidden/);
  assert.match(source, /flex-\[0_0_min\(80vw,320px\)\]/);
  assert.match(source, /xl:min-w-0 xl:flex-1 xl:basis-0/);
  assert.doesNotMatch(source, /grid-cols-|flex-wrap|whyBuyersGridClass/);
});

test('public cards filter before layout, preserve order, leave no cells, and hide the empty section', () => {
  const source = read('app/components/homepage/WhyBuyersSection.tsx');
  assert.match(source, /visibleBenefits = benefits\.filter\(\(_, index\) => cardVisibility\[index\]\)/);
  assert.match(source, /if \(visibleBenefits\.length === 0\) return null/);
  assert.match(source, /visibleBenefits\.map/);
  assert.match(source, /max-w-\[1475px\]/);
});

test('Admin has six global card checkboxes that persist only through the protected save route', () => {
  const admin = read('app/admin/homepage-content/page.tsx');
  const route = read('app/api/admin/homepage-content/save/route.ts');
  assert.match(admin, /whyBuyersVisibility/);
  assert.match(admin, /requestBody\.set\('whyBuyersVisibility', JSON\.stringify\(whyBuyersVisibility\)\)/);
  assert.match(admin, /fetch\('\/api\/admin\/homepage-content\/save', \{ cache: 'no-store' \}\)/);
  assert.match(admin, /No cards are currently selected for display on the homepage\./);
  assert.match(admin, /Show on homepage/);
  assert.match(admin, /Array\.from\(\{ length: 6 \}/);
  assert.match(admin, /data-why-buyers-card-editor=\{cardNumber\}/);
  assert.match(admin, /aria-label=\{`Show Card \$\{cardNumber\} on homepage`\}/);
  assert.match(admin, /Card \{cardNumber\}\{currentTitle \? ` — \$\{currentTitle\}` : ''\}/);
  assert.doesNotMatch(admin, /setWhyBuyersVisibility[\s\S]{0,120}handleLanguageChange/);
  assert.match(route, /requireAdminApi\(\)/);
  assert.match(route, /homepage_why_buyers_card_settings/);
  assert.match(route, /upsert\(visibilityRows, \{ onConflict: 'card_index' \}\)/);
});

test('visibility persistence does not clear or overwrite stored card data or section visibility', () => {
  const route = read('app/api/admin/homepage-content/save/route.ts');
  const admin = read('app/admin/homepage-content/page.tsx');
  const publicSource = read('app/components/homepage/WhyBuyersSection.tsx');
  for (let index = 1; index <= 6; index += 1) {
    for (const field of ['name', 'text', 'pic']) assert.match(admin, new RegExp(`section_5_${field}_${index}`));
  }
  assert.match(route, /from\('homepage_content'\)\.update\(payload\)/);
  assert.match(admin, /updateSectionVisibility/);
  assert.match(publicSource, /loadHomepageSection|loadWhyBuyersCardVisibility|loadHomepageContent/);
});

test('migration 041 creates global default-visible settings with public read and no browser write policy', () => {
  const sql = read('database/041_run_in_supabase_sql_editor_add_why_buyers_choose_card_visibility.sql');
  assert.match(sql, /homepage_why_buyers_card_settings/);
  assert.match(sql, /CHECK \(card_index BETWEEN 1 AND 6\)/);
  assert.match(sql, /VALUES \(1, TRUE\), \(2, TRUE\), \(3, TRUE\), \(4, TRUE\), \(5, TRUE\), \(6, TRUE\)/);
  assert.match(sql, /FOR SELECT/);
  assert.doesNotMatch(sql, /FOR (?:INSERT|UPDATE|DELETE|ALL)/);
});
