import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW_TRAP, DART_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C trap.c trapeffect_arrow_trap()/trapeffect_dart_trap(): a mounted hero's
// steed takes the missile half the time, through steedintrap() and thitm().
for (const trapType of [ARROW_TRAP, DART_TRAP]) {
    const missile = trapType === ARROW_TRAP ? 'arrow' : 'dart';
    void test(`a ridden steed sometimes takes a ${missile} trap's missile instead of the hero`, async () => {
        let steedTargeted = 0, heroTargeted = 0;
        for (let seed = 1n; seed <= 40n; seed++) {
            freshObjectRoom();
            requirePlayingGame(game);
            const steed = await createSaddledSteed();
            steed.mhp = steed.mhpmax = 200;
            game.u.usteed = steed;
            game.u.uhp = game.u.uhpmax = 200;
            const trap = addTrap(game.level, trapType, game.u.ux, game.u.uy);
            const messages = [];
            const input = resetInputState();
            input.beforeRead = () => {
                messages.push(game._last_message ?? '');
                input.feed(' ');
            };
            initRng(seed);
            await triggerHeroTrap(trap, { forceTrap: true });
            messages.push(game._last_message ?? '');
            const text = messages.join(' ');
            if (/The saddled pony is (?:almost )?hit by an? /.test(text)) {
                steedTargeted++;
                assert.equal(game.u.uhp, 200, 'the hero is untouched when the steed is targeted');
                assert.doesNotMatch(text, /You are (?:almost )?hit|misses you/);
            }
            else {
                heroTargeted++;
                assert.equal(steed.mhp, 200, text);
            }
        }
        assert.ok(steedTargeted > 0 && heroTargeted > 0, `steed ${steedTargeted}, hero ${heroTargeted}`);
    });
}
//# sourceMappingURL=steed_projectile_trap.test.js.map