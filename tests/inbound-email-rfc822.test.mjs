import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('app/api/integrations/email/inbound/route.ts', 'utf8');

test('RFC822 webhook reads exact bytes and passes the Buffer to the existing parser', () => {
  assert.match(source, /contentType\.includes\('message\/rfc822'\)/);
  assert.match(source, /Buffer\.from\(await request\.arrayBuffer\(\)\)/);
  assert.match(source, /parseEml\(rawBuffer\)/);
  assert.match(source, /rawEmail:\s*rawBuffer/);
});

test('RFC822 is never parsed as JSON and empty bodies are rejected', () => {
  const rfcBranch = source.slice(source.indexOf("contentType.includes('message/rfc822')"), source.indexOf("contentType.includes('application/json')"));
  assert.doesNotMatch(rfcBranch, /request\.json\(\)/);
  assert.match(rfcBranch, /rawBuffer\.byteLength === 0/);
  assert.match(rfcBranch, /status:\s*400/);
});

test('legacy JSON, authentication, and unsupported media handling remain explicit', () => {
  assert.match(source, /contentType\.includes\('application\/json'\)/);
  assert.match(source, /x-electron-email-secret/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /status:\s*415/);
});
