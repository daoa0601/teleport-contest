import { rhack } from '../js/cmd.js';
import type { InventoryObjectOverrides } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import {
    A_STR, BEAR_TRAP, M_AP_F_DKNOWN, M_AP_OBJECT, M_SEEN_COLD, M_SEEN_FIRE,
    M_SEEN_MAGR, TIMEOUT, TT_BEARTRAP, Upolyd,
} from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { zapHeroWithObject } from '../js/hero_self_zap.js';
import { heroHasRemovableSpeed, speedUpHero } from '../js/hero_speed.js';
import { heroStatusLine } from '../js/hero_status.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_LEVEL, MONSTER_NAME } from '../js/monster_data.js';
import {
    AMULET_OF_UNCHANGING, CHEST, DIAMOND, MEATBALL, OBJECT_NAMES, POT_FRUIT_JUICE,
    POT_SICKNESS, ROCK, SPE_EXTRA_HEALING, SPE_HEALING, SPE_STONE_TO_FLESH,
    SPEED_BOOTS, WAN_CANCELLATION, WAN_COLD, WAN_FIRE, WAN_LIGHTNING,
    WAN_MAGIC_MISSILE, WAN_OPENING, WAN_PROBING, WAN_SLEEP, WAN_SLOW_MONSTER,
    WAN_SPEED_MONSTER, WAN_STRIKING,
} from '../js/object_data.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, propertyTimeout, setPropertyTimeout } from '../js/properties.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { heroIsBlind } from '../js/senses.js';
import { makeBlinded } from '../js/sight_change.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject, unopenedCatBox } from './support/game-objects.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function room() {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    pushKeys(' '.repeat(200));
}

async function carryWand(type: number, { charges = 3, ...overrides }: InventoryObjectOverrides & { charges?: number } = {}) {
    return addInventoryObject(type, { initialize: false, spe: charges, ...overrides });
}

async function wieldArtifact(name: string) {
    const artifact = artifactByName(name);
    assert.ok(artifact !== null && artifact !== undefined);
    const weapon = await addInventoryObject(artifact.baseType);
    nameArtifact(weapon, artifact);
    await setPrimaryWeapon(weapon);
    return weapon;
}

for (const type of [WAN_STRIKING, WAN_MAGIC_MISSILE] as const) {
    void test(`Magicbane prevents direct self-damage from ${OBJECT_NAMES[type]}`, async () => {
        room();
        requireFixtureGame(game);
        await wieldArtifact('Magicbane');
        const watcher = await createMonsterAt('jackal', 12, 10);
        const result = await zapHeroWithObject(await carryWand(type));
        assert.equal(result.damage, 0);
        assert.equal(game.u.uhp, 200);
        assert.ok(watcher.seen_resistance != null);
        assert.ok(watcher.seen_resistance & M_SEEN_MAGR);
    });
}

for (const [artifact, type, memory] of [
    ['Fire Brand', WAN_FIRE, M_SEEN_FIRE],
    ['Frost Brand', WAN_COLD, M_SEEN_COLD],
] as const) {
    void test(`${artifact} protects from the matching elemental self-zap`, async () => {
        room();
        requireFixtureGame(game);
        await wieldArtifact(artifact);
        const watcher = await createMonsterAt('jackal', 12, 10);
        const result = await zapHeroWithObject(await carryWand(type));
        assert.equal(result.damage, 0);
        assert.equal(game.u.uhp, 200);
        assert.ok(watcher.seen_resistance != null);
        assert.ok(watcher.seen_resistance & memory);
    });
}

void test('an unresisted strike returns damage for the caller without applying it twice', async () => {
    room();
    requireFixtureGame(game);
    const result = await zapHeroWithObject(await carryWand(WAN_STRIKING));
    assert.ok(result.damage >= 2 && result.damage <= 24);
    assert.equal(game.u.uhp, 200);
    assert.equal(result.heroDied, false);
});

void test('shock resistance prevents damage but does not prevent the lightning flash', async () => {
    room();
    requireFixtureGame(game);
    grantIntrinsicProperty('shockResistance', 'outside');
    const result = await zapHeroWithObject(await carryWand(WAN_LIGHTNING));
    assert.equal(result.damage, 0);
    assert.equal(game.u.uhp, 200);
    assert.ok(heroIsBlind());
});

void test('a resisted fire self-zap repairs the hero iron-golem body', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('iron golem', { hitPoints: 5, maxHitPoints: 100 });
    const result = await zapHeroWithObject(await carryWand(WAN_FIRE));
    assert.equal(result.damage, 0);
    assert.ok(game.u.mh > 5);
    assert.ok(game.u.mh <= 100);
});

