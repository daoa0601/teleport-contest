import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

for (const [form, face] of [['floating eye', 'body'], ['brown mold', 'front']]) {
    void test(`wiping a clean ${form} names its ${face}`, async () => {
        assert.ok(form);
        freshRoomWithPolymorphedHero(form);

        await runExtendedCommand('wipe');

        assert.equal(game._pending_message, `Your ${face} is already clean.`);
        assert.equal(game.context.move, 1);
    });
}
