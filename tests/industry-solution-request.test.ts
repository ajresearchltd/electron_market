import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePublicEnquiry } from '../lib/public-request/policy.ts';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('every dynamic Industry Solution detail appends the inline request section', () => {
  const page = read('app/industry-solutions/[solutionId]/page.tsx');
  assert.match(page, /RelatedProductsState[\s\S]*IndustrySolutionRequestSection/);
  assert.match(page, /industrySolutionId=\{data\.ind_id\}/);
  assert.match(page, /industrySolutionTitle=\{data\.title\}/);
  assert.match(page, /getIndustrySolutionById\(id\)/);
});

test('homepage and detail page reuse one canonical General Goods form', () => {
  const modal = read('app/components/homepage/RequestEntryModal.tsx');
  const section = read('app/components/public-request/IndustrySolutionRequestSection.tsx');
  const form = read('app/components/public-request/GeneralGoodsRequestForm.tsx');
  assert.match(modal, /<GeneralGoodsRequestForm/);
  assert.match(section, /<GeneralGoodsRequestForm/);
  for (const label of ['Product or category name', 'Detailed request description', 'Estimated quantity', 'Estimated budget (USD)', 'Required delivery country', 'Required delivery date or timeframe', 'Manufacturer / brand (optional)']) assert.equal(form.includes(label), true);
  assert.match(form, /min=\{key === 'estimatedBudget' \? 7500/);
  assert.match(validatePublicEnquiry('general_goods', { estimatedBudget: 7499 })!, /7,500/);
});

test('inline access reuses canonical eight-digit authentication and stays on-page', () => {
  const section = read('app/components/public-request/IndustrySolutionRequestSection.tsx');
  const verify = read('app/api/public/request-access/verify-code/route.ts');
  assert.match(section, /request-access\/session/);
  assert.match(section, /request-access\/send-code/);
  assert.match(section, /request-access\/verify-code/);
  assert.match(section, /authIntent: 'industry_solution_request'/);
  assert.match(section, /data\.nextStep !== 'request_form'/);
  assert.match(section, /EMAIL_OTP_LENGTH/);
  assert.match(section, /maxLength=\{1\}/);
  assert.match(section, /grid-cols-4 gap-2 sm:grid-cols-8/);
  assert.match(section, /characters\.slice\(0, EMAIL_OTP_LENGTH\)/);
  assert.match(section, /event\.key === 'ArrowLeft'/);
  assert.match(section, /event\.key === 'ArrowRight'/);
  assert.match(section, /setDigits\(emptyOtp\(\)\); setChallengeId\(''\)/);
  assert.doesNotMatch(section, /router\.(?:push|replace)|location\.assign|\/login/);
  assert.doesNotMatch(section, /request-type-selector/);
  assert.match(verify, /industry_solution_request/);
  assert.match(verify, /authIntent==='industry_solution_request'\?'request_form':'hub'/);
});

test('Industry Solution access has a scoped light-blue authentication block', () => {
  const section = read('app/components/public-request/IndustrySolutionRequestSection.tsx');
  assert.match(section, /bg-\[#EAF6FF\]/);
  assert.match(section, /border-sky-200/);
  assert.match(section, /bg-white\/80/);
  assert.match(section, /text-blue-950/);
  assert.match(section, /text-slate-700/);
});

test('canonical mailer rejects six-digit provider values before SMTP and preserves the full OTP string', () => {
  const service = read('lib/public-request/auth-code.ts');
  const policy = read('lib/public-request/policy.ts');
  assert.match(policy, /EMAIL_OTP_LENGTH=8/);
  assert.match(service, /const otp=generated\.data\.properties\?\.email_otp/);
  assert.match(service, /if\(!validCanonicalEmailOtp\(otp\)\)throw new PublicRequestCodeError\('email_otp_extracted','EMAIL_OTP_FORMAT_INVALID'/);
  assert.ok(service.indexOf('validCanonicalEmailOtp(otp)') < service.indexOf('verifySmtp()'));
  assert.match(service, /\$\{otp\}/);
  assert.match(service, /codeDigest\(id,email,otp\)/);
  assert.doesNotMatch(service, /slice\(0,\s*6\)|substring\(0,\s*6\)|Number\(otp\)/);
});

test('submission stores server-validated canonical Industry Solution context idempotently', () => {
  const section = read('app/components/public-request/IndustrySolutionRequestSection.tsx');
  const access = read('lib/public-request/access.ts');
  const route = read('app/api/public/request-access/enquiries/route.ts');
  assert.match(section, /type: 'general_goods'/);
  assert.match(section, /source: 'industry_solution_detail', industrySolutionId/);
  assert.match(section, /submissionKey \|\| crypto\.randomUUID\(\)/);
  assert.match(route, /body\.context/);
  assert.match(access, /from\('industry_solution'\)\.select\('ind_id,title'\)\.eq\('ind_id', industrySolutionId\)\.maybeSingle\(\)/);
  assert.match(access, /safePayload\.industrySolutionId = solution\.data\.ind_id/);
  assert.match(access, /safePayload\.industrySolutionTitle = solution\.data\.title/);
  assert.match(access, /source = 'industry_solution_detail'/);
  assert.match(access, /submission_idempotency_key: key/);
  assert.match(access, /inserted\.error\?\.code === '23505'/);
});

test('Admin and Customer retain canonical Preliminary Order visibility', () => {
  const admin = read('app/admin/preliminary-orders/page.tsx');
  const customer = read('app/customer/requests/page.tsx');
  assert.match(admin, /public_sourcing_enquiries/);
  assert.match(admin, /JSON\.stringify\(payload,null,2\)/);
  assert.match(customer, /public_sourcing_enquiries/);
  assert.match(customer, /eq\('customer_user_id', user\.id\)/);
});
