import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLE, TRAPDOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { monsterKnowsTrap, monsterLearnsTrap } from '../js/trap_knowledge.js';
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

    void test(`a bottom-level ${kind === HOLE ? 'hole' : 'trapdoor'} is learned by its entrant and nearby observers`, async () => {
        freshConnectedLevels({ destinationDepth: 1 });
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 11, 10);
        const observer = await createMonsterAt('goblin', 12, 10);
        const trap = addTrap(game.level, kind, 11, 10, { dst: { dnum: 0, dlevel: 2 } });

        await triggerImmediateMonsterTrap(xorn, game, { random: () => 0 });

        assert.equal(monsterKnowsTrap(xorn, trap), true, 'the entrant learns the trap despite having nowhere to fall');
        assert.equal(monsterKnowsTrap(observer, trap), true, 'nearby sighted observers learn the trap');
        assert.ok(game.level.monsters.includes(xorn));
        assert.ok(!game._migratingMonsters?.includes(xorn));
    });

    void test(`a monster can avoid a known bottom-level ${kind === HOLE ? 'hole' : 'trapdoor'}`, async () => {
        freshConnectedLevels({ destinationDepth: 1 });
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 11, 10);
        const observer = await createMonsterAt('goblin', 12, 10);
        const trap = addTrap(game.level, kind, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
        monsterLearnsTrap(xorn, trap);

        const action = await triggerImmediateMonsterTrap(xorn, game, { random: () => 1 });

        assert.equal(action.event?.kind, 'known-trap-avoided');
        assert.equal(monsterKnowsTrap(observer, trap), false, 'avoiding the trap does not teach observers');
        assert.ok(game.level.monsters.includes(xorn));
    });
}
