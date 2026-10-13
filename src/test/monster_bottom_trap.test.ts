import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLE, TRAPDOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';

for (const kind of [HOLE, TRAPDOOR]) {
    void test(`a ${kind === HOLE ? 'hole' : 'trapdoor'} cannot send a xorn below the bottom level`, async () => {
        freshConnectedLevels({ destinationDepth: 1 });
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 11, 10);
        addTrap(game.level, kind, 11, 10, { dst: { dnum: 0, dlevel: 2 } });

        await triggerImmediateMonsterTrap(xorn, game, { random: () => 0 });

        assert.ok(game.level.monsters.includes(xorn));
        assert.equal(xorn.mx, 11);
        assert.equal(xorn.my, 10);
        assert.ok(!game._migratingMonsters?.includes(xorn));
    });
}
