import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, discoverArtifact } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { hitHeroWithObject } from '../js/hero_object_hit.js';
import { CLUB, ROCK } from '../js/object_data.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a rock striking from above passes harmlessly through a rock-passing hero', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    installPolymorphedHero('xorn', { hitPoints: 40 });
    const rock = await knownObject(ROCK);
    const messages = [];
    const result = await hitHeroWithObject(rock, 6, 20, {
        name: 'falling rock', rollOne: () => 1,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.hit, true);
    assert.equal(game.u.mh, 40);
    assert.equal(messages[1], 'It passes harmlessly through you.');
});
for (const { name, accuracy, roll, hit, message } of [
    { name: 'hits', accuracy: 8, roll: 1, hit: true, message: 'You are hit by 3 blessed +2 clubs.' },
    { name: 'almost hits', accuracy: 8, roll: 18, hit: false, message: 'You are almost hit by 3 blessed +2 clubs.' },
    { name: 'misses', accuracy: 6, roll: 20, hit: false, message: '3 blessed +2 clubs miss you.' },
]) {
    void test(`a stack that ${name} the hero retains its count and known properties`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        const clubs = await knownObject(CLUB, { quantity: 3, blessed: true, spe: 2 });
        const messages = [];
        const result = await hitHeroWithObject(clubs, 2, accuracy, {
            publish: async (message) => { messages.push(message); }, rollOne: () => roll,
        });
        assert.equal(result.hit, hit);
        assert.equal(game.u.uhp, hit ? 98 : 100);
        assert.equal(messages[0], message);
    });
}
for (const { artifactName, description } of [
    { artifactName: 'The Staff of Aesculapius', description: 'the Staff of Aesculapius' },
    { artifactName: 'Excalibur', description: 'Excalibur' },
]) {
    for (const { outcome, accuracy, roll, hit, message } of [
        { outcome: 'hits', accuracy: 8, roll: 1, hit: true, message: `You are hit by ${description}.` },
        { outcome: 'almost hits', accuracy: 8, roll: 18, hit: false, message: `You are almost hit by ${description}.` },
        { outcome: 'misses', accuracy: 6, roll: 20, hit: false,
            message: `${description.charAt(0).toUpperCase() + description.slice(1)} misses you.` },
    ]) {
        void test(`identified ${artifactName} keeps its native article when it ${outcome} the hero`, async () => {
            freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
            const artifact = artifactByName(artifactName);
            assert.ok(artifact, `Missing artifact: ${artifactName}`);
            const weapon = await artifactObject(artifactName, { rknown: true });
            discoverArtifact(artifact.id);
            const messages = [];
            const result = await hitHeroWithObject(weapon, 2, accuracy, {
                publish: async (message) => { messages.push(message); }, rollOne: () => roll,
            });
            assert.equal(result.hit, hit);
            assert.equal(game.u.uhp, hit ? 98 : 100);
            assert.equal(messages[0], message);
        });
    }
}
//# sourceMappingURL=hero_object_hit.test.js.map