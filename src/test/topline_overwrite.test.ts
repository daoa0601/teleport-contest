import test from 'node:test';
import assert from 'node:assert/strict';

import type { Engine } from '../js/jsmain.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

function topCells(engine: Engine, row = 0): string {
    assert.ok(engine.display);
    return (engine.display.grid[row] ?? []).map(cell => cell.ch).join('');
}

// C win/tty/topl.c:redotoplin(): home(); putsyms(str); cl_end() (topl.c:126,
// 136-137) — a new topline paints over the previous row and clears only the
// tail after the text. Text bytes reach the recorded frame through
// nomux_putch(char), whose `ch < 32` guard also rejects a signed byte with
// the high bit set, so the cell under such a byte keeps the previous row's
// character there instead of going blank.
void test('a topline message overwrites a longer prompt without clearing it first', async () => {
    const engine = await runSegment({
        seed: 381,
        datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Iris,role:priest,race:human,gender:female,'
            + 'align:lawful,!legacy,!tutorial,!autopickup,pettype:none',
        moves: '', storage: memoryStorage(),
    });
    // Eat the starting clove of garlic so the sprig of wolfsbane becomes the
    // only food: the eat question then offers the food class accelerator.
    for (const key of ['e', 'e']) {
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    // Name the sprig of wolfsbane with a Meta byte: C do_name.c:do_oname()
    // keeps the typed byte, so doname() reports "named w\xefde".
    for (const key of ['C', 'i', 'f', 'w', 'ï', 'd', 'e', '\r']) {
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    // The eat question stays on the top row while it waits for the answer.
    engine.inputGate.feed('e');
    await engine.runUntilInputNeeded();
    const prompt = topCells(engine);
    assert.ok(prompt.startsWith('What do you want to eat?'), prompt);
    // "What do you want to eat? [? or ?*]": column 31 holds the first '?' of
    // the choice list; the Meta byte of the name lands exactly there in the
    // message below ("This sprig of wolfsbane named w\xefde is delicious!").
    const staleCharacter = prompt.charAt(31);
    assert.equal(staleCharacter, '?');

    engine.inputGate.feed('f');
    await engine.runUntilInputNeeded();
    // eat.c:fprefx() -> give_feedback prints the message over the question:
    // redotoplin() overwrites columns 0..30, skips the Meta byte at column 31
    // and continues at column 32, so the question's '?' survives there.
    assert.equal(
        topCells(engine).trimEnd(),
        `This sprig of wolfsbane named w${staleCharacter}de is delicious!`,
    );
});
