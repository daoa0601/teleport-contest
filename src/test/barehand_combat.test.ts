import type { RoleKey } from '../js/roles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { prepareHeroBarehandContact } from '../js/barehand_combat.js';
import { recalculateHeroPhysicalDamage } from '../js/hero_physical_damage.js';
import { rhack } from '../js/cmd.js';
import { specialContactDamage } from '../js/contact_damage.js';
import {
    A_STR,
    P_BARE_HANDED_COMBAT,
    P_BASIC,
    P_EXPERT,
    P_RIDING,
    P_UNSKILLED,
    W_ARM,
    W_ARMC,
    W_ARMG,
    W_ARMU,
    W_RINGL,
    W_RINGR,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_GLOVES, OBJECT_NAMES, ROBE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { ensureHeroSkills } from '../js/skills.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function arena(species = 'shade', role: RoleKey = 'wizard') {
    freshObjectRoom({ role, hero: { ulevel: 30, uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 12;
    game.u.amax.a[A_STR] = 12;
    const monster = await createMonsterAt(species, 11, 10);
    monster.mhp = 200;
    monster.mhpmax = 200;
    monster.minvis = 0;
    monster.mundetected = 0;
    monster.mpeaceful = 0;
    ensureHeroSkills(game);
    const input = resetInputState();
    input.beforeRead = () => {
        assert.ok(game.nhDisplay);
        const text = game.nhDisplay.grid
            .map((row) => row.map((cell) => cell.ch).join(''))
            .join('\n');
        assert.ok(text.includes('--More--'), `Unexpected input: ${text.split('\n')[0]}`);
        input.feed(' ');
    };
    return monster;
}

async function silverRing(slot: 'uleft' | 'uright') {
    assert.ok(game.objectMaterials);
    const type = game.objectMaterials.findIndex(
        (material, otyp) => otyp >= 173 && otyp <= 200 && material === 14,
    );
    assert.ok(type >= 173, 'The shuffled ring class must contain a silver ring');
    const ring = await addInventoryObject(type, { spe: 0 });
    await wearHeroAccessory(ring, slot);
    return ring;
}

void test('bare hands pass through a shade but still spend a confusing touch', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    game.u.umconf = 2;
    await rhack('l'.charCodeAt(0));
    assert.equal(shade.mhp, 200);
    assert.equal(game.u.umconf, 1);
    assert.equal(barehandSkill().advance, 0);
});

void test('blessed gloves hurt a shade without training or applying barehand skill', async () => {
    const shade = await arena('shade', 'monk');
    requirePlayingGame(game);
    const gloves = await addInventoryObject(LEATHER_GLOVES, { blessed: true, bknown: false });
    wearHeroArmor(gloves);
    const practice = barehandSkill().advance;
    const hit = prepareHeroBarehandContact(shade);
    assert.ok(hit.damage >= 1 && hit.damage <= 4, `Blessed contact damage was ${hit.damage}`);
    assert.equal(barehandSkill().advance, practice);
    assert.equal(gloves.bknown, false);
});

void test('ordinary gloves cover silver rings and make a shade immune to the punch', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    await silverRing('uright');
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
    await rhack('l'.charCodeAt(0));
    assert.equal(shade.mhp, 200);
});

void test('a silver ring hurts a shade and gives feedback without identifying the ring', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    const ring = await silverRing('uright');
    ring.dknown = false;
    assert.ok(game._knownObjectTypes);
    game._knownObjectTypes.delete(ring.otyp);
    await rhack('l'.charCodeAt(0));
    assert.ok(shade.mhp < 200);
    assert.match(game._pending_message, /Your silver ring sears the shade!/);
    assert.equal(ring.dknown, false);
    assert.equal(game._knownObjectTypes.has(ring.otyp), false);
});

void test('two exposed silver rings share one damage roll on a single punch', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    await silverRing('uright');
    initRng(71n);
    const oneRing = prepareHeroBarehandContact(shade);
    await silverRing('uleft');
    initRng(71n);
    const twoRings = prepareHeroBarehandContact(shade);
    assert.equal(twoRings.damage, oneRing.damage);
    assert.ok(twoRings.damage >= 1 && twoRings.damage <= 20);
});

void test('a double punch uses the right ring first and left ring second', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    await silverRing('uleft');
    const first = prepareHeroBarehandContact(shade, { twoHits: 1 });
    const second = prepareHeroBarehandContact(shade, { twoHits: 2 });
    const later = prepareHeroBarehandContact(shade, { twoHits: 3 });
    assert.equal(first.damage, 0);
    assert.ok(second.damage >= 1 && second.damage <= 20);
    assert.equal(later.damage, 0);
});

void test('blessed rings do not add damage against undead', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    assert.ok(game.objectMaterials);
    const type = game.objectMaterials.findIndex(
        (material, otyp) => otyp >= 173 && otyp <= 200 && material !== 14,
    );
    const ring = await addInventoryObject(type, { blessed: true, spe: 0 });
    await wearHeroAccessory(ring, 'uright');
    assert.equal((prepareHeroBarehandContact(shade)).damage, 0);
});

