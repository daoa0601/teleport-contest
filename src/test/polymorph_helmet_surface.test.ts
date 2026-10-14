import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { CORR } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { HELMET } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a helmet dropped by polymorph in a corridor falls to the ground', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = CORR;
    const helmet = await addInventoryObject(HELMET);
    wearHeroArmor(helmet);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };

    await polymonHero(MONSTER_NAME.indexOf('jackal'));
    await flushPendingTopline();

    assert.match(messages.join('\n'), /Your helm falls to the ground!/);
    assert.equal(game.uarmh, null);
    assert.equal(helmet.where, 'floor');
});
