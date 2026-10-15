import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { POT_SICKNESS, SPE_DIG } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('Pestilence carries a potion of sickness even on a Rogue level', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };

    const rider = await makemonAt(MONSTER_NAME.indexOf('Pestilence'), 12, 10, MM_NOMSG);

    assert.ok(rider);
    assert.ok(rider.minvent.some(item => item.otyp === POT_SICKNESS));
});

void test('only the first Wizard on the earth plane receives a spellbook of dig', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    game.earth_level = { ...game.u.uz, flags: { town: false }, alignment: null };

    const first = await makemonAt(MONSTER_NAME.indexOf('Wizard of Yendor'), 12, 10, MM_NOMSG);
    const second = await makemonAt(MONSTER_NAME.indexOf('Wizard of Yendor'), 13, 10, MM_NOMSG);

    assert.ok(first && second);
    assert.ok(first.minvent.some(item => item.otyp === SPE_DIG));
    assert.equal(second.minvent.some(item => item.otyp === SPE_DIG), false);
    assert.equal(game.context.no_of_wizards, 2);
});

void test('NO_MINVENT suppresses fixed Wizard equipment while still counting the Wizard', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    game.earth_level = { ...game.u.uz, flags: { town: false }, alignment: null };

    const first = await makemonAt(MONSTER_NAME.indexOf('Wizard of Yendor'), 12, 10, MM_NOMSG | NO_MINVENT);
    const second = await makemonAt(MONSTER_NAME.indexOf('Wizard of Yendor'), 13, 10, MM_NOMSG);

    assert.ok(first && second);
    assert.equal(first.minvent.length, 0);
    assert.equal(second.minvent.some(item => item.otyp === SPE_DIG), false);
    assert.equal(game.context.no_of_wizards, 2);
});
