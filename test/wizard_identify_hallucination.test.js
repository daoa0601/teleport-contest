import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CLUB, DART, ROCK, TOUCHSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
// C invent.c:display_pickinv() attaches obj_to_glyph(otmp, rn2_on_display_rng)
// metadata to every wizard-identify row before doname().  A hallucinating
// hero therefore spends display-RNG draws per listed row; the tty menu never
// renders the glyph, so the player-visible effect is that the hallucination
// stream repainting remembered piles afterwards is advanced by the number of
// rows the Debug Identify menu showed.
async function hallucinatedRockAppearanceAfterWizIdentify(menuEntries) {
    const level = await freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    requirePlayingGame(game);
    game.flags.debug = true;
    // Unidentified objects (dknown unset by the unobserved admission) are
    // exactly the rows the Debug Identify menu lists.
    for (const otyp of menuEntries)
        await addInventoryObject(otyp, { observed: false });
    const rock = await floorObject(ROCK, 12, 10);
    initRng(61n);
    const input = resetInputState();
    pushKeys('wizidentify\n');
    const identify = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    const toplineRow = requireGameDisplay(game).grid[0];
    assert.ok(toplineRow, 'The Debug Identify menu needs its display row.');
    assert.doesNotMatch(toplineRow.map(cell => cell.ch).join(''), /\?/, 'The Debug Identify menu must not sit behind a question');
    // Escape leaves the PICK_ANY menu without identifying anything.
    input.feed('\x1b');
    await identify;
    game.tutorial_set_in_config = true;
    installPagerInput(input, { expected: /^/, limit: 80 });
    await finishAtCommandInput(input, () => moveloop_core(), /^/);
    const remembered = level.requireAt(rock.ox, rock.oy).remembered_glyph;
    assert.ok(remembered?.kind === 'object', 'The hallucination refresh must repaint the rock pile');
    return remembered.otyp;
}
void test('a hallucinated wizard identify menu spends display draws per row', async () => {
    const afterOneRow = await hallucinatedRockAppearanceAfterWizIdentify([DART]);
    const afterThreeRows = await hallucinatedRockAppearanceAfterWizIdentify([DART, CLUB, TOUCHSTONE]);
    assert.notEqual(afterThreeRows, afterOneRow, `Showing three Debug Identify rows must advance the hallucination stream past one row `
        + `(${afterThreeRows} vs ${afterOneRow})`);
});
//# sourceMappingURL=wizard_identify_hallucination.test.js.map