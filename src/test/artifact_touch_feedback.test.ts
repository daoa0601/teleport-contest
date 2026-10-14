import test from 'node:test';
import assert from 'node:assert/strict';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an artifact blast names and observes the unidentified base object', async () => {
    freshObjectRoom({ role: 'knight', hero: { uhp: 200, uhpmax: 200, ualign: { type: -1, record: 10 } } });
    const sword = await artifactObject('Excalibur', { dknown: false, where: 'inventory' });
    const messages: string[] = [];

    const touch = await touchArtifactByHero(sword, undefined, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(touch.blasted, true);
    assert.equal(sword.dknown, true);
    assert.equal(messages[0], "You are blasted by the long sword named Excalibur's power!");
});
