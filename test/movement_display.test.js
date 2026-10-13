import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { displayMessageWindow, flush_screen, newsym, pline } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { CORPSE, POT_HEALING } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
void test('swapping with a pet redraws both positions before the swap message is acknowledged', async () => {
    freshObjectRoom({ flags: { pickup: false } });
    const kitten = await createMonsterAt('kitten', 11, 10, MM_NOGRP | NO_MINVENT);
    initializePet(kitten);
    newsym(11, 10);
    await flush_screen(1);
    const input = resetInputState();
    let acknowledgments = 0;
    input.display = {
        async readKey() {
            assert.equal(++acknowledgments, 1, 'Only the swap message needs acknowledgment');
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You swap places with.*kitten/);
            assert.equal(requireScreenCell(9, 11).ch, 'f', 'The kitten is drawn at the hero\'s old position');
            assert.equal(requireScreenCell(10, 11).ch, '@', 'The hero is drawn at the kitten\'s old position');
            return 32;
        },
    };
    initRng(1);
    await rhack('l'.charCodeAt(0));
    await displayMessageWindow();
    assert.equal(acknowledgments, 1);
    assert.equal(game.u.ux, 11);
    assert.equal(kitten.mx, 10);
});
void test('automatic floor inspection flushes hero movement before acknowledging the previous message', async () => {
    freshObjectRoom({ flags: { pickup: false } });
    await floorObject(POT_HEALING, 11, 10);
    await floorObject(CORPSE, 11, 10, { corpsenm: nameToMonster('goblin') });
    newsym(11, 10);
    await flush_screen(1);
    await pline('You hear a distant howl.');
    game.u.ux = 11;
    newsym(10, 10);
    vision_recalc(1);
    const input = resetInputState();
    let acknowledgments = 0;
    input.display = {
        async readKey() {
            acknowledgments++;
            assert.ok(acknowledgments <= 2, 'Only the previous message and floor pile need acknowledgment');
            const display = requireGameDisplay();
            const prose = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(prose, acknowledgments === 1 ? /You hear a distant howl.*--More--/ : /Things that are here:/);
            assert.equal(requireScreenCell(9, 11).ch, '.', 'The hero\'s old position is cleared');
            assert.equal(requireScreenCell(10, 11).ch, '@', 'The hero is drawn above the corpse');
            return 32;
        },
    };
    await autopickupAtHero();
    assert.equal(acknowledgments, 2);
    assert.equal(game.u.ux, 11);
});
//# sourceMappingURL=movement_display.test.js.map