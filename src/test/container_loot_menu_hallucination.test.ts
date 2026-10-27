import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_COLOR } from '../js/monster_data.js';
import type { GameObject } from '../js/object_types.js';
import { CLUB, CORPSE, DART, OBJECT_BASES, OBJECT_COLOR, SACK, TOUCHSTONE } from '../js/object_data.js';
import { initRng, rn2Display } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

// C pickup.c:query_objlist() attaches obj_to_glyph() to every item of a loot
// menu; hallucination spends one display-RNG object draw per entry
// (display.h:random_obj_to_glyph).  Without those draws the hallucination
// refresh that follows the loot command would read its pile glyph from an
// earlier display-stream position.
void test('a hallucinated loot item menu spends one object draw per menu entry', async () => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    const sack = await floorObject(SACK, 10, 10);
    const contents: GameObject[] = [];
    for (const otyp of [DART, CLUB, TOUCHSTONE]) {
        contents.push(await knownObject(otyp, { where: 'contained', container: sack }));
    }
    sack.contents = contents;
    const firstObject = OBJECT_BASES[2];
    assert.ok(firstObject !== undefined);
    initRng(23n);
    const objectDraw = () => {
        const otyp = rn2Display(OBJECT_COLOR.length - firstObject) + firstObject;
        if (otyp === CORPSE) rn2Display(MONSTER_COLOR.length);
        return otyp;
    };
    const menuEntries = [objectDraw(), objectDraw(), objectDraw()];
    objectDraw(); // see_monsters() redraws the sack pile under the hero
    const pileAppearance = objectDraw(); // see_objects() redraws the pile top
    initRng(23n);

    const topline = () => requireGameDisplay(game).grid[0]?.map(cell => cell.ch).join('') ?? '';
    const input = resetInputState();
    pushKeys('loot\n');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(topline(), /Do what with the sack\?/);
    input.feed('o');
    await input.waitUntilBlocked();
    assert.match(topline(), /Take out what type of objects\?/);
    input.feed('a');
    await input.waitUntilBlocked();
    input.feed('\n');
    await input.waitUntilBlocked();
    assert.match(topline(), /Take out what\?/);
    input.feed('\x1b');
    await looting;

    game.tutorial_set_in_config = true;
    installPagerInput(input, { expected: /^/, limit: 80 });
    await finishAtCommandInput(input, () => moveloop_core(), /^/);

    const remembered = level.requireAt(game.u.ux, game.u.uy).remembered_glyph;
    assert.ok(remembered?.kind === 'object');
    assert.equal(remembered.otyp, pileAppearance,
        `Expected pile appearance ${pileAppearance} after ${menuEntries.length} menu draws`);
    assert.notEqual(pileAppearance, menuEntries[0]);
    assert.equal(game.context.move, 0);
});
