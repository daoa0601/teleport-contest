import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
void test('renewal scales health and power deficits by the same proportion as bonuses', async () => {
    const health = [];
    const power = [];
    for (const maximum of [80, 90, 100]) {
        freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        game.u.uhpmax = game.u.uenmax = maximum;
        game.u.uhp = game.u.uen = Math.trunc(maximum / 2);
        game.u.uhpinc.fill(0);
        game.u.ueninc.fill(0);
        game.u.uhpinc[0] = game.u.ueninc[0] = 90;
        initRng(3n);
        pushKeys('polyself\nhuman\n                        ');
        await rhack('#'.charCodeAt(0));
        health.push(game.u.uhpmax);
        power.push(game.u.uenmax);
    }
    for (const [name, values] of [['health', health], ['power', power]]) {
        const [deficit, ordinary, bonus] = values;
        assert.ok(deficit !== undefined && ordinary !== undefined && bonus !== undefined);
        assert.equal(ordinary - deficit, bonus - ordinary, `${name} must round a negative retained adjustment symmetrically: ${values.join(', ')}`);
    }
});
//# sourceMappingURL=polymorph_renewal_rounding.test.js.map