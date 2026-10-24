import test from 'node:test';
import assert from 'node:assert/strict';
import { removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { LEATHER_GLOVES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test("removing gloves cleans the slippery hands caused by Vlad's throne", async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    game.dungeons = [createDungeon({ dname: "Vlad's Tower" })];
    const gloves = await addInventoryObject(LEATHER_GLOVES);
    wearHeroArmor(gloves);
    initRng(21n);
    await runExtendedCommand('sit', ' '.repeat(10));
    assert.ok((game.u.glibTurns ?? 0) >= 100, 'The throne must coat the worn gloves.');
    await removeHeroArmor(gloves);
    assert.equal(game.u.glibTurns, 0);
    assert.equal(game.u.glib, false);
});
//# sourceMappingURL=throne_grease_gloves.test.js.map