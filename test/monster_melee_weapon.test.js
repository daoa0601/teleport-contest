import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT, W_ARM, W_ARMG, W_WEP } from '../js/const.js';
import { pline } from '../js/display.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { runMonsterAction } from '../js/monmove.js';
import { DAGGER, GAUNTLETS_OF_POWER, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('striking a rust-monster body rusts the attacking weapon', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    installPolymorphedHero('rust monster');
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    const dagger = knownObject(DAGGER, { spe: 0 });
    equipMonsterObject(goblin, dagger, W_WEP);

    await runMonsterAction(goblin, game, () => 0, count => count, () => 1);

    assert.equal(dagger.oeroded, 1);
});

test('weapon enchantment helps a monster hit an armored hero', async () => {
    const damage = [];
    for (const spe of [0, 8]) {
        freshObjectRoom({ flags: { verbose: false } });
        wearHeroArmor(addInventoryObject(OBJECT_NAMES.indexOf('plate mail')));
        findArmorClass();
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        goblin.mpeaceful = false;
        equipMonsterObject(goblin, knownObject(DAGGER, { spe }), W_WEP);
        const health = game.u.uhp;

        await runMonsterAction(goblin, game, () => 0, count => count,
            range => range);

        damage.push(health - game.u.uhp);
    }

    assert.equal(damage[0], 0, 'the ordinary dagger should miss');
    assert.ok(damage[1] > 0, 'the enchanted dagger should hit');
});

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

test('weapon enchantment helps a monster hit an armored opponent', async () => {
    const damage = [];
    for (const spe of [0, 8]) {
        freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
        const attacker = await createMonsterAt('captain', 10, 10, NO_MINVENT);
        tameMonster(attacker, game);
        equipMonsterObject(attacker, knownObject(DAGGER, { spe }), W_WEP);
        const captain = await createMonsterAt('captain', 11, 10, NO_MINVENT);
        captain.mpeaceful = false;
        equipMonsterObject(captain,
            knownObject(OBJECT_NAMES.indexOf('plate mail')), W_ARM);
        const health = captain.mhp;

        await runMonsterAction(attacker, game, () => 0, count => count,
            range => range);

        damage.push(health - captain.mhp);
    }

    assert.equal(damage[0], 0, 'the ordinary dagger should miss');
    assert.ok(damage[1] > 0, 'the enchanted dagger should hit');
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
