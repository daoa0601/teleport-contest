import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR, DOOR, D_CLOSED, MM_NOGRP, NO_MINVENT, STONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { useMonsterOffensiveItem } from '../js/monster_offensive_item.js';
import { BOULDER, EXPENSIVE_CAMERA, FROST_HORN, POT_CONFUSION, ROCK, SCR_EARTH, WAN_MAGIC_MISSILE, WAN_STRIKING, WAN_TELEPORTATION, } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { heroIsBlind } from '../js/senses.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function offensiveRoom() {
    freshObjectRoom({ left: 1, right: 30, top: 1, bottom: 19, role: 'barbarian',
        flags: { verbose: true }, hero: { uhp: 1000, uhpmax: 1000 } });
    requirePlayingGame(game);
    game.context.mon_moving = true;
    return game;
}
async function aimedOrc(x = 12, y = 10) {
    const orc = await createMonsterAt('orc', x, y, MM_NOGRP | NO_MINVENT);
    orc.mux = game.u.ux;
    orc.muy = game.u.uy;
    orc.mhp = orc.mhpmax = 200;
    return orc;
}
void test('the first attack-wand shot misses and trains the next charged shot', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    const wand = await knownObject(WAN_MAGIC_MISSILE, { spe: 2, typeKnown: false });
    await addObjectToMonsterInventory(orc, wand);
    const hp = state.u.uhp;
    const options = { state, random: () => 0, rollOne: () => 1,
        rollDice: (count, sides) => count * sides, publish: async () => { } };
    const first = await useMonsterOffensiveItem(orc, { kind: 'ray-wand', object: wand }, options);
    assert.equal(first.nativeResult, 2);
    assert.equal(state.u.uhp, hp);
    assert.equal(wand.spe, 1);
    assert.equal(orc.mwandexp, true);
    assert.equal(state._knownObjectTypes?.has(WAN_MAGIC_MISSILE), true);
    const second = await useMonsterOffensiveItem(orc, { kind: 'ray-wand', object: wand }, options);
    assert.equal(second.heroDied, false);
    assert.ok(state.u.uhp < hp);
    assert.equal(wand.spe, 0);
    assert.equal(wand.where, 'minvent');
});
void test('an experienced frost horn uses its rolled ray strength and spends one charge', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    orc.mwandexp = true;
    const horn = await knownObject(FROST_HORN, { spe: 2 });
    await addObjectToMonsterInventory(orc, horn);
    const hp = state.u.uhp;
    const result = await useMonsterOffensiveItem(orc, { kind: 'horn', object: horn }, {
        state, random: limit => limit - 1, rollOne: () => 1,
        rollDice: (count, sides) => count * sides, publish: async () => { },
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(state.u.uhp, hp - 66);
    assert.equal(horn.spe, 1);
});
void test('immediate striking also learns from its first missed shot', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    const wand = await knownObject(WAN_STRIKING, { spe: 2 });
    await addObjectToMonsterInventory(orc, wand);
    const hp = state.u.uhp;
    const options = { state, random: () => 0, rollOne: () => 1,
        rollDice: (count, sides) => count * sides, publish: async () => { } };
    await useMonsterOffensiveItem(orc, { kind: 'immediate-wand', object: wand }, options);
    assert.equal(state.u.uhp, hp);
    assert.equal(orc.mwandexp, true);
    await useMonsterOffensiveItem(orc, { kind: 'immediate-wand', object: wand }, options);
    assert.ok(state.u.uhp < hp);
    assert.equal(wand.spe, 0);
});
void test('teleporting at a remembered empty position spends a charge without learning attack-wand aim', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    orc.mux = 10;
    orc.muy = 8;
    const wand = await knownObject(WAN_TELEPORTATION, { spe: 2 });
    await addObjectToMonsterInventory(orc, wand);
    const result = await useMonsterOffensiveItem(orc, { kind: 'immediate-wand', object: wand }, {
        state, random: () => 0, publish: async () => { },
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(wand.spe, 1);
    assert.equal(!!orc.mwandexp, false);
    assert.equal(state.u.ux, 10);
    assert.equal(state.u.uy, 10);
});
for (const fatal of [false, true]) {
    void test(`a cursed attack wand ${fatal ? 'kills its user' : 'explodes without spending the ordinary attack'}`, async () => {
        const state = offensiveRoom();
        const orc = await aimedOrc();
        orc.mhp = fatal ? 1 : 200;
        const wand = await knownObject(WAN_MAGIC_MISSILE, { spe: 3, cursed: true });
        await addObjectToMonsterInventory(orc, wand);
        const hp = state.u.uhp;
        const result = await useMonsterOffensiveItem(orc, { kind: 'ray-wand', object: wand }, {
            state, random: () => 0, rollDice: (count, sides) => count * sides, publish: async () => { },
        });
        assert.equal(result.nativeResult, fatal ? 1 : 0);
        assert.equal(result.heroDied, false);
        assert.equal(wand.where, 'gone');
        assert.equal(state.u.uhp, hp);
        assert.equal(monsterAtPosition(state.level, orc.mx, orc.my) === orc, !fatal);
        if (!fatal)
            assert.equal(orc.mhp, 170);
        assert.equal(!!orc.mwandexp, false);
    });
}
void test('a thrown potion keeps its remaining stack and hits an intervening monster', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    const giant = await createMonsterAt('hill giant', 11, 10, MM_NOGRP | NO_MINVENT);
    giant.mhp = giant.mhpmax = 100;
    const potion = await knownObject(POT_CONFUSION, { quan: 2 });
    await addObjectToMonsterInventory(orc, potion);
    const hp = state.u.uhp;
    const messages = [];
    const result = await useMonsterOffensiveItem(orc, { kind: 'potion', object: potion }, {
        state, publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(state.u.uhp, hp);
    assert.equal(giant.mconf, 1);
    assert.equal(potion.quan, 1);
    assert.equal(potion.where, 'minvent');
    assert.equal(potion.carrierMid, orc.m_id);
    assert.ok(messages.includes('The orc hurls an uncursed potion of confusion!'));
});
for (const [label, blessed, cursed, count] of [
    ['ordinary', false, false, 9], ['blessed', true, false, 8], ['cursed', false, true, 1],
]) {
    void test(`a ${label} earth scroll drops its native pattern around the reader`, async () => {
        const state = offensiveRoom();
        const orc = await aimedOrc();
        const scroll = await knownObject(SCR_EARTH, { blessed, cursed, quan: 2 });
        await addObjectToMonsterInventory(orc, scroll);
        const hp = orc.mhp;
        const input = resetInputState();
        installPagerInput(input, { expected: /reads|rumbles|boulder|hit|killed/, limit: 12 });
        const result = await useMonsterOffensiveItem(orc, { kind: 'earth-scroll', object: scroll }, { state });
        assert.equal(result.nativeResult, 2);
        assert.equal(scroll.quan, 1);
        assert.equal(scroll.where, 'minvent');
        assert.equal(floorObjects(state.level).filter(object => object.otyp === BOULDER).length, count);
        assert.equal(floorObjectsAt(state.level, 12, 10).some(object => object.otyp === BOULDER), !blessed);
        if (blessed)
            assert.equal(orc.mhp, hp);
        else
            assert.ok(orc.mhp < hp);
    });
}
void test('a confused earth reader drops rock stacks instead of boulders', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    orc.mconf = 1;
    const scroll = await knownObject(SCR_EARTH, { blessed: true });
    await addObjectToMonsterInventory(orc, scroll);
    const input = resetInputState();
    installPagerInput(input, { expected: /reads|rumbles|confused|rocks|hit|mispronounc/, limit: 12 });
    await useMonsterOffensiveItem(orc, { kind: 'earth-scroll', object: scroll }, { state });
    const rocks = floorObjects(state.level).filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 8);
    assert.ok(rocks.every(object => object.quan >= 2 && object.quan <= 6));
    assert.equal(scroll.where, 'gone');
});
void test('a blessed earth scroll includes the adjacent hero while sparing its reader', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc(11, 10);
    const scroll = await knownObject(SCR_EARTH, { blessed: true });
    await addObjectToMonsterInventory(orc, scroll);
    const hp = state.u.uhp;
    const readerHp = orc.mhp;
    const input = resetInputState();
    installPagerInput(input, { expected: /reads|rumbles|boulder|hit/, limit: 12 });
    await useMonsterOffensiveItem(orc, { kind: 'earth-scroll', object: scroll }, { state });
    assert.ok(state.u.uhp < hp);
    assert.equal(orc.mhp, readerHp);
    assert.ok(floorObjectsAt(state.level, state.u.ux, state.u.uy).some(object => object.otyp === BOULDER));
    assert.equal(floorObjects(state.level).filter(object => object.otyp === BOULDER).length, 8);
});
void test('earth scrolls skip closed doors, solid terrain and air squares', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    for (const [x, y, type] of [[11, 9, DOOR], [11, 10, AIR], [11, 11, STONE]]) {
        const location = state.level.at(x, y);
        assert.ok(location);
        location.typ = type;
        if (type === DOOR)
            location.doormask = D_CLOSED;
    }
    vision_recalc(0);
    const scroll = await knownObject(SCR_EARTH);
    await addObjectToMonsterInventory(orc, scroll);
    const input = resetInputState();
    installPagerInput(input, { expected: /reads|rumbles|boulder|hit/, limit: 12 });
    await useMonsterOffensiveItem(orc, { kind: 'earth-scroll', object: scroll }, { state });
    for (const y of [9, 10, 11])
        assert.equal(floorObjectsAt(state.level, 11, y).length, 0);
    assert.equal(floorObjects(state.level).filter(object => object.otyp === BOULDER).length, 6);
});
void test('a reader killed by its own earth scroll cannot drop the consumed scroll', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    orc.mhp = 1;
    const scroll = await knownObject(SCR_EARTH, { cursed: true });
    await addObjectToMonsterInventory(orc, scroll);
    const experience = state.u.uexp;
    const input = resetInputState();
    installPagerInput(input, { expected: /reads|rumbles|boulder|hit|killed/, limit: 12 });
    const result = await useMonsterOffensiveItem(orc, { kind: 'earth-scroll', object: scroll }, { state });
    assert.equal(result.nativeResult, 1);
    assert.notEqual(monsterAtPosition(state.level, orc.mx, orc.my), orc);
    assert.equal(scroll.where, 'gone');
    assert.equal(floorObjects(state.level).includes(scroll), false);
    assert.equal(state.u.uexp, experience);
});
void test('camera charges and blindness wait for the actual picture message page', async () => {
    const state = offensiveRoom();
    const orc = await aimedOrc();
    const camera = await knownObject(EXPENSIVE_CAMERA, { spe: 3 });
    await addObjectToMonsterInventory(orc, camera);
    const input = resetInputState();
    const action = useMonsterOffensiveItem(orc, { kind: 'camera', object: camera }, { state, rollOne: () => 12 });
    await input.waitUntilBlocked();
    assert.equal(camera.spe, 3);
    assert.equal(heroIsBlind(state), false);
    const result = await answerPrompts(action, input, [
        { prompt: /The orc takes a picture of you with an expensive camera![\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen();
    assert.equal(result.nativeResult, 1);
    assert.ok(orc.mhp > 0);
    assert.equal(result.heroDied, false);
    assert.equal(camera.spe, 2);
    assert.equal(state.u.blindTurns, 12);
    assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '', /You are blinded by the flash of light!/);
});
void test('a camera still hurts a gremlin whose blindness resistance blocks the flash', async () => {
    const state = offensiveRoom();
    installPolymorphedHero('gremlin', { hitPoints: 100 });
    grantIntrinsicProperty('blindResistance', 'outside');
    const orc = await aimedOrc();
    const camera = await knownObject(EXPENSIVE_CAMERA, { spe: 2 });
    await addObjectToMonsterInventory(orc, camera);
    const result = await useMonsterOffensiveItem(orc, { kind: 'camera', object: camera }, { state, publish: async () => { } });
    assert.equal(result.nativeResult, 1);
    assert.equal(heroIsBlind(state), false);
    assert.ok(state.u.mh >= 95 && state.u.mh < 100);
    assert.equal(camera.spe, 1);
});
void test('a hallucinating blind hero still hears the photographers native cheese line', async () => {
    const state = offensiveRoom();
    await makeBlinded(10, { talk: false });
    await makeHallucinated(20, { talk: false });
    const orc = await aimedOrc();
    const camera = await knownObject(EXPENSIVE_CAMERA, { spe: 1 });
    await addObjectToMonsterInventory(orc, camera);
    const messages = [];
    await useMonsterOffensiveItem(orc, { kind: 'camera', object: camera }, {
        state, publish: async (message) => { messages.push(message); },
    });
    assert.deepEqual(messages, ['"Say cheese!"']);
    assert.equal(state.u.blindTurns, 10);
    assert.equal(camera.spe, 0);
});
//# sourceMappingURL=monster_offensive_item.test.js.map