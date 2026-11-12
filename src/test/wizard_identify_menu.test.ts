import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { objectNeedsFullIdentification } from '../js/objnam.js';
import { POT_EXTRA_HEALING, POT_HEALING, SCR_IDENTIFY } from '../js/object_data.js';
import { applyNethackrc } from '../js/cfgfiles.js';
import { ATR_BOLD, CLR_RED  } from '../js/terminal.js';
import { C_ATR_BOLD } from '../js/color_attr.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const selector of ['_', '\x09', '!']) {
    void test(`wizard identify can permanently identify all items with ${JSON.stringify(selector)}`, async () => {
        await freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        const potion = await addInventoryObject(POT_HEALING, { invlet: 'a', known: false, bknown: false });
        const scroll = await addInventoryObject(SCR_IDENTIFY, { invlet: 'b', known: false, bknown: false });
        const input = resetInputState();
        installPagerInput(input, { expected: /potion|scroll/, limit: 4 });
        if (selector === '!') applyNethackrc('BIND=!:wizidentify');

        if (selector === '!') {
            input.feed(`${selector}\n`);
            await rhack('!'.charCodeAt(0));
        } else await runExtendedCommand('wizidentify', `${selector}\n`);

        assert.equal(objectNeedsFullIdentification(potion), false);
        assert.equal(objectNeedsFullIdentification(scroll), false);
        assert.equal(game.context.move, 0);
    });
}

void test('wizard identify with an empty inventory reports that nothing is carried', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('\x1b');

    await rhack(9);

    assert.equal(game._pending_message, 'Not carrying anything.');
    assert.equal(game.context.move, 0);
});

void test('wizard identify selects an object class without identifying other classes', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    const healing = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const extraHealing = await addInventoryObject(POT_EXTRA_HEALING, { known: false, bknown: false });
    const scroll = await addInventoryObject(SCR_IDENTIFY, { known: false, bknown: false });
    const input = resetInputState();
    installPagerInput(input, { expected: /potion/, limit: 4 });

    await runExtendedCommand('wizidentify', '!\n');

    assert.equal(objectNeedsFullIdentification(healing), false, 'the potion shortcut selects healing');
    assert.equal(objectNeedsFullIdentification(extraHealing), false, 'the shortcut selects every potion');
    assert.equal(objectNeedsFullIdentification(scroll), true, 'other object classes stay unidentified');
    assert.equal(game.context.move, 0);
});

void test('wizard identify names an unseen potion by its unknown noun while hallucinating', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    // Hallucination keeps fully_identify_obj() from setting dknown, and
    // display_pickinv() clears iflags.override_ID before the identify
    // notices (invent.c:3391), so the notice names the unseen potion
    // "a potion" rather than revealing "potion of healing".
    game.u.hallucinationTurns = 20;
    const potion = await addInventoryObject(POT_HEALING, {
        invlet: 'a', known: false, bknown: false, dknown: false, typeKnown: false, observed: false,
    });
    const input = resetInputState();
    installPagerInput(input, { expected: /potion/, limit: 4 });

    await runExtendedCommand('wizidentify', 'a\n');

    const said = [...game._messageHistory, game._pending_message].join(' | ');
    assert.ok(said.includes('a - an uncursed potion.'), `the notice names the unseen noun: ${said}`);
    assert.ok(!said.includes('potion of healing'), `the notice must not reveal the type: ${said}`);
    // not_fully_identified() also requires dknown (objnam.c), which
    // observe_object() leaves clear while hallucinating: the potion
    // legitimately reappears in the next wizard identify menu.
    assert.equal(objectNeedsFullIdentification(potion), true);
    assert.equal(game.context.move, 0);
});

void test('wizard identify uses the configured class heading style', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    game.iflags.menu_headings = { attr: C_ATR_BOLD, color: CLR_RED };
    const input = resetInputState();
    const operation = rhack(9);
    try {
        await input.waitUntilBlocked();
        const row = requireGameDisplay().grid.find(row => row.map(cell => cell.ch).join('').includes('Potions'));
        assert.ok(row, 'wizard identify displays the Potions heading');
        const heading = row.find(cell => cell.ch === 'P');
        assert.equal(heading?.attr, ATR_BOLD);
        assert.equal(heading?.color, CLR_RED);
    } finally {
        input.feed('\x1b');
        await operation;
    }
});
