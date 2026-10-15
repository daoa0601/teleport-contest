import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { requireScreenRow } from './support/screen.js';
import { freshObjectRoom } from './support/object-room.js';

void test('fountain self-knowledge opens magical enlightenment before the feeling subsides', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const input = resetInputState();
    const pages: string[] = [];
    input.beforeRead = () => {
        pages.push(Array.from({ length: 24 }, (_, row) =>
            requireScreenRow(row).map(cell => cell.ch).join('')).join('\n'));
    };
    input.feed('y' + ' '.repeat(20));
    initRng(16n);

    await rhack('q'.charCodeAt(0));

    assert.ok(pages.some(page => /attributes:[\s\S]*Status:/.test(page)),
        'The drink must display the enlightenment window');
    assert.match(game._pending_message, /The feeling subsides\./);
    assert.equal(game.context.move, 1);
});
