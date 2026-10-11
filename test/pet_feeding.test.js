import test from 'node:test';
import assert from 'node:assert/strict';
import { beginPetEating, finishPetEating } from '../js/pet_eating.js';
import { initializePet } from '../js/dog.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LAVAPOOL, MM_EMIN, NO_MINVENT, POOL } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, CARROT, CORPSE, DAGGER, GOLD_PIECE, LUMP_OF_ROYAL_JELLY, ROCK, SACK, TRIPE_RATION } from '../js/object_data.js';
import { mksobj } from '../js/mklev.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { getObjectLocation } from '../js/object_location.js';
import { resumeDeferredPetEating, resumeDeferredPetMove, runMonsterAction } from '../js/monmove.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { installPagerInput } from './support/pager-input.js';
async function createPet(species = 'little dog', x = 11, y = 10) {
    const pet = await createMonsterAt(species, x, y, NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    return pet;
}
async function visibleMessage() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('a pet eating at its square restores its hunger deadline and maximum HP without healing old damage', async () => {
    freshObjectRoom({ moves: 100 });
    requirePlayingGame(game);
    const pet = await createPet();
    assert.ok(pet.edog);
    pet.mhp = 3;
    pet.mhpmax = 4;
    pet.mconf = 1;
    pet.mflee = 1;
    pet.mfleetim = 9;
    pet.mtame = 10;
    pet.edog.hungrytime = 90;
    pet.edog.mhpmax_penalty = 8;
    const tripe = await floorObject(TRIPE_RATION, 11, 10, { quan: 3 });
    const action = await runMonsterAction(pet, game);
    assert.ok(action.movement);
    await resumeDeferredPetEating(action, game);
    assert.equal(pet.edog.hungrytime, 1300); // Small dog gets 6 times 200.
    assert.equal(pet.edog.mhpmax_penalty, 0);
    assert.equal(pet.mhpmax, 12);
    assert.equal(pet.mhp, 3);
    assert.equal(pet.mconf, 0);
    assert.equal(pet.mfleetim, 4);
    assert.equal(pet.mtame, 11);
    assert.equal(pet.meating, 2);
    assert.equal(tripe.quan, 2);
    assert.equal(game.level.objects[11]?.[10]?.length, 1);
});
void test('a moving pet consumes food only after its eating message crosses the older message pager', async () => {
    freshObjectRoom({ moves: 100 });
    requirePlayingGame(game);
    const pet = await createPet('little dog', 12, 10);
    const food = await floorObject(TRIPE_RATION, 11, 10);
    const input = resetInputState();
    await plineWithContinuation('The previous message fills the top line before your pet can finish eating.');
    const action = await runMonsterAction(pet, game);
    assert.ok(action.movement);
    const feeding = resumeDeferredPetEating(action, game);
    await input.waitUntilBlocked();
    assert.equal(food.where, 'floor');
    assert.equal(pet.mx, 11);
    await answerPrompts(feeding, input, [{ prompt: /previous message.*--More--/s, keys: ' ' }]);
    assert.equal(food.where, 'gone');
    assert.equal(game.level.objects[11]?.[10]?.length, 0);
    assert.match(await visibleMessage(), /Your little dog eats an uncursed tripe ration\./);
});
void test('partly eaten food and devouring reduce a meal and its chewing time', async () => {
    freshObjectRoom({ moves: 100 });
    const pet = await createPet('tiger');
    assert.ok(pet.edog);
    pet.edog.hungrytime = 100;
    const corpse = await floorObject(CORPSE, 11, 10, {
        corpsenm: MONSTER_NAME.indexOf('human'), oeaten: 200,
    });
    const meal = beginPetEating(pet, corpse, { x: 11, y: 10 }, game, true);
    await finishPetEating(pet, meal);
    assert.equal(pet.meating, 6); // (3 + 1450/64) * (200/400), then halved.
    assert.equal(pet.edog.hungrytime, 700); // 200 * large-size 4 * 3/4.
    assert.equal(corpse.where, 'gone');
});
void test('a blind carnivore eats a carrot and regains sight', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createPet();
    pet.mcansee = 0;
    pet.mblinded = 20;
    const carrot = await floorObject(CARROT, 11, 10);
    const input = resetInputState();
    installPagerInput(input, { expected: /eats an uncursed carrot|can see again/, limit: 1 });
    const action = await runMonsterAction(pet, game);
    assert.ok(action.movement);
    await resumeDeferredPetEating(action, game);
    assert.equal(pet.mcansee, 1);
    assert.equal(pet.mblinded, 0);
    assert.equal(carrot.where, 'gone');
    assert.match(await visibleMessage(), /can see again/);
});
void test('a metallivore consumes an entire coin stack with weight-independent coin nutrition', async () => {
    freshObjectRoom({ moves: 100 });
    const pet = await createPet('xorn');
    assert.ok(pet.edog);
    pet.edog.hungrytime = 100;
    const gold = await floorObject(GOLD_PIECE, 11, 10, { quan: 4000 });
    await finishPetEating(pet, beginPetEating(pet, gold, { x: 11, y: 10 }));
    assert.equal(pet.meating, 3);
    assert.equal(pet.edog.hungrytime, 300);
    assert.equal(gold.where, 'gone');
});
void test('a gelatinous cube preserves swallowed contents when eating a container', async () => {
    freshObjectRoom();
    const pet = await createPet('gelatinous cube');
    const sack = await floorObject(SACK, 11, 10);
    const rock = await knownObject(ROCK);
    await addCreatedObjectToContainer(sack, rock);
    await finishPetEating(pet, beginPetEating(pet, sack, { x: 11, y: 10 }));
    assert.equal(sack.where, 'gone');
    assert.equal(rock.where, 'minvent');
    assert.ok(pet.minvent?.includes(rock));
    assert.equal(rock.carrierMid, pet.m_id);
    assert.equal(getObjectLocation(rock)?.x, pet.mx);
    assert.equal(getObjectLocation(rock)?.y, pet.my);
});
void test('royal jelly grows a killer bee into a queen and delays its next move', async () => {
    freshObjectRoom();
    const pet = await createPet('killer bee');
    const jelly = await floorObject(LUMP_OF_ROYAL_JELLY, 11, 10, { blessed: true, quan: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /eats a lump of royal jelly|grows up/, limit: 2 });
    await finishPetEating(pet, beginPetEating(pet, jelly, { x: 11, y: 10 }));
    assert.equal(pet.mnum, MONSTER_NAME.indexOf('queen bee'));
    assert.equal(pet.mfrozen, 3);
    assert.equal(pet.mcanmove, 0);
    assert.equal(jelly.quan, 1);
});
void test('food carried by the hero rewards apport using the pet\'s last delivery distance and time', async () => {
    freshObjectRoom({ moves: 100 });
    const pet = await createPet();
    assert.ok(pet.edog);
    pet.edog.apport = 5;
    pet.edog.dropdist = 10;
    pet.edog.droptime = 90;
    const food = await floorObject(TRIPE_RATION, 11, 10, { invlet: 'a' });
    await finishPetEating(pet, beginPetEating(pet, food, { x: 11, y: 10 }));
    assert.equal(pet.edog.apport, 15);
});
void test('a nurse corpse heals a wounded pet as well as relieving its hunger', async () => {
    freshObjectRoom();
    const pet = await createPet();
    pet.mhp = 2;
    pet.mhpmax = 20;
    const corpse = await floorObject(CORPSE, 11, 10, {
        corpsenm: MONSTER_NAME.indexOf('nurse'),
    });
    const input = resetInputState();
    installPagerInput(input, { expected: /eats an uncursed nurse corpse|looks healthy/, limit: 1 });
    await finishPetEating(pet, beginPetEating(pet, corpse, { x: 11, y: 10 }));
    assert.equal(pet.mhp, 20);
    assert.equal(corpse.where, 'gone');
});
void test('a rust monster spits out rustproof metal after removing its coating', async () => {
    freshObjectRoom();
    const pet = await createPet('rust monster');
    const dagger = await floorObject(DAGGER, 11, 10, { oerodeproof: true });
    const input = resetInputState();
    installPagerInput(input, { expected: /eats|spits.*out in disgust/, limit: 1 });
    await finishPetEating(pet, beginPetEating(pet, dagger, { x: 11, y: 10 }));
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.oerodeproof, false);
    assert.equal(pet.mstun, 1);
});
for (const terrain of [POOL, LAVAPOOL]) {
    void test(`a flying pet cannot reach food below ${terrain === POOL ? 'water' : 'lava'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const pet = await createPet('vampire bat', 12, 10);
        const location = level.at(11, 10);
        assert.ok(location);
        location.typ = terrain;
        const food = await floorObject(TRIPE_RATION, 11, 10);
        const input = resetInputState();
        installPagerInput(input, { expected: /vampire bat/, limit: 1 });
        const action = await runMonsterAction(pet, game);
        assert.ok(action.movement);
        await resumeDeferredPetEating(action, game);
        assert.equal(food.where, 'floor');
        assert.equal(pet.meating ?? 0, 0);
    });
}
void test('a salamander can retrieve food from lava without eating it', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createPet('salamander', 12, 10);
    assert.ok(pet.edog);
    pet.edog.apport = 20;
    const location = level.at(12, 10);
    assert.ok(location);
    location.typ = LAVAPOOL;
    const food = await floorObject(TRIPE_RATION, 12, 10);
    // Native salamanders have no eating diet. Lava affinity lets them fetch
    // this food; ordinary pickup willingness still varies between moves.
    for (let attempt = 0; attempt < 8 && food.where === 'floor'; attempt++) {
        const action = await runMonsterAction(pet, game);
        assert.ok(action.movement);
        await resumeDeferredPetMove(action, game);
    }
    assert.equal(food.where, 'minvent', `Food was not retrieved from lava; pet is at ${pet.mx},${pet.my}`);
    assert.ok(pet.minvent?.includes(food));
    assert.equal(pet.meating ?? 0, 0);
});
void test('a rock-throwing pet reaches food underneath a boulder', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createPet('hill giant', 12, 10);
    const food = await floorObject(TRIPE_RATION, 11, 10);
    await floorObject(BOULDER, 11, 10);
    const action = await runMonsterAction(pet, game);
    assert.ok(action.movement);
    await resumeDeferredPetEating(action, game);
    assert.equal(food.where, 'gone');
    assert.equal(pet.meating, 2);
});
void test('a tame minion follows its hero without eating nearby food', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const angel = await createMonsterAt('Angel', 12, 10, MM_EMIN | NO_MINVENT);
    angel.isminion = true;
    angel.mtame = 10;
    angel.mpeaceful = true;
    const food = await floorObject(TRIPE_RATION, 11, 10);
    const action = await runMonsterAction(angel, game);
    assert.ok(action.movement);
    await resumeDeferredPetEating(action, game);
    assert.equal(food.where, 'floor');
    assert.equal(angel.meating ?? 0, 0);
});
void test('an enormous coin meal clamps overflowing nutrition and delay instead of starving the pet', async () => {
    freshObjectRoom({ moves: 100 });
    const pet = await createPet('xorn');
    assert.ok(pet.edog);
    pet.edog.hungrytime = 100;
    // Fits a native long; both calculated meal values overflow signed int.
    const gold = await floorObject(GOLD_PIECE, 11, 10, { quan: 4_337_916_970_000 });
    await finishPetEating(pet, beginPetEating(pet, gold, { x: 11, y: 10 }));
    assert.equal(pet.meating, 1);
    assert.equal(pet.edog.hungrytime, 100);
    assert.equal(gold.where, 'gone');
});
void test('a pet names newly generated food after seeing it without relying on an inventory label', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createPet();
    const food = await mksobj(TRIPE_RATION, true, false);
    placeCreatedObject(food, pet.mx, pet.my);
    const action = await runMonsterAction(pet, game);
    assert.ok(action.movement);
    await resumeDeferredPetEating(action, game);
    assert.equal(await visibleMessage(), 'Your little dog eats a tripe ration.');
});
//# sourceMappingURL=pet_feeding.test.js.map