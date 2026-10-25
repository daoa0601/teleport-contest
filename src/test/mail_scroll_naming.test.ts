// C objnam.c:1318-1349 (doname_base) and invent.c:not_fully_identified():
// scroll of mail is special-cased behind MAIL_STRUCTURES. It never takes the
// "uncursed" prefix while implicit_uncursed is on, and its unknown beatitude
// does not keep it "not fully identified" for the itemized identify filter.

import assert from 'node:assert/strict';
import test from 'node:test';

import { inventoryItemDescription, objectNeedsFullIdentification } from '../js/invent.js';
import { game } from '../js/gstate.js';
import { OBJECT_NAMES, SCR_IDENTIFY } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const SCROLL_OF_MAIL = OBJECT_NAMES.indexOf('mail');

void test('an identified scroll of mail omits "uncursed" from its inventory name', async () => {
    freshObjectRoom();

    const mail = await addInventoryObject(SCROLL_OF_MAIL, {
        spe: 1, bknown: true, known: true, dknown: true, typeKnown: true,
    });

    assert.equal(await inventoryItemDescription(mail), 'a scroll of mail');
});

void test('ordinary scrolls keep "uncursed" while implicit_uncursed is on', async () => {
    freshObjectRoom();

    const scroll = await addInventoryObject(SCR_IDENTIFY, {
        bknown: true, known: true, dknown: true, typeKnown: true,
    });

    assert.equal(await inventoryItemDescription(scroll), 'an uncursed scroll of identify');
});

void test('turning implicit_uncursed off shows the mail scroll as uncursed', async () => {
    freshObjectRoom();
    game.flags.implicit_uncursed = false;
    try {
        const mail = await addInventoryObject(SCROLL_OF_MAIL, {
            spe: 1, bknown: true, known: true, dknown: true, typeKnown: true,
        });

        assert.equal(await inventoryItemDescription(mail), 'an uncursed scroll of mail');
    } finally {
        game.flags.implicit_uncursed = true;
    }
});

void test('a scroll of mail with unknown beatitude counts as fully identified', async () => {
    freshObjectRoom();

    const mail = await addInventoryObject(SCROLL_OF_MAIL, {
        spe: 1, bknown: false, known: true, dknown: true, typeKnown: true,
    });
    const scroll = await addInventoryObject(SCR_IDENTIFY, {
        bknown: false, known: true, dknown: true, typeKnown: true,
    });

    assert.equal(objectNeedsFullIdentification(mail), false);
    assert.equal(objectNeedsFullIdentification(scroll), true);
});
