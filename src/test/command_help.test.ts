import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { option_help } from '../js/options.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('whatdoes describes the command currently bound to the requested key', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'search');
    input.feed('&');
    const action = rhack(0);
    try {
        const waiting = await Promise.race([
            input.waitUntilBlocked().then(() => true), action.then(() => false),
        ]);
        assert.equal(waiting, true, 'whatdoes must request a command key');
        while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
            input.feed(' ');
            await input.waitUntilBlocked();
        }
        input.feed('!');
        await action;
        assert.match(game._pending_message, /! +search for traps and secret doors \(#search\)\./);
        assert.equal(game.context.move, 0);
    } finally {
        input.feed('\x1b');
        await action;
    }
});

for (const { key, message } of [
    { key: '\xe1', message: 'M-a     adjust inventory letters (#adjust).' },
    { key: '\xff', message: "No such command 'M-^?', char code 255 (0377 or 0xff)." },
]) {
    void test(`whatdoes interprets the 8-bit key ${JSON.stringify(key)} as unsigned`, async () => {
        const input = freshTurnRoom();
        input.feed('&');
        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
                input.feed(' ');
                await input.waitUntilBlocked();
            }
            input.feed(key);
            await action;

            assert.equal(game._pending_message, message);
            assert.equal(game.context.move, 0);
        } finally {
            input.feed('\x1b');
            await action;
        }
    });
}

void test('the full key list shows configured command keys', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'search');
    input.feed('?j');
    const action = rhack(0);
    try {
        const waiting = await Promise.race([
            input.waitUntilBlocked().then(() => true), action.then(() => false),
        ]);
        assert.equal(waiting, true, 'the full key list must wait for dismissal');
        assert.match(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '',
            /Full Current Key Bindings List/);
    } finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

for (const [key, dx, dy, dz] of [
    ['l', 1, 0, 0],
    ['U', 1, -1, 0],
    ['\x08', -1, 0, 0],
    ['<', 0, 0, -1],
    ['>', 0, 0, 1],
    ['~', -1, 1, 0],
    ['3', -1, 1, 0],
    ['!', 1, 0, 0],
] as const) {
    void test(`whatdoes updates the hero direction while describing ${JSON.stringify(key)}`, async () => {
        const input = freshTurnRoom();
        game.u.dx = -1;
        game.u.dy = 1;
        game.u.dz = -1;
        game.commandBindings.bindKey('!'.charCodeAt(0), 'moveeast');
        input.feed('&');
        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
                input.feed(' ');
                await input.waitUntilBlocked();
            }
            input.feed(key);
            await action;
            assert.equal(game.u.dx, dx);
            assert.equal(game.u.dy, dy);
            assert.equal(game.u.dz, dz);
            assert.equal(game.u.ux, 10, 'describing movement must not move the hero');
            assert.equal(game.u.uy, 10);
            assert.equal(game.context.move, 0);
        } finally {
            input.feed('\x1b');
            await action;
        }
    });
}

void test('whatdoes distinguishes rest_on_space from the ordinary wait command', async () => {
    const input = freshTurnRoom({ flags: { rest_on_space: true } });
    game.commandBindings.setRestOnSpace(true);
    input.feed('&');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
            input.feed(' ');
            await input.waitUntilBlocked();
        }
        input.feed(' ');
        await action;
        assert.equal(game._pending_message, "<space> rest one move via 'rest_on_space' option (#wait).");
        assert.equal(game.context.move, 0);

        input.feed('&.');
        await rhack(0);
        assert.equal(game._pending_message, '.       rest one move while doing nothing (#wait).');
    } finally {
        input.feed('\x1b');
        await action;
    }
});

void test('the full key list identifies the rest_on_space option on the Space binding', async () => {
    const input = freshTurnRoom({ flags: { rest_on_space: true } });
    game.commandBindings.setRestOnSpace(true);
    input.feed('?j');
    const action = rhack(0);
    try {
        for (let page = 0; ; page++) {
            assert.ok(page < 20, 'the key list must show the Space binding within twenty pages');
            const waiting = await Promise.race([
                input.waitUntilBlocked().then(() => true), action.then(() => false),
            ]);
            assert.equal(waiting, true, 'the key list ended without displaying the Space binding');
            const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
            if (text.includes('<space>')) {
                assert.match(text, /<space> +wait +rest one move via 'rest_on_space' option/);
                break;
            }
            input.feed(' ');
        }
    } finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

for (const numberPad of [0, 1]) {
    void test(`the full key list preserves the hero direction with number_pad=${numberPad}`, async () => {
        const input = freshTurnRoom();
        game.commandBindings.setNumberPad(numberPad);
        game.u.dx = -1;
        game.u.dy = 1;
        game.u.dz = -1;
        input.feed('?j');
        const action = rhack(0);
        try {
            const waiting = await Promise.race([
                input.waitUntilBlocked().then(() => true), action.then(() => false),
            ]);
            assert.equal(waiting, true, 'the key list must wait for dismissal');
            const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
            assert.match(text, /<esc> +cancel current prompt or pending prefix/);
            assert.equal(game.u.dx, -1);
            assert.equal(game.u.dy, 1);
            assert.equal(game.u.dz, -1, 'listing special keys must not probe movement');
        } finally {
            input.feed('\x1b');
            await action;
        }
        assert.equal(game.context.move, 0);
    });
}

void test('whatdoes describes the fixed Escape key', async () => {
    const input = freshTurnRoom();
    input.feed('&');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
            input.feed(' ');
            await input.waitUntilBlocked();
        }
        input.feed('\x1b');
        await action;

        assert.equal(game._pending_message, '<esc>   cancel current prompt or pending prefix.');
        assert.equal(game.context.move, 0);
    } finally {
        input.feed('\x1b');
        await action;
    }
});

void test('option help lists booleans, compound descriptions, and configuration directives without taking a turn', async () => {
    const input = freshTurnRoom();
    input.feed('?g');
    const action = rhack(0);
    const pages: string[] = [];
    try {
        for (let page = 0; ; page++) {
            assert.ok(page < 12, 'option help did not finish within twelve pages');
            const boundary = await Promise.race([
                input.waitUntilBlocked().then(() => 'waiting'), action.then(() => 'closed'),
            ]);
            if (boundary === 'closed') break;
            pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
            input.feed(' ');
        }
        const text = pages.join('\n');
        assert.match(text, /NetHack Options Help:/);
        assert.match(text, /Boolean options .*negated/);
        assert.match(text, /autopickup,/);
        assert.match(text, /Compound options:/);
        assert.match(text, /`fruit' + - name of a fruit you enjoy eating,/);
        assert.match(text, /Other settings:/);
        assert.match(text, /autopickup exceptions/);
        assert.match(text, /See NetHack's "Guidebook" for details/);
        assert.doesNotMatch(text, /debug_hunger|montelecontrol|wizweight/);
    } finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

void test('option help includes wizard-only options in debug mode', async () => {
    const input = freshTurnRoom({ flags: { debug: true } });
    const action = option_help();
    const pages: string[] = [];
    try {
        for (let page = 0; ; page++) {
            assert.ok(page < 12, 'option help did not finish within twelve pages');
            const boundary = await Promise.race([
                input.waitUntilBlocked().then(() => 'waiting'), action.then(() => 'closed'),
            ]);
            if (boundary === 'closed') break;
            pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
            input.feed(' ');
        }
        const text = pages.join('\n');
        assert.match(text, /montelecontrol/);
        assert.match(text, /wizweight/);
        assert.match(text, /debug_hunger/);
    } finally {
        input.feed('\x1b');
        await action;
    }
});
