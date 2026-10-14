import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, ENGRAVE } from '../js/const.js';
import { newsym } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const key of ['m', 'M']) {
    void test(`look choice ${key} lists shown monsters with coordinates`, async () => {
        freshObjectRoom({ flags: { tips: false } });
        await createMonsterAt('kitten', 11, 10);
        newsym(11, 10);
        const input = resetInputState();
        input.feed(key);
        await answerPrompts(rhack('/'.charCodeAt(0)), input, [
            { prompt: /monsters[\s\S]*<11,10>[\s\S]*kitten[\s\S]*--More--/i, keys: ' ' },
        ]);
        assert.equal(game.context.move, 0);
    });
}
for (const key of ['o', 'O']) {
    void test(`look choice ${key} lists shown objects and observes adjacent ones`, async () => {
        freshObjectRoom({ flags: { tips: false } });
        const dagger = await floorObject(DAGGER, 11, 10, { dknown: false });
        newsym(11, 10);
        dagger.dknown = false;
        const input = resetInputState();
        input.feed(key);
        await answerPrompts(rhack('/'.charCodeAt(0)), input, [
            { prompt: /objects[\s\S]*<11,10>[\s\S]*dagger[\s\S]*--More--/i, keys: ' ' },
        ]);
        assert.equal(dagger.dknown, true);
    });
}
for (const key of ['t', 'T']) {
    void test(`look choice ${key} lists a remembered trap obscured by an object`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        level.traps.push({ tx: 11, ty: 10, ttyp: BEAR_TRAP, tseen: true,
            once: false, launch: { x: 0, y: 0 } });
        await floorObject(DAGGER, 11, 10);
        newsym(11, 10);
        const input = resetInputState();
        input.feed(key);
        await answerPrompts(rhack('/'.charCodeAt(0)), input, [
            { prompt: /traps[\s\S]*bear trap, obscured by \)[\s\S]*--More--/i, keys: ' ' },
        ]);
    });
}
for (const key of ['e', 'E']) {
    void test(`look choice ${key} lists a covered engraving using its remembered text`, async () => {
        freshObjectRoom({ flags: { tips: false } });
        const engraving = makeEngravingAt(11, 10, 'new words', null, 0, ENGRAVE);
        assert.ok(engraving);
        engraving.eread = true;
        engraving.rememberedText = 'old words';
        await floorObject(DAGGER, 11, 10);
        newsym(11, 10);
        const input = resetInputState();
        input.feed(key);
        await answerPrompts(rhack('/'.charCodeAt(0)), input, [
            { prompt: /engravings[\s\S]*remembered text: "old words", obscured by \)[\s\S]*--More--/i, keys: ' ' },
        ]);
        assert.equal(engraving.rememberedText, 'old words');
    });
}

void test('look lists use a full-screen text window with a bottom-row pager', async () => {
    freshObjectRoom({ flags: { tips: false } });
    await createMonsterAt('kitten', 11, 10);
    newsym(11, 10);
    const input = resetInputState();
    input.feed('M');
    const operation = rhack('/'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    assert.equal(game.nhDisplay.cursorRow, game.nhDisplay.rows - 1);
    assert.ok(game.nhDisplay.grid[0]?.map(cell => cell.ch).join('').startsWith('All monsters currently shown on the map:'));
    input.feed(' ');
    await operation;
});

for (const dismiss of [' ', '\x1b']) {
    void test(`object lists delay later observations until the first page is ${dismiss === ' ' ? 'advanced' : 'cancelled'}`, async () => {
        freshObjectRoom({ left: 3, right: 18, flags: { tips: false } });
        for (const y of [8, 9]) {
            for (let x = 3; x <= (y === 8 ? 17 : 8); x++) {
                await floorObject(DAGGER, x, y);
                newsym(x, y);
            }
        }
        const nextPageDagger = await floorObject(DAGGER, 9, 9, { dknown: false });
        newsym(9, 9);
        nextPageDagger.dknown = false;
        const laterDagger = await floorObject(DAGGER, 11, 11, { dknown: false });
        newsym(11, 11);
        laterDagger.dknown = false;
        const input = resetInputState();
        input.feed('O');
        const operation = rhack('/'.charCodeAt(0));
        await input.waitUntilBlocked();
        try {
            assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '',
                /All objects currently shown on the map:/);
            assert.equal(nextPageDagger.dknown, true, 'The object which triggers the page flush has already been described');
            assert.equal(laterDagger.dknown, false, 'A later adjacent object stays unobserved at the first pager');
        } finally {
            input.feed(dismiss === ' ' ? '  ' : dismiss);
            await operation;
        }
        // look_all keeps iterating after Escape even though tty stops
        // displaying the cancelled text window.
        assert.equal(laterDagger.dknown, true, 'The list finishes observing its objects after pager input');
    });
}
