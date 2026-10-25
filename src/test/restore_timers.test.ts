import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble } from '../js/allmain.js';
import { ICE, MOAT } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('restoring expires a due ice timer before welcoming the hero without taking a turn', async () => {
    const level = freshObjectRoom();
    level.requireAt(15, 10).typ = ICE;
    scheduleLevelTimer(15, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const moves = game.moves;
    const input = resetInputState();
    input.beforeRead = () => {
        assert.equal(requireGameLevel().requireAt(15, 10).typ, MOAT,
            'Due timers must finish before the welcome is presented');
    };
    installPagerInput(input, { expected: /Restoring save file|welcome back/, limit: 2 });

    await restoregamePreamble();

    assert.equal(requireGameLevel().requireAt(15, 10).typ, MOAT);
    assert.equal(game.moves, moves);
});
