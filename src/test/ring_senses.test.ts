import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

void test('an invisibility ring identifies itself with the native disappearance message', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('invisibility'), { typeKnown: false });
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${ring.invlet}l                `);

    await rhack('P'.charCodeAt(0));

    assert.equal(objectTypeKnown(ring), true);
    assert.match([...messages, game._pending_message].join(' '), /Gee!  All of a sudden, you can't see yourself\./);
    await rhack('R'.charCodeAt(0));
    assert.match([...messages, game._pending_message].join(' '), /Your body seems to unfade\.\.\./);
});

void test('a see-invisible ring reveals a stationary invisible monster immediately and hides it on removal', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    monster.minvis = 1;
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('see invisible'));
    newsym(monster.mx, monster.my);
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'monster');
    resetInputState().feed(`${ring.invlet}l                `);

    await rhack('P'.charCodeAt(0));

    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'monster');
    await rhack('R'.charCodeAt(0));
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'monster');
});

void test('an invisible hero discovers a see-invisible ring from becoming visible to themselves', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('invisible', 'outside');
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('see invisible'), { typeKnown: false });
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${ring.invlet}l                `);

    await rhack('P'.charCodeAt(0));

    assert.equal(objectTypeKnown(ring), true);
    assert.match([...messages, game._pending_message].join(' '), /Suddenly you are transparent, but there!/);
    await rhack('R'.charCodeAt(0));
    assert.match([...messages, game._pending_message].join(' '), /Suddenly you cannot see yourself\./);
});

void test('a warning ring refreshes the displayed warning for a stationary invisible giant', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('fire giant', 12, 10, NO_MINVENT);
    monster.minvis = 1;
    monster.mpeaceful = false;
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('warning'));
    newsym(monster.mx, monster.my);
    resetInputState().feed(`${ring.invlet}l                `);

    await rhack('P'.charCodeAt(0));

    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'warning');
    await rhack('R'.charCodeAt(0));
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'warning');
});
