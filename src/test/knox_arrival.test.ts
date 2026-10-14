import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { requireScreenRow } from './support/screen.js';
import { createSpecialLevel } from './support/topology.js';

for (const croesusDead of [false, true]) {
    void test(`returning to Fort Ludios ${croesusDead ? 'leaves the disabled alarm silent' : 'sounds the alarm and wakes its defenders'}`, async () => {
        const { source, destination } = freshConnectedLevels();
        requirePlayingGame(game);
        game.knox_level = createSpecialLevel({ dnum: 0, dlevel: 2 });
        requireMonsterVital(MONSTER_NAME.indexOf('Croesus')).died = croesusDead ? 1 : 0;
        game.level = destination;
        const soldier = await createMonsterAt('soldier', 15, 10, NO_MINVENT);
        soldier.msleeping = 1;
        game.level = source;
        destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
        resetInputState().feed(' '.repeat(10));

        await gotoLevel({ dlevel: 2 });
        await flush_screen(1);

        assert.equal(!!soldier.msleeping, croesusDead);
        const line = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.equal(line.includes('An alarm sounds!'), !croesusDead);
    });
}
