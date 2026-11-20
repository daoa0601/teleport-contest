import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
function topLine(engine) {
    assert.ok(engine.display);
    return (engine.display.grid[0] ?? []).map(cell => cell.ch).join('').trimEnd();
}
// The recorded tty frame stores text through nomux_putch(char), which ignores
// a byte with the high bit set: the echoed cell keeps its previous contents
// while getline's cursor still advances past the typed character.
void test('a typed high-bit byte advances the line without drawing a character', async () => {
    const engine = await runSegment({
        seed: 381,
        datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Iris,role:Rogue,race:human,gender:female,align:chaotic,!legacy,!tutorial,!autopickup,pettype:none',
        moves: '', storage: memoryStorage(),
    });
    for (const key of [' ', '#', 'a', 'n', '\r', 'w', 'ï', 'd', 'e']) {
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    assert.equal(topLine(engine), 'What do you want to call this dungeon level? w de');
});
// tty_raw_print()'s shadow writer takes each byte as unsigned char, so a
// configuration diagnostic echoes a high-bit byte from the options line.
void test('a raw-printed configuration diagnostic keeps a high-bit byte', async () => {
    const engine = await runSegment({
        seed: 381,
        datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Iris,role:Rogue,race:human,gender:female,align:chaotic,!legacy,!tutorial,pettype:none,zzï',
        moves: '', storage: memoryStorage(),
    });
    assert.ok(engine.display);
    const screen = engine.display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /zzï/);
});
//# sourceMappingURL=high_bit_text_capture.test.js.map