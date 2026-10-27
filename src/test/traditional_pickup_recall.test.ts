import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { ARROW, CLUB, FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';

// C records the traditional pickup's per-object answers (pickup.c:852
// ynaq/ynNaq, hack.h:1331 addcmdq TRUE) and replays them through
// windows.c:getlin(): during do-again its cmdq_pop() loop drains
// CQ_REPEAT into the class line, so the recorded answers become the
// text of "What kinds of thing do you want to pick up?" instead of
// answering the per-object questions. Invalid class letters report
// "There are no X's here." (pickup.c:231-236) and the per-object
// questions are asked live again (verified against the recorder binary).

void test('do-again drains recorded pickup answers into the class question', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const club = await floorObject(CLUB, 10, 10);
    const arrow = await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: ')\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'n' },
        { prompt: /Pick up .*club\?/, keys: 'y' },
    ]);
    assert.equal(club.where, 'inventory');

    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            // The recorded 'n' and 'y' answer the class line, which echoes
            // them back; neither is a class letter, so both are refused.
            { prompt: /What kinds of thing do you want to pick up\? \[[^\]]*\] ny--More--/, keys: ' ' },
            { prompt: /There are no n's here\.  There are no y's here\./, keys: ' ' },
            // Nothing matched, so pickup asks about each object live again.
            { prompt: /Pick up .*arrow\?/, keys: 'q' },
        ]);
    } finally {
        await repeat;
    }
    assert.equal(arrow.where, 'floor');
    assert.equal(food.where, 'floor');
});

void test('do-again drains a recorded quit answer as a refused class letter', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const club = await floorObject(CLUB, 10, 10);
    const arrow = await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: 'A\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'y' },
        { prompt: /arrow.*--More--/, keys: ' ' },
        { prompt: /Pick up .*club\?/, keys: 'q' },
    ]);
    assert.equal(arrow.where, 'inventory');
    assert.equal(club.where, 'floor');

    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            // The recorded 'y' and 'q' answer the class line together.
            { prompt: /What kinds of thing do you want to pick up\? \[[^\]]*\] yq--More--/, keys: ' ' },
            { prompt: /There are no y's here\.  There are no q's here\./, keys: ' ' },
            // The per-object questions are asked live again.
            { prompt: /Pick up .*club\?/, keys: 'q' },
        ]);
    } finally {
        await repeat;
    }
    // The picked-up arrow answers live and quits; nothing new is picked.
    assert.equal(club.where, 'floor');
    assert.equal(food.where, 'floor');
});

void test('do-again drains a recorded all answer as the class letter for everything', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: 'A\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'a' },
    ]);
    const club = await floorObject(CLUB, 10, 10);
    await floorObject(ARROW, 10, 10);

    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            // The recorded 'a' answers the class line: everything is taken
            // without any per-object question.
            { prompt: /What kinds of thing do you want to pick up\? \[[^\]]*\] a/, keys: ' ' },
            { prompt: /a - .*arrow.*b - .*club/, keys: ' ' },
        ]);
    } finally {
        await repeat;
    }
    assert.equal(club.where, 'inventory');
    assert.equal(game.inventory.find(object => object.otyp === ARROW)?.quan, 2);
    assert.equal(food.where, 'inventory', 'everything includes the food');
    assert.equal(game.context.move, 1);
});

// C's count answer records only the '#' key: tty_yn_function reads the
// digits with plain readchar() calls (topl.c:486-500), which never reach
// the command queue, so the replay drains '#' as a refused class letter
// and asks about the remaining stack live.
void test('do-again drains a recorded count answer as a refused class letter', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const arrows = await floorObject(ARROW, 10, 10, { quantity: 5 });
    await floorObject(FOOD_RATION, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: ')\n' },
        { prompt: /Pick up .*arrows\?/, keys: '2\n' },
    ]);
    assert.equal(arrows.quan, 3);

    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing do you want to pick up\? \[[^\]]*\] #--More--/, keys: ' ' },
            { prompt: /There are no #'s here\./, keys: ' ' },
            { prompt: /Pick up .*food ration\?/, keys: 'q' },
        ]);
    } finally {
        await repeat;
    }
    assert.equal(arrows.quan, 3, 'the count is not replayed');
    assert.equal(game.inventory.find(object => object.otyp === ARROW)?.quan, 2);
});

// When the original run records '#' followed by another answer, the
// class line drains both characters in order.
void test('do-again drains a count and its following answer together', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const club = await floorObject(CLUB, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10, { quantity: 5 });
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: ')\n' },
        { prompt: /Pick up .*arrows\?/, keys: '2\n' },
        { prompt: /arrows.*--More--/, keys: ' ' },
        { prompt: /Pick up .*club\?/, keys: 'n' },
    ]);
    assert.equal(arrows.quan, 3);
    assert.equal(club.where, 'floor');

    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing do you want to pick up\? \[[^\]]*\] #n--More--/, keys: ' ' },
            { prompt: /There are no #'s here\.  There are no n's here\./, keys: ' ' },
            { prompt: /Pick up .*arrows\?/, keys: 'q' },
        ]);
    } finally {
        await repeat;
    }
    assert.equal(arrows.quan, 3);
    assert.equal(club.where, 'floor');
});
