import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('an uneventful sit cannot make Vlad\'s throne disappear', async () => {
    const level = freshObjectRoom();
    const throne = level.requireAt(10, 10);
    throne.typ = THRONE;
    game.dungeons = [createDungeon({ dname: "Vlad's Tower" })];
    initRng(2n);

    await runExtendedCommand('sit', ' '.repeat(10));

    assert.equal(throne.typ, THRONE);
    assert.doesNotMatch(game._pending_message, /puff of logic/);
});
