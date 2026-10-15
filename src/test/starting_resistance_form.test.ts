import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { uInitMisc } from '../js/u_init.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a Valkyrie retains her innate cold resistance in a dog body', async () => {
    freshObjectRoom({ role: 'valkyrie', flags: { debug: true } });
    uInitMisc(1);
    requirePlayingGame(game);

    await runExtendedCommand('polyself', `dog\n${' '.repeat(60)}`);

    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('dog'));
    assert.equal(game.u.coldResistance, true);
});
