import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('#wizcustom shows the active symbol set without taking a turn', async () => {
    freshObjectRoom({ flags: { debug: true } });
    game.symset = 'DECgraphics';
    const pages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        input.feed(' ');
    };

    await runExtendedCommand('wizcustom');

    const text = pages.join('\n');
    assert.match(text, /#wizcustom: colorcount=\d+ DECgraphics, active, handler=DEC/);
    assert.match(text, /glyph identifier.*customcolor/);
    assert.match(text, /G_vwall_mines/);
    assert.equal(game.context.move, 0);
});
