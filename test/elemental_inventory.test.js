import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { PIT } from '../js/const.js';
import { wearEyewear } from '../js/eyewear.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addTrap } from './support/level-state.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { flushPendingTopline } from '../js/display.js';
import { pushKeys } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { dodiscovered } from '../js/o_init.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { igniteItems } from '../js/light.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING, GLOB_OF_GREEN_SLIME, OBJECT_NAMES, POT_HEALING, POT_SPEED, RIN_PROTECTION, SCR_IDENTIFY, SPE_BOOK_OF_THE_DEAD, TALLOW_CANDLE, WAN_COLD, } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, } from '../js/zap.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('carried paper can burn while an exposed candle catches light', async () => {
    freshObjectRoom({ moves: 10, hero: { uhp: 20, uhpmax: 20 } });
    requireFixtureGame(game);
    const scroll = await addInventoryObject(SCR_IDENTIFY);
    const candle = await addInventoryObject(TALLOW_CANDLE, { age: 80 });
    pushKeys(' '.repeat(20));
    initRng(2n);
    const result = await destroyFireInventory(5);
    await igniteItems(game.inventory);
    assert.equal(result.heroDied, false);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.u.uhp, 19);
    assert.ok(candle.lamplit);
    assert.ok(objectTimers(candle).some(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT));
});
void test('cold shatters carried potions and immediately hurts the carrier', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 20 } });
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_HEALING, { quan: 2, quantity: 2 });
    pushKeys(' '.repeat(20));
    initRng(2n);
    const result = await destroyColdInventory(5);
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp < 20);
    assert.ok(potion.where === 'gone' || potion.quan < 2);
});
void test('electricity can recharge a worn ring and update its armor protection', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const ring = await addInventoryObject(RIN_PROTECTION, { spe: 0 });
    await wearHeroAccessory(ring, 'uleft');
    const armorClass = game.u.uac;
    pushKeys(' '.repeat(20));
    initRng(1n);
    const result = await destroyElectricInventory(5);
    assert.equal(result.heroDied, false);
    assert.equal(ring.spe, 1);
    assert.equal(game.uleft, ring);
    assert.equal(game.u.uac, armorClass - 1);
});
for (const lifesaving of [false, true]) {
    void test(`an electrically overcharged ring ${lifesaving ? 'allows life saving' : 'kills immediately'} despite shock resistance`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 40, shockResistance: true } });
        requireFixtureGame(game);
        const ring = await addInventoryObject(RIN_PROTECTION, { spe: 8 });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await destroyElectricInventory(5);
        assert.equal(result.heroDied, !lifesaving);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(ring.where, 'gone');
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
        else
            assert.equal(game._deathKiller, 'exploding ring');
    });
}
for (const unchanging of [false, true]) {
    void test(`an exploding ring ${unchanging ? 'kills an unchanging iron golem' : 'restores a depleted iron golem to human form'}`, async () => {
        freshObjectRoom({ hero: { uhp: 40, uhpmax: 40 } });
        requireFixtureGame(game);
        installPolymorphedHero('iron golem', { hitPoints: 1, maxHitPoints: 80 });
        const ring = await addInventoryObject(RIN_PROTECTION, { spe: 8 });
        if (unchanging)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
        assert.ok(game.u.shockResistance, 'the actual form grants electrical resistance');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await destroyElectricInventory(5);
        assert.equal(result.heroDied, unchanging);
        assert.equal(ring.where, 'gone');
        if (unchanging)
            assert.equal(game._deathKiller, 'killed while stuck in creature form');
        else {
            assert.equal(game.u.umonnum, game.u.umonster);
            assert.equal(game.u.uhp, 40);
        }
    });
}
for (const lifesaving of [false, true]) {
    void test(`a shattered stack ${lifesaving ? 'resumes destruction of the next selected stack after life saving' : 'stops destruction of the next selected stack on death'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 40 } });
        requireFixtureGame(game);
        const first = await addInventoryObject(POT_HEALING, { quan: 40, quantity: 40 });
        const next = await addInventoryObject(POT_SPEED, { quan: 40, quantity: 40 });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await destroyColdInventory(10);
        assert.ok(first.quan < 40);
        assert.equal(result.heroDied, !lifesaving);
        if (lifesaving) {
            assert.ok(next.quan < 40, 'the second stack is eligible and is really damaged');
            assert.ok(game.u.uhp > 0);
        }
        else {
            assert.equal(next.quan, 40);
            assert.equal(game._deathKiller, 'shattered potions');
        }
    });
}
for (const artifactName of ['Frost Brand', 'Fire Brand', 'The Mitre of Holiness']) {
    void test(`${artifactName} protects carried potions from elemental destruction`, async () => {
        freshObjectRoom({ role: 'priest', hero: { ualign: { type: 1, record: 10 } } });
        const artifact = artifactByName(artifactName);
        assert.ok(artifact !== null && artifact !== undefined);
        const item = await addInventoryObject(artifact.baseType);
        nameArtifact(item, artifact);
        if (artifactName !== 'The Mitre of Holiness')
            await setPrimaryWeapon(item);
        const potion = await addInventoryObject(POT_HEALING, { quan: 40, quantity: 40 });
        pushKeys(' '.repeat(100));
        initRng(2n);
        const destroy = artifactName === 'Frost Brand' ? destroyColdInventory : destroyFireInventory;
        await destroy(5);
        assert.equal(potion.quan, 40);
    });
}
void test('intrinsic cold resistance does not protect carried potions like a wielded Frost Brand', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    grantIntrinsicProperty('coldResistance', 'outside');
    const artifact = artifactByName('Frost Brand');
    assert.ok(artifact !== null && artifact !== undefined);
    const sword = await addInventoryObject(artifact.baseType);
    nameArtifact(sword, artifact);
    const potion = await addInventoryObject(POT_HEALING, { quan: 40, quantity: 40 });
    pushKeys(' '.repeat(100));
    initRng(2n);
    await destroyColdInventory(5);
    assert.ok(potion.quan < 40, 'neither intrinsic resistance nor the unwielded sword shields this stack');
    assert.ok(game.u.uhp < 40, 'shattered potions hurt even a cold-resistant hero');
});
void test('a burning green-slime glob boils and explodes', async () => {
    freshObjectRoom();
    const glob = await addInventoryObject(GLOB_OF_GREEN_SLIME);
    const messages = [];
    initRng(2n);
    await destroyFireInventory(5, { publish: async (message) => messages.push(message) });
    assert.equal(glob.where, 'gone');
    assert.ok(messages.some(message => /glob of green slime boils and explodes!/.test(message)));
});
for (const eyesWorn of [false, true]) {
    void test(`the Book glow ${eyesWorn ? 'is visible through the Eyes of the Overworld' : 'is hidden by blindness'}`, async () => {
        freshObjectRoom({ role: 'monk' });
        requireFixtureGame(game);
        const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD);
        setHeroBlindnessTurns(20);
        pushKeys(' '.repeat(100));
        if (eyesWorn) {
            const artifact = artifactByName('The Eyes of the Overworld');
            assert.ok(artifact !== null && artifact !== undefined);
            const eyes = await addInventoryObject(artifact.baseType);
            nameArtifact(eyes, artifact);
            await wearEyewear(eyes);
        }
        const messages = [];
        initRng(2n);
        await destroyFireInventory(5, { publish: async (message) => messages.push(message) });
        assert.equal(book.where, 'inventory');
        assert.equal(game.u.blindTurns, 20);
        assert.equal(messages.some(message => /glows a strange dark red/.test(message)), eyesWorn);
    });
}
for (const lifesaving of [false, true]) {
    void test(`ordinary items are destroyed before losing levitation ${lifesaving ? 'and life saving lets the ring finish crumbling' : 'causes a fatal fall'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 40, shockResistance: true } });
        requireFixtureGame(game);
        const ring = await addInventoryObject(OBJECT_NAMES.indexOf('levitation'));
        await wearHeroAccessory(ring, 'uleft');
        pushKeys(' ');
        await flushPendingTopline();
        const wand = await addInventoryObject(WAN_COLD);
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(5n);
        const result = await destroyElectricInventory(10);
        assert.equal(wand.where, 'gone', 'the nondeferred wand is destroyed before the fall');
        assert.equal(result.heroDied, !lifesaving);
        assert.equal(game.uleft, null);
        if (lifesaving) {
            assert.equal(ring.where, 'gone');
            assert.ok(game.u.uhp > 0);
        }
        else {
            assert.equal(ring.where, 'inventory', 'death interrupts Ring_gone before useup');
        }
    });
}
void test('hallucination changes the Book glow color without damaging the Book', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD);
    const messages = [];
    initRng(2n);
    await destroyFireInventory(5, { publish: async (message) => messages.push(message) });
    assert.equal(book.where, 'inventory');
    assert.ok(messages.some(message => /glows a strange (?!dark red)[^,]+, but remains intact/.test(message)));
});
for (const artifactName of ['Fire Brand', 'The Mitre of Holiness']) {
    void test(`${artifactName} still resists burning-paper damage when inventory protection fails`, async () => {
        freshObjectRoom({ role: 'priest', hero: { ualign: { type: 1, record: 10 } } });
        requireFixtureGame(game);
        const artifact = artifactByName(artifactName);
        assert.ok(artifact !== null && artifact !== undefined);
        const item = await addInventoryObject(artifact.baseType);
        nameArtifact(item, artifact);
        if (artifactName === 'Fire Brand')
            await setPrimaryWeapon(item);
        const scroll = await addInventoryObject(SCR_IDENTIFY);
        pushKeys(' '.repeat(100));
        initRng(679n);
        await destroyFireInventory(5);
        assert.equal(scroll.where, 'gone', 'the 99% inventory protection has actually failed');
        assert.equal(game.u.uhp, 40, 'artifact fire resistance still prevents secondary paper damage');
    });
}
for (const sight of ['sighted', 'blind', 'hallucinating']) {
    void test(`destruction of a previously unseen stack ${sight === 'sighted' ? 'reveals its appearance' : `does not reveal its appearance while ${sight}`}`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        setHeroBlindnessTurns(20);
        const potion = await addInventoryObject(POT_HEALING, {
            quan: 40, quantity: 40, dknown: false, known: false,
            typeKnown: false, observed: false,
        });
        recordObjectCall(POT_HEALING, 'nectar');
        if (sight !== 'blind')
            setHeroBlindnessTurns(0);
        if (sight === 'hallucinating')
            game.u.hallucinationTurns = 20;
        const messages = [];
        initRng(1n);
        await destroyColdInventory(5, { publish: async (message) => messages.push(message) });
        assert.ok(potion.quan > 0 && potion.quan < 40);
        assert.ok(messages[0]);
        assert.equal(messages[0].includes('called nectar'), sight === 'sighted');
        assert.ok(!messages[0].includes('healing'), 'an appearance is not a type identification');
        game.u.hallucinationTurns = 0;
        setHeroBlindnessTurns(20);
        assert.equal(inventoryItemDescription(potion).includes('called nectar'), sight === 'sighted', 'the surviving copy remembers an appearance only if it could really be seen');
    });
}
for (const sight of ['sighted', 'blind', 'hallucinating']) {
    void test(`a fully destroyed unseen potion ${sight === 'sighted' ? 'leaves its appearance in discoveries' : `does not reveal its appearance while ${sight}`}`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        setHeroBlindnessTurns(20);
        const potion = await addInventoryObject(POT_HEALING, {
            dknown: false, known: false, typeKnown: false, observed: false,
        });
        if (sight !== 'blind')
            setHeroBlindnessTurns(0);
        if (sight === 'hallucinating')
            game.u.hallucinationTurns = 20;
        initRng(1n);
        await destroyColdInventory(5, { publish: async () => { } });
        assert.ok(!game.inventory.includes(potion));
        const showing = dodiscovered();
        const text = requireGameDisplay(game).grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        pushKeys('\x1b');
        await showing;
        assert.ok(game.objectDescriptions !== null && game.objectDescriptions !== undefined);
        const appearance = game.objectDescriptions[POT_HEALING];
        assert.equal(text.includes(`potion (${appearance})`), sight === 'sighted');
    });
}
//# sourceMappingURL=elemental_inventory.test.js.map