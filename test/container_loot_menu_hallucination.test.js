import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CLUB, DART, ROCK, SACK, TOUCHSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
// C pickup.c:query_objlist() attaches obj_to_glyph() to every item of a loot
// menu, so a hallucinating hero spends one display-RNG draw per menu entry.
// The glyph itself is not rendered in the tty menu; the player-visible effect
// is that the pile glyphs redrawn after the loot command come from a display
// stream advanced by the number of menu entries shown.
async function hallucinatedRockAppearanceAfterLoot(menuEntries) {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    const sack = await floorObject(SACK, 10, 10);
    const contents = [];
    for (const otyp of menuEntries) {
        contents.push(await knownObject(otyp, { where: 'contained', container: sack }));
    }
    sack.contents = contents;
    const rock = await floorObject(ROCK, 12, 10);
    initRng(61n);
    const topline = () => requireGameDisplay(game).grid[0]?.map(cell => cell.ch).join('') ?? '';
    const input = resetInputState();
    pushKeys('loot\n');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(topline(), /Do what with the sack\?/);
    input.feed('o');
    await input.waitUntilBlocked();
    // A one-class sack skips the category menu outright (query_category()
    // shows no menu for a single category), so only multi-class sacks see it.
    if (/Take out what type of objects\?/.test(topline())) {
        input.feed('a');
        await input.waitUntilBlocked();
        input.feed('\n');
        await input.waitUntilBlocked();
    }
    assert.match(topline(), /Take out what\?/);
    input.feed('\x1b');
    await looting;
    game.tutorial_set_in_config = true;
    installPagerInput(input, { expected: /^/, limit: 80 });
    await finishAtCommandInput(input, () => moveloop_core(), /^/);
    const remembered = level.requireAt(rock.ox, rock.oy).remembered_glyph;
    assert.ok(remembered?.kind === 'object', 'The hallucination refresh must repaint the rock pile');
    return remembered.otyp;
}
void test('a hallucinated loot item menu spends one object draw per menu entry', async () => {
    const afterOneEntry = await hallucinatedRockAppearanceAfterLoot([DART]);
    const afterThreeEntries = await hallucinatedRockAppearanceAfterLoot([DART, CLUB, TOUCHSTONE]);
    assert.notEqual(afterThreeEntries, afterOneEntry, `Showing three loot entries must advance the hallucination stream past one entry `
        + `(${afterThreeEntries} vs ${afterOneEntry})`);
});
//# sourceMappingURL=container_loot_menu_hallucination.test.js.map