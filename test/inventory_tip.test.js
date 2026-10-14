import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, CRYSKNIFE, DAGGER, HORN_OF_PLENTY, SACK, WAN_CANCELLATION, WORM_TOOTH } from '../js/object_data.js';
import { objectWeight } from '../js/weight.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { planInput } from './support/planned-input.js';
void test('the inventory tip action spills a carried sack while ignoring a floor container', async (t) => {
    const level = freshObjectRoom();
    const sack = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const dagger = await knownObject(DAGGER, { where: 'free' });
    await addObjectToContainer(sack, dagger);
    sack.owt = objectWeight(sack);
    const floorSack = await floorObject(SACK, game.u.ux, game.u.uy, { cknown: false });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: sack.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of[\s\S]*on the floor/, keys: '\n' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(sack.contents?.length, 0);
    assert.equal(sack.owt, objectWeight(sack));
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.container, null);
    assert.equal(level.objects[game.u.ux]?.[game.u.uy]?.includes(dagger), true);
    assert.equal(game.inventory.includes(sack), true);
    assert.equal(floorSack.cknown, false);
    assert.match(game._pending_message, /An object spills out:.*dagger\./);
});
void test('cancelling a tip destination keeps the contents and spends a turn', async (t) => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const dagger = await knownObject(DAGGER, { where: 'free' });
    await addObjectToContainer(sack, dagger);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: sack.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: '\x1b' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(sack.contents?.includes(dagger), true);
    assert.equal(dagger.container, sack);
    assert.equal(dagger.where, 'contained');
});
void test('tipping a locked carried container learns the lock and leaves its contents inside', async (t) => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { initialize: false, cknown: false, lknown: false, olocked: true });
    const dagger = await knownObject(DAGGER, { where: 'free' });
    await addObjectToContainer(sack, dagger);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: sack.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: '\n' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(sack.lknown, true);
    assert.equal(sack.cknown, false);
    assert.equal(sack.contents?.includes(dagger), true);
    assert.equal(game._pending_message, 'The sack is locked.');
});
void test('tipping into another carried sack merges its contents and updates both weights', async (t) => {
    freshObjectRoom();
    const source = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const target = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const daggers = await knownObject(DAGGER, { initialize: false, where: 'free', quan: 3 });
    const existing = await knownObject(DAGGER, { initialize: false, where: 'free', quan: 2 });
    await addObjectToContainer(source, daggers);
    await addObjectToContainer(target, existing);
    source.owt = objectWeight(source);
    target.owt = objectWeight(target);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: source.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: target.invlet },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(source.contents?.length, 0);
    assert.equal(target.contents?.length, 1);
    assert.equal(existing.quan, 5);
    assert.equal(existing.container, target);
    assert.equal(source.owt, objectWeight(source));
    assert.equal(target.owt, objectWeight(target));
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /An object tumbles into the sack\./);
});
void test('tipping a bag of tricks empties all its charges in one turn', async (t) => {
    const level = freshObjectRoom();
    const bag = await addInventoryObject(BAG_OF_TRICKS, { cknown: false, spe: 2 });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: bag.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: '\n' },
        { prompt: /suddenly appears next to you!.*--More--/, keys: ' ' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.ok(level.monsters.length >= 2);
    assert.equal(bag.spe, 0);
    assert.equal(bag.cknown, true);
    assert.equal(game.context.move, 1);
});
void test('tipping a horn of plenty creates all its remaining food or drink inside the chosen sack', async (t) => {
    freshObjectRoom();
    const horn = await addInventoryObject(HORN_OF_PLENTY, { spe: 2, blessed: true });
    const target = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: horn.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: target.invlet },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(horn.spe, 0);
    assert.equal(horn.cknown, true);
    assert.ok((target.contents?.reduce((count, object) => count + object.quan, 0) ?? 0) >= 2);
    assert.ok(target.contents?.every(object => object.blessed && object.where === 'contained'));
    assert.equal(target.owt, objectWeight(target));
    assert.equal(game.inventory.length, 2);
    assert.equal(game.context.move, 1);
});
void test('a cancellation wand tipped into a bag of holding destroys the wand and the destination bag', async (t) => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const source = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const target = await addInventoryObject(BAG_OF_HOLDING, { initialize: false, cknown: true });
    const wand = await knownObject(WAN_CANCELLATION, { where: 'free', spe: 1 });
    await addObjectToContainer(source, wand);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: source.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
        { prompt: /Where to tip the contents of/, keys: target.invlet },
        { prompt: /An object tumbles into the bag of holding\.[\s\S]*--More--/, keys: ' ' },
        { prompt: /blasted by a magical[\s\S]*explosion!.*--More--/, keys: ' ' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(source.contents?.length, 0);
    assert.equal(wand.where, 'gone');
    assert.equal(target.where, 'gone');
    assert.equal(game.inventory.includes(target), false);
    assert.ok(game.u.uhp !== undefined && game.u.uhp < 100);
    assert.equal(game.context.move, 1);
});
void test('the tip command asks about a floor sack and spills it after confirmation', async (t) => {
    const level = freshObjectRoom();
    const sack = await floorObject(SACK, game.u.ux, game.u.uy, { initialize: false, cknown: false });
    const dagger = await knownObject(DAGGER, { initialize: false, where: 'free' });
    await addObjectToContainer(sack, dagger);
    const input = resetInputState();
    input.feed('tip\n');
    planInput(input, t, [
        { prompt: /There is .*sack here, tip it\?/, keys: 'y' },
        { prompt: /Where to tip the contents of/, keys: '\n' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game.context.move, 1);
    assert.equal(sack.cknown, true);
    assert.equal(sack.contents?.length, 0);
    assert.equal(level.objects[game.u.ux]?.[game.u.uy]?.includes(dagger), true);
});
void test('declining a floor sack continues to carried-object selection for tipping', async (t) => {
    freshObjectRoom();
    const floorSack = await floorObject(SACK, game.u.ux, game.u.uy, { initialize: false, cknown: false });
    const carried = await addInventoryObject(SACK, { initialize: false, cknown: false });
    const input = resetInputState();
    input.feed('tip\n');
    planInput(input, t, [
        { prompt: /There is .*sack here, tip it\?/, keys: 'n' },
        { prompt: /What do you want to tip\?/, keys: carried.invlet },
        { prompt: /Where to tip the contents of/, keys: '\n' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game.context.move, 1);
    assert.equal(carried.cknown, true);
    assert.equal(floorSack.cknown, false);
    assert.equal(game._pending_message, 'The sack is empty.');
});
void test('a tipped bag explosion credits the hero when scattered contents kill a monster', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const source = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const target = await addInventoryObject(BAG_OF_HOLDING, { initialize: false, cknown: true });
    const wand = await knownObject(WAN_CANCELLATION, { where: 'free', spe: 1 });
    const knife = await knownObject(CRYSKNIFE, { initialize: false, where: 'free', spe: 20 });
    await addObjectToContainer(source, wand);
    await addObjectToContainer(target, knife);
    const monsters = [];
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        if (dx === undefined || dy === undefined)
            throw new Error('The test monster needs a neighboring square');
        const monster = await createMonsterAt('newt', game.u.ux + dx, game.u.uy + dy);
        monster.mhp = 1;
        monsters.push(monster);
    }
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: source.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
    ]);
    initRng(1n);
    const tipping = rhack(0);
    await input.waitUntilBlocked();
    assert.match(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'), /Where to tip the contents of/);
    installPagerInput(input, { expected: /tumbles|explosion|hits|killed/, limit: 8 });
    input.feed(target.invlet);
    await tipping;
    assert.ok(monsters.some(monster => monster.dead));
    assert.match(game._pending_message, /crysknife hits/);
    assert.equal(knife.otyp, WORM_TOOTH);
    assert.equal(game.u.uconduct?.killer, 1);
    assert.equal(target.where, 'gone');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=inventory_tip.test.js.map