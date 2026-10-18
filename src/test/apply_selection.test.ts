import { objectTypeKnown } from '../js/shk.js';
import { inventoryLetter } from './support/commands.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { VIBRATING_SQUARE } from '../js/const.js';
import { retouchHeroObject } from '../js/hero_retouch.js';
import { resetInputState } from '../js/input.js';
import {
    BELL_OF_OPENING,
    CLUB,
    EUCALYPTUS_LEAF,
    GOLD_PIECE,
    LOADSTONE,
    OIL_LAMP,
    OBJECT_NAMES,
    POT_HEALING,
    POT_OIL,
    SPE_BLANK_PAPER,
    TOUCHSTONE,
} from '../js/object_data.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';

function screenText() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
}

void test('apply lists suggested objects in inventory-letter order while preserving the inventory chain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await addInventoryObject(CLUB, { invlet: 'a' });
    await addInventoryObject(EUCALYPTUS_LEAF, { invlet: 'Z' });
    for (const letter of 'fedcb') await addInventoryObject(OIL_LAMP, { invlet: letter });
    const inventory = game.inventory.slice();
    const input = resetInputState();
    const command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();

    assert.equal(game._pending_message, 'What do you want to use or apply? [b-fZ or ?*] ');
    assert.ok(game.inventory.every((item, index) => item === inventory[index]));
    input.feed('\x1b');
    await command;
    assert.equal(game.context.move, 0);
});

void test('apply accepts an unsuggested carried object and reports that it cannot be used', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB);
    await addInventoryObject(OIL_LAMP);
    resetInputState().feed(inventoryLetter(club));

    await rhack('a'.charCodeAt(0));

    assert.match(game._pending_message, /Sorry, I don't know how to use that/);
    assert.equal(club.where, 'inventory');
    assert.equal(game.context.move, 0);
});

void test('apply refuses to open an empty suggestion set when only unusable objects are held', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await addInventoryObject(CLUB);

    await rhack('a'.charCodeAt(0));

    assert.equal(game._pending_message, "You don't have anything to use or apply.");
    assert.equal(game.context.move, 0);
});

void test('coins keep apply available without advertising their letter and dispatch the real flip', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 7 });
    const input = resetInputState();
    const command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'What do you want to use or apply? [*] ');
    input.feed('$ ');
    await command;

    assert.match(game._pending_message, /It comes up (heads|tails)/);
    assert.equal(gold.quan, 7);
    assert.equal(game.context.move, 1);
});

void test('applying a book reaches page flipping and blank-paper discovery', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_BLANK_PAPER, { typeKnown: false });
    resetInputState().feed(book.invlet + ' ');

    await rhack('a'.charCodeAt(0));

    assert.ok(game._knownObjectTypes);
    assert.ok(game._knownObjectTypes.has(SPE_BLANK_PAPER));
    assert.equal(game.context.move, 1);
    assert.equal(game._occupation, undefined);
});

