import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { ALTAR, AM_SHRINE, Align2amask, D_CLOSED, DOOR, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, ROOM, ROOMOFFSET, STONE, TELEP_TRAP, TEMPLE, W_ARMH, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { selectMonsterOffensiveItem } from '../js/monster_offensive_selection.js';
import { addObjectToContainer } from '../js/object_container.js';
import { CORPSE, DUNCE_CAP, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, HELMET, LARGE_BOX, LEATHER_ARMOR, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_PARALYSIS, POT_SLEEPING, ROCK, SCR_EARTH, SCR_FIRE, SCR_SCARE_MONSTER, WAN_COLD, WAN_DEATH, WAN_FIRE, WAN_MAGIC_MISSILE, WAN_SLEEP, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, } from '../js/object_data.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { applyPotionEffect } from '../js/potion_effects.js';
import { dopray } from '../js/pray.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createRoom, createSpecialLevel } from './support/topology.js';
const MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
async function offensiveRoom({ species = 'orc', x = 14, y = 10 } = {}) {
    const level = freshObjectRoom({ left: 2, right: 35, top: 2, bottom: 18 });
    requirePlayingGame(game);
    const state = game;
    const monster = await createMonsterAt(species, x, y, MONSTER_FLAGS);
    monster.mux = state.u.ux;
    monster.muy = state.u.uy;
    const give = async (otyp, charges = 3) => {
        const object = await addObjectToMonsterInventory(monster, await knownObject(otyp, { initialize: false, spe: charges }), state, { atFront: false });
        assert.ok(object);
        return object;
    };
    const select = (random = (_limit) => 1) => selectMonsterOffensiveItem(monster, state, { random });
    return { monster, state, level, give, select };
}
void test('offensive selection returns the actual carried wand without spending its charge', async () => {
    const { give, select } = await offensiveRoom();
    const wand = await give(WAN_FIRE, 4);
    const choice = select();
    assert.ok(choice);
    assert.equal(choice.kind, 'ray-wand');
    assert.equal(choice.object, wand);
    assert.equal(wand.spe, 4);
    assert.equal(wand.where, 'minvent');
});
for (const species of ['ape', 'stone golem', 'red dragon']) {
    void test(`${species} cannot choose an offensive inventory item`, async () => {
        const { give, select } = await offensiveRoom({ species });
        await give(WAN_STRIKING);
        assert.equal(select(), null);
    });
}
void test('peaceful monsters do not select an offensive item', async () => {
    const { monster, give, select } = await offensiveRoom();
    await give(POT_CONFUSION);
    monster.mpeaceful = true;
    assert.equal(select(), null);
});
void test('monsters outside an engulfer do not target the swallowed hero', async () => {
    const { give, select } = await offensiveRoom();
    await give(WAN_STRIKING);
    await installSwallowedHero(await createMonsterAt('purple worm', 11, 10, MONSTER_FLAGS));
    assert.equal(select(), null);
});
void test('an unaligned remembered hero location blocks every offensive choice', async () => {
    const { monster, give, select } = await offensiveRoom();
    await give(WAN_STRIKING);
    monster.muy = 11;
    assert.equal(select(), null);
});
void test('a nurse leaves a naked unarmed hero alone but attacks after armor is worn', async () => {
    const { give, select, state } = await offensiveRoom({ species: 'nurse' });
    const wand = await give(WAN_STRIKING);
    assert.equal(select(), null);
    wearHeroArmor(await addInventoryObject(LEATHER_ARMOR), state);
    assert.equal(select()?.object, wand);
});
for (const deathFirst of [false, true]) {
    void test(`native selection keeps the death wand ahead of a paralysis potion when death is ${deathFirst ? 'first' : 'last'}`, async () => {
        const { give, select } = await offensiveRoom();
        if (!deathFirst)
            await give(POT_PARALYSIS);
        const death = await give(WAN_DEATH);
        if (deathFirst)
            await give(POT_PARALYSIS);
        assert.equal(select()?.object, death);
    });
}
void test('the first viable wand of the selected type retains its identity', async () => {
    const { give, select } = await offensiveRoom();
    await give(WAN_FIRE, 0);
    const firstCharged = await give(WAN_FIRE, 2);
    await give(WAN_FIRE, 5);
    assert.equal(select()?.object, firstCharged);
});
void test('known reflection suppresses rays and horns while permitting striking', async () => {
    const { monster, give, select } = await offensiveRoom();
    await give(WAN_DEATH);
    await give(FIRE_HORN);
    const striking = await give(WAN_STRIKING);
    monster.seen_resistance = M_SEEN_REFL;
    assert.equal(select()?.object, striking);
});
void test('adjacent monsters avoid reflecting attacks without needing resistance knowledge', async () => {
    const { give, select } = await offensiveRoom({ x: 11 });
    await give(WAN_FIRE);
    await give(FROST_HORN);
    const acid = await give(POT_ACID);
    assert.equal(select()?.object, acid);
});
void test('a monster uses what it has seen resisted, rather than knowing the hero properties', async () => {
    const { monster, state, give, select } = await offensiveRoom();
    state.u.fireResistance = true;
    const fire = await give(WAN_FIRE);
    const cold = await give(WAN_COLD);
    assert.equal(select()?.object, fire);
    monster.seen_resistance = M_SEEN_FIRE;
    assert.equal(select()?.object, cold);
    monster.seen_resistance |= M_SEEN_COLD;
    assert.equal(select(), null);
});
void test('observed antimagic rules out death, magic missile, and striking', async () => {
    const { monster, give, select } = await offensiveRoom();
    await give(WAN_DEATH);
    await give(WAN_MAGIC_MISSILE);
    await give(WAN_STRIKING);
    const confusion = await give(POT_CONFUSION);
    monster.seen_resistance = M_SEEN_MAGR;
    assert.equal(select()?.object, confusion);
});
void test('sleeping potions remain eligible during helplessness while sleep wands and paralysis do not', async () => {
    const { state, give, select } = await offensiveRoom();
    await give(WAN_SLEEP);
    await give(POT_PARALYSIS);
    const sleeping = await give(POT_SLEEPING);
    state.multi = -3;
    assert.equal(select()?.object, sleeping);
});
for (const delay of ['sleep', 'paralysis', 'prayer']) {
    void test(`an active ${delay} prevents another sleep wand or paralysis potion choice`, async () => {
        const { state, give, select } = await offensiveRoom();
        await give(WAN_SLEEP);
        await give(POT_PARALYSIS);
        installPagerInput(resetInputState(), {
            expected: /frozen|praying|shimmering/i, limit: 6,
        });
        if (delay === 'sleep')
            putHeroToSleep(3, { state });
        else if (delay === 'paralysis')
            await applyPotionEffect(await knownObject(POT_PARALYSIS), { state });
        else {
            state.flags.paranoia_bits = 0;
            state.flags.debug = false;
            state.u.ublesscnt = 0;
            state.u.ualign.record = 10;
            await dopray();
        }
        assert.equal(select(), null);
        const sleeping = await give(POT_SLEEPING);
        assert.equal(select()?.object, sleeping, 'native sleeping potions remain eligible during a delay');
    });
}
void test('observed sleep and acid resistance reject the corresponding thrown potions', async () => {
    const { monster, give, select } = await offensiveRoom();
    await give(POT_SLEEPING);
    const acid = await give(POT_ACID);
    monster.seen_resistance = M_SEEN_SLEEP;
    assert.equal(select()?.object, acid);
    monster.seen_resistance |= M_SEEN_ACID;
    assert.equal(select(), null);
});
void test('a gaze attacker does not blind its intended victim with a potion', async () => {
    const { give, select } = await offensiveRoom({ species: 'Medusa' });
    await give(POT_BLINDNESS);
    const confusion = await give(POT_CONFUSION);
    assert.equal(select()?.object, confusion);
});
void test('an ordinary monster can choose a charged elemental horn', async () => {
    const { give, select } = await offensiveRoom();
    const horn = await give(FROST_HORN);
    assert.equal(select()?.kind, 'horn');
    assert.equal(select()?.object, horn);
});
void test('a silent breathless wraith can use a wand but cannot blow a horn', async () => {
    const { give, select } = await offensiveRoom({ species: 'wraith' });
    await give(FIRE_HORN);
    const wand = await give(WAN_STRIKING);
    assert.equal(select()?.object, wand);
});
void test('undead turning targets a corpse in open hero inventory', async () => {
    const { give, select } = await offensiveRoom();
    const wand = await give(WAN_UNDEAD_TURNING);
    await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    assert.equal(select()?.object, wand);
});
void test('undead turning ignores corpses inside carried containers', async () => {
    const { give, select } = await offensiveRoom();
    await give(WAN_UNDEAD_TURNING);
    const box = await addInventoryObject(LARGE_BOX);
    await addObjectToContainer(box, await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lichen') }));
    assert.equal(select(), null);
});
void test('undead turning notices a ground corpse three steps beyond the hero', async () => {
    const { give, select } = await offensiveRoom({ x: 13 });
    const wand = await give(WAN_UNDEAD_TURNING);
    await floorObject(CORPSE, 7, 10, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    assert.equal(select()?.object, wand);
});
void test('a wall beyond the hero shields a corpse from the undead-turning scan', async () => {
    const { level, give, select } = await offensiveRoom({ x: 13 });
    await give(WAN_UNDEAD_TURNING);
    level.requireAt(8, 10).typ = STONE;
    await floorObject(CORPSE, 7, 10, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    assert.equal(select(), null);
});
void test('undead turning rejects an extended scan beyond wand range even with a nearer corpse', async () => {
    const { give, select } = await offensiveRoom({ x: 15 });
    await give(WAN_UNDEAD_TURNING);
    await floorObject(CORPSE, 14, 10, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    assert.equal(select(), null);
});
void test('a teleport wand needs a reason to dislodge the hero', async () => {
    const { state, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    assert.equal(select(), null);
    await floorObject(SCR_SCARE_MONSTER, state.u.ux, state.u.uy);
    assert.equal(select()?.object, wand);
});
void test('a monster does not offer a controlled hero a teleport', async () => {
    const { state, give, select } = await offensiveRoom();
    await give(WAN_TELEPORTATION);
    await floorObject(SCR_SCARE_MONSTER, state.u.ux, state.u.uy);
    state.u.teleportControl = true;
    assert.equal(select(), null);
});
void test('a monster learns not to attempt teleporting a defended hero on a restricted level', async () => {
    const { monster, state, level, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    await floorObject(SCR_SCARE_MONSTER, state.u.ux, state.u.uy);
    level.flags.noteleport = true;
    assert.equal(select()?.object, wand);
    monster.mtrapseen = 1 << (TELEP_TRAP - 1);
    assert.equal(select(), null);
});
void test('a nearby hostile ally makes a chokepoint worth clearing with teleportation', async () => {
    const { level, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    level.requireAt(11, 9).typ = STONE;
    level.requireAt(11, 11).typ = STONE;
    const ally = await createMonsterAt('goblin', 14, 11, MONSTER_FLAGS);
    ally.mpeaceful = true;
    assert.equal(select(), null);
    ally.mpeaceful = false;
    assert.equal(select()?.object, wand);
    level.requireAt(11, 11).typ = ROOM;
    assert.equal(select(), null);
});
void test('closed doors can form the two sides of a chokepoint', async () => {
    const { level, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    for (const y of [9, 11]) {
        const square = level.requireAt(11, y);
        square.typ = DOOR;
        square.doormask = D_CLOSED;
    }
    await createMonsterAt('goblin', 14, 11, MONSTER_FLAGS);
    assert.equal(select()?.object, wand);
});
void test('a wanted object underneath the hero motivates a teleport wand', async () => {
    const { state, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    await floorObject(POT_CONFUSION, state.u.ux, state.u.uy);
    assert.equal(select()?.object, wand);
});
void test('exactly three unwanted floor stacks are enough to motivate teleportation', async () => {
    const { state, give, select } = await offensiveRoom({ species: 'wraith' });
    const wand = await give(WAN_TELEPORTATION);
    await floorObject(ROCK, state.u.ux, state.u.uy);
    await floorObject(ROCK, state.u.ux, state.u.uy, { blessed: true });
    assert.equal(select(), null);
    await floorObject(ROCK, state.u.ux, state.u.uy, { cursed: true });
    assert.equal(select()?.object, wand);
});
void test('a stairway beneath the hero motivates a teleport wand', async () => {
    const { state, give, select } = await offensiveRoom();
    const wand = await give(WAN_TELEPORTATION);
    state.stairs = { sx: state.u.ux, sy: state.u.uy, up: true, isladder: false,
        tolev: { dnum: 0, dlevel: 7 }, u_traversed: false, next: null };
    assert.equal(select()?.object, wand);
});
void test('a hard helmet permits nearby earth-scroll use without the reckless chance', async () => {
    const { monster, state, give, select } = await offensiveRoom({ x: 11 });
    const scroll = await give(SCR_EARTH);
    await equipMonsterObject(monster, await knownObject(HELMET), W_ARMH, state);
    assert.equal(select()?.kind, 'earth-scroll');
    assert.equal(select()?.object, scroll);
});
void test('a soft hat leaves earth-scroll use dependent on recklessness or confusion', async () => {
    const { monster, state, give, select } = await offensiveRoom({ x: 11 });
    const scroll = await give(SCR_EARTH);
    await equipMonsterObject(monster, await knownObject(DUNCE_CAP), W_ARMH, state);
    assert.equal(select(), null);
    assert.equal(select(() => 0)?.object, scroll);
    monster.mconf = 1;
    assert.equal(select()?.object, scroll);
});
void test('an unsolid wraith uses earth nearby, but not while blind or at a distance', async () => {
    const { monster, give, select } = await offensiveRoom({ species: 'wraith', x: 11 });
    const scroll = await give(SCR_EARTH);
    assert.equal(select()?.object, scroll);
    monster.mcansee = 0;
    assert.equal(select(), null);
    monster.mcansee = 1;
    placeMonsterAt(monster, 13, 10);
    assert.equal(select(), null);
});
void test('earth scrolls work on the Earth plane but not other endgame planes or Rogue', async () => {
    const { state, give, select } = await offensiveRoom({ species: 'wraith', x: 11 });
    const scroll = await give(SCR_EARTH);
    state.rogue_level = { ...state.u.uz };
    assert.equal(select(), null);
    state.rogue_level = { dnum: 0, dlevel: 99 };
    state.astral_level = createSpecialLevel({ dnum: 2, dlevel: 1 });
    state.earth_level = createSpecialLevel({ dnum: 2, dlevel: 5 });
    state.u.uz = { dnum: 2, dlevel: 4 };
    assert.equal(select(), null);
    state.u.uz = { dnum: 2, dlevel: 5 };
    assert.equal(select()?.object, scroll);
});
void test('the disabled native fire-scroll attack is not selected', async () => {
    const { give, select } = await offensiveRoom({ x: 11 });
    await give(SCR_FIRE);
    assert.equal(select(() => 0), null);
});
void test('a charged camera flashes only on its nearby opportunity', async () => {
    const { give, select } = await offensiveRoom({ x: 11 });
    const camera = await give(EXPENSIVE_CAMERA);
    assert.equal(select(), null);
    const choice = select(() => 0);
    assert.ok(choice);
    assert.equal(choice.kind, 'camera');
    assert.equal(choice.object, camera);
    camera.spe = 0;
    assert.equal(select(() => 0), null);
});
void test('a camera ignores a blind hero unless the current body hates light', async () => {
    const { state, give, select } = await offensiveRoom({ x: 11 });
    const camera = await give(EXPENSIVE_CAMERA);
    await makeBlinded(20, { state, talk: false, publish: async () => { } });
    assert.equal(select(() => 0), null);
    installPolymorphedHero('gremlin', { blindTurns: 20 });
    assert.equal(select(() => 0)?.object, camera);
});
void test('an Archon body resists the flash even while able to see', async () => {
    const { give, select } = await offensiveRoom({ x: 11 });
    await give(EXPENSIVE_CAMERA);
    installPolymorphedHero('Archon');
    assert.equal(select(() => 0), null);
});
void test('a faithful hero in an intact sanctuary is not targeted with an offensive item', async () => {
    const { state, level, give, select } = await offensiveRoom();
    const wand = await give(WAN_STRIKING);
    const room = createRoom({ lx: 7, hx: 18, ly: 7, hy: 13, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(8, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 8, 11, MONSTER_FLAGS);
    priest.ispriest = 1;
    priest.mpeaceful = true;
    priest.epri = { shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...state.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0 };
    updateHeroRoomMembership(state);
    vision_recalc(0);
    assert.equal(select(), null);
    priest.mpeaceful = false;
    assert.equal(select()?.object, wand);
});
//# sourceMappingURL=monster_offensive_selection.test.js.map