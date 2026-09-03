import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';

test('a shrieker wakes the other monsters on the level', async () => {
    freshRoomWithPolymorphedHero('shrieker');
    const jackal = addMonster({
        species: 'jackal',
        x: 11,
        y: 10,
        msleeping: 1,
    });
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
    const insideTower = addMonster({
        species: 'jackal', x: 12, y: 10, msleeping: 1,
    });
    const acrossMoat = addMonster({
        species: 'coyote', x: 8, y: 10, msleeping: 1,
    });

    await runMonsterAbilityCommand();

    assert.equal(insideTower.msleeping, 0);
    assert.equal(acrossMoat.msleeping, 1);
});
