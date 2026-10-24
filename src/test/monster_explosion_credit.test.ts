import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPL_FIERY, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { createElementalMonsterExplosion, explode } from '../js/explosion.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_COLD } from '../js/monster_attack_types.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const monsterTurn of [false, true]) {
    void test(`a gas spore dying during the ${monsterTurn ? 'monster' : 'hero'} turn assigns blast credit by that turn`, async () => {
        freshObjectRoom({ context: { mon_moving: monsterTurn } });
        requireFixtureGame(game);
        const spore = await createMonsterAt('gas spore', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        const victim = await createMonsterAt('jackal', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        victim.mhp = 1;
        installPagerInput(resetInputState(), { expected: /caught|killed|kill|Boom/, limit: 8 });

        await finishEnvironmentalMonsterDeath(spore, game, { rollDice: () => 8 });

        assert.ok(victim.mhp <= 0, 'The death explosion killed the neighboring jackal.');
        assert.equal(game.u.uconduct.killer || 0, monsterTurn ? 0 : 1);
    });
}

void test('hero credit for a self-burning gas spore does not extend to its death blast during the monster turn', async () => {
    freshObjectRoom({ context: { mon_moving: true } });
    requireFixtureGame(game);
    const spore = await createMonsterAt('gas spore', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    spore.mhp = 1;
    const victim = await createMonsterAt('jackal', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    victim.mhp = 1;
    installPagerInput(resetInputState(), { expected: /caught|killed|kill|Boom/, limit: 10 });

    await explode(14, 10, -11, 8, 9, -EXPL_FIERY);

    assert.ok(victim.mhp <= 0, 'The gas spore death blast killed its neighbor.');
    assert.ok(game.u.uexp > 0, 'The hero receives credit for the self-burning spore.');
    assert.equal(game.u.uconduct.killer || 0, 0, 'Both deaths preserve pacifism during the monster turn.');
});

void test('an elemental monster explosion during the hero turn gives the hero kill credit', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const victim = await createMonsterAt('jackal', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    victim.mhp = 1;
    installPagerInput(resetInputState(), { expected: /caught|killed|kill|Boom/, limit: 8 });

    await createElementalMonsterExplosion(14, 10, AD_COLD, 8, "freezing sphere's explosion");

    assert.ok(victim.mhp <= 0, 'The cold explosion killed the neighboring jackal.');
    assert.equal(game.u.uconduct.killer, 1);
});
