import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

function menuText(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

for (const forced of [false, true]) {
    void test(`${forced ? 'forced' : 'question-mark'} dip menu offers only hands when carrying gold`, async () => {
        freshObjectRoom({ flags: { force_invmenu: forced } });
        const gold = await addInventoryObject(GOLD_PIECE, { quan: 50 });
        const input = resetInputState();
        input.feed(`dip\n${forced ? '' : '?'}`);
        const action = rhack('#'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            assert.match(menuText(), /Miscellaneous[\s\S]*- - your hands[\s\S]*\(end\)/);
            assert.doesNotMatch(menuText(), /Coins|gold pieces|list everything|list likely candidates/);
        } finally {
            input.feed('-');
            await action;
        }

        assert.match(game._pending_message, /You don't have anything to dip them into\./);
        assert.equal(game.context.move, 0);
        assert.equal(gold.quan, 50);
    });
}

void test('a dip menu with an empty pack still lists the downplayed hands choice in a window', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('dip\n?');
    const action = rhack('#'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(menuText(), /Miscellaneous[\s\S]*- - your hands[\s\S]*\(end\)/);
        assert.doesNotMatch(menuText(), /--More--/);
    } finally {
        input.feed('\x1b');
        await action;
    }

    assert.equal(game.context.move, 0);
});

void test('suggested hands with no suggested objects leave the dip menu showing full inventory', async () => {
    const level = freshObjectRoom({ hero: { glibTurns: 7 } });
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();
    input.feed('dip\n?');
    const action = rhack('#'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(menuText(), /Miscellaneous[\s\S]*your hands[\s\S]*Coins[\s\S]*gold pieces/);
    } finally {
        input.feed('\x1b');
        await action;
    }

    assert.equal(game.u.glibTurns, 7);
    assert.equal(game.context.move, 0);
});

void test('applying with only gold offers its downplayed coin as a single message-line choice', async () => {
    freshObjectRoom();
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();

    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /What do you want to use or apply\? \[\*\]/, keys: '?' },
        { prompt: /\$ - 50 gold pieces\.--More--/, keys: '$' },
    ]);

    assert.equal(game.context.move, 1);
    assert.equal(gold.quan, 50);
    assert.match(game._pending_message, /You flip a gold piece\./);
});

void test('a forced apply menu switches between its gold-only alternatives and full inventory', async () => {
    freshObjectRoom({ flags: { force_invmenu: true } });
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    await addInventoryObject(DAGGER);
    const input = resetInputState();
    const action = rhack('a'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(menuText(), /Coins[\s\S]*gold pieces[\s\S]*\* - \(list everything\)/);
        assert.doesNotMatch(menuText(), /Weapons|dagger|hands/);

        input.feed('*');
        await input.waitUntilBlocked();
        assert.match(menuText(), /gold pieces/);
        assert.match(menuText(), /Weapons[\s\S]*dagger[\s\S]*\? - \(list likely candidates\)/);

        input.feed('?');
        await input.waitUntilBlocked();
        assert.match(menuText(), /Coins[\s\S]*gold pieces[\s\S]*\* - \(list everything\)/);
        assert.doesNotMatch(menuText(), /Weapons|dagger|hands/);
    } finally {
        input.feed('\x1b');
        await action;
    }

    assert.equal(game.context.move, 0);
});

void test('wielding with only gold keeps hands and coins in the full-inventory fallback', async () => {
    freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();
    input.feed('?');
    const action = rhack('w'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(menuText(), /Miscellaneous[\s\S]*bare hands[\s\S]*Coins[\s\S]*gold pieces/);
    } finally {
        input.feed('-');
        await action;
    }

    assert.equal(game.uwep, null);
    assert.equal(game.context.move, 0);
});
