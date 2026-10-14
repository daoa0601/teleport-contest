import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRE_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
void test('a concealed clinger triggers a fire trap and takes its damage', async () => {
    const { monster } = await freshMonsterTrapRoom(FIRE_TRAP, {
        monster: { species: 'rock piercer', hitPoints: 40 },
    });
    requirePlayingGame(game);
    monster.mundetected = true;
    const action = await triggerImmediateMonsterTrap(monster, game);
    await finishImmediateMonsterTrap(action, game);
    assert.ok(monster.mhp < 40, 'Clinging does not prevent floor-triggered fire damage');
    assert.ok((monster.mtrapseen ?? 0) & (1 << (FIRE_TRAP - 1)));
});
//# sourceMappingURL=concealed_clinger_floor_trap.test.js.map