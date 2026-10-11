import test from 'node:test';
import assert from 'node:assert/strict';

import { InputGate } from '../js/input.js';

void test('InputGate consumes supplied keys and reports when it needs another',
    async () => {
        let boundaries = 0;
        const gate = new InputGate({
            beforeRead: () => { boundaries++; },
        });
        gate.feed('ab');

        assert.equal(await gate.readKey(), 'a'.charCodeAt(0));
        assert.equal(await gate.readKey(), 'b'.charCodeAt(0));

        const pendingKey = gate.readKey();
        await gate.waitUntilBlocked();
        assert.equal(gate.isBlocked, true);

        gate.feed('c');
        assert.equal(await pendingKey, 'c'.charCodeAt(0));
        assert.equal(gate.isBlocked, false);
        assert.equal(boundaries, 3);
    });