void test('barehand damage uses live martial skill and trains a substantial base hit', async () => {
    const target = await arena('lichen', 'monk');
    requirePlayingGame(game);
    const skills = installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_EXPERT });
    const damages = [];
    for (let i = 0; i < 12; i++) {
        const contact = prepareHeroBarehandContact(target);
        damages.push(await recalculateHeroPhysicalDamage(contact.damage, null, {
            mode: 'melee', twoHits: 0, getDamageBonus: true,
            useWeaponSkill: contact.useWeaponSkill,
            trainWeaponSkill: contact.trainWeaponSkill,
        }));
    }
    assert.ok(damages.every((damage) => damage >= 7 && damage <= 10));
    const skill = skills[P_BARE_HANDED_COMBAT];
    assert.ok(skill);
    assert.ok(skill.advance > 0);
});

void test('riding skill increases a normal punch but does not bypass shade immunity', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    const target = await createMonsterAt('lichen', 12, 10);
    game.u.usteed = await createMonsterAt('pony', 10, 11);
    installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_BASIC, [P_RIDING]: P_EXPERT });
    const hit = prepareHeroBarehandContact(target);
    const damage = await recalculateHeroPhysicalDamage(hit.damage, null, {
        mode: 'melee', twoHits: 0, getDamageBonus: true,
        useWeaponSkill: hit.useWeaponSkill,
        trainWeaponSkill: hit.trainWeaponSkill,
    });
    assert.ok(damage >= 4 && damage <= 5);
    assert.equal((prepareHeroBarehandContact(shade)).damage, 0);
});

void test('a skilled hero can punch twice without using a stored alternate weapon', async () => {
    let sawDouble = false;
    for (let seed = 1; seed <= 15 && !sawDouble; seed++) {
        const target = await arena('giant');
        requirePlayingGame(game);
        installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_EXPERT });
        const weapon = await addInventoryObject(OBJECT_NAMES.indexOf('long sword'), { spe: 20 });
        game.uswapwep = weapon;
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        const damage = 200 - target.mhp;
        assert.ok(damage <= 8, `Two expert punches inflicted ${damage} damage`);
        sawDouble = damage > 4;
    }
    assert.equal(sawDouble, true, 'An expert must be able to land more than one punch');
});

void test('an unskilled hero makes one punch and checks the left ring too', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_UNSKILLED });
    await silverRing('uleft');
    await rhack('l'.charCodeAt(0));
    assert.ok(shade.mhp < 200);
});

void test('a shield prevents a second barehand strike even at expert skill', async () => {
    const target = await arena('giant');
    requirePlayingGame(game);
    installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_EXPERT });
    wearHeroArmor(await addInventoryObject(OBJECT_NAMES.indexOf('small shield')));
    for (let seed = 1; seed <= 8; seed++) {
        target.mhp = 200;
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        assert.ok(200 - target.mhp <= 4, 'A shield permits only one punch');
    }
});

void test('silver and blessed armor still harm a vampire in another form', async () => {
    const target = await arena('bat');
    requirePlayingGame(game);
    target.cham = MONSTER_NAME.indexOf('vampire');
    await silverRing('uright');
    const silver = specialContactDamage(game.u, target, W_RINGR);
    assert.ok(silver.damage >= 1 && silver.damage <= 20);
    wearHeroArmor(await addInventoryObject(LEATHER_GLOVES, { blessed: true }));
    const blessed = specialContactDamage(game.u, target, W_ARMG);
    assert.ok(blessed.damage >= 1 && blessed.damage <= 4);
});

void test('contact uses the outermost selected armor and does not add hidden layers', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    wearHeroArmor(
        await addInventoryObject(OBJECT_NAMES.indexOf('Hawaiian shirt'), { blessed: true }),
    );
    wearHeroArmor(await addInventoryObject(ROBE));
    const hidden = specialContactDamage(game.u, shade, W_ARMC | W_ARM | W_ARMU);
    const exposed = specialContactDamage(game.u, shade, W_ARMU);
    assert.equal(hidden.damage, 0);
    assert.ok(exposed.damage >= 1 && exposed.damage <= 4);
});

void test('monster armor can inflict blessed contact but monster rings cannot', async () => {
    const shade = await arena();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('human', 12, 10);
    const gloves = await knownObject(LEATHER_GLOVES, { blessed: true });
    await equipMonsterObject(attacker, gloves, W_ARMG);
    const contact = specialContactDamage(attacker, shade, W_ARMG | W_RINGL | W_RINGR);
    assert.ok(contact.damage >= 1 && contact.damage <= 4);
    gloves.owornmask = 0;
    assert.equal(specialContactDamage(attacker, shade, W_RINGL | W_RINGR).damage, 0);
});

function barehandSkill() {
    const skill = game.u.weaponSkills?.[P_BARE_HANDED_COMBAT];
    assert.ok(skill);
    return skill;
}
