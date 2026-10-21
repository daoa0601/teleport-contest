import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, W_ARMF } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { IRON_SHOES, KICKING_BOOTS, ELVEN_BOOTS, OBJECT_NAMES } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { equipMonsterObject } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
for (const [boots, protects] of [
    [IRON_SHOES, true], [KICKING_BOOTS, true], [ELVEN_BOOTS, false],
]) {
    void test(`a bear trap ${protects ? 'spares' : 'wounds'} a monster in ${OBJECT_NAMES[boots]}`, async () => {
        const { monster } = await freshMonsterTrapRoom(BEAR_TRAP, {
            gameplaySeed: 23n, monster: { species: 'dwarf' },
        });
        requirePlayingGame(game);
        monster.mhp = monster.mhpmax = 50;
        await equipMonsterObject(monster, await knownObject(boots), W_ARMF);
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, { publish: async () => { } });
        assert.equal(monster.mtrapped, 1, 'the dwarf is caught');
        // C trap.c:wearing_iron_shoes() checks the boots' material.
        assert.equal(monster.mhp === 50, protects);
    });
}
//# sourceMappingURL=monster_bear_trap_boots.test.js.map