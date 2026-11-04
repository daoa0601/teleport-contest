import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { POT_HEALING, SCR_FOOD_DETECTION } from '../js/object_data.js';
import { remove_object } from '../js/floor_object.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenCell } from './support/screen.js';

// C detect.c:check_map_spot() compares the remembered glyph's class through
// objects[glyph_to_obj(glyph)].oc_class, and display.h:glyph_to_obj() decodes
// a generic object glyph to its class slot.  include/objects.h:81-102 fills
// slots [1]..[17] with GENERIC(class) entries whose oc_class is that class,
// so a remembered generic-potion glyph ('!' for an unseen !dknown potion)
// counts as a potion for clear_stale_map(): once no potion remains on the
// square or in a monster there, unmap_object() forgets it and the
// map_redisplay() after browse_map() shows bare stone instead of the '!' it
// had drawn for the same potion earlier.
void test('a confused food detection forgets a remembered generic potion after it leaves the square', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    requirePlayingGame(game);

    // Two unseen potions north and south of the lit starting room; the
    // confused/cursed scroll detects POTION_CLASS, so both are mapped as
    // generic potions.
    const carriedAway = await floorObject(POT_HEALING, 10, 4, { dknown: false });
    await floorObject(POT_HEALING, 10, 16, { dknown: false });
    const scroll = await addInventoryObject(SCR_FOOD_DETECTION, {
        cursed: true, quan: 2, quantity: 2,
    });
    assert.ok(scroll.invlet, 'the scroll needs an inventory letter');

    installPagerInput(input, {
        expected: /nose|smell|sense|instruction|Done|read|scroll/i,
        limit: 40,
    });
    const pager = input.display;
    assert.ok(pager, 'the browse turn needs its configured message pager');
    let browseAnswers = 0;
    input.display = {
        // End each detection's getpos() browse at the current spot and
        // acknowledge anything paged; cancel any other cursor read.
        async readKey(): Promise<number> {
            const display = game.nhDisplay;
            assert.ok(display, 'the browse turn needs its display');
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space to continue/.test(screen)) {
                return pager.readKey();
            }
            if (browseAnswers > 0) {
                browseAnswers--;
                return '.'.charCodeAt(0);
            }
            return 27;
        },
    };

    browseAnswers = 1;
    input.feed(`r${scroll.invlet}`);
    await moveloop_core();
    // The restored map repaints with the status at the next command input.
    await finishAtCommandInput(input, moveloop_core, /.*/);
    // Map (10,4) renders at screen column 9, row 5; (10,16) at row 17.
    assert.equal(requireScreenCell(9, 5).ch, '!',
        'the first browse maps the unseen north potion as a generic potion');
    assert.equal(requireScreenCell(9, 17).ch, '!',
        'the first browse maps the south potion the same way');

    // The north potion is carried away (obj_extract_self()); the remembered
    // generic glyph outlives it only until the next detection's
    // clear_stale_map() runs.
    remove_object(carriedAway);

    browseAnswers = 1;
    input.feed(`r${scroll.invlet}`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /.*/);
    assert.equal(requireScreenCell(9, 5).ch, ' ',
        'clear_stale_map forgets the generic potion the browse still mapped');
    assert.equal(requireScreenCell(9, 17).ch, '!',
        'the south potion stays remembered because it is still there');
});
