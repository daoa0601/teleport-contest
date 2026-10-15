import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DIAMOND, ROCK } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, blind, levitating, sound] of [
    [ROCK, true, false, 'Splash!'],
    [DIAMOND, false, true, 'Plop!'],
] as const) {
    void test(`dropping into water makes a ${sound} for ${blind ? 'a blind hero' : 'a levitating hero'}`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        const object = await addInventoryObject(type, { invlet: 'a' });
        if (blind) setHeroBlindnessTurns(20, game);
        if (levitating) grantIntrinsicProperty('levitation', 'outside');
        pushKeys('a');

        await rhack('d'.charCodeAt(0));

        assert.equal(game._pending_message, sound);
        assert.equal(object.where, 'floor');
        assert.equal(game.context.move, 1);
    });
}
