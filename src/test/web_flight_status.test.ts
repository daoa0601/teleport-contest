import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/botl.js';
import { rhack } from '../js/cmd.js';
import { A_STR, TT_WEB, WEB } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

// nethack-c/upstream/src/trap.c:trapeffect_web() calls
// "set_utrap(1, TT_WEB);", then the strong hero's
// "You(\"tear through %s web!\", a_your[trap->madeby_u]);", then
// "set_utrap((unsigned) tim, TT_WEB);". Flight stays blocked at the pager.
void test('a flying dragon caught in a web loses Fly until it tears free', async () => {
    const level = await freshObjectRoom({ flags: { pickup: false } });
    const hero = installPolymorphedHero('black dragon');
    hero.acurr.a[A_STR] = hero.amax.a[A_STR] = 118;
    const x = hero.ux + 1, y = hero.uy;
    const web = addTrap(level, WEB, x, y);
    // The floor description makes the two web messages need a pager.
    await floorObject(GOLD_PIECE, x, y, { quan: 85 });
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bFly\b/);
    const input = resetInputState();
    let acknowledgedWeb = false;
    input.display = {
        async readKey(): Promise<number> {
            assert.equal(acknowledgedWeb, false, 'only the web entry needs acknowledgement');
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''),
                /You fly into a spider web!.*--More--/);
            assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''),
                /\bFly\b/, 'the web blocks flight while its entry message is displayed');
            assert.equal(hero.utraptype, TT_WEB);
            assert.ok((hero.utrap ?? 0) > 0);
            acknowledgedWeb = true;
            return ' '.charCodeAt(0);
        },
    };

    await rhack('l'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(acknowledgedWeb, true, 'the hero acknowledged entering the web');
    assert.equal(game._pending_message, 'You tear through a web!');
    assert.equal(hero.utrap, 0);
    assert.equal(level.traps.includes(web), false);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bFly\b/);
});
