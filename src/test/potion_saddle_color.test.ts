import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { POT_WATER } from '../js/object_data.js';
import { monsterSaddle } from '../js/steed.js';
import { knownObject } from './support/game-objects.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('hallucination distorts the aura when holy water blesses a saddle', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 30, uluck: 13 } });
    const pony = await createSaddledSteed();
    const saddle = monsterSaddle(pony);
    assert.ok(saddle);
    const water = await knownObject(POT_WATER, { blessed: true });
    const messages: string[] = [];

    await hitMonsterWithSupportedPotion({ monster: pony, potion: water,
        publish: async message => { messages.push(message); } });

    assert.equal(saddle.blessed, true, 'The bottle must hit the saddle to exercise its aura.');
    assert.equal(saddle.bknown, false);
    const glow = messages.find(message => /glows with/.test(message));
    assert.ok(glow, messages.join(' | '));
    // Native hcolor's hallucination vocabulary has no ordinary light blue.
    assert.doesNotMatch(glow, /light blue/);
});
