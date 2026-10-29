import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
// C do.c:goto_level() ends with fall damage (do.c:1989-1994) and pickup(1)
// (do.c:1996) after resetting u.uz0 to the arrival level (do.c:1967).  A
// hero who dies falling down the shaft therefore ends the game with u.uz0
// on the level they died on, not the one they left.
void test('dying to arrival fall damage leaves u.uz0 on the arrival level', async () => {
    freshPlayableRoom({
        flags: { debug: true },
        hero: { uz: { dnum: 0, dlevel: 1 }, uhp: 1 },
        seed: 3n,
    });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 5 }),
    ];
    const input = resetInputState();
    input.beforeRead = () => {
        const prompt = game._pending_message || '';
        game._pending_message = '';
        game._retained_message = '';
        input.feed(prompt.includes('Die?') ? 'y' : ' ');
    };
    await gotoLevel({ dnum: 0, dlevel: 4 }, { arrival: 'falling' });
    assert.equal(game.program_state?.gameover, true, 'the three-level shaft fall must kill a 1 HP hero');
    assert.equal(game.u.uz?.dlevel, 4, 'the hero died on the arrival level');
    assert.deepEqual(game.u.uz0, { dnum: 0, dlevel: 4 }, 'u.uz0 is reset before the fall damage, so death keeps it on the arrival level (do.c:1967)');
});
//# sourceMappingURL=arrival_fall_death_uz0.test.js.map