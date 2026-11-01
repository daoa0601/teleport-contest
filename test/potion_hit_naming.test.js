import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { wakeMonstersNearWithMessages } from '../js/mon.js';
import { POT_ACID, POT_HEALING, POT_WATER } from '../js/object_data.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { species, potionType, blessed, pain } of [
    { species: 'Juiblex', potionType: POT_WATER, blessed: true, pain: 'Juiblex shrieks in pain!' },
    { species: 'trapper', potionType: POT_ACID, blessed: false, pain: 'The trapper writhes in pain!' },
]) {
    void test(`a potion names an unseen engulfing ${species} in its pain message`, async () => {
        await freshObjectRoom();
        const engulfer = await createMonsterAt(species, game.u.ux, game.u.uy);
        engulfer.mhp = engulfer.mhpmax = 100;
        game.u.uswallow = 1;
        game.u.ustuck = engulfer;
        // gulpmu() removes map sight when the hero is swallowed.
        await vision_recalc(2);
        const potion = await addInventoryObject(potionType, { blessed });
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Crash!|pain!/, limit: 4 });
        initRng(2511n);
        await throwInventoryObject(potion, '<');
        const text = [...messages, game._pending_message].join('\n');
        assert.ok(text.includes(`Crash!  ${pain}`), text);
        assert.ok(engulfer.mhp < 100, 'The broken potion must damage its engulfing target');
        assert.equal(potion.where, 'gone');
    });
}
for (const { sense, hero, subject } of [
    { sense: 'telepathy', hero: { telepathy: true }, subject: 'The hezrou' },
    { sense: 'monster detection', hero: { detectMonsters: true }, subject: 'The hezrou' },
    { sense: 'ordinary warning alone', hero: { warning: true }, subject: 'It' },
]) {
    void test(`holy water pain describes a blind hero's target with ${sense}`, async () => {
        await freshObjectRoom({ hero });
        await makeBlinded(10, { talk: false });
        const demon = await createMonsterAt('hezrou', game.u.ux + 1, game.u.uy);
        demon.mhp = demon.mhpmax = 100;
        const potion = await knownObject(POT_WATER, { blessed: true });
        const messages = [];
        await hitMonsterWithSupportedPotion({
            monster: demon,
            potion,
            wakeNearby: wakeMonstersNearWithMessages,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(messages[0], 'Crash!');
        assert.equal(messages[1], `${subject} writhes in pain!`);
    });
}
void test('healing a monster sensed by a blind hero does not describe how it looks', async () => {
    await freshObjectRoom({ hero: { telepathy: true } });
    await makeBlinded(10, { talk: false });
    const dog = await createMonsterAt('dog', game.u.ux + 1, game.u.uy);
    dog.mhp = 2;
    dog.mhpmax = 20;
    const potion = await knownObject(POT_HEALING);
    const messages = [];
    await hitMonsterWithSupportedPotion({
        monster: dog,
        potion,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(dog.mhp, 20);
    assert.deepEqual(messages, ['Crash!']);
});
//# sourceMappingURL=potion_hit_naming.test.js.map