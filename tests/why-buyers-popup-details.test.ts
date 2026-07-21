import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { mapWhyBuyersCardDetail, safeWhyBuyersCtaUrl, type WhyBuyersCardDetailRow, WHY_BUYERS_IMAGE_UPLOADS } from '../lib/homepage/why-buyers-details.ts';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('migration 042 defines the existing language/card detail table and public content fields', () => {
  const sql = read('database/042_run_in_supabase_sql_editor_create_homepage_why_buyers_card_details.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.homepage_why_buyers_card_details/);
  assert.match(sql, /UNIQUE \(homepage_content_id, card_number\)/);
  assert.match(sql, /CHECK \(card_number BETWEEN 1 AND 6\)/);
  for (const field of ['modal_title','modal_subtitle','main_image_path','main_image_alt','additional_image_1_path','additional_image_1_alt','additional_image_2_path','additional_image_2_alt','summary_text','body_text','button_text','button_url']) assert.match(sql, new RegExp(field));
  assert.match(sql, /FOR SELECT/);
});

test('canonical mapper exposes only camelCase public fields and trims empty strings', () => {
  const row: WhyBuyersCardDetailRow = { homepage_content_id:'private-row', card_number:3, modal_title:' Title ', modal_subtitle:' ', main_image_path:null, main_image_alt:null, additional_image_1_path:'/one.jpg', additional_image_1_alt:' One ', additional_image_2_path:null, additional_image_2_alt:null, summary_text:' Summary ', body_text:' Body ', button_text:' Go ', button_url:' /go ' };
  const detail = mapWhyBuyersCardDetail(row);
  assert.deepEqual(detail, { cardNumber:3, modalTitle:'Title', modalSubtitle:null, mainImagePath:null, mainImageAlt:null, additionalImage1Path:'/one.jpg', additionalImage1Alt:'One', additionalImage2Path:null, additionalImage2Alt:null, summaryText:'Summary', bodyText:'Body', buttonText:'Go', buttonUrl:'/go' });
  assert.equal('homepage_content_id' in detail, false);
});

test('public loader uses one language-row query and maps stable card numbers', () => {
  const loader = read('app/components/homepage/homepageContent.ts');
  const section = read('app/components/homepage/WhyBuyersSection.tsx');
  assert.match(loader, /eq\('homepage_content_id', homepageContentId\)/);
  assert.match(loader, /rows\.map\(mapWhyBuyersCardDetail\)/);
  assert.match(section, /details\.find\(\(detail\) => detail\.cardNumber === benefit\.cardNumber\)/);
  assert.match(section, /visibleBenefits = benefits\.filter/);
});

test('modal renders complete text content conditionally with safe plain-text formatting', () => {
  const modal = read('app/components/homepage/WhyBuyersDetailsModal.tsx');
  assert.match(modal, /modalTitle \|\| card\.title/);
  assert.match(modal, /modalSubtitle \|\| card\.description/);
  assert.match(modal, /summaryText/);
  assert.match(modal, /Detailed information/);
  assert.match(modal, /split\(\/\\r\?\\n\\s\*\\r\?\\n\//);
  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
});

test('modal combines the homepage card photo and populated detail images in one slideshow', () => {
  const modal = read('app/components/homepage/WhyBuyersDetailsModal.tsx');
  assert.match(modal, /card\.pic && isImagePath\(card\.pic\)/);
  assert.match(modal, /mainImagePath && isImagePath/);
  assert.match(modal, /additionalImage1Path && isImagePath/);
  assert.match(modal, /additionalImage2Path && isImagePath/);
  assert.match(modal, /if \(!src \|\| !isImagePath\(src\) \|\| failed\) return null/);
  assert.match(modal, /<ImageSlideshow images=\{images\}/);
  assert.match(modal, /Previous image/);
  assert.match(modal, /Next image/);
  assert.match(modal, /window\.setInterval/);
  assert.match(modal, /object-contain/);
  assert.match(modal, /aspect-square/);
  assert.match(modal, /max-w-\[560px\]/);
});

test('CTA accepts safe internal/http links, rejects unsafe schemes, and uses Next Link internally', () => {
  assert.deepEqual(safeWhyBuyersCtaUrl('/create-request'), { href:'/create-request', external:false });
  assert.equal(safeWhyBuyersCtaUrl('javascript:alert(1)'), null);
  assert.equal(safeWhyBuyersCtaUrl('data:text/html,test'), null);
  assert.equal(safeWhyBuyersCtaUrl('//evil.test'), null);
  assert.equal(safeWhyBuyersCtaUrl('https://example.com')?.external, true);
  const modal = read('app/components/homepage/WhyBuyersDetailsModal.tsx');
  assert.match(modal, /<Link href=/);
  assert.match(modal, /noopener noreferrer/);
  assert.match(modal, /mt-6 flex justify-center/);
  assert.match(modal, /bg-blue-950/);
});

test('modal preserves responsive sizing, scrolling, focus trap and accessible close behavior', () => {
  const modal = read('app/components/homepage/WhyBuyersDetailsModal.tsx');
  assert.match(modal, /max-h-\[90vh\]/);
  assert.match(modal, /w-\[min\(960px,calc\(100vw-32px\)\)\]/);
  assert.match(modal, /aspect-square/);
  assert.match(modal, /overflow-x-hidden overflow-y-auto/);
  assert.match(modal, /role="dialog" aria-modal="true"/);
  assert.match(modal, /event\.key === 'Escape'/);
  assert.match(modal, /event\.key === 'Tab'/);
  assert.match(modal, /document\.body\.style\.overflow = 'hidden'/);
});

test('Admin persistence remains scoped and idempotent for every detail field', () => {
  const editor = read('app/admin/homepage-content/WhyBuyersDetailsEditor.tsx');
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  assert.match(editor, /for\(const field of WHY_BUYERS_DETAIL_FIELDS\)body\.set/);
  assert.match(api, /upsert\(payload, \{ onConflict: 'homepage_content_id,card_number' \}\)/);
  assert.doesNotMatch(api, /homepage_why_buyers_card_settings/);
  assert.doesNotMatch(api, /section_5_name|section_5_text|section_5_pic/);
});

test('client and server share one multipart file-field contract for all three images', () => {
  assert.deepEqual(Object.keys(WHY_BUYERS_IMAGE_UPLOADS), ['main_image','additional_image_1','additional_image_2']);
  assert.deepEqual(Object.values(WHY_BUYERS_IMAGE_UPLOADS).map(item => item.pathField), ['main_image_path','additional_image_1_path','additional_image_2_path']);
  const editor = read('app/admin/homepage-content/WhyBuyersDetailsEditor.tsx');
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  assert.match(editor, /new FormData\(\)/);
  assert.match(editor, /body\.set\(key,file,file\.name\)/);
  assert.doesNotMatch(editor, /Content-Type/);
  assert.match(api, /request\.formData\(\)/);
  assert.doesNotMatch(api, /request\.json\(\)/);
  assert.match(api, /WHY_BUYERS_IMAGE_UPLOADS/);
});

test('upload route authorizes before parsing and validates empty, type and 2 MB size', () => {
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  assert.ok(api.indexOf('requireAdminApi()') < api.indexOf('request.formData()'));
  assert.match(api, /POPUP_IMAGE_EMPTY/);
  assert.match(api, /POPUP_IMAGE_TYPE_UNSUPPORTED/);
  assert.match(api, /POPUP_IMAGE_TOO_LARGE/);
  assert.match(api, /2 \* 1024 \* 1024/);
  assert.match(api, /image\/png.*image\/jpeg.*image\/webp/);
});

test('each selected image uploads independently as bytes to a collision-safe language/card path', () => {
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  assert.match(api, /new Uint8Array\(await value\.arrayBuffer\(\)\)/);
  assert.match(api, /why-buyers-choose\/details\/\$\{homepageContentId\}\/card-\$\{cardNumber\}\/\$\{config\.folder\}/);
  assert.match(api, /storage\.from\(BUCKET\)\.upload\(path, bytes/);
  assert.match(api, /payload\[config\.pathField\]/);
});

test('no-file saves preserve submitted paths and failures clean new objects without database corruption', () => {
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  assert.match(api, /payload\[field\] = clean\(form\.get\(field\)\)/);
  assert.match(api, /filter\(item => item\.value instanceof File\)/);
  assert.match(api, /if \(uploadedPaths\.length\) await auth\.admin\.storage\.from\(BUCKET\)\.remove\(uploadedPaths\)/);
  assert.match(api, /POPUP_STORAGE_UPLOAD_FAILED/);
  assert.match(api, /POPUP_IMAGE_PATH_SAVE_FAILED/);
  assert.match(api, /return NextResponse\.json\(\{ detail: result\.data, correlationId \}\)/);
});

test('working text fields, CTA, visibility, and public no-placeholder behavior remain intact', () => {
  const api = read('app/api/admin/homepage-content/why-buyers-details/route.ts');
  const modal = read('app/components/homepage/WhyBuyersDetailsModal.tsx');
  const section = read('app/components/homepage/WhyBuyersSection.tsx');
  assert.match(api, /for \(const field of WHY_BUYERS_DETAIL_FIELDS\)/);
  assert.match(modal, /safeWhyBuyersCtaUrl/);
  assert.match(modal, /return null/);
  assert.doesNotMatch(modal, /Image unavailable/);
  assert.match(section, /visibleBenefits = benefits\.filter/);
  assert.match(section, /flex w-full flex-nowrap/);
});
