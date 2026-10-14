import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { DOOR, D_NODOOR, M_AP_FURNITURE, M_AP_TYPE, MM_ANGRY, NO_MINVENT, TT_PIT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { nhgetch, pushKey } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const command of ['o', 'c']) {
    for (const detected of [false, true]) {
        void test(`${command === 'o' ? 'opening' : 'closing'} a ${detected ? 'detected' : 'hidden'} door mimic reveals it and uses a turn`, async () => {
            const level = freshObjectRoom({ hero: { detectMonsters: detected } });
            const doorway = level.requireAt(11, 10);
            doorway.typ = DOOR;
            doorway.doormask = D_NODOOR;
            const mimic = await createMonsterAt('small mimic', 11, 10, MM_ANGRY | NO_MINVENT);
            mimic.m_ap_type = M_AP_FURNITURE;
            mimic.mappearance = CmapSymbol.vcdoor;
            mimic.msleeping = 0;
            newsym(11, 10);
            pushKey('l');

            await rhack(command.charCodeAt(0));

            assert.equal(M_AP_TYPE(mimic), 0);
            assert.equal(game.context.move, 1);
            assert.equal(doorway.doormask, D_NODOOR);
            assert.equal(glyphAt(11, 10)?.kind, 'monster');
            if (!detected) assert.match(game._pending_message, /That closed door actually is a small mimic!/);
        });
    }
}

void test('trying to open a sleeping door mimic wakes it before the monster turn', async () => {
    const level = freshObjectRoom();
    const doorway = level.requireAt(11, 10);
    doorway.typ = DOOR;
    doorway.doormask = D_NODOOR;
    const mimic = await createMonsterAt('small mimic', 11, 10, MM_ANGRY | NO_MINVENT);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CmapSymbol.hcdoor;
    mimic.msleeping = 1;
    newsym(11, 10);
    pushKey('l');
    pushKey(' ');

    await rhack('o'.charCodeAt(0));

    assert.equal(mimic.msleeping, 0);
    assert.equal(M_AP_TYPE(mimic), 0);
    assert.equal(game.context.move, 1);
});

void test('closing from a pit refuses before taking a direction or revealing a door mimic', async () => {
    const level = freshObjectRoom({ hero: { utrap: 3, utraptype: TT_PIT } });
    const doorway = level.requireAt(11, 10);
    doorway.typ = DOOR;
    doorway.doormask = D_NODOOR;
    const mimic = await createMonsterAt('small mimic', 11, 10, MM_ANGRY | NO_MINVENT);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = CmapSymbol.vcdoor;
    mimic.msleeping = 0;
    newsym(11, 10);
    pushKey('l');

    await rhack('c'.charCodeAt(0));

    assert.equal(game._pending_message, "You can't reach over the edge of the pit.");
    assert.equal(game.context.move, 0);
    assert.equal(M_AP_TYPE(mimic), M_AP_FURNITURE);
    assert.equal(glyphAt(11, 10)?.kind, 'terrain');
    assert.equal(await nhgetch(), 'l'.charCodeAt(0), 'the refused command leaves the direction unread');
});