void test('sleeping yourself ends an occupation and installs real helplessness', async () => {
    room();
    requireFixtureGame(game);
    resetInputState().feed('4s');
    await rhack(0);
    assert.equal(game._occupation?.key, 'command');
    const result = await zapHeroWithObject(await carryWand(WAN_SLEEP));
    assert.equal(result.damage, 0);
    assert.equal(game._occupation, null);
    assert.ok((game._helplessTurns ?? 0) >= 1 && (game._helplessTurns ?? 0) <= 50);
    assert.equal(game._helplessReason, 'sleeping');
    assert.ok(game.u.usleep);
});

void test('sleep resistance leaves the hero awake', async () => {
    room();
    requireFixtureGame(game);
    grantIntrinsicProperty('sleepResistance', 'outside');
    await zapHeroWithObject(await carryWand(WAN_SLEEP));
    assert.ok(!((game._helplessTurns ?? 0) > 0));
    assert.ok(!game.u.usleep);
});

void test('self-cancellation removes a worn ring bonus and neutralizes carried objects', async () => {
    room();
    requireFixtureGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 3 });
    await wearHeroAccessory(ring, 'uleft');
    assert.ok(game.u.abon);
    const bonus = game.u.abon.a[A_STR];
    const potion = await addInventoryObject(POT_SICKNESS, { cursed: true });
    const wand = await carryWand(WAN_CANCELLATION, { charges: 4, cursed: true });
    await zapHeroWithObject(wand);
    assert.equal(ring.spe, 0);
    assert.ok(game.u.abon != null);
    assert.equal(game.u.abon.a[A_STR], bonus - 3);
    assert.equal(potion.otyp, POT_FRUIT_JUICE);
    assert.equal(potion.cursed, false);
    assert.equal(wand.spe, 4);
});

void test('self-cancellation returns a changed hero to the original body', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('wolf');
    await zapHeroWithObject(await carryWand(WAN_CANCELLATION));
    assert.ok(!Upolyd(game.u));
});

void test('Unchanging keeps a living changed body through self-cancellation', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('wolf');
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
    await zapHeroWithObject(await carryWand(WAN_CANCELLATION));
    assert.ok(Upolyd(game.u));
    assert.equal(MONSTER_NAME[game.u.umonnum], 'wolf');
});

void test('plain healing restores the current body without curing unblessed blindness', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('wolf', { hitPoints: 1, maxHitPoints: 40 });
    await makeBlinded(20);
    game.u.uhp = 100;
    await zapHeroWithObject(await knownObject(SPE_HEALING, { blessed: false }));
    assert.ok(game.u.mh > 1);
    assert.equal(game.u.uhp, 100);
    assert.ok(heroIsBlind());
});

void test('extra healing clears sticky blindness while keeping its maximum HP', async () => {
    room();
    requireFixtureGame(game);
    game.u.uhp = 195;
    game.u.ucreamed = 10;
    await makeBlinded(10);
    await zapHeroWithObject(await knownObject(SPE_EXTRA_HEALING));
    assert.equal(game.u.uhp, 200);
    assert.equal(game.u.uhpmax, 200);
    assert.equal(game.u.ucreamed, 0);
    assert.ok(!heroIsBlind());
});

void test('self stone-to-flesh transforms a stone body and respects item bypasses', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('stone golem');
    const diamond = await addInventoryObject(DIAMOND, { bypass: true });
    game.context.bypasses = true;
    await zapHeroWithObject(await knownObject(SPE_STONE_TO_FLESH));
    assert.equal(MONSTER_NAME[game.u.umonnum], 'flesh golem');
    assert.equal(diamond.otyp, DIAMOND);
    assert.ok(game.inventory.includes(diamond));
});

void test('self stone-to-flesh merges all newly transformed inventory stacks', async () => {
    room();
    requireFixtureGame(game);
    await addInventoryObject(ROCK, { quan: 2, oname: 'First' });
    await addInventoryObject(ROCK, { quan: 3, oname: 'Second' });
    await addInventoryObject(ROCK, { quan: 4, oname: 'Third' });
    await zapHeroWithObject(await knownObject(SPE_STONE_TO_FLESH));
    const meat = game.inventory.filter(object => object.otyp === MEATBALL);
    assert.equal(meat.length, 1);
    assert.equal(meat[0]?.quan, 9);
});

void test('self-opening releases a holding trap before reaching a carried locked box', async () => {
    room();
    requireFixtureGame(game);
    const box = await addInventoryObject(CHEST, { olocked: true });
    addTrap(game.level, BEAR_TRAP, game.u.ux, game.u.uy, { tseen: true });
    game.u.utrap = 5;
    game.u.utraptype = TT_BEARTRAP;
    await zapHeroWithObject(await carryWand(WAN_OPENING));
    assert.equal(game.u.utrap, 0);
    assert.equal(box.olocked, true);
    await zapHeroWithObject(await carryWand(WAN_OPENING));
    assert.equal(box.olocked, false);
});

