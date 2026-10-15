import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE, UTOTYPE_DEFERRED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon } from './support/topology.js';

void test('Vlad\'s throne schedules travel until the command finishes on its source level', async () => {
    const { source, destination } = freshConnectedLevels({ dungeonName: "Vlad's Tower" });
    source.requireAt(10, 10).typ = THRONE;
    game.dungeons.push(createDungeon({ dname: 'Gehennom', num_dunlevs: 20 }));
    const levels = game._levelCache;
    const cached = levels?.get('0:2');
    assert.ok(levels && cached);
    levels.set('1:19', cached);
    initRng(59n);

    await runExtendedCommand('sit', ' '.repeat(20));

    assert.ok(game.level === source, 'The sit command must finish on the departure level');
    assert.equal(game.u.utotype, UTOTYPE_DEFERRED);
    assert.deepEqual(game.u.utolev, { dnum: 1, dlevel: 19 });
    await finishScheduledLevelChange();
    assert.ok(game.level === destination, 'Deferred travel must restore the destination level');
    assert.equal(game.u.utotype, 0);
    assert.match(game._pending_message, /extremely out of place/);
});
