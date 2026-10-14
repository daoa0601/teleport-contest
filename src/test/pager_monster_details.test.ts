import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, TT_BEARTRAP } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('quick look describes the hero mount and trap without a redundant saddle', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    const pony = await createSaddledSteed();
    game.u.usteed = pony;
    game.u.utrap = 3;
    game.u.utraptype = TT_BEARTRAP;
    level.traps.push({ tx: 10, ty: 10, ttyp: BEAR_TRAP, tseen: true,
        once: false, launch: { x: 0, y: 0 } });
    newsym(10, 10);
    const input = resetInputState();
    input.feed('.');

    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /mounted on your pony[\s\S]*trapped in a bear trap[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
});

void test('quick look still describes the saddle on an unmounted pony', async () => {
    freshObjectRoom({ flags: { tips: false } });
    await createSaddledSteed();
    newsym(11, 10);
    resetInputState().feed('l.');

    await rhack(';'.charCodeAt(0));
    await flush_screen(1);
    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(text, /saddled pony/);
    assert.equal(game.context.move, 0);
});

void test('quick look describes a leashed trapped monster and reveals the trap', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    const kitten = await createMonsterAt('kitten', 11, 10);
    kitten.mleashed = true;
    kitten.mtrapped = 1;
    const trap = { tx: 11, ty: 10, ttyp: BEAR_TRAP, tseen: false,
        once: false, launch: { x: 0, y: 0 } };
    level.traps.push(trap);
    newsym(11, 10);
    resetInputState().feed('l. ');

    await rhack(';'.charCodeAt(0));
    await flush_screen(1);

    const text = requireGameDisplay().grid.slice(0, 2).map(row => row.map(cell => cell.ch).join('')).join('');
    assert.match(text, /leashed to you/);
    assert.match(text, /trapped in a bear trap/);
    assert.equal(trap.tseen, true);
});

void test('quick look explains a monster seen through detection', async () => {
    freshObjectRoom({ flags: { tips: false }, hero: { detectMonsters: true } });
    await createMonsterAt('kitten', 11, 10);
    newsym(11, 10);
    const input = resetInputState();
    input.feed('l.');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /seen: normal vision, monster[\s\S]*detection[\s\S]*--More--/, keys: ' ' },
    ]);
});
