import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { PARANOID_PRAY, PARANOID_SWIM, PARANOID_TRAP } from '../js/const.js';
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}
async function fullOptions(names, respond = () => '\x1b') {
    const input = resetInputState();
    const remaining = new Set(names);
    const views = [];
    let selecting = true;
    let answer = '';
    let reads = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const view = screen();
        if (++reads > 70)
            throw new Error(`Options did not finish; remaining: ${[...remaining].join(', ')}`);
        if (!selecting) {
            if (!answer) {
                views.push(view);
                answer = respond(view);
            }
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
            return;
        }
        const row = view.split('\n').find(line => [...remaining].some(name => line.includes(` ${name} `)));
        const name = [...remaining].find(name => row?.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+] /)?.[1];
        if (name && key) {
            remaining.delete(name);
            input.feed(key);
        }
        else if (!remaining.size) {
            selecting = false;
            input.feed('\n');
        }
        else
            input.feed(' ');
    };
    input.feed('O');
    try {
        await command;
        assert.equal(remaining.size, 0, 'Every requested option was offered');
        return views;
    }
    finally {
        input.beforeRead = null;
    }
}
async function simpleOption(name) {
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
    }
    finally {
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
void test('full fruit edits announce the native singular name', async () => {
    freshObjectRoom();
    await fullOptions(['fruit'], view => view.includes('Set fruit to what?') ? 'mangos\n' : ' ');
    assert.equal(game.fruitName, 'mango');
    assert.match(game._pending_message, /Fruit is now "mango"\./);
});
void test('runmode offers native display choices and keeps the selected mode', async () => {
    freshObjectRoom();
    const views = await fullOptions(['runmode'], () => 't');
    assert.ok(views.some(view => view.includes('Select run/travel display mode:')));
    assert.equal(game.flags.runmode, 'teleport');
});
void test('message history mode uses its own choice menu and confirmation', async () => {
    freshObjectRoom();
    const views = await fullOptions(['msg_window'], () => 'r');
    assert.ok(views.some(view => view.includes('Select message history display type:')));
    assert.equal(game.iflags.prevmsg_window, 'r');
    assert.match(game._pending_message, /'msg_window' changed to "reversed"\./);
});
void test('paranoid confirmation can clear all preselected actions', async () => {
    freshObjectRoom({ flags: { paranoia_bits: PARANOID_PRAY | PARANOID_TRAP | PARANOID_SWIM } });
    const views = await fullOptions(['paranoid_confirmation'], () => '-\n');
    assert.ok(views.some(view => view.includes('Actions requiring extra confirmation:')));
    assert.equal(game.flags.paranoia_bits, 0);
});
void test('disclosure edits selected categories in native category order', async () => {
    freshObjectRoom();
    const views = await fullOptions(['disclose'], view => {
        if (view.includes('Change which disclosure options categories:'))
            return 'iv\n';
        if (view.includes('Disclosure options for inventory:'))
            return 'b';
        if (view.includes('Disclosure options for vanquished:'))
            return 'c';
        return '\x1b';
    });
    assert.ok(views.some(view => view.includes('Disclosure options for inventory:')));
    assert.ok(views.some(view => view.includes('Disclosure options for vanquished:')));
    assert.equal(game.flags.disclose, '+i na #v ng nc no');
});
void test('autounlock applies the checked action set from the simple menu', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('iauf\n\x1b');
    await rhack('O'.charCodeAt(0));
    assert.equal(game.flags.autounlock, 9);
});
void test('pickup burden uses the native encumbrance choices', async () => {
    freshObjectRoom();
    const views = await fullOptions(['pickup_burden'], () => 'l');
    assert.ok(views.some(view => view.includes('Select encumbrance level:')));
    assert.equal(game.flags.pickup_burden, 5);
});
//# sourceMappingURL=options_interactive.test.js.map