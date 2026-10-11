import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
void test('scenario commands wait for queued native messages before sending their next key', () => {
    const driver = createSessionDriver([{ type: 'keys', value: 's', dismissMore: true }]);
    assert.equal(driver.nextKey(['The pony hits the jackal.--More--']), ' ');
    assert.equal(driver.nextKey(['The jackal bites!--More--']), ' ');
    assert.equal(driver.nextKey(['']), 's');
    assert.equal(driver.nextKey(['You hear a noise.--More--']), ' ');
    assert.equal(driver.nextKey(['']), null);
});
void test('exact-key plans keep their requested input even at a message prompt', () => {
    const driver = createSessionDriver([{ type: 'keys', value: '\x1b' }]);
    assert.equal(driver.nextKey(['--More--']), '\x1b');
    assert.equal(driver.nextKey(['']), null);
});
//# sourceMappingURL=holdout-actions.test.js.map