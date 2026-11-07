import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_LEVITATION } from '../js/object_data.js';
import { applyLevitationPotion } from '../js/potion.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

// C potion.c:peffect_levitation() (1174-1177) sets HLevitation's timeout to
// 1 *before* float_up() so the macro is true while it runs, and C trap.c
// float_up() prints "You start to float in the air!" (3988) and then "You
// are no longer able to control your flight." (3999-4000) *before* its
// closing float_vs_flight() (4001) sets BFlying|I_SPECIAL.  The second
// message pages the first, and the status line the pager shows is rendered
// in between: botl.c:1194 reads `Flying`, which is
// `(HFlying || EFlying || steed flyer) && !BFlying` (youprop.h:253-255) with
// BFlying still holding its pre-potion value — so a polymorphed flyer shows
// both Fly and Lev at the pager, and only Lev after the potion settles.
void test('a polymorphed flyer quaffing levitation shows Fly and Lev at the pager', async () => {
    await freshObjectRoom({ flags: { pickup: false } });
    requirePlayingGame(game);
    installPolymorphedHero('gray dragon');
    const input = resetInputState();
    let pagerSeen = 0;
    input.display = {
        async readKey(): Promise<number> {
            pagerSeen++;
            const status = requireScreenRow(23).map(cell => cell.ch).join('');
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''),
                /You start to float in the air!--More--/);
            assert.match(status, /\bFly\b/,
                'flight is not blocked until float_vs_flight() runs (youprop.h:253)');
            assert.match(status, /\bLev\b/,
                'the one-turn kludge already makes the Levitation macro true');
            return ' '.charCodeAt(0);
        },
    };

    await applyLevitationPotion(await knownObject(POT_LEVITATION));

    assert.equal(pagerSeen, 1, 'only the float-up message pages');
    await flush_screen(1);
    const settled = requireScreenRow(23).map(cell => cell.ch).join('');
    // float_up()'s closing float_vs_flight() (trap.c:4001) sets
    // BFlying|I_SPECIAL: levitation now overrides flight (polyself.c:136-138).
    assert.doesNotMatch(settled, /\bFly\b/);
    assert.match(settled, /\bLev\b/);
    assert.equal(game.u.levitating, true);
    assert.equal(game.u.flying, false);
});
