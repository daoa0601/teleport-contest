import test from 'node:test';
import assert from 'node:assert/strict';
import { LAVAPOOL, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { runMonsterAction } from '../js/monmove.js';
import { CORPSE, POT_SLEEPING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('catching a monster potion transfers it into hero inventory ownership', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('goblin', 11, 10, MM_ANGRY | NO_MINVENT);
    const potion = await knownObject(POT_SLEEPING);
    await addObjectToMonsterInventory(monster, potion, game);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /goblin|potion|catch/i, limit: 8 });
    await performMonsterHeroAttack(monster, game, { random: () => 0 });
    assert.equal(game.inventory.includes(potion), true);
    assert.equal(monster.minvent?.includes(potion), false);
    assert.equal(potion.where, 'inventory');
    assert.equal(potion.carrierMid, undefined);
    assert.equal(potion.ocarry, null);
});
void test('monster knockback into lava does not leave a burned victim corpse', async () => {
    const level = freshObjectRoom({
        heroX: 18,
        right: 20,
        recalculateVision: false,
        flags: { verbose: false },
    });
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 10, 10, NO_MINVENT);
    initializePet(giant, { state: game });
    const orc = await createMonsterAt('orc', 11, 10, MM_ANGRY | NO_MINVENT);
    level.requireAt(13, 10).typ = LAVAPOOL;
    await runMonsterAction(giant, game, () => 0, (count) => count, () => 1);
    assert.equal(level.monsters.includes(orc), false);
    assert.equal(floorObjects(level).some((object) => object.otyp === CORPSE && object.corpsenm === orc.mnum), false);
});
//# sourceMappingURL=monster_turn_ownership.test.js.map