import test from 'node:test';
import assert from 'node:assert/strict';

import { MSLOW, NO_MINVENT, W_ARMS, W_WEP } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { DAGGER, SHIELD_OF_REFLECTION } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function freshFight(defenderSpecies, attackerSpecies = 'soldier') {
    freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
    const attacker = await createMonsterAt(attackerSpecies, 10, 10, NO_MINVENT);
    tameMonster(attacker, game);
    const defender = await createMonsterAt(defenderSpecies, 11, 10, NO_MINVENT);
    defender.mpeaceful = false;
    pushKeys(' '.repeat(40));
    return { attacker, defender };
}

test('a slain acid blob still splashes its killer', async () => {
    const { attacker, defender } = await freshFight('acid blob');
    defender.mhp = 1;
    const health = attacker.mhp;

    await runMonsterAction(attacker, game, range => range === 2 ? 0 : 1,
        count => count, () => 1);

    assert.equal(game.level.monsters.includes(defender), false);
    assert.ok(attacker.mhp < health, 'the dead blob should still damage its killer');
});

test('an acid passive can corrode a weapon even when the attacker misses', async () => {
    const { attacker } = await freshFight('acid blob');
    const dagger = equipMonsterObject(attacker, knownObject(DAGGER, { spe: 0 }), W_WEP);

    await runMonsterAction(attacker, game, range => range === 6 ? 0 : 1,
        count => count, range => range);

    assert.equal(dagger.oeroded2, 1);
});

for (const reflected of [false, true]) {
    test(`a floating eye ${reflected ? 'cannot paralyze a reflecting attacker' : 'paralyzes its attacker'}`, async () => {
        const { attacker } = await freshFight('floating eye');
        if (reflected) equipMonsterObject(attacker, knownObject(SHIELD_OF_REFLECTION), W_ARMS);

        await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

        assert.equal(!!attacker.mcanmove, reflected);
        assert.equal(attacker.mfrozen > 0, !reflected);
    });
}

test('cold retaliation heals a brown mold enough to split even after a missed attack', async () => {
    const { attacker, defender } = await freshFight('brown mold');
    defender.mhp = defender.mhpmax = 16;

    await runMonsterAction(attacker, game, () => 1, count => count, range => range);

    const molds = game.level.monsters.filter(monster => monster.mnum === defender.mnum);
    assert.equal(molds.length, 2);
    assert.equal(molds.reduce((health, monster) => health + monster.mhp, 0), 17);
});

test('cold retaliation slows a flesh golem without damaging it', async () => {
    const { attacker } = await freshFight('brown mold', 'flesh golem');
    const health = attacker.mhp;

    await runMonsterAction(attacker, game, () => 1, count => count, range => range);

    assert.equal(attacker.mhp, health);
    assert.equal(attacker.mspeed, MSLOW);
});

test('a fire elemental\'s heat heals an injured iron golem attacker', async () => {
    const { attacker } = await freshFight('fire elemental', 'iron golem');
    attacker.mhp -= 20;
    const health = attacker.mhp;

    await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

    assert.ok(attacker.mhp > health);
    assert.ok(attacker.mhp <= attacker.mhpmax);
});

for (const cancelled of [false, true]) {
    test(`a ${cancelled ? 'cancelled' : 'normal'} disenchanter ${cancelled ? 'leaves weapon enchantment intact' : 'drains its attacker\'s weapon'}`, async () => {
        const { attacker, defender } = await freshFight('disenchanter', 'captain');
        defender.mcan = cancelled;
        const dagger = equipMonsterObject(attacker, knownObject(DAGGER, { spe: 3 }), W_WEP);

        await runMonsterAction(attacker, game, range => range === 100 ? 99 : 1,
            count => count, () => 1);

        if (cancelled) assert.equal(dagger.spe, 3);
        else assert.ok(dagger.spe < 3);
    });
}
