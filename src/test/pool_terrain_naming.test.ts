import assert from 'node:assert/strict';
import test from 'node:test';

import { MOAT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { init_dungeons } from '../js/dungeon.js';
import { waterbodyName } from '../js/terrain_name.js';
import { freshObjectRoom } from './support/object-room.js';

void test('entering a moat announces that body of water', async () => {
    const level = freshObjectRoom({ hero: { magicalBreathing: true } });
    level.requireAt(10, 10).typ = MOAT;
    const messages: string[] = [];

    await heroLiquidEffects({ publish: text => { messages.push(text); } });

    assert.equal(messages[0], 'You fall into the moat.');
    assert.equal(game.u.uinwater, 1);
});

void test('drowning names the moat in the death record', async () => {
    const level = freshObjectRoom({ left: 10, right: 10, top: 10, bottom: 10 });
    level.requireAt(10, 10).typ = MOAT;
    let cause: string | null | undefined;

    const result = await heroLiquidEffects({
        publish: () => {}, die: async options => { cause = options.deathCause; },
    });

    assert.equal(result?.died, true);
    assert.equal(cause, 'drowned in a moat');
});

void test("water on Juiblex's assigned level is described as a swamp", async () => {
    freshObjectRoom();
    await init_dungeons();
    const juiblex = game.specialLevels?.get('juiblex');
    assert.ok(juiblex);
    game.u.uz = { dnum: juiblex.dnum, dlevel: juiblex.dlevel };
    const location = game.level?.at(10, 10);
    assert.ok(location);
    location.typ = MOAT;

    assert.equal(waterbodyName(10, 10), 'swamp');
});
