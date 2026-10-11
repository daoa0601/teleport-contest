import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoldoutPolicy } from '../scripts/lib/holdout-policy.mjs';
import { decodeSession } from '../scripts/lib/session-types.mjs';
function recording(driver) {
    return {
        version: 5,
        segments: [{
                seed: 42,
                datetime: '20260101120000',
                nethackrc: '',
                recording: {
                    termination: 'input-boundary',
                    exitCode: null,
                    suppliedKeys: 0,
                    driver,
                },
            }],
    };
}
for (const kind of ['fuzz', 'explore']) {
    void test(`${kind} recording preserves missing blocked-cell telemetry`, () => {
        const summary = createHoldoutPolicy({ kind, seed: 42, maxSteps: 10 }).summary;
        delete summary.blockedCells;
        const session = decodeSession(recording(summary));
        const driver = session.segments[0]?.recording?.driver;
        assert.ok(driver);
        assert.equal(driver.kind, kind);
        assert.equal(Object.hasOwn(driver, 'blockedCells'), false);
        assert.equal(driver.keysSent, summary.keysSent);
    });
}
void test('recording preserves a reported blocked-cell count and setup status', () => {
    const policy = createHoldoutPolicy({ kind: 'explore', seed: 42, maxSteps: 10 });
    const session = decodeSession(recording({ ...policy.summary, blockedCells: 13, setupComplete: true }));
    const driver = session.segments[0]?.recording?.driver;
    assert.ok(driver);
    assert.equal(driver.blockedCells, 13);
    assert.equal(driver.setupComplete, true);
});
void test('recording rejects malformed blocked-cell telemetry when it is present', () => {
    const policy = createHoldoutPolicy({ kind: 'fuzz', seed: 42, maxSteps: 10 });
    for (const blockedCells of ['13', null, Infinity]) {
        assert.throws(() => decodeSession(recording({ ...policy.summary, blockedCells })), /blockedCells must be a finite number/);
    }
});
//# sourceMappingURL=session_recording.test.js.map