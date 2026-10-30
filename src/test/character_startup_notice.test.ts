import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

void test('character selection retains the startup notice with a configured name', async () => {
    const engine = await runSegment({ seed: 25, datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Picker,!legacy,!tutorial,pettype:none',
        moves: '', storage: memoryStorage() });
    const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
    assert.match(text, /Shall I pick/);
    assert.match(text, /NetHack, Copyright/);
    assert.match(text, /See license for details/);
    await engine.lua.destroy();
});

void test('a configured name does not offer renaming in character confirmation', async () => {
    const engine = await runSegment({ seed: 25, datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Picker,!legacy,!tutorial,pettype:none',
        moves: 'y', storage: memoryStorage() });
    const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
    assert.match(text, /Is this ok/);
    assert.doesNotMatch(text, /choose another name/);
    await engine.lua.destroy();
});
