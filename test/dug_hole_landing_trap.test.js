import test from 'node:test';
import assert from 'node:assert/strict';
import { DART_TRAP, ROOM, STONE } from '../js/const.js';
import { digHole } from '../js/digging_terrain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
void test('falling through a freshly dug hole triggers a trap at the landing square', async () => {
    const { destination } = freshConnectedLevels({ destinationDepth: 2 });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    game.u.ux = 11; // off the down stairs, onto diggable floor
    for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            const location = destination.at(x, y);
            if (location && location.typ !== STONE && !(y === 10 && (x === 14 || x === 15)))
                location.typ = STONE;
        }
    }
    const trap = addTrap(destination, DART_TRAP, 15, 10);
    // A pet next to the hero follows the fall and arrives on the hero's
    // square, so goto_level() shifts one of them onto the trap.
    const pet = await createMonsterAt('little dog', 12, 10);
    pet.mtame = 10;
    resetInputState().display = {
        async readKey() { return ' '.charCodeAt(0); },
    };
    initRng(5n);
    await digHole({});
    assert.ok(game.level === destination, 'the hero fell to the level below');
    assert.deepEqual([game.u.ux, game.u.uy], [15, 10], 'the arriving pet displaced the hero onto the trap');
    assert.equal(trap.tseen, true, "spoteffects() sets off the landing square's trap");
    assert.match(game._pending_message ?? '', /A little dart shoots out at you!/);
});
//# sourceMappingURL=dug_hole_landing_trap.test.js.map