import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, OBJECT_BASES, OBJECT_COLOR, OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng, rn2Display } from '../js/rng.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
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

for (const invisible of [false, true]) {
    for (const command of ['P', 'R'] as const) {
        const action = command === 'P' ? 'wear' : 'removal';
        void test(`see-invisible ring ${action} redraws the hallucinated floor for ${invisible ? 'an invisible' : 'a visible'} hero`, async () => {
            const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
            if (invisible) grantIntrinsicProperty('invisible', 'outside');
            await floorObject(ROCK, game.u.ux, game.u.uy);
            const ring = await addInventoryObject(OBJECT_NAMES.indexOf('see invisible'));
            resetInputState().feed(`${ring.invlet}l                `);
            if (command === 'R') await rhack('P'.charCodeAt(0));
            const firstObject = OBJECT_BASES[2];
            assert.ok(firstObject !== undefined);
            initRng(17n);
            // see_monsters() redraws the hero's floor once. Only an invisible
            // hero gets the additional redraw beside the ring's effect message.
            let appearance = rn2Display(OBJECT_COLOR.length - firstObject) + firstObject;
            if (appearance === CORPSE) rn2Display(MONSTER_NAME.length);
            if (invisible) appearance = rn2Display(OBJECT_COLOR.length - firstObject) + firstObject;
            initRng(17n);

            await rhack(command.charCodeAt(0));

            const remembered = level.requireAt(game.u.ux, game.u.uy).remembered_glyph;
            assert.ok(remembered?.kind === 'object');
            assert.equal(remembered.otyp, appearance,
                'The ring must not replace the floor appearance with an extra hallucinated redraw');
        });
    }
}

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
