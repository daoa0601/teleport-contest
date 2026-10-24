import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_TELEP, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { teleportMonsterToRandomLevel } from '../js/teleport.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { createDungeon } from './support/topology.js';
import { freshObjectRoom } from './support/object-room.js';
// C dog.c migrate_to_level() turns a departing monster's light global and
// calls vision_recalc() at once, so the squares it lit go dark before any
// other monster moves rather than at the next scheduled recalculation.
void test('a luminous monster leaving the level darkens what it lit immediately', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const vortex = await createMonsterAt('fire vortex', 13, 10, MM_NOGRP | NO_MINVENT);
    vision_recalc(0);
    assert.equal(cansee(14, 10), true, 'The vortex lights the square beyond it.');
    const trap = addTrap(requireGameLevel(), LEVEL_TELEP, 13, 10);
    const result = await teleportMonsterToRandomLevel(vortex, trap, {
        random: () => 1, rollOne: () => 1, publish: async () => { },
    });
    assert.ok(result, 'The vortex leaves the level.');
    assert.equal(game.vision_full_recalc ? 'pending' : 'done', 'done');
    assert.equal(cansee(14, 10), false, 'Its light no longer reaches the square.');
});
//# sourceMappingURL=migrating_light.test.js.map