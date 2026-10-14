import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a disenchanter waits for its hit message before draining worn armor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await addInventoryObject(LEATHER_ARMOR, { spe: 3 });
    wearHeroArmor(armor);
    const monster = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.msleeping = 0;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    const input = resetInputState();
    await plineWithContinuation('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const attack = performMonsterHeroAttack(monster, game, {
        random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
    });
    await input.waitUntilBlocked();
    const enchantmentAtPager = armor.spe;
    pushKeys(' '.repeat(20));
    await attack;

    assert.equal(enchantmentAtPager, 3, 'draining must not precede acknowledgment of the prior message');
    assert.equal(armor.spe, 2);
});
