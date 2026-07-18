import test from 'node:test';import assert from 'node:assert/strict';
import {supplierResponseKeyForMessage} from '../lib/supplier-email/supplier-response.ts';
test('same inbound email has a stable response key',()=>{assert.equal(supplierResponseKeyForMessage('a'),'email:a');assert.equal(supplierResponseKeyForMessage('a'),supplierResponseKeyForMessage('a'))});
test('different inbound emails have different response keys',()=>assert.notEqual(supplierResponseKeyForMessage('a'),supplierResponseKeyForMessage('b')));
