import assert from 'node:assert/strict';
import test from 'node:test';

import { wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLOAK_OF_MAGIC_RESISTANCE, ROCK } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('shrinking out of a cloak announces the new load only once', async () => {
    freshObjectRoom();
    await addInventoryObject(ROCK, { quan: 40 });
    const cloak = await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE);
    wearHeroArmor(cloak);
    game._encumbranceLevel = nearCapacity(game);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };

    await polymonHero(MONSTER_NAME.indexOf('gnome'));
    messages.push(game._pending_message);

    assert.equal(cloak.where, 'floor');
    assert.equal(nearCapacity(game), 1);
    assert.equal(messages.filter(message => message.includes('Your movements are slowed slightly')).length, 1,
        `Expected one load announcement; saw ${messages.join(' | ')}`);
});
