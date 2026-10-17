import { monsterAtPosition } from '../js/monster_location.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_AMUL, W_ARMG, W_ARMS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_GLOVES, SHIELD_OF_REFLECTION, STATUE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function freshAttack(form: string, hitPoints = 40) {
    freshObjectRoom({ flags: { verbose: false } });
    installPolymorphedHero(form, { hitPoints });
    const attacker = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    attacker.mpeaceful = false;
    pushKeys(' '.repeat(40));
    return attacker;
}

void test('life saving prevents the statue but still records the hero\'s lethal contact', async () => {
    const attacker = await freshAttack('cockatrice');
    requireFixtureGame(game);
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);

    await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

    assert.ok(game.level.monsters.includes(attacker));
    assert.equal(attacker.mhp, attacker.mhpmax);
    assert.equal(attacker.minvent.includes(amulet), false);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === STATUE), false);
});

void test('a gas-spore hero explodes and returns to human form when struck', async () => {
    const attacker = await freshAttack('gas spore');
    requireFixtureGame(game);
    const health = attacker.mhp;

    await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.ok(attacker.mhp < health);
});

void test('cold retaliation can split the hero into a tame clone', async () => {
    const attacker = await freshAttack('brown mold', 16);
    requireFixtureGame(game);

    await runMonsterAction(attacker, game, () => 1,
        (count, sides) => count === 1 ? 1 : count * sides, () => 1);

    const clone = game.level.monsters.find(monster => monster !== attacker && monster.mnum === game.u.umonnum);
    assert.ok(clone, 'cold healing should produce a second brown mold');
    assert.ok((clone.mtame ?? 0) > 0);
    assert.equal(clone.mhp + game.u.mh, clone.mhpmax + game.u.mhmax);
});

for (const form of ['acid blob', 'red mold'] as const) {
    void test(`a lost ${form} form ${form === 'acid blob' ? 'still splashes' : 'no longer burns'} the attacker`, async () => {
        const attacker = await freshAttack(form, 1);
        requireFixtureGame(game);
        const health = attacker.mhp;

        await runMonsterAction(attacker, game, range => range === 2 ? 0 : 1,
            count => count, () => 1);

        assert.equal(game.u.umonnum, game.u.umonster);
        if (form === 'acid blob') assert.ok(attacker.mhp < health);
        else assert.equal(attacker.mhp, health);
    });
}

for (const gloves of [false, true] as const) {
    void test(`a cockatrice hero ${gloves ? 'cannot petrify a gloved hand' : 'petrifies an unprotected attacker'}`, async () => {
        const attacker = await freshAttack('cockatrice');
        requireFixtureGame(game);
        if (gloves) await equipMonsterObject(attacker, await knownObject(LEATHER_GLOVES), W_ARMG);

        await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

        assert.equal(monsterAtPosition(game.level, attacker.mx, attacker.my) === attacker, gloves);
        if (!gloves) assert.ok(floorObjectsAt(game.level, 11, 10)
            .some(object => object.otyp === STATUE && object.corpsenm === attacker.mnum));
    });
}

for (const reflected of [false, true] as const) {
    void test(`a floating-eye hero ${reflected ? 'has its gaze reflected' : 'freezes its attacker'}`, async () => {
        const attacker = await freshAttack('floating eye');
        requireFixtureGame(game);
        if (reflected) await equipMonsterObject(attacker, await knownObject(SHIELD_OF_REFLECTION), W_ARMS);

        await runMonsterAction(attacker, game, () => 1, count => count, () => 1);

        assert.equal(!!attacker.mcanmove, reflected);
        assert.equal((attacker.mfrozen ?? 0) > 0, !reflected);
    });
}