void test('self-probing reveals carried container state without exposing nested contents', async () => {
    room();
    requireFixtureGame(game);
    const box = await unopenedCatBox({ where: 'inventory', dknown: false, lknown: false });
    const cat = box.contents?.[0];
    assert.ok(cat);
    cat.dknown = false;
    game.inventory.push(box);
    await zapHeroWithObject(await carryWand(WAN_PROBING));
    assert.equal(box.dknown, true);
    assert.equal(box.lknown, true);
    assert.equal(box.cknown, false);
    assert.ok(box.contents != null);
    assert.equal(cat.dknown, false);
});

void test('successive speed effects extend the timeout and saturate at its limit', async () => {
    room();
    requireFixtureGame(game);
    await zapHeroWithObject(await carryWand(WAN_SPEED_MONSTER));
    const first = game.u.veryFastTurns;
    assert.ok(first != null);
    assert.ok(first >= 50 && first <= 74);
    await speedUpHero(20);
    assert.equal(game.u.veryFastTurns, first + 20);
    await speedUpHero(TIMEOUT);
    assert.equal(game.u.veryFastTurns, TIMEOUT);
});

void test('zero-length speed magic does not leave permanent very-fast movement', async () => {
    room();
    requireFixtureGame(game);
    await speedUpHero(0);
    assert.equal(game.u.veryFastTurns, 0);
    assert.equal(game.u.veryFast, false);
    assert.equal(heroHasRemovableSpeed(), false);
});

void test('a self-speed zap retains its input boundary before granting the timeout', async () => {
    room();
    requireFixtureGame(game);
    const wand = await carryWand(WAN_SPEED_MONSTER);
    const input = resetInputState();
    await pline('A chill passes through the chamber as you examine the wand.');
    const action = zapHeroWithObject(wand);
    try {
        const paused = await Promise.race([
            input.waitUntilBlocked().then(() => true),
            action.then(() => false),
        ]);
        assert.equal(paused, true);
        assert.ok(!((game.u.veryFastTurns ?? 0) > 0));
    } finally {
        input.feed(' '.repeat(10));
        await action;
    }
    assert.ok((game.u.veryFastTurns ?? 0) >= 50);
});

void test('slowing removes intrinsic and timed speed while retaining worn speed boots', async () => {
    room();
    requireFixtureGame(game);
    grantIntrinsicProperty('fast', 'outside');
    await speedUpHero(25);
    const boots = await addInventoryObject(SPEED_BOOTS);
    wearHeroArmor(boots);
    await zapHeroWithObject(await carryWand(WAN_SLOW_MONSTER));
    assert.equal(game.u.veryFastTurns, 0);
    assert.equal(hasIntrinsicProperty('fast'), false);
    assert.equal(game.u.veryFast, true);
    assert.equal(heroHasRemovableSpeed(), false);
});

void test('slowing removes a fast timeout before refreshing the effective property', async () => {
    room();
    requireFixtureGame(game);
    setPropertyTimeout('fast', 20);
    assert.equal(heroHasRemovableSpeed(), true);
    await zapHeroWithObject(await carryWand(WAN_SLOW_MONSTER));
    assert.equal(propertyTimeout('fast'), 0);
    assert.equal(game.u.fast, false);
    assert.equal(heroHasRemovableSpeed(), false);
});

void test('self-probing uses the current form level and health', async () => {
    room();
    requireFixtureGame(game);
    installPolymorphedHero('wolf', { hitPoints: 13, maxHitPoints: 40 });
    const form = game.u.umonnum;
    assert.ok(heroStatusLine().includes(`Level ${MONSTER_LEVEL[form]}  HP 13(40)`));
});

void test('probe status distinguishes sticky-goop blindness from covered blindness', async () => {
    room();
    requireFixtureGame(game);
    game.u.ucreamed = 10;
    await makeBlinded(10);
    assert.match(heroStatusLine(), /blinded by sticky goop/);
    await makeBlinded(20);
    assert.match(heroStatusLine(), /blind, covered by sticky goop/);
});

void test('probe status masks appearance knowledge and omits mounted leg wounds', async () => {
    room();
    requireFixtureGame(game);
    game.u.m_ap_type = M_AP_F_DKNOWN;
    assert.doesNotMatch(heroStatusLine(), /disguised/);
    game.u.m_ap_type |= M_AP_OBJECT;
    assert.match(heroStatusLine(), /disguised/);
    game.u._woundedLegSide = 'both';
    game.u._woundedLegTurns = 10;
    assert.match(heroStatusLine(), /injured legs/);
    game.u.usteed = await createSaddledSteed();
    assert.doesNotMatch(heroStatusLine(), /injured/);
});

void test('probe status describes engulfment and omits the outside gas cloud', async () => {
    room();
    requireFixtureGame(game);
    const cloud = await createMonsterAt('fog cloud', 11, 10);
    installSwallowedHero(cloud);
    await createHarmlessGasCloudSelection(game, [{ x: game.u.ux, y: game.u.uy }], { ttl: 10 });
    const status = heroStatusLine();
    assert.match(status, /engulfed by the fog cloud/);
    assert.doesNotMatch(status, /in a cloud of vapor/);
});
