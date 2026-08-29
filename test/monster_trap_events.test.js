import test from 'node:test';
import assert from 'node:assert/strict';

import { presentMonsterWebTrap } from '../js/monster_trap_events.js';

test('web trap presenter resolves its subject only for a visible web event', async () => {
    const messages = [];
    const monster = { mnum: 68 };
    const result = await presentMonsterWebTrap({
        event: { kind: 'web-trap' },
        monster,
        visible: true,
        subject: actor => {
            assert.equal(actor, monster);
            return 'The water nymph';
        },
        announce: async message => messages.push(message),
    });

    assert.deepEqual(messages, [
        'The water nymph is caught in a spider web.',
    ]);
    assert.deepEqual(result, {
        handled: true,
        presented: true,
        message: 'The water nymph is caught in a spider web.',
    });
});

test('web presenter is silent when unseen and rejects adjacent event kinds', async () => {
    for (const entry of [
        { event: { kind: 'web-trap' }, visible: false, handled: true },
        { event: { kind: 'bear-trap' }, visible: true, handled: false },
        { event: null, visible: true, handled: false },
    ]) {
        const result = await presentMonsterWebTrap({
            event: entry.event,
            visible: entry.visible,
            subject: () => {
                throw new Error('silent web event must not resolve a subject');
            },
            announce: async () => {
                throw new Error('silent web event must not announce');
            },
        });
        assert.equal(result.handled, entry.handled);
        assert.equal(result.presented, false);
        assert.equal(result.message, '');
    }
});
