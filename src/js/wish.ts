// The Amulet's victory wish.
// C ref: allmain.c grants it once, after elapsed monster work and before the
// next player input; zap.c:makewish() itself lives in zap.ts.

import { flushPendingTopline } from './topl.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { makeWish } from './zap.js';

// Part of C allmain.c's moveloop turn boundary (allmain.c:446): the
// amulet wish is granted once, after elapsed monster work and before
// the next player input.
export async function grantAmuletWish(): Promise<boolean> {
    if (!game.u?.uhave?.amulet || game.u?.uevent?.amulet_wish)
        return false;
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.amulet_wish = 1;
    await flushPendingTopline();
    // C allmain.c:449 uses urgent_pline() so the announcement overrides the
    // message suppression left by an Escape at --More--.
    await plineWithContinuation('The Amulet is bestowing a wish upon you!', { urgent: true });
    await makeWish();
    return true;
}
