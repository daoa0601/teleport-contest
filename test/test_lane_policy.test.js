import test from 'node:test';
import assert from 'node:assert/strict';

import { auditBehavioralTestLane } from '../scripts/audit-test-lanes.mjs';

test('behavioral lane cannot depend on recorded public sessions', () => {
    const result = auditBehavioralTestLane();

    assert.deepEqual(result.failures, []);
    assert.ok(result.files.includes('test_lane_policy.test.js'));
    assert.equal(
        result.files.some(filename => filename.endsWith('.public-regression.js')),
        false,
    );
});
