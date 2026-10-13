import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
void test('an imp walking toward the hero finishes its turn before taunting', async () => {
    for (let seed = 1; seed <= 8; seed++) {
        const health = [];
        for (const invisible of [false, true]) {
            freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10,
                heroX: 14, heroY: 10, hero: { uhp: 200, uhpmax: 200, uac: 100 } });
            requirePlayingGame(game);
            const goblin = await createMonsterAt('goblin', 15, 10, MM_ANGRY | NO_MINVENT);
            const imp = await createMonsterAt('imp', 10, 10, MM_ANGRY | NO_MINVENT);
            goblin.movement = imp.movement = 12;
            goblin.msleeping = imp.msleeping = 0;
            imp.minvis = imp.perminvis = invisible;
            game._moveloopStarted = true;
            game._heroTimePending = true;
            game.u.umovement = 12;
            initRng(BigInt(seed));
            const input = resetInputState();
            installPagerInput(input, { expected: /goblin|imp/, limit: 10 });
            await finishAtCommandInput(input, moveloop_core, /goblin/);
            assert.equal(imp.mx, 11);
            assert.equal(imp.my, 10);
            assert.ok(game.u.uhp < 200, 'the goblin takes its attack after the imp walks');
            health.push(game.u.uhp);
        }
        // Native dochug() returns after this move. Visibility cannot admit
        // an extra taunt which changes the following goblin's attack.
        assert.equal(health[0], health[1], `the imp's visibility changed the next attack in game ${seed}`);
    }
});
//# sourceMappingURL=monster_movement_turn_end.test.js.map