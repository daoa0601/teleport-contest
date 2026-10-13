import assert from 'node:assert/strict';
import test from 'node:test';

import { ARROW_TRAP, DART_TRAP, NO_MINVENT, ROCKTRAP } from '../js/const.js';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const [type, name] of [[ARROW_TRAP, 'arrow'], [DART_TRAP, 'dart'], [ROCKTRAP, 'falling-rock']] as const) {
    void test(`revealing a ${name} trap redraws a monster over its floor pile before hit prose`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const kitten = await createMonsterAt('kitten', 12, 10, NO_MINVENT);
        kitten.mhp = kitten.mhpmax = 100;
        await floorObject(ROCK, 11, 10);
        newsym(11, 10);
        await flush_screen(1);
        const trap = addTrap(level, type, 11, 10, { tseen: false });
        placeMonsterAt(kitten, 11, 10);
        newsym(12, 10);
        await plineWithContinuation('You hear something moving nearby in the darkness.');
        const input = resetInputState();
        const action = await triggerImmediateMonsterTrap(kitten, game);
        const finishing = resumeDeferredMonsterTrap(action, game);
        await input.waitUntilBlocked();
        const cell = requireScreenCell(10, 11).ch;
        input.feed(' '.repeat(4));
        await finishing;

        assert.equal(trap.tseen, true);
        assert.equal(cell, 'f');
    });
}
