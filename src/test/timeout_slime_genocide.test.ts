import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { finishHeroDeath } from '../js/end.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { polymonHero } from '../js/polyself.js';
import { advanceHeroSliming, PM_GREEN_SLIME, startHeroSliming } from '../js/slime.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('declining sliming death acknowledges that a genocided form is still fatal', async () => {
    freshObjectRoom({ flags: { debug: true, bones: false } });
    requireFixtureGame(game);
    const vital = game.mvitals[PM_GREEN_SLIME];
    assert.ok(vital);
    vital.mvflags |= G_GENOD;
    startHeroSliming({ turns: 1 });
    const input = resetInputState();
    const messages: string[] = [];
    let reads = 0;
    let declinedDeaths = 0;
    input.display = {
        readKey() {
            const line = requireScreenRow(0).map(cell => cell.ch).join('').trim();
            assert.ok(++reads < 20, `Sliming recovery did not finish: ${line}`);
            messages.push(game._pending_message || line);
            if (/Die\?/.test(line)) {
                declinedDeaths++;
                return Promise.resolve('n'.charCodeAt(0));
            }
            assert.match(line, /--More--/);
            return Promise.resolve(' '.charCodeAt(0));
        },
    };

    const result = await advanceHeroSliming({ transform: polymonHero, die: finishHeroDeath });

    assert.equal(declinedDeaths, 2);
    assert.equal(result.died, false);
    assert.match(messages.join('\n'), /Yes, you do\.  Green slime has been genocided\.\.\./);
});
