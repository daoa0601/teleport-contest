import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BELL_OF_OPENING, POT_SICKNESS, SPE_DIG } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('Scorpius generates the same floor object whether or not he receives inventory', async () => {
    for (let seed = 1; seed <= 8; seed++) {
        const emptyInventoryLevel = freshObjectRoom({ gameplaySeed: seed });
        game.in_mklev = true;
        const unequipped = await makemonAt(MONSTER_NAME.indexOf('Scorpius'), 12, 10, NO_MINVENT);
        const expectedFloor = floorObjectsAt(emptyInventoryLevel, 12, 10);
        assert.ok(unequipped);
        assert.equal(unequipped.minvent.length, 0);
        assert.equal(expectedFloor.length, 1);
        const expectedObject = expectedFloor[0];
        assert.ok(expectedObject);
        const equippedLevel = freshObjectRoom({ gameplaySeed: seed });
        game.in_mklev = true;
        const equipped = await makemonAt(MONSTER_NAME.indexOf('Scorpius'), 12, 10);
        const actualFloor = floorObjectsAt(equippedLevel, 12, 10);
        assert.ok(equipped);
        assert.ok(equipped.minvent.some(item => item.otyp === BELL_OF_OPENING));
        assert.equal(actualFloor.length, 1);
        const actualObject = actualFloor[0];
        assert.ok(actualObject);
        assert.equal(actualObject.otyp, expectedObject.otyp, `Scorpius's Bell must not change his floor object's type (seed ${seed})`);
    }
});
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
//# sourceMappingURL=monster_birth_special_items.test.js.map