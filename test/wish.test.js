import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { identifyPack, inventoryItemDescription } from '../js/invent.js';
import { AMULET_OF_YENDOR, BELL, FAKE_AMULET_OF_YENDOR, OIL_LAMP, ROCK, SPE_BLANK_PAPER, TALLOW_CANDLE, WAX_CANDLE, } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { makeWish } from '../js/wish.js';
import { freshObjectRoom } from './support/object-room.js';
async function wishObject(...args) {
    const result = await readObjectName(...args);
    assert.ok(result && !result.noWish, `Expected an object from wish: ${args[0]}`);
    return result.object;
}
for (const request of ['rock', '1 rock']) {
    void test(`wishing for "${request}" gives one rock instead of a generated stack`, async () => {
        freshObjectRoom({ gameplaySeed: 6101 });
        requirePlayingGame(game);
        const object = await wishObject(request);
        assert.equal(object.quan, 1);
        assert.equal(object.owt, 10);
    });
}
for (const wizardWish of [false, true]) {
    void test(`${wizardWish ? 'wizard' : 'ordinary'} wishes cannot stack long swords`, async () => {
        freshObjectRoom({ gameplaySeed: 6102 });
        requirePlayingGame(game);
        const object = await wishObject('3 long swords', { wizardWish });
        assert.equal(object.quan, 1);
    });
}
for (const [request, count] of [['20 arrows', 20], ['7 wax candles', 7]]) {
    void test(`an ordinary wish can supply ${request}`, async () => {
        freshObjectRoom({ gameplaySeed: 6103 });
        requirePlayingGame(game);
        const object = await wishObject(request);
        assert.equal(object.quan, count);
    });
}
for (const [request, count] of [
    ['0 3 arrows', 3],
    ['0 0 blessed 3 arrows', 3],
    ['0 arrows', 2],
    ['0 arrow', 1],
]) {
    void test(`a zero prefix leaves the wish count unset in "${request}"`, async () => {
        freshObjectRoom();
        const object = await wishObject(request);
        assert.equal(object.quan, count);
    });
}
void test('an excessive ammunition wish keeps the normal generated stack', async () => {
    freshObjectRoom({ gameplaySeed: 6104 });
    requirePlayingGame(game);
    const object = await wishObject('1000 arrows');
    assert.ok(object.quan >= 6 && object.quan <= 11, `received ${object.quan} arrows`);
});
void test('wizard wishes can supply large ammunition stacks', async () => {
    freshObjectRoom({ gameplaySeed: 6104 });
    requirePlayingGame(game);
    const object = await wishObject('1000 arrows', { wizardWish: true });
    assert.equal(object.quan, 1000);
    assert.equal(object.owt, 1000);
});
for (const [wizardWish, amount, weight] of [[false, 5000, 50], [true, 10000, 100]]) {
    void test(`${wizardWish ? 'wizard' : 'ordinary'} gold wishes use the appropriate limit`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const object = await wishObject('10000 gold pieces', { wizardWish });
        assert.equal(object.quan, amount);
        assert.equal(object.owt, weight);
    });
}
void test('a count of globs increases one glob\'s weight instead of its stack size', async () => {
    freshObjectRoom({ gameplaySeed: 6105 });
    requirePlayingGame(game);
    const result = await readObjectName('2 medium globs of gray ooze');
    assert.ok(result, 'the named glob was not recognized');
    assert.ok(!result.noWish);
    assert.equal(result.object.quan, 1);
    assert.equal(result.object.owt, 240);
});
void test('an ordinary glob wish respects the limit for very large globs', async () => {
    freshObjectRoom({ gameplaySeed: 6106 });
    requirePlayingGame(game);
    const result = await readObjectName('10 very large gray ooze globs');
    assert.ok(result, 'the inverted glob name was not recognized');
    assert.ok(!result.noWish);
    assert.equal(result.object.quan, 1);
    assert.equal(result.object.owt, 1040);
});
for (const [answer, weight] of [['y', 5200], ['n', 1040]]) {
    void test(`a wizard can ${answer === 'y' ? 'override' : 'keep'} the glob weight limit`, async () => {
        freshObjectRoom({ gameplaySeed: 6107 });
        requirePlayingGame(game);
        pushKey(answer);
        const result = await readObjectName('10 very large globs of gray ooze', {
            wizardWish: true,
        });
        assert.ok(result, 'the named glob was not recognized');
        assert.ok(!result.noWish);
        assert.equal(result.object.quan, 1);
        assert.equal(result.object.owt, weight);
    });
}
void test('a wish grants the requested single rock to the hero', async () => {
    freshObjectRoom({ gameplaySeed: 6108 });
    requirePlayingGame(game);
    pushKeys('1 rock\n');
    await makeWish();
    const rocks = game.inventory.filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.ok(rocks[0] != null);
    assert.equal(rocks[0].quan, 1);
});
for (const [request, replacement] of [
    ['Amulet of Yendor', FAKE_AMULET_OF_YENDOR],
    ['Bell of Opening', BELL],
    ['Book of the Dead', SPE_BLANK_PAPER],
    ['magic lamp', OIL_LAMP],
]) {
    void test(`an ordinary wish for ${request} supplies its permitted replacement`, async () => {
        freshObjectRoom({ gameplaySeed: 6201 });
        requirePlayingGame(game);
        const result = await readObjectName(request);
        assert.ok(result, 'the requested item was not recognized');
        assert.ok(!result.noWish);
        assert.equal(result.object.otyp, replacement);
    });
}
void test('wishing for the invocation candelabrum gives ordinary candles', async () => {
    freshObjectRoom({ gameplaySeed: 6202 });
    requirePlayingGame(game);
    const object = await wishObject('Candelabrum of Invocation');
    assert.ok([TALLOW_CANDLE, WAX_CANDLE].includes(object.otyp));
});
void test('wizard wishes can create the real Amulet of Yendor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await wishObject('Amulet of Yendor', { wizardWish: true });
    assert.equal(object.otyp, AMULET_OF_YENDOR);
});
void test('an ordinary wish cannot create venom', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const result = await readObjectName('splash of acid venom');
    assert.equal(result, null);
});
for (const [wizardWish, enchantment] of [[false, 0], [true, 99]]) {
    void test(`${wizardWish ? 'wizard' : 'ordinary'} enchantment wishes respect their limit`, async () => {
        freshObjectRoom({ gameplaySeed: 6203 });
        requirePlayingGame(game);
        const object = await wishObject('+999 long sword', { wizardWish });
        assert.equal(object.spe, enchantment);
    });
}
void test('a negative enchantment request curses the wished weapon', async () => {
    freshObjectRoom({ gameplaySeed: 6204 });
    requirePlayingGame(game);
    const object = await wishObject('-2 long sword');
    assert.equal(object.cursed, true);
    assert.ok(object.spe <= 0 && object.spe >= -2);
});
void test('ordinary wand wishes cannot increase their generated charge count', async () => {
    freshObjectRoom({ gameplaySeed: 6205 });
    requirePlayingGame(game);
    const object = await wishObject('wand of light (0:99)');
    assert.ok(object.spe >= 11 && object.spe <= 15, `received ${object.spe} charges`);
});
void test('a negative wand charge request stops at the cancelled state', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await wishObject('-10 wand of light');
    assert.equal(object.spe, -1);
});
void test('an ordinary wished wand of wishing cannot supply fresh wishes', async () => {
    freshObjectRoom({ gameplaySeed: 6206 });
    requirePlayingGame(game);
    const object = await wishObject('wand of wishing (0:99)');
    assert.ok(object.spe === 0 || object.spe === -1);
    assert.equal(object.recharged, 1);
});
void test('wizard wand charge and recharge requests still have storage limits', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await wishObject('wand of light (20:999)', { wizardWish: true });
    assert.equal(object.spe, 99);
    assert.equal(object.recharged, 7);
});
void test('identifying a wished wand reveals its real recharge count', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    pushKeys('wand of light (2:7)\n');
    await makeWish();
    await identifyPack(0);
    const firstWishedObject = game.inventory[0];
    assert.ok(firstWishedObject);
    assert.match(inventoryItemDescription(firstWishedObject), /\(2:7\)/);
});
void test('a chest cannot receive a weapon enchantment', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await wishObject('+5 chest');
    assert.equal(object.spe, 0);
});
for (const modifier of ['blessed', 'uncursed']) {
    void test(`bad luck from carried items spoils requests for ${modifier} items`, async () => {
        freshObjectRoom({ hero: { uluck: 1, moreluck: -3 } });
        requirePlayingGame(game);
        const object = await wishObject(`${modifier} potion of healing`);
        assert.equal(object.blessed, false);
        assert.equal(object.cursed, true);
    });
}
void test('bad luck prevents an ordinary wish from making a weapon rustproof', async () => {
    freshObjectRoom({ hero: { uluck: -1 } });
    requirePlayingGame(game);
    const object = await wishObject('rustproof long sword');
    assert.equal(!!object.oerodeproof, false);
});
void test('wizard wishes can bless and rustproof an item despite bad luck', async () => {
    freshObjectRoom({ hero: { uluck: -1 } });
    requirePlayingGame(game);
    const object = await wishObject('blessed rustproof long sword', { wizardWish: true });
    assert.equal(object.blessed, true);
    assert.equal(object.cursed, false);
    assert.equal(object.oerodeproof, true);
});
void test('a denied quest-artifact wish does not prevent its later creation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const denied = await readObjectName('The Orb of Detection');
    const granted = await readObjectName('The Orb of Detection', { wizardWish: true });
    assert.ok(denied != null, 'Expected denied to be initialized');
    assert.equal(denied.noWish, true);
    assert.ok(granted);
    assert.ok(!granted.noWish);
    assert.ok(granted.object.oartifact);
});
void test('even wizard wishes cannot create an artifact stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await wishObject('9 Grimtooth', { wizardWish: true });
    assert.equal(object.quan, 1);
    assert.ok(object.oartifact);
});
//# sourceMappingURL=wish.test.js.map