import test from 'node:test';
import assert from 'node:assert/strict';
import { SLP_GAS_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap, } from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
void test('sleeping gas puts a susceptible visible monster to sleep', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SLP_GAS_TRAP, {
        gameplaySeed: 31n,
    });
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => messages.push(message),
    });
    assert.equal(monster.mcanmove, 0);
    assert.ok((monster.mfrozen ?? 0) > 0);
    assert.equal(trap.tseen, true);
    assert.match(messages[0] ?? '', /suddenly falls asleep/);
});
//# sourceMappingURL=monster_sleep_gas_trap.test.js.map