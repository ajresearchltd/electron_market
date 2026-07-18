import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('category cards and wrapper use the scoped 15 percent enlargement', () => {
  const source = read('app/components/homepage/CategoriesSection.tsx');
  assert.match(source, /max-w-\[1472px\]/);
  assert.match(source, /h-\[242px\] w-\[219px\]/);
  assert.match(source, /h-\[150px\]/);
  assert.match(source, /href=\{`\/categories\/\$\{encodeURIComponent\(category\.cat_id\)\}`\}/);
  assert.match(source, /\.from\('category'\)/);
  assert.match(source, /overflow-x-auto/);
});

test('special offer cards and wrapper use the scoped 15 percent enlargement', () => {
  const source = read('app/components/homepage/MarketingDiscountsSection.tsx');
  assert.match(source, /max-w-\[1472px\]/);
  assert.match(source, /max-w-\[260px\]/);
  assert.match(source, /min-h-\[368px\]/);
  assert.match(source, /h-\[260px\]/);
  assert.match(source, /item\.discount_text/);
  assert.match(source, /href=\{`\/special-offers\/\$\{encodeURIComponent\(item\.id\)\}`\}/);
  assert.match(source, /\.from\('homepage_marketing_discounts'\)/);
});

test('industry cards and wrapper use the scoped 25 percent enlargement', () => {
  const source = read('app/components/homepage/IndustrySolutionsSection.tsx');
  assert.match(source, /max-w-\[1475px\]/);
  assert.match(source, /max-w-\[220px\]/);
  assert.match(source, /min-h-\[245px\]/);
  assert.match(source, /h-\[165px\]/);
  assert.match(source, /href=\{`\/industry-solutions\/\$\{encodeURIComponent\(solution\.ind_id\)\}`\}/);
  assert.match(source, /\.from\('industry_solution'\)/);
});

test('process cards use four local responsive images with accessible text treatment', () => {
  const source = read('app/components/homepage/ProcessSection.tsx');
  const assets = [
    ['request-quote.webp', 'Request a supplier quotation'],
    ['negotiate.webp', 'Buyer and supplier negotiation'],
    ['pay-order.webp', 'Secure payment and order confirmation'],
    ['delivery.webp', 'Global order delivery'],
  ] as const;

  for (const [file, alt] of assets) {
    assert.equal(fs.existsSync(`public/reference/process/${file}`), true);
    assert.match(source, new RegExp(`/reference/process/${file.replace('.', '\\.')}`));
    assert.match(source, new RegExp(alt));
  }

  assert.match(source, /import Image from 'next\/image'/);
  assert.match(source, /aspect-\[16\/9\]/);
  assert.match(source, /bg-\[#071633\]/);
  assert.match(source, /text-blue-100/);
  assert.match(source, /motion-reduce:transform-none/);
  assert.match(source, /grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4/);
  for (const title of ['Request Quote', 'Negotiate', 'Pay & Order', 'Delivery']) assert.match(source, new RegExp(`title: '${title.replace('&', '\\&')}'`));
  assert.match(source, /row\[`section_8_title_\$\{index\}`\] \|\| fallback\?\.title/);
  assert.doesNotMatch(source, /https?:\/\/[^'"`]+\.(?:png|jpe?g|webp)/);
});
