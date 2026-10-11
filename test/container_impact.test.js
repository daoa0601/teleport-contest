import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, CHEST, EGG, MIRROR, OBJECT_NAMES, POT_WATER, } from '../js/object_data.js';
import { containerImpactDamage } from '../js/container_impact.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { objectWeight } from '../js/weight.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
function collector() {
    const messages = [];
    return {
        messages,
        publish: (text) => {
            messages.push(text);
        },
    };
}
function rollSequence(values) {
    let index = 0;
    return (size) => {
        const value = values[Math.min(index, values.length - 1)];
        index++;
        assert.ok(value !== undefined, 'impact roll fixture must not be empty');
        return value % size;
    };
}
async function chestWith(...contents) {
    const chest = await knownObject(CHEST, { cknown: true });
    chest.contents = [];
    for (const content of contents)
        await addCreatedObjectToContainer(chest, content);
    chest.owt = objectWeight(chest);
    return chest;
}
void test('a glass potion breaks with a muffled shatter inside a chest', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const before = chest.owt;
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, ['You hear a muffled shatter.']);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(!chest.contents.includes(potion));
    assert.equal(potion.where, 'gone');
    assert.equal(chest.cknown, false);
    assert.ok(chest.owt < before, 'container weight must drop with contents');
});
void test('a resisting glass item survives the impact', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([0]),
    });
    assert.deepEqual(log.messages, []);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(chest.contents.includes(potion));
    assert.equal(chest.cknown, true);
});
void test('a stack of glass items loses exactly one unit', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const stack = await knownObject(POT_WATER, { quan: 3, quantity: 3 });
    const chest = await chestWith(stack);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, ['You hear a muffled shatter.']);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(chest.contents.includes(stack));
    assert.equal(stack.quan, 2);
    assert.equal(stack.quantity, 2);
});
void test('the newest content takes the first breakage roll', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const older = await knownObject(POT_WATER);
    const newer = await knownObject(POT_WATER);
    const chest = await chestWith(older);
    await addCreatedObjectToContainer(chest, newer); // newest iterates first
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99, 0]),
    });
    assert.deepEqual(log.messages, ['You hear a muffled shatter.']);
    assert.equal(newer.where, 'gone');
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(chest.contents.includes(older));
    assert.equal(older.where, 'contained');
});
void test('a cracking egg breaks one third of the time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const egg = await knownObject(EGG, { spe: 0, corpsenm: 0 });
    const chest = await chestWith(egg);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([0]),
    });
    assert.deepEqual(log.messages, ['You hear a muffled cracking.']);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(!chest.contents.includes(egg));
});
void test('a mirror in the container costs two luck', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uluck = 0;
    const mirror = await knownObject(MIRROR);
    const chest = await chestWith(mirror);
    await containerImpactDamage(chest, 10, 10, {
        publish: collector().publish,
        random: rollSequence([99]),
    });
    assert.equal(game.u.uluck, -2);
});
void test('an egg laid by the hero costs one luck, a wild egg none', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uluck = 0;
    const laid = await knownObject(EGG, { spe: 1, corpsenm: 0 });
    const chestA = await chestWith(laid);
    await containerImpactDamage(chestA, 10, 10, {
        publish: collector().publish,
        random: rollSequence([0]),
    });
    assert.equal(game.u.uluck, -1);
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uluck = 0;
    const wild = await knownObject(EGG, { spe: 0, corpsenm: 0 });
    const chestB = await chestWith(wild);
    await containerImpactDamage(chestB, 10, 10, {
        publish: collector().publish,
        random: rollSequence([0]),
    });
    assert.equal(game.u.uluck, 0);
});
void test('bags of holding and tricks never spill breakage', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const holding = await knownObject(BAG_OF_HOLDING);
    holding.contents = [];
    await addCreatedObjectToContainer(holding, await knownObject(POT_WATER));
    const tricks = await knownObject(BAG_OF_TRICKS);
    tricks.contents = [];
    await addCreatedObjectToContainer(tricks, await knownObject(POT_WATER));
    const log = collector();
    await containerImpactDamage(holding, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    await containerImpactDamage(tricks, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, []);
    assert.equal(holding.contents.length, 1);
    assert.equal(tricks.contents.length, 1);
});
void test('empty and non-container objects are left alone', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const empty = await chestWith();
    const looseStack = await knownObject(POT_WATER);
    looseStack.contents = [await knownObject(MIRROR)]; // not a container type
    const log = collector();
    await containerImpactDamage(empty, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    await containerImpactDamage(looseStack, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, []);
    assert.equal(looseStack.contents.length, 1);
});
void test('an awake deaf hero hears nothing but the contents still break', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.deafTurns = 5;
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, []);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(!chest.contents.includes(potion));
});
void test('disabled acoustics silence the muffled sound', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags = { ...game.flags, acoustics: false };
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, []);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(!chest.contents.includes(potion));
});
void test('an underwater hero barely hears the muffled sound', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uinwater = 1;
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, ['You barely hear a muffled shatter.']);
});
void test('a sleeping hero dreams the muffled sound, deaf or not', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._helplessTurns = 5;
    game.u.usleep = 1;
    const potion = await knownObject(POT_WATER);
    const chest = await chestWith(potion);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, ['You dream that you hear a muffled shatter.']);
    freshObjectRoom();
    requirePlayingGame(game);
    game._helplessTurns = 5;
    game.u.usleep = 1;
    game.u.deafTurns = 5; // Deaf && !Unaware is the only deaf suppression
    const chest2 = await chestWith(await knownObject(POT_WATER));
    const log2 = collector();
    await containerImpactDamage(chest2, 10, 10, {
        publish: log2.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log2.messages, ['You dream that you hear a muffled shatter.']);
});
void test('glass gems ride out the impact unharmed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worthlessGlass = OBJECT_NAMES.indexOf('worthless piece of blue glass');
    const gem = await knownObject(worthlessGlass);
    const chest = await chestWith(gem);
    const log = collector();
    await containerImpactDamage(chest, 10, 10, {
        publish: log.publish,
        random: rollSequence([99]),
    });
    assert.deepEqual(log.messages, []);
    assert.ok(chest.contents, 'the chest must retain its contents list');
    assert.ok(chest.contents.includes(gem));
    assert.equal(chest.cknown, true);
});
//# sourceMappingURL=container_impact.test.js.map