import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLE, MAGIC_PORTAL, TRAPDOOR } from '../js/const.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { vision_recalc } from '../js/vision.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';

for (const kind of [HOLE, TRAPDOOR, MAGIC_PORTAL]) {
    void test(`trap type ${kind} retains its monster until the departure message can be shown`, async () => {
        freshConnectedLevels();
        requirePlayingGame(game);
        const xorn = await createMonsterAt('xorn', 11, 10);
        const trap = addTrap(game.level, kind, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
        vision_recalc(0);
        const input = resetInputState();
        await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

        const fall = triggerImmediateMonsterTrap(xorn, game, { random: () => 0 });
        const boundary = await Promise.race([
            input.waitUntilBlocked().then(() => 'pager'), fall.then(() => 'left'),
        ]);
        assert.equal(boundary, 'pager', 'departure waits for the previous message');

        assert.ok(game.level.monsters.includes(xorn));
        assert.equal(xorn.mx, 11);
        assert.equal(trap.tseen, false);
        input.feed(' ');
        await fall;
        assert.equal(game.level.monsters.includes(xorn), false);
        assert.equal(trap.tseen, true);
        assert.ok(game._migratingMonsters?.includes(xorn));
    });
}
