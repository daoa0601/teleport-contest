import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, DART, OIL_LAMP, RIN_PROTECTION, SCR_BLANK_PAPER } from '../js/object_data.js';
import { pline } from '../js/pline.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

function screenText(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

// C pager.c:do_look(): "invlet = display_inventory((const char *) 0, TRUE);"
// C invent.c:display_pickinv(): "else if (!lets)" offers '?' on that
// full-inventory menu even though it was not opened through getobj().
void test('looking at carried objects offers likely candidates and accepts that selector', async () => {
    await freshObjectRoom({ flags: { force_invmenu: true } });
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });
    const input = resetInputState();

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /What do you want to look at:/, keys: 'i' },
        { prompt: /Weapons[\s\S]*Special[\s\S]*\? - \(list likely candidates\)/,
            keys: '?' },
    ]);

    assert.equal(daggers.quan, 5);
    assert.equal(daggers.where, 'inventory');
    assert.equal(game.context.move, 0);
});

void test('a forced drop menu has no special selector when all objects are suggested', async () => {
    const level = await freshObjectRoom({ flags: { force_invmenu: true } });
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });
    const input = resetInputState();
    const dropping = rhack('d'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(screenText(), /What do you want to drop\?[\s\S]*Weapons/);
        assert.doesNotMatch(screenText(), /Special|list everything|list likely candidates/);
    } finally {
        input.feed(`2${daggers.invlet}`);
        await dropping;
    }

    assert.equal(daggers.quan, 3);
    const dropped = level.objects[game.u.ux]?.[game.u.uy]?.find(object => object.otyp === DAGGER);
    assert.equal(dropped?.quan, 2);
    assert.equal(game.context.move, 1);
});

void test('ordinary inventory keeps its action menu without forced-selection shortcuts', async () => {
    await freshObjectRoom({ flags: { force_invmenu: true } });
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    const inventory = rhack('i'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(screenText(), /Weapons/);
        assert.doesNotMatch(screenText(), /Special|list everything|list likely candidates/);
    } finally {
        input.feed(' ');
        await inventory;
    }
    assert.equal(dagger.where, 'inventory');
    assert.equal(game.flags.force_invmenu, true);
    assert.equal(game.context.move, 0);
});

for (const { command, otyp, verb } of [
    { command: 'a', otyp: OIL_LAMP, verb: 'use or apply' },
    { command: 'r', otyp: SCR_BLANK_PAPER, verb: 'read' },
    { command: 'P', otyp: RIN_PROTECTION, verb: 'put on' },
]) {
    void test(`forced ${verb} remembers its question between the preceding and following messages`, async () => {
        await freshObjectRoom({ flags: { force_invmenu: true, verbose: false } });
        await addInventoryObject(otyp);
        game.iflags.prevmsg_window = 'r';
        await pline('Before choosing.');
        const input = resetInputState();

        await answerPrompts(rhack(command.charCodeAt(0)), input, [
            { prompt: /What do you want to /, keys: '\x1b' },
        ]);
        assert.doesNotMatch(screenText(), /What do you want to /,
            'the dismissed menu question must not be painted as a message');
        await pline('After choosing.');

        const history = rhack(16);
        try {
            await input.waitUntilBlocked();
            const text = screenText();
            assert.match(text, /Message History/);
            const after = text.indexOf('After choosing.');
            const question = text.indexOf(`What do you want to ${verb}?`);
            const before = text.indexOf('Before choosing.');
            assert.ok(after >= 0 && question > after && before > question,
                `Reversed history must show the question between the messages:\n${text}`);
        } finally {
            input.feed(' ');
            await history;
        }
        assert.equal(game.context.move, 0);
    });
}

void test('switching forced quiver menus remembers the question once and can empty the quiver', async () => {
    await freshObjectRoom({ flags: { force_invmenu: true, verbose: false } });
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    game.iflags.prevmsg_window = 'r';

    await answerPrompts(rhack('Q'.charCodeAt(0)), input, [
        { prompt: /What do you want to ready\?[\s\S]*\* - \(list everything\)/, keys: '*' },
        { prompt: /Miscellaneous[\s\S]*- - empty quiver \(nothing readied\)[\s\S]*\? - \(list likely candidates\)/,
            keys: '?' },
        { prompt: /\* - \(list everything\)/, keys: '*' },
        { prompt: /- - empty quiver/, keys: '-' },
    ]);
    assert.equal(game.uquiver, null);
    assert.equal(dart.where, 'inventory');

    const history = rhack(16);
    try {
        await input.waitUntilBlocked();
        const text = screenText();
        assert.equal(text.split('What do you want to ready?').length - 1, 1, text);
        assert.match(text, /You already have no ammunition readied!/);
    } finally {
        input.feed(' ');
        await history;
    }
    assert.equal(game.context.move, 0);
});

void test('a forced fire menu replaces the unread empty-quiver message without paging it', async () => {
    await freshObjectRoom({ flags: { force_invmenu: true, autoquiver: false, verbose: false } });
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    game.iflags.prevmsg_window = 'r';

    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /What do you want to fire\?[\s\S]*\(end\)/, keys: '\x1b' },
    ]);
    assert.equal(dart.quan, 1);
    assert.equal(game.context.move, 0);

    const history = rhack(16);
    try {
        await input.waitUntilBlocked();
        assert.match(screenText(), /Message History[\s\S]*What do you want to fire\?[\s\S]*You have no ammunition readied\./);
    } finally {
        input.feed(' ');
        await history;
    }
});

void test('a forced apply menu accepts an item count without splitting a command that disallows counts', async () => {
    await freshObjectRoom({ flags: { force_invmenu: true } });
    const lamp = await addInventoryObject(OIL_LAMP, { spe: 1, age: 500 });
    const input = resetInputState();

    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /What do you want to use or apply\?/, keys: `2${lamp.invlet}` },
    ]);

    assert.equal(lamp.lamplit, true);
    assert.equal(lamp.quan, 1);
    assert.equal(game.context.move, 1);
});

for (const { keys, message } of [
    { keys: '\x1b', message: 'Never mind.' },
    { keys: ' ', message: '' },
]) {
    void test(`dismissing a forced menu with ${keys === ' ' ? 'space' : 'Escape'} cancels the action`, async () => {
        await freshObjectRoom({ flags: { force_invmenu: true, verbose: true } });
        const dagger = await addInventoryObject(DAGGER, { quan: 3 });
        const input = resetInputState();

        await answerPrompts(rhack('d'.charCodeAt(0)), input, [
            { prompt: /What do you want to drop\?/, keys },
        ]);

        assert.equal(game._pending_message, message);
        assert.equal(dagger.where, 'inventory');
        assert.equal(dagger.quan, 3);
        assert.equal(game.context.move, 0);
    });
}
