import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

for (const { stage, nameOption, prompt } of [
    { stage: 'name entry', nameOption: '', prompt: /Who are you\?/ },
    { stage: 'character selection', nameOption: 'name:Picker,', prompt: /Shall I pick/ },
]) {
    void test(`${stage} displays the recorder's pinned build version`, async () => {
        const engine = await runSegment({ seed: 25, datetime: '20000110090000',
            nethackrc: `OPTIONS=${nameOption}!legacy,!tutorial,pettype:none`,
            moves: '', storage: memoryStorage() });
        try {
            const text = screenText(capturedScreen(engine));
            assert.match(text, prompt);
            assert.match(text, /Version 5\.0\.0 MacOS, built May  2 2026 12:00:00\./);
        } finally {
            await engine.lua.destroy();
        }
    });
}

const configurationSources: readonly ('file' | 'environment')[] = ['file', 'environment'];
for (const source of configurationSources) {
    void test(`${source} configuration errors appear before the startup notice`, async () => {
        const engine = await startWithConfigurationError(source);
        try {
            const text = screenText(capturedScreen(engine));
            assert.match(text, /Unrecognized pet type 'lizard'/);
            assert.match(text, /Hit return to continue/);
            assert.doesNotMatch(text, /NetHack, Copyright|See license for details/);
        } finally {
            await engine.lua.destroy();
        }
    });

    void test(`character selection shows the startup notice after ${source} errors are acknowledged`, async () => {
        const engine = await startWithConfigurationError(source);
        try {
            engine.inputGate.feed('\r');
            await engine.runUntilInputNeeded();

            const text = screenText(capturedScreen(engine));
            assert.match(text, /Shall I pick/);
            assert.match(text, /NetHack, Copyright/);
            assert.match(text, /See license for details/);
            assert.doesNotMatch(text, /Unrecognized pet type|Hit return to continue/);
        } finally {
            await engine.lua.destroy();
        }
    });
}

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

async function startWithConfigurationError(source: 'file' | 'environment'): Promise<Engine> {
    const engine = new Engine({ seed: 25, datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Picker,!legacy,!tutorial,pettype:none\n'
            + (source === 'file' ? 'OPTIONS=pettype:lizard\n' : ''),
        ...(source === 'environment' ? { nethackOptions: 'pettype:lizard' } : {}),
        display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    return engine;
}
