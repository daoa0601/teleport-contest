import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_COMBINATION, MENU_TRADITIONAL, PARANOID_AUTOALL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { CLUB, DAGGER, LOADSTONE } from '../js/object_data.js';
import { objectDescription } from '../js/object_description.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
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
for (const dropDagger of [false, true]) {
    void test(`a refused traditional drop clears recall${dropDagger ? ' while preserving time spent dropping another item' : ''}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const dagger = dropDagger ? await addInventoryObject(DAGGER) : null;
        const stone = await addInventoryObject(LOADSTONE, { cursed: true });
        const input = resetInputState();
        input.feed('a\n');
        await rhack('D'.charCodeAt(0));
        assert.equal(game.context.move, Number(dropDagger));
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(await nhgetch(), 27, 'repeat must leave the next input key untouched');
        assert.equal(stone.where, 'inventory');
        if (dagger)
            assert.equal(dagger.where, 'floor');
    });
}
void test('traditional dropping restarts floating letters after gold leaves the inventory', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, fixinv: false, verbose: false } });
    setHeroGoldAmount(game, 10);
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    input.feed('$)\ny');
    const action = rhack('D'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        const prompt = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(prompt, /^a - .*dagger\?/);
    }
    finally {
        input.feed('n');
        await action;
    }
    assert.equal(dagger.where, 'inventory');
    assert.equal(game.inventory.some(object => object.oclass === 12), false);
});
for (const dualWielding of [false, true]) {
    void test(`traditional dropping shortens a long item name and keeps its question${dualWielding ? ' while dual-wielding' : ''}`, async () => {
        freshObjectRoom({ role: 'valkyrie', flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const name = 'Marigold the Bold, companion of the far northern expedition';
        const dagger = await addInventoryObject(DAGGER, {
            oname: name, greased: true, oeroded: 3, oeroded2: 3,
        });
        await setPrimaryWeapon(dagger, game);
        if (dualWielding) {
            await setSecondaryWeapon(await addInventoryObject(CLUB), game);
            setTwoWeaponCombat(true, game);
        }
        const input = resetInputState();
        input.feed(')\n');
        const action = rhack('D'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            const prompt = requireGameDisplay().grid.slice(0, 3)
                .map(row => row.map(cell => cell.ch).join('').trimEnd()).join(' ');
            assert.match(prompt, dualWielding
                ? /dagger named Marigold\.\.\. \(wielded in right hand\)\? \[ynaq\]/
                : /dagger named Marigold\.\.\. \(weapon in right hand\)\? \[ynaq\]/);
        }
        finally {
            input.feed('q');
            await action;
        }
        assert.ok(objectDescription(dagger).includes(name), 'the full item name returns after the question');
        assert.equal(dagger.where, 'inventory');
    });
}
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