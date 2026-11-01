import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL } from '../js/const.js';
import { landFloorObject } from '../js/floor_effects.js';
import { unlinkObject } from '../js/mkobj.js';
import { IRON_CHAIN } from '../js/object_data.js';
import { cansee } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an iron chain rusting below the water surface is silent', async () => {
    const level = await freshObjectRoom();
    level.requireAt(12, 10).typ = POOL;
    const chain = await floorObject(IRON_CHAIN, 10, 10, { blessed: false });
    unlinkObject(chain);
    assert.equal(cansee(12, 10), true, 'The landing square is visible from above the pool.');
    const messages: string[] = [];

    await landFloorObject(chain, 12, 10, {
        random: () => 19, publish: message => { messages.push(message); },
    });

    assert.equal(chain.oeroded, 1);
    assert.equal(chain.where, 'floor');
    assert.equal(chain.ox, 12);
    assert.equal(messages.some(message => /rust/.test(message)), false,
        `Submerged erosion must be silent; received: ${messages.join(' / ')}`);
});
