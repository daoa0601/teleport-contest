import test from 'node:test';
import assert from 'node:assert/strict';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { DIED } from '../js/const.js';
import { formatKillerCause } from '../js/end.js';
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

void test('a fatal artifact blast is recorded as killed by touching the artifact', async () => {
    freshObjectRoom({ role: 'knight', hero: { uhp: 1, uhpmax: 1, ualign: { type: -1, record: 10 } } });
    const sword = await artifactObject('Excalibur', { where: 'inventory' });
    let cause = '';

    const touch = await touchArtifactByHero(sword, undefined, {
        publish: async () => {},
        die: ({ killer, killerFormat }) => {
            cause = formatKillerCause(killer, DIED, killerFormat);
            return true;
        },
    });

    assert.equal(touch.died, true);
    assert.equal(cause, 'killed by touching Excalibur');
});
