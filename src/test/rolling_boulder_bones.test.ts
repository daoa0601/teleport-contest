import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ROLLING_BOULDER_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('a fatal rolling boulder returns to its launch square before bones are prepared', async () => {
    const level = freshObjectRoom({
        hero: { uhp: 1, uhpmax: 40, uac: 100, fumbling: true },
        flags: { pickup: false, debug: true, bones: true },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20, bonetag: 'D' })];
    const boulder = await floorObject(BOULDER, 9, 10);
    addTrap(level, ROLLING_BOULDER_TRAP, 11, 10, {
        tseen: true, launch: { x: 9, y: 10 }, launch2: { x: 15, y: 10 },
    });
    const input = resetInputState();
    input.beforeRead = () => input.feed(game._pending_message.startsWith('Die?') ? 'y'
        : game._pending_message.includes('bones') ? 'n' : ' ');
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.equal(game.program_state.gameover, true);
    assert.equal(game._canMakeBones, true);
    assert.ok(floorObjectsAt(level, 9, 10).includes(boulder));
    assert.equal(boulder.otrapped, false);
});
