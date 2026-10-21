import { installPagerInput } from './support/pager-input.js';
import { inventoryLetter } from './support/commands.js';
import { requireScreenCell } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { gainHeroStrength } from '../js/attrib.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { A_STR, TIMEOUT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { advanceCorpseResistanceTimeouts, corpseEnergyBuzz, grantCorpseIntrinsic, } from '../js/corpse_intrinsics.js';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, GAUNTLETS_OF_POWER } from '../js/object_data.js';
import { wearHeroArmor } from '../js/armor.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, refreshProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const species = (name) => MONSTER_NAME.indexOf(name);
function room({ seed = 41n, hero = {} } = {}) {
    freshObjectRoom({ gameplaySeed: seed, hero });
    requirePlayingGame(game);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /You no longer feel secure from petrification|But wait|The medallion crumbles|amulet of life saving|You feel |You be chillin|You are wielding|corpse|Corpse|You finish|You seem|You can no longer|You are slowing|You are beginning|You can see/,
        limit: 24,
    });
    return input;
}
for (const [dragon, property, message] of [
    ['red dragon', 'fireResistance', 'momentary chill'],
    ['white dragon', 'coldResistance', 'full of hot air'],
    ['orange dragon', 'sleepResistance', 'wide awake'],
    ['black dragon', 'disintegrationResistance', 'very firm'],
    ['blue dragon', 'shockResistance', 'health currently feels amplified'],
    ['green dragon', 'poisonResistance', 'feel healthy'],
]) {
    void test(`${dragon} flesh conveys lasting ${property}`, async () => {
        room();
        requirePlayingGame(game);
        await grantCorpseIntrinsic(species(dragon));
        assert.equal(game.u[property], true);
        assert.equal(hasIntrinsicProperty(property, 'outside'), true);
        assert.match(game._pending_message, new RegExp(message));
    });
}
void test('resisting fire does not mean that a baby dragon conveys that resistance', async () => {
    room();
    requirePlayingGame(game);
    await grantCorpseIntrinsic(species('baby red dragon'));
    assert.equal(!!game.u.fireResistance, false);
    assert.equal(game._pending_message || '', '');
});
void test('a corpse adds a permanent source despite existing resistance from the hero form', async () => {
    room();
    requirePlayingGame(game);
    grantIntrinsicProperty('poisonResistance', 'form');
    await grantCorpseIntrinsic(species('green dragon'));
    assert.equal(hasIntrinsicProperty('poisonResistance', 'outside'), true);
    assert.match(game._pending_message, /especially healthy/);
});
void test('a repeated permanent grant stays quiet', async () => {
    room();
    requirePlayingGame(game);
    grantIntrinsicProperty('fireResistance', 'outside');
    await grantCorpseIntrinsic(species('red dragon'));
    assert.equal(game._pending_message || '', '');
});
void test('a grant waits for its message before installing the permanent source', async () => {
    room();
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('An earlier message leaves very little room for the next sentence.');
    const granting = grantCorpseIntrinsic(species('red dragon'));
    try {
        await input.waitUntilBlocked();
        assert.equal(hasIntrinsicProperty('fireResistance', 'outside'), false);
    }
    finally {
        input.feed('    ');
        await granting;
    }
    assert.equal(game.u.fireResistance, true);
});
void test('floating-eye flesh reveals a living monster to a blind hero', async () => {
    room();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 14, 10);
    setHeroBlindnessTurns(20);
    await grantCorpseIntrinsic(species('floating eye'));
    await flush_screen(1);
    assert.equal(game.u.telepathy, true);
    assert.equal(requireScreenCell(monster.mx - 1, monster.my + 1).ch, 'd');
});
void test('a tengu offers poison resistance or one teleport ability, never two at once', async () => {
    const seen = new Set();
    for (let seed = 1; seed <= 24; seed++) {
        room({ seed: BigInt(seed) });
        requirePlayingGame(game);
        await grantCorpseIntrinsic(species('tengu'));
        const granted = ['poisonResistance', 'teleportation', 'teleportControl'].filter((property) => hasIntrinsicProperty(property, 'outside'));
        assert.ok(granted.length <= 1, `tengu granted ${granted.join(', ')}`);
        for (const property of granted)
            seen.add(property);
    }
    assert.equal(seen.size, 3);
});
void test('a hill giant can improve strength or grant nothing', async () => {
    let gains = 0, unchanged = 0;
    for (let seed = 1; seed <= 12; seed++) {
        room({ seed: BigInt(seed) });
        requirePlayingGame(game);
        const before = game.u.acurr.a[A_STR];
        await grantCorpseIntrinsic(species('hill giant'));
        const gain = game.u.acurr.a[A_STR] - before;
        assert.ok(gain >= 0 && gain <= 6);
        if (gain)
            gains++;
        else
            unchanged++;
    }
    assert.ok(gains > 0 && unchanged > 0);
});
void test('yellow-dragon flesh grants exactly one temporary resistance', async () => {
    room();
    requirePlayingGame(game);
    await grantCorpseIntrinsic(species('yellow dragon'));
    const granted = ['acidResistance', 'stoneResistance'].filter((property) => game.u[property]);
    assert.equal(granted.length, 1);
    const property = granted[0];
    assert.ok(property);
    const turns = game.u[`${property}Turns`];
    assert.ok(turns !== undefined);
    assert.ok(turns >= 3 && turns <= 18);
    assert.equal(hasIntrinsicProperty(property, 'outside'), false);
});
void test('temporary corpse resistance extends existing protection and saturates its timer', async () => {
    room();
    requirePlayingGame(game);
    for (const property of ['acidResistance', 'stoneResistance']) {
        game.u[`${property}Turns`] = TIMEOUT - 1;
        refreshProperty(property);
    }
    await grantCorpseIntrinsic(species('yellow dragon'));
    assert.equal(Math.max(game.u.acidResistanceTurns ?? 0, game.u.stoneResistanceTurns ?? 0), TIMEOUT);
    assert.equal(game._pending_message || '', '');
});
void test('depleted magical energy receives a small buzz without increasing its maximum', async () => {
    room({ hero: { uen: 0, uenmax: 12, uenpeak: 12 } });
    requirePlayingGame(game);
    await corpseEnergyBuzz();
    assert.ok(game.u.uen >= 1 && game.u.uen <= 3);
    assert.equal(game.u.uenmax, 12);
    assert.match(game._pending_message, /mild buzz/);
});
void test('a buzz can raise maximum energy by one but never exceeds it', async () => {
    let increased = 0, unchanged = 0;
    for (let seed = 1; seed <= 20; seed++) {
        room({ seed: BigInt(seed), hero: { uen: 12, uenmax: 12, uenpeak: 12 } });
        requirePlayingGame(game);
        await corpseEnergyBuzz();
        assert.equal(game.u.uen, game.u.uenmax);
        assert.equal(game.u.uenpeak, game.u.uenmax);
        if (game.u.uenmax === 13)
            increased++;
        else {
            assert.equal(game.u.uenmax, 12);
            unchanged++;
        }
    }
    assert.ok(increased > 0 && unchanged > 0);
});
void test('acid resistance expires while an independent permanent source survives', async () => {
    room({ hero: { acidResistanceTurns: 1, stoneResistanceTurns: 1 } });
    requirePlayingGame(game);
    refreshProperty('acidResistance');
    grantIntrinsicProperty('stoneResistance', 'outside');
    await advanceCorpseResistanceTimeouts();
    assert.equal(game.u.acidResistance, false);
    assert.equal(game.u.stoneResistance, true);
    assert.equal(game.u.stoneResistanceTurns, 0);
    assert.match(game._pending_message, /no longer feel safe from acid/);
    assert.doesNotMatch(game._pending_message, /petrification/);
});
for (const [flesh, property] of [
    ['ochre jelly', 'acidResistance'],
    ['cockatrice', 'stoneResistance'],
]) {
    void test(`${property} stays active throughout a dangerous meal and expires when it stops`, async () => {
        const input = room();
        requirePlayingGame(game);
        game.u[`${property}Turns`] = 1;
        refreshProperty(property);
        const corpse = await addInventoryObject(CORPSE, {
            corpsenm: species(flesh),
            age: game.moves,
        });
        input.feed(inventoryLetter(corpse));
        await rhack('e'.charCodeAt(0));
        assert.equal(game._occupation?.key, 'eat-food');
        await advanceCorpseResistanceTimeouts();
        assert.equal(game.u[property], true);
        assert.equal(game.u[`${property}Turns`], 1);
        await stopHeroOccupation();
        await advanceCorpseResistanceTimeouts();
        assert.equal(game.u[property], false);
        assert.equal(game.u[`${property}Turns`], 0);
    });
}
void test('sleeping through resistance expiry suppresses its warning', async () => {
    room({ hero: { acidResistanceTurns: 1 } });
    requirePlayingGame(game);
    refreshProperty('acidResistance');
    await putHeroToSleep(10);
    await advanceCorpseResistanceTimeouts();
    assert.equal(game.u.acidResistance, false);
    assert.equal(game._pending_message || '', '');
});
void test('prayer freezes corpse resistance through the ordinary turn loop', async () => {
    const input = room({ hero: { acidResistanceTurns: 3, invulnerable: true } });
    requirePlayingGame(game);
    refreshProperty('acidResistance');
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.context.move = 0;
    input.feed('..');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.acidResistanceTurns, 3);
});
void test('the ordinary turn loop expires corpse resistance', async () => {
    const input = room({ hero: { acidResistanceTurns: 1 } });
    requirePlayingGame(game);
    refreshProperty('acidResistance');
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.context.move = 0;
    input.feed('..');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.acidResistanceTurns, 0);
    assert.equal(game.u.acidResistance, false);
});
void test('stone resistance ending while wielding flesh uses life saving and releases the corpse', async () => {
    room({ hero: { stoneResistanceTurns: 1 } });
    requirePlayingGame(game);
    refreshProperty('stoneResistance');
    const corpse = await addInventoryObject(CORPSE, { corpsenm: species('cockatrice') });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    await setPrimaryWeapon(corpse);
    await flushPendingTopline();
    await advanceCorpseResistanceTimeouts();
    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.uwep, null);
    assert.ok(game.inventory.includes(corpse));
});
void test('gloves keep wielded petrifying flesh safe when temporary resistance ends', async () => {
    room({ hero: { stoneResistanceTurns: 1 } });
    requirePlayingGame(game);
    refreshProperty('stoneResistance');
    const corpse = await addInventoryObject(CORPSE, { corpsenm: species('cockatrice') });
    await setPrimaryWeapon(corpse);
    wearHeroArmor(await addInventoryObject(GAUNTLETS_OF_POWER));
    await advanceCorpseResistanceTimeouts();
    assert.equal(game.uwep, corpse);
    assert.equal(game.program_state.gameover || false, false);
    assert.equal(game.u.stoneResistance, false);
});
void test('strength gain stays quiet when gloves already fix effective strength', async () => {
    room();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(GAUNTLETS_OF_POWER));
    await flushPendingTopline();
    const before = game.u.acurr.a[A_STR];
    await gainHeroStrength(null, 1);
    assert.equal(game.u.acurr.a[A_STR], before + 1);
    assert.equal(game._pending_message || '', '');
});
void test('exceptional strength has larger random gains below 18/85 and single gains above it', async () => {
    room();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 18;
    await gainHeroStrength();
    assert.ok(game.u.acurr.a[A_STR] > 18 && game.u.acurr.a[A_STR] <= 28);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 103;
    await gainHeroStrength();
    assert.equal(game.u.acurr.a[A_STR], 104);
});
//# sourceMappingURL=corpse_intrinsics.test.js.map