import assert from 'node:assert/strict';
import test from 'node:test';

import { ROOM, STONE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { continueHeroDigging, startHeroDigging } from '../js/hero_digging.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { requireFixtureGame } from './support/game-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C dig.c mkcavearea(): display_nhwindow(WIN_MESSAGE, TRUE) acknowledges the
// cave announcement before any ceiling square visibly changes.
void test('an Earth cave-in announcement pages before the ceiling collapses',
    async () => {
        const level = freshObjectRoom();
        requireFixtureGame(game);
        game.earth_level = {
            ...game.u.uz, flags: { town: false }, alignment: null,
        };
        const pick = await addInventoryObject(PICK_AXE, { cursed: true });
        await setPrimaryWeapon(pick);
        level.requireAt(11, 10).typ = STONE;
        vision_reset();
        const input = resetInputState();
        initRng(5n);
        await startHeroDigging(pick, 11, 10);

        const digging = (async () => {
            for (let turn = 0; turn < 32; turn++) {
                if (!await continueHeroDigging()) return;
            }
            assert.fail('Digging did not finish within 32 turns.');
        })();

        // First pager: the dig start and effort messages.
        await input.waitUntilBlocked();
        input.feed(' ');

        // Second pager: the cave-in announcement itself.
        await input.waitUntilBlocked();
        const display = requireGameDisplay();
        const topLine = Array.from({ length: display.cols },
            (_, column) => display.getChar(column + 1, 1)).join('');
        assert.match(topLine, /Crash!  The ceiling collapses around you!\s*--More--/);
        assert.equal(level.requireAt(9, 10).typ, ROOM,
            'The collapse waits for its announcement to be acknowledged.');
        input.feed(' ');

        await digging;

        assert.equal(level.requireAt(9, 10).typ, STONE,
            'Acknowledging the pager releases the collapse.');
    });