for (const menuKey of ['?', '*']) {
    void test(`apply ${menuKey} menu ${menuKey === '?' ? 'limits the list to suggestions' : 'includes all carried items'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        await addInventoryObject(CLUB);
        await addInventoryObject(OIL_LAMP);
        await addInventoryObject(GOLD_PIECE, { quan: 11 });
        const input = resetInputState();
        let menu = '';
        input.beforeRead = () => {
            const shown = screenText();
            if (shown.includes('oil lamp')) menu = shown;
        };
        input.feed(menuKey + '\x1b');

        await rhack('a'.charCodeAt(0));

        assert.match(menu, /oil lamp/);
        if (menuKey === '?') {
            assert.match(menu, /oil lamp[^\n]*\.--More--/);
            assert.doesNotMatch(menu, /club|gold pieces/);
        }
        else assert.match(menu, /club[\s\S]*gold pieces|gold pieces[\s\S]*club/);
        assert.equal(game.context.move, 0);
    });
}

void test('an unknown potion keeps apply available but only discovered oil becomes a suggestion', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const oil = await addInventoryObject(POT_OIL, { typeKnown: false, invlet: 'o' });
    await addInventoryObject(POT_HEALING, { invlet: 'h' });
    const input = resetInputState();
    let command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'What do you want to use or apply? [*] ');
    input.feed('\x1b');
    await command;
    learnObjectType(POT_OIL);
    game._pending_message = '';
    command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, `What do you want to use or apply? [${oil.invlet} or ?*] `);
    input.feed('\x1b');
    await command;
});

void test('recognizing touchstones removes other recognized gray stones from apply suggestions', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const loadstone = await addInventoryObject(LOADSTONE, { typeKnown: false, invlet: 'l' });
    const input = resetInputState();
    const command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /\[l or \?\*\]/);
    input.feed('\x1b');
    await command;
    learnObjectType(TOUCHSTONE);
    game._pending_message = '';

    await rhack('a'.charCodeAt(0));

    assert.match(game._pending_message, /don't have anything/);
    assert.equal(objectTypeKnown(loadstone), false);
});

void test('force_invmenu begins with suggestions and can reveal all inventory', async () => {
    freshObjectRoom({ flags: { force_invmenu: true, verbose: true } });
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB);
    await addInventoryObject(OIL_LAMP);
    const input = resetInputState();
    const screens: string[] = [];
    input.beforeRead = () => {
        screens.push(screenText());
    };
    input.feed('*' + club.invlet);

    await rhack('a'.charCodeAt(0));

    assert.ok(screens[0]);
    assert.ok(screens[1]);
    assert.match(screens[0], /What do you want to use or apply/);
    assert.match(screens[0], /list everything/);
    assert.doesNotMatch(screens[0], /club/);
    assert.match(screens[1], /club/);
    assert.match(screens[1], /list likely candidates/);
    assert.match(game._pending_message, /Sorry/);
});

void test('nonconstant inventory letters are reassigned before the apply prompt', async () => {
    freshObjectRoom({ flags: { fixinv: false, verbose: true } });
    requirePlayingGame(game);
    await addInventoryObject(CLUB, { invlet: 'Z' });
    await addInventoryObject(OIL_LAMP, { invlet: 'm' });
    const gold = await addInventoryObject(GOLD_PIECE);
    const carried = game.inventory.filter((item) => item !== gold);
    const input = resetInputState();
    const command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();

    assert.equal(game.inventory[0], gold);
    assert.equal(carried[0]?.invlet, 'a');
    assert.equal(carried[1]?.invlet, 'b');
    assert.equal(gold.invlet, '$');
    input.feed('\x1b');
    await command;
});

void test('rub refuses an empty applicable inventory and rejects a carried non-rubbable object', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB);
    await runExtendedCommand('rub');
    assert.equal(game._pending_message, "You don't have anything to rub.");

    await addInventoryObject(OIL_LAMP);
    game._pending_message = '';
    await runExtendedCommand('rub', inventoryLetter(club));
    assert.equal(game._pending_message, 'That is a silly thing to rub.');
    assert.equal(game.context.move, 0);
});

void test('apply rejects a count and resumes object selection after its message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB);
    await addInventoryObject(OIL_LAMP);
    const input = resetInputState();
    input.feed('3');
    const command = rhack('a'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /No count allowed with this command/);
    input.feed(' ' + club.invlet);
    await command;

    assert.match(game._pending_message, /Sorry/);
    assert.equal(game.context.move, 0);
});

void test('choosing empty hands for apply mimes the action without consuming time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await addInventoryObject(OIL_LAMP);
    resetInputState().feed('-');

    await rhack('a'.charCodeAt(0));

    assert.match(game._pending_message, /^You mime (using|applying) something\.$/);
    assert.equal(game.context.move, 0);
});

void test('Return cancels apply without leaving an unanswered prompt when verbose is disabled', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP);
    resetInputState().feed('\n');

    await rhack('a'.charCodeAt(0));

    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, '');
    assert.equal(lamp.lamplit, false);
});

void test('applying an unequipped silver item burns a werecreature before its ordinary action', async () => {
    freshObjectRoom({ hero: { ulycn: 0 } });
    requirePlayingGame(game);
    const saber = await addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    await addInventoryObject(OIL_LAMP);
    const health = game.u.uhp;
    resetInputState().feed(inventoryLetter(saber));

    await rhack('a'.charCodeAt(0));

    assert.ok(game.u.uhp < health);
    assert.match(game._pending_message, /can't handle your silver saber/);
    assert.equal(saber.where, 'inventory');
    assert.equal(game.context.move, 1);
});

for (const onStairs of [false, true]) {
    void test(`a silver-hating hero ${onStairs ? 'cannot' : 'can'} handle the invocation bell on the ritual square${onStairs ? ' after stairs replace it' : ''}`, async () => {
        freshObjectRoom({ hero: { ulycn: 0, uz: { dnum: 1, dlevel: 4 } } });
        requirePlayingGame(game);
        game.dungeons = [
            createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
            createDungeon({ dname: 'Gehennom', num_dunlevs: 5, flags: { hellish: true } }),
        ];
        game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
        addTrap(requireGameLevel(), VIBRATING_SQUARE, game.u.ux, game.u.uy);
        if (onStairs)
            game.stairs = {
                sx: game.u.ux,
                sy: game.u.uy,
                up: false,
                isladder: false,
                tolev: { dnum: 1, dlevel: 5 },
                u_traversed: false,
                next: null,
            };
        const bell = await addInventoryObject(BELL_OF_OPENING);
        const health = game.u.uhp;

        const result = await retouchHeroObject(bell);

        assert.equal(result.rejected, onStairs);
        assert.equal(game.u.uhp < health, onStairs);
        assert.equal(bell.where, 'inventory');
    });
}
