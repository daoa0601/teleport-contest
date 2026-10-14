import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP, NEED_WEAPON, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterWieldedWeapon } from '../js/monster_weapon.js';
import { CROSSBOW, CROSSBOW_BOLT, TWO_HANDED_SWORD } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a trapped archer does not spend its turn readying a melee weapon against a distant hero', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('sergeant', 12, 12, NO_MINVENT);
    soldier.mpeaceful = 0;
    soldier.msleeping = 0;
    soldier.mtrapped = 1;
    soldier.weaponCheck = NEED_WEAPON;
    addTrap(level, BEAR_TRAP, 12, 12);
    const sword = await knownObject(TWO_HANDED_SWORD);
    for (const object of [sword, await knownObject(CROSSBOW), await knownObject(CROSSBOW_BOLT)])
        await addObjectToMonsterInventory(soldier, object);

    await runMonsterAction(soldier, game, limit => limit - 1);

    assert.ok(monsterWieldedWeapon(soldier) !== sword, 'the trapped archer must keep its melee weapon stowed');
    assert.equal(!!sword.wielded, false);
});
