import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, } from '../js/objclass.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mkobj } from '../js/mkobj.js';
import { freshObjectRoom } from './support/object-room.js';
void test('random Rogue-level loot uses only the seven Rogue object classes', async () => {
    await freshObjectRoom({ gameplaySeed: 140 });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    const classes = new Set([
        WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, WAND_CLASS, RING_CLASS,
    ]);
    for (let count = 0; count < 100; count++) {
        const object = await mkobj(RANDOM_CLASS, false);
        assert.ok(classes.has(object.oclass), `Rogue loot has class ${object.oclass}`);
    }
});
//# sourceMappingURL=mkobj_rogue.test.js.map