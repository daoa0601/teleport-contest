import assert from 'node:assert/strict';
import test from 'node:test';
import { nomul } from '../js/command_state.js';
import { LANDMINE, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function giantSetsOffMine() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 14, 10, MM_NOGRP | NO_MINVENT);
    giant.mhp = giant.mhpmax = 100;
    addTrap(level, LANDMINE, 14, 10);
    nomul(-10, game);
    game._helplessReason = 'fainted from lack of food';
    game._helplessDoneMessage = 'You regain consciousness.';
    initRng(1n);
    const action = await triggerImmediateMonsterTrap(giant, game);
    await resumeDeferredMonsterTrap(action, game, { publish: async () => { } });
    assert.ok(giant.mhp < 100, 'the mine exploded under the giant');
}
void test('a monster setting off a land mine wakes a fainted hero next turn', async () => {
    await giantSetsOffMine();
    // C trap.c:trapeffect_landmine() leaves one helpless turn when unconscious().
    assert.equal(game.multi, -1);
    assert.equal(game._helplessDoneMessage, 'The explosion awakens you!');
});
//# sourceMappingURL=landmine_wakes_hero.test.js.map