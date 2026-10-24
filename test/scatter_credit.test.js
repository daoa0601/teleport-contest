import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { explodeLandMine } from '../js/landmine_explosion.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { DAGGER } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const monsterTurn of [false, true]) {
    void test(`scattered weapons assign kill credit by the active ${monsterTurn ? 'monster' : 'hero'} turn`, async () => {
        freshObjectRoom({ context: { mon_moving: monsterTurn } });
        requireFixtureGame(game);
        const victim = await createMonsterAt('jackal', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        victim.mhp = 1;
        await floorObject(DAGGER, 14, 10);
        await scatterFloorObjects(14, 10, 1, {
            mayDestroy: false, random: () => 0, rollOne: () => 1,
        });
        assert.ok(victim.mhp <= 0, 'The scattered dagger killed its target.');
        assert.equal(game.u.uconduct.killer || 0, monsterTurn ? 0 : 1);
    });
}
void test('a land mine set off during the hero turn credits scattered weapon kills to the hero', async () => {
    const level = freshObjectRoom();
    requireFixtureGame(game);
    const victim = await createMonsterAt('jackal', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    victim.mhp = 1;
    await floorObject(DAGGER, 14, 10);
    const mine = addTrap(level, LANDMINE, 14, 10);
    installPagerInput(resetInputState(), { expected: /hits|killed|kill/, limit: 8 });
    await explodeLandMine(mine, game, {
        random: () => 0, rollOne: () => 1,
        finishMonsterDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
    });
    assert.ok(victim.mhp <= 0, 'The mine scattered a dagger into its target.');
    assert.equal(game.u.uconduct.killer, 1, 'The scatter credits the hero even when the trap has an environmental death handler.');
});
//# sourceMappingURL=scatter_credit.test.js.map