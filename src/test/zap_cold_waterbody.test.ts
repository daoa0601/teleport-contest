import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, MOAT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { WAN_COLD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a cold wand names Medusa\'s shallow sea before it freezes', async () => {
    const level = freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    game.medusa_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    level.requireAt(11, 10).typ = MOAT;
    const wand = await addInventoryObject(WAN_COLD, { spe: 2 });
    pushKeys(`${wand.invlet}l`);

    await rhack('z'.charCodeAt(0));

    assert.equal(level.requireAt(11, 10).typ, ICE);
    assert.equal(game._pending_message, 'The shallow sea is bridged with ice!');
    assert.equal(wand.spe, 1);
});
