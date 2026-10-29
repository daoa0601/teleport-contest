import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { clearMessageWindow, flush_screen, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

interface Answer {
    prompt: string;
    keys: string;
}

async function editMessageTypes(script: readonly Answer[]): Promise<string[]> {
    const input = resetInputState();
    const views: string[] = [];
    let selected = false;
    let editing = false;
    let answer = '';
    let reads = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const view = screen();
        assert.ok(++reads < 600, `Message type editor did not finish:\n${view}`);
        if (editing) {
            if (!answer) {
                const next = script[views.length];
                assert.ok(next, `Unexpected editor screen:\n${view}`);
                assert.ok(view.includes(next.prompt), `Expected ${next.prompt}:\n${view}`);
                views.push(view);
                answer = next.keys;
            }
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
        } else if (selected) {
            editing = true;
            input.feed('\n');
        } else {
            const row = view.split('\n').find(line => / [-+] message types\s/.test(line));
            const key = row?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
            if (key) {
                selected = true;
                input.feed(key);
            } else input.feed(' ');
        }
    };
    input.feed('O');
    try {
        await command;
        assert.equal(views.length, script.length, 'Every editor prompt was displayed');
        assert.equal(game.moves, 40, 'Editing message types does not use a turn');
        return views;
    } finally {
        input.beforeRead = null;
    }
}

void test('adding a hide rule through options suppresses matching messages', async () => {
    freshObjectRoom();

    const views = await editMessageTypes([
        { prompt: 'add new message type', keys: 'a' },
        { prompt: 'What new message pattern?', keys: '^A bell rings[.]$\n' },
        { prompt: 'How to show the message', keys: 'b' },
        { prompt: 'list message types', keys: 'x' },
    ]);

    assert.doesNotMatch(views[0] ?? '', /list message types|remove existing message type/);
    clearMessageWindow();
    await plineWithContinuation('A bell rings.');
    await flush_screen(1);
    assert.doesNotMatch(screen(), /A bell rings\./);
    await plineWithContinuation('A gong rings.');
    await flush_screen(1);
    assert.match(screen(), /A gong rings\./);
});

void test('message type listing uses canonical names and newest rules first', async () => {
    freshObjectRoom();
    applyNethackrc('MSGTYPE=noshow "bell"\nMSGTYPE=more "gong"');

    const views = await editMessageTypes([
        { prompt: 'Do what?', keys: 'l' },
        { prompt: 'List of message types', keys: '\n' },
        { prompt: 'Do what?', keys: 'x' },
    ]);

    const listing = views[1] ?? '';
    assert.match(listing, /a - stop\s+"gong"/);
    assert.match(listing, /b - hide\s+"bell"/);
});

void test('removing several message types preserves the other rules', async () => {
    freshObjectRoom();
    applyNethackrc('MSGTYPE=hide "bell"\nMSGTYPE=stop "gong"\nMSGTYPE=norep "chime"');

    const views = await editMessageTypes([
        { prompt: 'Do what?', keys: 'r' },
        { prompt: 'Remove which message types', keys: 'ab\n' },
        { prompt: 'Do what?', keys: 'l' },
        { prompt: 'List of message types', keys: '\n' },
        { prompt: 'Do what?', keys: 'x' },
    ]);
    assert.match(views[3] ?? '', /a - hide\s+"bell"/);
    assert.doesNotMatch(views[3] ?? '', /gong|chime/);
    clearMessageWindow();
    await plineWithContinuation('A gong rings.');
    await flush_screen(1);
    assert.match(screen(), /A gong rings\./);
});

void test('invalid message patterns report their regex error and return to the editor', async () => {
    freshObjectRoom();

    const views = await editMessageTypes([
        { prompt: 'Do what?', keys: 'a' },
        { prompt: 'What new message pattern?', keys: 'a**\n' },
        { prompt: 'MSGTYPE regex: repetition-operator operand invalid.--More--', keys: ' ' },
        { prompt: 'Do what?', keys: 'x' },
    ]);

    assert.doesNotMatch(views[3] ?? '', /list message types/);
});

void test('cancelling the message type picker keeps existing rules and returns to the editor', async () => {
    freshObjectRoom();
    applyNethackrc('MSGTYPE=hide "bell"');

    const views = await editMessageTypes([
        { prompt: 'Do what?', keys: 'a' },
        { prompt: 'What new message pattern?', keys: 'gong\n' },
        { prompt: 'How to show the message', keys: '\x1b' },
        { prompt: 'Do what?', keys: 'l' },
        { prompt: 'List of message types', keys: '\n' },
        { prompt: 'Do what?', keys: 'x' },
    ]);

    assert.match(views[4] ?? '', /hide\s+"bell"/);
    assert.doesNotMatch(views[4] ?? '', /gong/);
});

void test('cancelling message pattern input exits the editor', async () => {
    freshObjectRoom();

    await editMessageTypes([
        { prompt: 'Do what?', keys: 'a' },
        { prompt: 'What new message pattern?', keys: '\x1b' },
    ]);
});
