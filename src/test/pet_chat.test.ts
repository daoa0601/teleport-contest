import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { runExtendedCommand } from './support/commands.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [name, message] of [
    ['', 'The saddled pony is eating noisily.'],
    ['spot', 'Spot is eating noisily.'],
] as const) {
    void test(`chat uses the perceived name of an eating ${name ? 'named' : 'saddled'} pet`, async () => {
        freshObjectRoom();
        const pony = await createSaddledSteed('pony', { x: 11, y: 10 });
        pony.meating = 3;
        if (name) setMonsterGivenName(pony, name);

        await runExtendedCommand('chat', 'l');

        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
        assert.equal(pony.meating, 3);
    });
}
