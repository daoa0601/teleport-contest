import test from 'node:test';
import assert from 'node:assert/strict';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { inventoryLetter } from './support/commands.js';
import { rhack } from '../js/cmd.js';
// C apply.c:3139 reveals an unseen whip target with Amonnam(), the
// capitalized form of a_monnam(), so vowel-initial species take "An".
void test('a whip revealing a hidden acid blob names it with the article an', async () => {
    freshPlayableRoom();
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    const blob = await createMonsterAt('acid blob', game.u.ux + 1, game.u.uy);
    blob.mundetected = 1;
    initRng(7105n);
    const paged = [];
    const input = resetInputState();
    input.beforeRead = () => { paged.push(game._pending_message || ''); };
    pushKeys(`${inventoryLetter(whip)}l   `);
    await rhack('a'.charCodeAt(0));
    assert.equal(blob.mundetected, 0);
    assert.deepEqual(paged.filter(line => line.includes('is there that you')), ["An acid blob is there that you couldn't see."]);
    assert.equal(game._pending_message, 'You flick your bullwhip towards the acid blob.  Snap!');
});
// C apply.c:3138: if (spotitnow || !glyph_is_invisible(levl[rx][ry].glyph))
// — a target that stays unseen is announced ("A monster is there that you
// couldn't see.") and its square is map_invisible()-marked only when the
// square does not already remember an invisible marker; an already-marked
// square prints no reveal at all.
for (const alreadyMarked of [false, true]) {
    void test(`whipping an unseen monster ${alreadyMarked ? 'skips the reveal on an already-marked square' : 'announces and marks an unmarked square'}`, async () => {
        const level = freshPlayableRoom();
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        const lurker = await createMonsterAt('newt', game.u.ux + 1, game.u.uy);
        lurker.minvis = true;
        const square = level.requireAt(game.u.ux + 1, game.u.uy);
        square.remembered_glyph = alreadyMarked
            ? { kind: 'invisible', ch: 'I', color: 8 } : null;
        initRng(7106n);
        const paged = [];
        const input = resetInputState();
        input.beforeRead = () => { paged.push(game._pending_message || ''); };
        pushKeys(`${inventoryLetter(whip)}l   `);
        await rhack('a'.charCodeAt(0));
        const reveals = paged.filter(line => line.includes('is there that you'));
        if (alreadyMarked) {
            assert.deepEqual(reveals, [], 'an already-marked square must not repeat the reveal');
        }
        else {
            assert.deepEqual(reveals, ["A monster is there that you couldn't see."]);
        }
        assert.equal(square.remembered_glyph?.kind, 'invisible', alreadyMarked
            ? 'the existing marker must stay'
            : 'map_invisible() must have marked the square');
        assert.match(game._pending_message, /You flick your bullwhip towards it\./);
    });
}
//# sourceMappingURL=whip_reveal_article.test.js.map