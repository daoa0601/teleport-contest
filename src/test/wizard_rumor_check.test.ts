import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('#wizrumorcheck displays both rumor sections and supporting text without taking a turn', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const pages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
    };
    input.display = { async readKey() { return 32; } };

    await runExtendedCommand('wizrumorcheck');

    const text = pages.join('\n');
    assert.match(text, /T start=\d+.*end=\d+.*size=\d+/);
    assert.match(text, /F start=\d+.*end=\d+.*size=\d+/);
    for (const heading of ['Engravings:', 'Epitaphs:', 'Bogus monsters:'])
        assert.ok(text.includes(heading), `${heading} must be shown in the wizard diagnostic`);
    assert.equal(game.context.move, 0);
});
