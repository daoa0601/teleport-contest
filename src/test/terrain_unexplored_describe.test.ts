import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { makeBlinded } from '../js/sight_change.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { createMonsterAt } from './support/monsters.js';

const toplText = () => requireScreenRow(0).map(cell => cell.ch).join('').trim();

// C detect.c:reveal_terrain_getglyph() starts every non-swallowed square
// from glyph_at(), the screen buffer, whose never-drawn value is
// GLYPH_UNEXPLORED, so browsing #terrain onto a never-explored square
// makes getpos()'s auto_describe report lookat()'s "unexplored area"
// rather than the S_stone "unexplored" of a mapped-but-unseen square.
void test('terrain browsing an unexplored square reports unexplored area', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('\x7fc');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        input.feed(' ');
        // Move the cursor below the lit room onto never-explored space.
        input.feed('jjj');
        await input.waitUntilBlocked();
        assert.equal(toplText(), 'unexplored area');
    } finally {
        input.feed(',');
        await action;
    }
});

// Hiding a sensed monster behind unexplored space keeps the same wording:
// C's levl[][].glyph starts as GLYPH_UNEXPLORED (mklev.c zerorm) and only
// unmap_object() writes the S_stone default, so reveal_terrain_getglyph()
// hides a telepathically sensed monster at a never-seen square with the
// unexplored glyph and lookat() reports "unexplored area".
void test('terrain browsing hides a sensed monster behind unexplored area', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    // Intrinsic telepathy while blind senses the kitten without ever
    // seeing its square, so no memory glyph is written when it appears.
    game.u.telepathy = true;
    await makeBlinded(100, { talk: false });
    const monster = await createMonsterAt('kitten', 10, 14);
    assert.ok(monster, 'kitten should be placed outside the lit room');
    input.feed('\x7fc');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        input.feed(' ');
        await input.waitUntilBlocked();
        input.feed('jjjj');
        await input.waitUntilBlocked();
        assert.equal(toplText(), 'unexplored area');
    } finally {
        input.feed(',');
        await action;
    }
});
