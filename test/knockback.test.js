import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, PIT, W_WEP } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { CLUB, DAGGER, LOADSTONE, STATUE } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { freshObjectRoom } from './support/object-room.js';

async function freshGiantFight() {
    freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
    const giant = await createMonsterAt('hill giant', 10, 10, NO_MINVENT);
    tameMonster(giant, game);
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.mpeaceful = false;
    return { giant, orc };
}

for (const weapon of [null, CLUB, DAGGER]) {
    const attack = weapon === CLUB ? 'a club' : weapon === DAGGER ? 'a dagger' : 'its fist';
    test(`a giant using ${attack} ${weapon === DAGGER ? 'cuts its opponent without knockback' : 'knocks its opponent back'}`, async () => {
        const { giant, orc } = await freshGiantFight();
        if (weapon !== null) equipMonsterObject(giant, knownObject(weapon), W_WEP);
        const health = orc.mhp;
        pushKeys(' '.repeat(40));

        await runMonsterAction(giant, game, () => 0, count => count, () => 1);

        assert.equal(orc.mx, weapon === DAGGER ? 11 : 13);
        if (weapon === DAGGER) assert.ok(orc.mhp < health);
        else {
            assert.equal(orc.mhp, health, 'C returns after monster knockback without applying the pending hit damage');
            assert.equal(orc.mstun, 1);
            assert.equal(orc.movement, 0);
        }
    });
}

test('a knocked monster passes over one pit and falls into the pit where it lands', async () => {
    const { giant, orc } = await freshGiantFight();
    addTrap(game.level, PIT, 12, 10);
    addTrap(game.level, PIT, 13, 10);
    pushKeys(' '.repeat(40));

    await runMonsterAction(giant, game, () => 0, count => count, () => 1);

    assert.equal(orc.mx, 13);
    assert.equal(orc.mtrapped, 1);
});

test('a knocked monster petrifies when it collides with a cockatrice', async () => {
    const { giant, orc } = await freshGiantFight();
    await createMonsterAt('cockatrice', 12, 10, NO_MINVENT);
    pushKeys(' '.repeat(40));

    await runMonsterAction(giant, game, () => 0, count => count, () => 1);

    assert.equal(game.level.monsters.includes(orc), false);
    assert.ok(floorObjectsAt(game.level, 11, 10)
        .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
});

for (const loadstone of [false, true]) {
    test(`a small hero ${loadstone ? 'carrying a loadstone stands firm' : 'is knocked back'} when hit by a giant`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        installPolymorphedHero('kobold');
        if (loadstone) addInventoryObject(LOADSTONE);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        giant.mpeaceful = false;
        pushKeys(' '.repeat(40));

        await runMonsterAction(giant, game, () => 0, count => count, () => 1);

        assert.equal(game.u.ux, loadstone ? 10 : 8);
        assert.ok(game.u.mh < game.u.mhmax, 'hero knockback must not cancel the hit damage');
    });
}

test('a cursed saddle makes the mount and rider move together when struck', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 }, flags: { verbose: false } });
    const pony = await createSaddledSteed('pony');
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    pony.saddle.cursed = true;
    const titan = await createMonsterAt('titan', 10, 10, NO_MINVENT);
    pushKeys(' '.repeat(40));

    await tryKnockback(titan, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, { random: () => 0 });

    assert.equal(game.u.usteed, pony);
    assert.equal(game.u.ux, 13);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});
