import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_HOLDING, CLUB, POT_HEALING } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';

for (const blind of [false, true]) {
    void test(`a vanishing unseen potion ${blind ? 'stays unidentified to a blind hero' : 'reveals its appearance to a sighted hero'}`, async () => {
        freshPlayableRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        game.objectDescriptions = [];
        game.objectDescriptions[POT_HEALING] = 'pink';
        const bag = await addInventoryObject(BAG_OF_HOLDING, {
            invlet: 'a', initialize: false, cursed: true, cknown: true,
        });
        const potion = await knownObject(POT_HEALING, {
            initialize: false, where: 'contained', container: bag,
            known: false, typeKnown: false, dknown: false, bknown: false,
        });
        bag.contents = [potion];
        await addInventoryObject(CLUB, { invlet: 'b' });
        initRng(17n);
        const input = resetInputState();

        await answerPrompts(applyInventoryObject(bag), input, [
            { prompt: blind ? /You notice a potion disappear!/ : /You see a pink potion disappear!/, keys: ' ' },
            { prompt: /Do what with/, keys: 'q' },
        ]);

        assert.equal(potion.where, 'gone');
        assert.equal(potion.dknown, !blind);
        assert.equal(game._encounteredObjectTypes?.has(POT_HEALING) ?? false, !blind);
        assert.equal(game.context.move, 0);
    });
}

void test('the discovered Eyes of the Overworld have vanished when a cursed bag consumes them', async () => {
    freshPlayableRoom();
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cursed: true, cknown: true,
    });
    const eyes = await artifactObject('The Eyes of the Overworld', {
        where: 'contained', container: bag,
    });
    assert.ok(eyes.oartifact);
    game._artifactDiscoveries = [eyes.oartifact];
    bag.contents = [eyes];
    await addInventoryObject(CLUB, { invlet: 'b' });
    initRng(17n);
    const input = resetInputState();

    await answerPrompts(applyInventoryObject(bag), input, [
        { prompt: /Eyes of the Overworld have vanished!/, keys: ' ' },
        { prompt: /Do what with/, keys: 'q' },
    ]);

    assert.equal(eyes.where, 'gone');
});
