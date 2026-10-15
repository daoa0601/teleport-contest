import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
void test('an untended temple can summon a hostile ghost and terrify the entering hero', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(5);
    await rhack('l'.charCodeAt(0));
    const ghost = level.monsters.find(monster => monster.mnum === 287);
    assert.ok(ghost, 'entering the abandoned temple should create a ghost');
    assert.equal(ghost.mpeaceful, 0);
    assert.equal(game._helplessTurns, 3);
    assert.equal(game._helplessReason, 'being terrified of a ghost');
    assert.equal(game._helplessDoneMessage, 'You regain your composure.');
});
//# sourceMappingURL=temple_ghost.test.js.map