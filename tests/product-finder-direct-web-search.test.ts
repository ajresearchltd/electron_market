import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = () => fs.readFileSync('app/api/product-finder/sessions/route.ts', 'utf8');
const panel = () => fs.readFileSync('app/components/product-finder/ProductFinderPanel.tsx', 'utf8');
const savedSession = () => fs.readFileSync('app/api/product-finder/sessions/[sessionId]/route.ts', 'utf8');
const modal = () => fs.readFileSync('app/components/product-finder/ProductFinderModal.tsx', 'utf8');

test('every Product Finder message is sent directly to Responses API with required web search', () => {
  const source = route();
  assert.match(source, /openai\.responses\.create\(/);
  assert.match(source, /userMessage: message/);
  assert.match(source, /tools: \[\{ type: 'web_search' \}\]/);
  assert.match(source, /tool_choice: 'required'/);
  for (const forbidden of ['parseProductIntent', 'runProductFinderAgent', 'createProductFinderTools', 'product_search_candidates']) assert.doesNotMatch(source, new RegExp(forbidden));
});

test('supplier-entered site inventory is checked for availability and prices', () => {
  const source = route();
  const inventory = fs.readFileSync('lib/product-finder/supplier-inventory.ts', 'utf8');
  assert.match(source, /searchSupplierInventory\(database, message\)/);
  assert.match(source, /electronMarketInventory: siteInventory/);
  assert.match(inventory, /supplier_stock_upload_items/);
  for (const field of ['part_number', 'available_quantity', 'unit_price', 'currency', 'moq', 'lead_time']) assert.match(inventory, new RegExp(field));
  assert.doesNotMatch(inventory, /supplier_company_name|contact_email|contact_phone/);
});

test('the server preserves output_text as the assistant message', () => {
  const source = route();
  assert.match(source, /assistantMessage = response\.output_text/);
  assert.doesNotMatch(source, /JSON\.parse\(response/);
});

test('the UI renders the raw chat response and restores saved chats and ready offers', () => {
  const source = panel();
  assert.match(source, /whitespace-pre-wrap/);
  assert.match(source, /All Chats/);
  assert.match(source, /Ready Supply Offers/);
  assert.match(savedSession(), /product_search_events/);
});

test('the shared Admin and Supplier panel preserves its right-hand workspace', () => {
  const source = panel();
  assert.match(source, /lg:grid-cols-/);
  assert.match(source, /<aside[^>]*aria-label="Saved chats and supply offers"/);
  assert.match(source, /All Chats/);
  assert.match(source, /Ready Supply Offers/);
});

test('each modal opening starts with a blank unsaved chat and New Chat does not persist', () => {
  const source = panel();
  assert.match(modal(), /\{open && <ProductFinderPanel mode=\{mode\}\/>\}/);
  assert.match(source, /New unsaved chat/);
  assert.match(source, /type="button" onClick=\{newConversation\}[^>]*>New Chat</);
  const reset = source.slice(source.indexOf('const newConversation'), source.indexOf('return ('));
  assert.doesNotMatch(reset, /fetch\(|product_search|POST/);
  assert.match(source, /body: JSON\.stringify\(\{ message, sessionId: session\?\.id \}\)/);
});

test('chat is on the right, lists are on the left, and all three panes scroll independently', () => {
  const source = panel();
  assert.match(source, /lg:grid-cols-\[minmax\(360px,.8fr\)_minmax\(0,1.2fr\)\]/);
  assert.match(source, /lg:col-start-2 lg:row-start-1/);
  assert.match(source, /Saved chats and supply offers[^]*lg:col-start-1 lg:row-start-1|lg:col-start-1 lg:row-start-1[^]*Saved chats and supply offers/);
  assert.ok((source.match(/overflow-y-auto/g) ?? []).length >= 3);
  assert.match(source, /viewport\.scrollTop = viewport\.scrollHeight/);
  assert.match(modal(), /h-\[96vh\][^]*flex-1 overflow-hidden/);
});

test('Admin HUB and Customer HUB both use the corrected shared Product Finder modal', () => {
  const admin = fs.readFileSync('app/admin/page.tsx', 'utf8');
  const customer = fs.readFileSync('app/components/customer/CustomerHubHeader.tsx', 'utf8');
  assert.match(admin, /<ProductFinderModal open=\{productFinderOpen\} mode="admin"/);
  assert.match(customer, /<ProductFinderModal open=\{productFinderOpen\} mode="customer"/);
  assert.match(modal(), /<ProductFinderPanel mode=\{mode\}/);
});

test('Product Finder is fully removed from Supplier HUB and retained in Customer HUB', () => {
  const supplier = fs.readFileSync('app/supplier/dashboard/page.tsx', 'utf8');
  const customer = fs.readFileSync('app/components/customer/CustomerHubHeader.tsx', 'utf8');
  assert.doesNotMatch(supplier, /ProductFinder|productFinder|Product AI Finder|product-finder/);
  assert.match(customer, /Product AI Finder/);
  assert.match(customer, /<ProductFinderModal open=\{productFinderOpen\} mode="customer"/);
  assert.match(route(), /role === 'supplier'[^]*Product Finder is available in Customer HUB/);
  assert.match(savedSession(), /role === 'supplier'[^]*Product Finder is available in Customer HUB/);
});
