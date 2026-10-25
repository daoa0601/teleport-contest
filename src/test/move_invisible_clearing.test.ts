import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { glyphAt, map_invisible } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C hack.c:domove(): once the attempted step is not a forced fight and not a
// displacer-beast swap, the move itself clears a remembered "unseen monster"
// at the destination (unmap_invisible + newsym) — even when the step never
// completes. The "m" prefix skips domove_fight_empty()'s thin-air attack, so
// the clearing falls to the move attempt alone.
void test('a no-pick move attempt clears a remembered unseen monster at its destination', async () => {
    freshObjectRoom();
    installPolymorphedHero('blue jelly');

    map_invisible(11, 10);
    assert.equal(glyphAt(11, 10)?.kind, 'invisible');

    pushKeys('l' + ' '.repeat(8));
    await rhack('m'.charCodeAt(0));

    assert.equal(game._pending_message, 'You are rooted to the ground.');
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    // The failed step still revealed that nothing unseen stands there.
    assert.equal(game.level?.requireAt(11, 10).remembered_glyph?.kind, 'terrain');
    assert.equal(glyphAt(11, 10)?.kind, 'terrain');
});
