import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getPublicHubNavigation } from '../lib/auth/redirectByRole.ts';

test('canonical public HUB navigation maps supported persisted roles', () => {
  assert.deepEqual(getPublicHubNavigation('admin'), {
    role: 'admin', label: 'Admin HUB', href: '/admin', ariaLabel: 'Open Admin HUB',
  });
  assert.deepEqual(getPublicHubNavigation('customer'), {
    role: 'customer', label: 'Customer HUB', href: '/customer/dashboard', ariaLabel: 'Open Customer HUB',
  });
  assert.deepEqual(getPublicHubNavigation('supplier'), {
    role: 'supplier', label: 'Supplier HUB', href: '/supplier/dashboard', ariaLabel: 'Open Supplier HUB',
  });
});

test('unknown, absent and non-public roles do not expose a HUB action', () => {
  assert.equal(getPublicHubNavigation(null), null);
  assert.equal(getPublicHubNavigation(''), null);
  assert.equal(getPublicHubNavigation('unknown'), null);
  assert.equal(getPublicHubNavigation('support'), null);
});

test('public header keeps HUB before profile and provides mobile access', () => {
  const header = fs.readFileSync('app/components/homepage/Header.tsx', 'utf8');
  const desktopHub = header.indexOf('{hubNavigation&&<Link');
  const profile = header.indexOf('<Link href={hubHref}', desktopHub);
  assert.ok(desktopHub >= 0 && profile > desktopHub);
  assert.match(header, /aria-label=\{hubNavigation\.ariaLabel\}/);
  assert.match(header, /lg:hidden/);
  assert.match(header, /hubNavigation\.label/);
  assert.doesNotMatch(header, /Supplyer HUB/);
});

test('middleware retains cross-role route enforcement', () => {
  const middleware = fs.readFileSync('middleware.ts', 'utf8');
  assert.match(middleware, /pathname\.startsWith\('\/customer'\) && role === 'customer'/);
  assert.match(middleware, /pathname\.startsWith\('\/supplier'\) && role === 'supplier'/);
  assert.match(middleware, /pathname\.startsWith\('\/admin'\) && role === 'admin'/);
  assert.match(middleware, /getDashboardPathByRole\(role\)/);
});

test('authenticated public request identity still bypasses guest verification', () => {
  const access = fs.readFileSync('lib/public-request/access.ts', 'utf8');
  const modal = fs.readFileSync('app/components/homepage/RequestEntryModal.tsx', 'utf8');
  assert.match(access, /kind:\s*'authenticated' as const/);
  assert.match(modal, /if\(value\.kind==='authenticated'\)/);
  assert.match(modal, /else if\(value\.verified\)/);
  assert.match(modal, /setStep\(requested\?'individual_product':'selector'\)/);
});
