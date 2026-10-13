import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { promptDirection } from '../js/tty_prompts.js';
import { moveloop_core } from '../js/allmain.js';
import { ARROW, BOW, CLUB, OBJECT_NAMES } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom, freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { createMonsterAt } from './support/monsters.js';

void test('a direction query acknowledges unread pet prose before accepting a direction', async () => {
    freshGameplayRoom();
    await plineWithContinuation('Your dog drops a food ration.');
    const input = resetInputState();
    const direction = promptDirection();
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /Your dog drops a food ration\./);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /^In what direction\?/);
    } finally {
        input.feed('l');
        await direction;
    }
    const selected = await direction;
    assert.ok(selected);
    assert.equal(selected.dx, 1);
    assert.equal(selected.dy, 0);
});

void test('fire assistance preserves Escape suppression when queued fire resumes after swapping', async () => {
    const input = freshTurnRoom();
    await setPrimaryWeapon(await addInventoryObject(CLUB, { invlet: 'a' }));
    const bow = await addInventoryObject(BOW, { invlet: 'b' });
    await setSecondaryWeapon(bow);
    await setQuiverObject(await addInventoryObject(ARROW, { invlet: 'c', quan: 3 }));
    input.feed('f');
    await moveloop_core();
    const swap = moveloop_core();
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await swap;
    assert.equal(game.uwep, bow);

    const fire = moveloop_core();
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /^In what direction\?/);
    } finally {
        input.feed('\x1b\x1b');
        await fire;
    }
});

void test('target input restores feedback for a queued polearm attack after Escape during swapping', async () => {
    const input = freshTurnRoom({ hero: { uhitinc: 100 } });
    game._travelTipShown = true;
    await setPrimaryWeapon(await addInventoryObject(CLUB, { invlet: 'a' }));
    const polearm = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'), { invlet: 'b' });
    await setSecondaryWeapon(polearm);
    const target = await createMonsterAt('jackal', 12, 10);
    target.mhp = target.mhpmax = 100;
    target.mcanmove = 0;
    target.mfrozen = 10;
    newsym(target.mx, target.my);

    input.feed('ab');
    const swap = moveloop_core();
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await swap;
    assert.equal(game.uwep, polearm);

    input.feed('.');
    await moveloop_core();
    await flush_screen(1);

    const message = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    assert.match(message, /hits the jackal/);
    assert.ok(target.mhp < 100);
    assert.equal(game.context.move, 1);
});

void test('a direction query skips prose suppressed by Escape at the preceding pager', async () => {
    freshGameplayRoom();
    await plineWithContinuation('You swap weapons and secure your new weapon in your right hand.');
    const input = resetInputState();
    const feedback = plineWithContinuation('Your old weapon is now your alternate weapon.');
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await feedback;

    const direction = promptDirection();
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /^In what direction\?/);
    } finally {
        input.feed('\x1b\x1b');
        await direction;
    }
});

