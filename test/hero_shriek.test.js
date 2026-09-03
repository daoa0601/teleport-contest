import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';

test('a shrieker wakes the other monsters on the level', async () => {
    freshRoomWithPolymorphedHero('shrieker');
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.msleeping = 1;
    await runMonsterAbilityCommand();

    assert.equal(jackal.msleeping, 0);
    assert.equal(game.context.move, 0);
});

test('a shriek does not cross the moat around the Wizard tower', async () => {
    freshRoomWithPolymorphedHero('shrieker', {
        heroX: 11,
        heroY: 10,
    });
    game._activeSpecialLevel = {
        prototype: 'wizard1',
        downTeleportExclude: { lx: 10, ly: 8, hx: 14, hy: 12 },
    };
    const insideTower = await createMonsterAt('jackal', 12, 10);
    insideTower.msleeping = 1;
    const acrossMoat = await createMonsterAt('coyote', 8, 10);
    acrossMoat.msleeping = 1;

    await runMonsterAbilityCommand();

    assert.equal(insideTower.msleeping, 0);
    assert.equal(acrossMoat.msleeping, 1);
});
