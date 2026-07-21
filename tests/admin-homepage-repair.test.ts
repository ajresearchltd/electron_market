import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('Homepage Content Admin reuses the sticky authenticated Admin HUB header and has no production debug UI', () => {
  const page = read('app/admin/homepage-content/page.tsx');
  const header = read('app/components/admin/AdminHubHeader.tsx');
  assert.match(page, /<AdminHubHeader title="Homepage Content Admin"/);
  assert.doesNotMatch(page, /Temporary admin page|Temporary save debug|Last Supabase error/i);
  assert.match(header, /sticky top-0 z-\[80\] w-full bg-\[#071b3a\]/);
  assert.match(header, /user_profiles/);
  for (const label of ['Preliminary Orders', 'Home', 'Sign out']) assert.match(header, new RegExp(label));
});

test('Homepage image save is Admin-authorized, server-side, validated, and preserves images when no file is selected', () => {
  const page = read('app/admin/homepage-content/page.tsx');
  const route = read('app/api/admin/homepage-content/save/route.ts');
  assert.match(page, /fetch\('\/api\/admin\/homepage-content\/save'/);
  assert.doesNotMatch(page, /supabase\.storage[\s\S]*\.upload\(/);
  assert.match(route, /requireAdminApi\(\)/);
  assert.match(route, /const BUCKET = 'homepage-icons'/);
  assert.match(route, /MAX_FILE_SIZE = 2 \* 1024 \* 1024/);
  assert.match(route, /image\/png[\s\S]*image\/jpeg[\s\S]*image\/webp[\s\S]*image\/svg\+xml/);
  assert.match(route, /crypto\.randomUUID\(\)/);
  assert.match(route, /upsert: false/);
  assert.match(page, /if \(file\) requestBody\.set/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_.*SERVICE|anon/);
});

test('five management routes move beside visibility without removing other Quick Actions', () => {
  const page = read('app/admin/homepage-content/page.tsx');
  const hub = read('app/admin/page.tsx');
  const routes = ['/admin/how-it-works', '/admin/categories', '/admin/discount-prices', '/admin/verified-suppliers', '/admin/industry-solutions'];
  for (const route of routes) { assert.match(page, new RegExp(route)); assert.doesNotMatch(hub, new RegExp(`label: '[^']+', href: '${route}'`)); }
  assert.match(page, /Show on homepage[\s\S]*action && <Link/);
  for (const label of ['Main Table', 'Supplier Inbox', 'AI config', 'AI PROMPT', 'Octopart request', 'AI meets']) assert.match(hub, new RegExp(label));
});

test('homepage-only minimum and Industry Solutions product summary styling are scoped', () => {
  const css = read('app/globals.css');
  const industry = read('app/components/homepage/IndustrySolutionsSection.tsx');
  assert.match(css, /\.public-homepage-scope \.text-\\\[10px\\\][\s\S]*font-size: 13px/);
  assert.match(industry, /solution\.product_summary && <p className="[^"]*text-right[^"]*text-black/);
  assert.match(industry, /<h3 className="break-words text-sm font-bold leading-5 text-blue-700"/);
  assert.match(industry, /pb-3/);
});
