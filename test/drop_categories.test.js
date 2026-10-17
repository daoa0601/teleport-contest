import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_COMBINATION, MENU_TRADITIONAL, PARANOID_AUTOALL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DAGGER, LOADSTONE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const count of [1, 2, 3, 4]) {
    void test(`traditional drop of ${count} stacks uses the native command result for turn cost`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const objects = [];
        for (let index = 0; index < count; index++)
            objects.push(await addInventoryObject(DAGGER, { spe: index }));
        resetInputState().feed('a\n');
        await rhack('D'.charCodeAt(0));
        for (const object of objects)
            assert.equal(object.where, 'floor');
        // askchain() returns the successful-drop count directly; rhack()
        // checks ECMD_TIME, the low bit, rather than whether it is nonzero.
        assert.equal(game.context.move, count % 2);
    });
}
void test('a refused stack does not change the turn-cost bit of traditional dropping', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
    const dagger = await addInventoryObject(DAGGER);
    const club = await addInventoryObject(CLUB);
    const loadstone = await addInventoryObject(LOADSTONE, { cursed: true });
    resetInputState().feed('a\n');
    await rhack('D'.charCodeAt(0));
    assert.equal(dagger.where, 'floor');
    assert.equal(club.where, 'floor');
    assert.equal(loadstone.where, 'inventory');
    assert.equal(game.context.move, 0);
});
void test('combination drop-all converts multiple successful drops into a timed command', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, verbose: false } });
    const dagger = await addInventoryObject(DAGGER);
    const club = await addInventoryObject(CLUB);
    resetInputState().feed('a\n');
    await rhack('D'.charCodeAt(0));
    assert.equal(dagger.where, 'floor');
    assert.equal(club.where, 'floor');
    assert.equal(game.context.move, 1);
});
for (const style of [MENU_TRADITIONAL, MENU_COMBINATION]) {
    void test(`drop category inventory uses a menu for one carried item in style ${style}`, async () => {
        freshObjectRoom({ flags: { menu_style: style } });
        const dagger = await addInventoryObject(DAGGER);
        const input = resetInputState();
        input.feed('i\n');
        const action = rhack('D'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /Weapons/);
            assert.match(text, /a - .*dagger/);
            assert.match(text, /\(end\)/);
        }
        finally {
            input.feed('\x1b');
            await action;
        }
        assert.equal(dagger.where, 'inventory');
        assert.equal(game.context.move, 0);
    });
}
for (const response of ['', ' ', 'A']) {
    void test(`combination drop with no category (${JSON.stringify(response)}) returns when Autoall is disabled`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, paranoia_bits: 0 } });
        const dagger = await addInventoryObject(DAGGER);
        const input = resetInputState();
        input.feed(`${response}\n`);
        const action = rhack('D'.charCodeAt(0));
        try {
            const completed = await Promise.race([
                action.then(() => true), input.waitUntilBlocked().then(() => false),
            ]);
            assert.equal(completed, true, 'an empty filter must finish without requesting another key');
            assert.equal(game.context.move, 0);
            assert.equal(dagger.where, 'inventory');
        }
        finally {
            if (input.isBlocked)
                input.feed('\x1b');
            await action;
        }
        const startX = game.u.ux;
        input.feed('l');
        await rhack(0);
        assert.equal(game.u.ux, startX + 1, 'the next key remains a movement command');
    });
}
for (const [response, paranoia] of [['', PARANOID_AUTOALL], ['m', 0]]) {
    void test(`combination drop allows all items for ${response === 'm' ? 'an explicit menu request' : 'an empty filter with Autoall enabled'}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_COMBINATION, paranoia_bits: paranoia, verbose: false } });
        const dagger = await addInventoryObject(DAGGER);
        resetInputState().feed(`${response}\n${dagger.invlet}\n`);
        await rhack('D'.charCodeAt(0));
        assert.equal(dagger.where, 'floor');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=drop_categories.test.js.map