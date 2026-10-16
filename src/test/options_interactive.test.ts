import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

async function simpleOption(name: string): Promise<void> {
    const input = resetInputState();
    const command = rhack('O'.charCodeAt(0));
    for (let page = 0; page < 12; page++) {
        await input.waitUntilBlocked();
        const row = screen().split('\n').find(line => line.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
        if (key) {
            input.feed(key);
            await input.waitUntilBlocked();
            input.feed('\x1b');
            await command;
            return;
        }
        input.feed(' ');
    }
    input.feed('\x1b');
    await command;
    assert.fail(`The simple options menu did not offer ${name}`);
}

void test('the simple options menu toggles autoquiver without using a turn', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    requirePlayingGame(game);

    await simpleOption('autoquiver');

    assert.equal(game.flags.autoquiver, true);
    assert.equal(game.moves, 40);
    assert.equal(game.context.move, 0);
});

void test('simple option help explains the choices and can be hidden again', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const command = rhack('O'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('?');
    await input.waitUntilBlocked();
    try {
        assert.match(screen(), /Use command '#optionsfull' to get the complete options list\./);
        assert.match(screen(), /name of a fruit you enjoy eating/);
        assert.match(screen(), /\? - hide help/);
        input.feed('?');
        await input.waitUntilBlocked();
        assert.match(screen(), /\? - show help/);
        assert.doesNotMatch(screen(), /name of a fruit you enjoy eating/);
    } finally {
        input.feed('\x1b');
        await command;
    }
});
