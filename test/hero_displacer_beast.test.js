import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, NO_MINVENT, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an alert displacer beast sometimes swaps places with an approaching hero instead of taking an attack', async () => {
    let swaps = 0;
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ hero: { uhitinc: -100 } });
        requirePlayingGame(game);
        const beast = await createMonsterAt('displacer beast', 11, 10, MM_ANGRY | NO_MINVENT);
        beast.mux = game.u.ux;
        beast.muy = game.u.uy;
        const hp = beast.mhp;
        pushKeys(' '.repeat(30));
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        if (game.u.ux === 10)
            continue;
        assert.equal(game.u.ux, 11);
        assert.equal(beast.mx, 10);
        assert.equal(beast.mux, 11, 'the beast remembers the hero at the new position');
        assert.equal(beast.mhp, hp);
        assert.match(game._pending_message, /swaps places with you/);
        swaps++;
    }
    assert.ok(swaps > 0, 'the beast must sometimes choose its native displacement');
});
void test('a beast choosing to displace the hero lands in the trap at the old hero square', async () => {
    let trapped = false;
    for (let seed = 1; seed <= 16 && !trapped; seed++) {
        const level = freshObjectRoom({ hero: { uhitinc: -100 } });
        requirePlayingGame(game);
        const beast = await createMonsterAt('displacer beast', 11, 10, MM_ANGRY | NO_MINVENT);
        beast.mux = 10;
        beast.muy = 10;
        addTrap(level, PIT, 10, 10);
        pushKeys(' '.repeat(30));
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        if (game.u.ux === 10)
            continue;
        assert.equal(beast.mx, 10);
        assert.equal(beast.mtrapped, 1);
        trapped = true;
    }
    assert.ok(trapped, 'a displaced beast must settle the landing trap');
});
//# sourceMappingURL=hero_displacer_beast.test.js.map