import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { BURN } from '../js/const.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { TOWEL, WAN_FIRE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('force_invmenu engraving uses the implement selected by the inventory action', async () => {
    const input = freshTurnRoom({ flags: { force_invmenu: true } });
    const wand = await addInventoryObject(WAN_FIRE, { spe: 10 });
    const towel = await addInventoryObject(TOWEL);
    input.feed('i');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /Wands/, keys: wand.invlet },
        { prompt: /Do what with the wand of fire\?/, keys: 'E' },
    ]);

    const operation = moveloop_core();
    try {
        await answerPrompts(operation, input, [
            { prompt: /You burn into the floor with [^\n]*wand of fire[^\n]*--More--/, keys: ' ' },
            { prompt: /What do you want to burn into the floor here\?/, keys: 'X\r' },
        ]);
    } finally {
        input.feed('\x1b\x1b\x1b');
        await operation;
    }
    input.clear();
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.equal(engraving?.text, 'X');
    assert.equal(engraving?.engr_type, BURN);
    assert.equal(wand.spe, 9);
    assert.equal(game.inventory.includes(towel), true);
});
