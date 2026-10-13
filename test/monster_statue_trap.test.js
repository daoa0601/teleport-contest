import assert from 'node:assert/strict';
import test from 'node:test';
import { STATUE_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
void test('a monster learns a statue trap without activating or revealing it', async () => {
    const { monster, trap, level } = await freshMonsterTrapRoom(STATUE_TRAP);
    requirePlayingGame(game);
    const health = monster.mhp;
    await triggerImmediateMonsterTrap(monster, game);
    assert.equal(monsterKnowsTrap(monster, trap), true);
    assert.equal(level.traps.includes(trap), true);
    assert.equal(trap.tseen, false);
    assert.equal(monster.mhp, health);
    assert.equal(level.monsters.length, 1);
});
//# sourceMappingURL=monster_statue_trap.test.js.map