import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { WAN_CREATE_MONSTER } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('breaking a creation wand respects monster-generation exclusion zones', async () => {
    const level = freshPlayableRoom({ hero: { uhp: 500, uhpmax: 500 } });
    level.exclusionZones.push({ type: 'monster-generation', lx: 1, hx: 79, ly: 0, hy: 20 });
    const wand = await addInventoryObject(WAN_CREATE_MONSTER, { spe: 1 });
    await applyInventoryObject(wand, 'y                          ');
    assert.equal(wand.where, 'gone');
    assert.equal(game.context.move, 1);
    assert.equal(level.monsters.length, 0, 'the nine summon attempts cannot enter the excluded region');
});
//# sourceMappingURL=wand_break_exclusion.test.js.map