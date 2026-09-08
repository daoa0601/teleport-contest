import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_ARMG, W_WEP } from '../js/const.js';
import { pline } from '../js/display.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { runMonsterAction } from '../js/monmove.js';
import { DAGGER, GAUNTLETS_OF_POWER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a monster\'s enchanted weapon does more damage to another monster', async () => {
    const damage = [];
    for (const spe of [0, 5]) {
        freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
        const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
        tameMonster(captain, game);
        equipMonsterObject(captain, knownObject(DAGGER, { spe }), W_WEP);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        giant.mpeaceful = false;
        const health = giant.mhp;

        await runMonsterAction(captain, game, () => 0, count => count, () => 1);

        damage.push(health - giant.mhp);
    }

    assert.ok(damage[0] > 0, 'the unenchanted weapon should hit');
    assert.ok(damage[1] > damage[0], 'enchantment should add damage');
});

test('power gauntlets strengthen a monster\'s weapon hit only while worn', async () => {
    const damage = [];
    for (const gloves of ['none', 'carried', 'worn']) {
        freshObjectRoom({ flags: { verbose: false } });
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        goblin.mpeaceful = false;
        equipMonsterObject(goblin, knownObject(DAGGER), W_WEP);
        if (gloves === 'carried') {
            addObjectToMonsterInventory(goblin, knownObject(GAUNTLETS_OF_POWER));
        } else if (gloves === 'worn') {
            equipMonsterObject(goblin, knownObject(GAUNTLETS_OF_POWER), W_ARMG);
        }
        const health = game.u.uhp;

        await runMonsterAction(goblin, game, () => 0, count => count, () => 1);

        damage.push(health - game.u.uhp);
    }

    assert.ok(damage[0] > 0);
    assert.equal(damage[1], damage[0]);
    assert.ok(damage[2] - damage[0] >= 3 && damage[2] - damage[0] <= 6,
        `worn gauntlets should add 3 to 6 damage, got ${damage[2] - damage[0]}`);
});

test('a weapon swing waits for the previous message before the monster hits', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    equipMonsterObject(goblin, knownObject(DAGGER), W_WEP);
    const health = game.u.uhp;
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const attack = runMonsterAction(goblin, game, () => 0, count => count, () => 1);
    await input.waitUntilBlocked();
    assert.equal(game.u.uhp, health);
    input.feed(' ');
    await attack;

    assert.ok(game.u.uhp < health);
});
