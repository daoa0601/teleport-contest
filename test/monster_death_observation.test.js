import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { doGenocide } from '../js/genocide.js';
import { pushKeys } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_HEALING } from '../js/object_data.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const scenarios = [
    { name: 'nearby ordinary object', x: 12, seen: true },
    { name: 'distant artifact', x: 16, artifact: true, seen: true },
    { name: 'nearby object during hallucination', x: 12, hallucinating: true, seen: false },
    { name: 'distant object seen by a priest', x: 16, role: 'priest', seen: false },
];
for (const scenario of scenarios) {
    void test(`death-drop naming observes a ${scenario.name} by C distance and sense rules`, async () => {
        freshObjectRoom({ right: 20, role: scenario.role || 'caveman' });
        requirePlayingGame(game);
        const orc = await createMonsterAt('orc', scenario.x, 10);
        const knowledge = { dknown: false, bknown: false, typeKnown: false };
        const object = scenario.artifact
            ? await artifactObject('Sunsword', knowledge)
            : await knownObject(POT_HEALING, knowledge);
        await addObjectToMonsterInventory(orc, object);
        if (scenario.hallucinating)
            game.u.hallucinationTurns = 10;
        pushKeys('orc\n            ');
        await doGenocide(1);
        assert.equal(object.where, 'floor');
        assert.equal(object.dknown, scenario.seen);
        assert.equal(object.bknown, scenario.role === 'priest');
    });
}
//# sourceMappingURL=monster_death_observation.test.js.map