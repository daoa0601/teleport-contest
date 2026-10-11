import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { fullyIdentifyObject } from '../js/invent.js';
import { pushKeys } from '../js/input.js';
import { IRON_SHOES } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const [role, x, hallucinating, name] of [
    ['valkyrie', 14, false, 'a pair of boots called Work'],
    ['valkyrie', 11, false, 'a pair of shoes called Work'],
    ['valkyrie', 11, true, 'a pair of boots called Work'],
    ['priest', 14, false, 'a blessed pair of boots called Work'],
] as const) {
    void test(`${role} sees armor pickup at range ${x - 10}${hallucinating ? ' while hallucinating' : ''}`, async () => {
        const input = freshTurnRoom({ role, left: 10, right: 16, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const messages: string[] = [];
        input.beforeRead = () => { messages.push((game._screen_output.split('\n')[0] ?? '')); };
        const monster = await createMonsterAt('goblin', x + 1, 10);
        monster.mpeaceful = 0;
        monster.msleeping = 0;
        monster.movement = 12;
        const boots = await floorObject(IRON_SHOES, x, 10, {
            dknown: false, bknown: false, known: false, typeKnown: false,
            blessed: role === 'priest',
        });
        game._knownObjectTypes?.delete(IRON_SHOES);
        recordObjectCall(IRON_SHOES, 'Work');
        if (hallucinating) game.u.hallucinationTurns = 20;
        initRng(1n);
        pushKeys('m.' + ' '.repeat(50) + 'm.');

        await moveloop_core();
        await moveloop_core();

        assert.ok(monster.minvent.includes(boots), 'the goblin picked up the boots');
        assert.ok(messages.some(message => message.includes(`picks up ${name}.`)), messages.join(' | '));
        assert.equal(boots.dknown, x === 11 && !hallucinating);
        if (role === 'priest') assert.equal(boots.bknown, true);
    });
}

for (const artifactName of ['The Mitre of Holiness', 'Excalibur']) {
    void test(`visible pickup uses the definite article for identified ${artifactName}`, async () => {
        const input = freshTurnRoom({ role: 'priest', left: 10, right: 16, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const messages: string[] = [];
        input.beforeRead = () => { messages.push((game._screen_output.split('\n')[0] ?? '')); };
        const monster = await createMonsterAt('archeologist', 15, 10, NO_MINVENT);
        monster.mpeaceful = 0;
        monster.msleeping = 0;
        monster.movement = 12;
        const artifact = artifactByName(artifactName);
        assert.ok(artifact);
        const object = await floorObject(artifact.baseType, 14, 10, { blessed: true, spe: 2 });
        nameArtifact(object, artifact);
        fullyIdentifyObject(object);
        initRng(1n);
        pushKeys('m.' + ' '.repeat(60) + 'm.');

        await moveloop_core();
        await moveloop_core();

        assert.ok(monster.minvent.includes(object), `The adventurer should pick up ${artifactName}: ${messages.join(' | ')}`);
        const name = artifactName === 'Excalibur' ? 'Excalibur' : 'Mitre of Holiness';
        assert.ok(messages.some(message => message.includes(`picks up the blessed +2 ${name}.`)), messages.join(' | '));
    });
}

void test('seeing an artifact pickup does not identify the artifact', async () => {
    const input = freshTurnRoom({ left: 10, right: 16, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const messages: string[] = [];
    input.beforeRead = () => { messages.push((game._screen_output.split('\n')[0] ?? '')); };
    const monster = await createMonsterAt('archeologist', 15, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.msleeping = 0;
    monster.movement = 12;
    const artifact = artifactByName('The Mitre of Holiness');
    assert.ok(artifact);
    const mitre = await floorObject(artifact.baseType, 14, 10, {
        blessed: true, spe: 2, dknown: false,
    });
    nameArtifact(mitre, artifact);
    initRng(1n);
    pushKeys('m.' + ' '.repeat(60) + 'm.');

    await moveloop_core();
    await moveloop_core();

    assert.ok(monster.minvent.includes(mitre));
    assert.equal(mitre.dknown, true, 'artifacts can be observed beyond the usual near-name range');
    assert.ok(!game._artifactDiscoveries?.includes(artifact.id));
    assert.ok(messages.some(message => message.includes('picks up a blessed +2 helm of brilliance named the Mitre of Holiness.')), messages.join(' | '));
});
