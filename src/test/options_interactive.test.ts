import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

async function fullOptions(names: readonly string[], respond: (view: string) => string = () => '\x1b'): Promise<string[]> {
    const input = resetInputState();
    const remaining = new Set(names);
    const views: string[] = [];
    let selecting = true;
    let reads = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const view = screen();
        if (++reads > 70) throw new Error(`Options did not finish; remaining: ${[...remaining].join(', ')}`);
        if (!selecting) {
            views.push(view);
            input.feed(respond(view));
            return;
        }
        const row = view.split('\n').find(line => [...remaining].some(name => line.includes(` ${name} `)));
        const name = [...remaining].find(name => row?.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+] /)?.[1];
        if (name && key) {
            remaining.delete(name);
            input.feed(key);
        } else if (!remaining.size) {
            selecting = false;
            input.feed('\n');
        } else input.feed(' ');
    };
    input.feed('O');
    try {
        await command;
        assert.equal(remaining.size, 0, 'Every requested option was offered');
        return views;
    } finally {
        input.beforeRead = null;
    }
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

void test('full options edit compounds in their displayed order', async () => {
    freshObjectRoom();

    const prompts = await fullOptions(['fruit', 'number_pad']);

    assert.match(prompts[0] ?? '', /Set fruit to what\?/);
    assert.match(prompts[1] ?? '', /Select number_pad mode:/);
});

void test('full option help returns to the choices with its help offer removed', async () => {
    freshObjectRoom();

    const views = await fullOptions(['view help for options menu'], view => view.includes('--More--') ? ' ' : '\x1b');

    assert.ok(views.some(view => view.includes('How dynamically setting options works:')));
    assert.match(views.at(-1) ?? '', /Set what options\?/);
    assert.doesNotMatch(views.at(-1) ?? '', /view help for options menu/);
});
