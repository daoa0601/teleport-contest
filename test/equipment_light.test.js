import test from 'node:test';
import assert from 'node:assert/strict';

import { applyArmorOnEffects, removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { dropHeroInventoryForBones } from '../js/bones_death.js';
import { rhack } from '../js/cmd.js';
import { NEED_HTH_WEAPON, NO_MINVENT, W_WEP } from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { unwieldMonsterWeapon, wieldMonsterWeapon } from '../js/monster_weapon.js';
import { OBJECT_NAMES, OIL_LAMP, WAX_CANDLE } from '../js/object_data.js';
import { beginObjectBurn, endObjectBurn } from '../js/light.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const GOLD_MAIL = OBJECT_NAMES.indexOf('gold dragon scale mail');

function darkRoom() {
    const level = freshObjectRoom({ left: 2, right: 30, top: 2, bottom: 18 });
    for (let x = 2; x <= 30; x++) {
        for (let y = 2; y <= 18; y++) {
            level.at(x, y).lit = false;
            level.at(x, y).waslit = false;
        }
    }
    vision_reset();
    vision_recalc(0);
    return level;
}

test('gold dragon mail lights the dungeon while worn and moves with the hero', () => {
    darkRoom();
    const armor = addInventoryObject(GOLD_MAIL);
    assert.equal(cansee(13, 10), false);

    wearHeroArmor(armor);
    applyArmorOnEffects(armor);
    vision_recalc(0);
    assert.equal(cansee(13, 10), true);

    moveHeroByTeleport(20, 10);
    vision_recalc(0);
    assert.equal(cansee(13, 10), false);
    assert.equal(cansee(23, 10), true);

    removeHeroArmor(armor);
    vision_recalc(0);
    assert.equal(cansee(23, 10), false);
    assert.equal(armor.lamplit, false);
});

test('a monster lights nearby squares with gold dragon mail until it loses the armor', async () => {
    darkRoom();
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    const armor = addObjectToMonsterInventory(soldier, knownObject(GOLD_MAIL));

    await initializeMonsterArmor(soldier);
    vision_recalc(0);
    assert.equal(cansee(17, 10), true);

    await removeObjectFromMonsterInventory(soldier, armor);
    vision_recalc(0);
    assert.equal(cansee(17, 10), false);
    assert.equal(armor.lamplit, false);
    assert.equal(game.level.monsters.includes(soldier), true);
});

test('wielding Sunsword lights the room and emptying the hand extinguishes it', async () => {
    darkRoom();
    game.u.ualign.type = 1;
    const sword = addInventoryItem(artifactObject('Sunsword'));
    pushKeys(`${sword.invlet} `);

    await rhack('w'.charCodeAt(0));
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);

    pushKeys('- ');
    await rhack('w'.charCodeAt(0));
    vision_recalc(0);
    assert.equal(sword.lamplit, false);
    assert.equal(cansee(12, 10), false);
    assert.match(game._pending_message, /Sunsword stops shining/);
});

test('swapping Sunsword from the alternate slot starts its light', async () => {
    darkRoom();
    game.u.ualign.type = 1;
    const sword = addInventoryItem(artifactObject('Sunsword'));
    setSecondaryWeapon(sword);
    pushKeys('  ');

    await rhack('x'.charCodeAt(0));
    vision_recalc(0);

    assert.equal(game.uwep, sword);
    assert.equal(cansee(12, 10), true);
});

test('a stack of burning candles lights a wider area until extinguished', () => {
    darkRoom();
    const candles = floorObject(WAX_CANDLE, 14, 10, { quan: 9, age: 200 });

    beginObjectBurn(candles);
    vision_recalc(0);
    assert.equal(cansee(18, 10), true);

    endObjectBurn(candles);
    vision_recalc(0);
    assert.equal(cansee(18, 10), false);
});

test('gold armor stops lighting the room when its wearer dies', async () => {
    darkRoom();
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    const armor = addObjectToMonsterInventory(soldier, knownObject(GOLD_MAIL));
    await initializeMonsterArmor(soldier);
    soldier.mhp = 0;

    await finishEnvironmentalMonsterDeath(soldier, game, { publish: async () => {} });
    vision_recalc(0);

    assert.equal(armor.lamplit, false);
    assert.equal(cansee(17, 10), false);
});

test('hero death extinguishes equipment light but leaves a dropped lamp burning', () => {
    darkRoom();
    const armor = addInventoryObject(GOLD_MAIL);
    wearHeroArmor(armor);
    applyArmorOnEffects(armor);
    const sword = addInventoryItem(artifactObject('Sunsword'));
    setPrimaryWeapon(sword);
    beginObjectBurn(sword);
    const lamp = addInventoryObject(OIL_LAMP, { age: 100 });
    beginObjectBurn(lamp);

    dropHeroInventoryForBones(game.u.ux, game.u.uy);

    assert.equal(armor.lamplit, false);
    assert.equal(sword.lamplit, false);
    assert.equal(lamp.lamplit, true);
});

test('a monster can unwield Sunsword without dropping it or leaving its light behind', async () => {
    darkRoom();
    const giant = await createMonsterAt('giant', 14, 10, NO_MINVENT);
    const sword = equipMonsterObject(giant, artifactObject('Sunsword'), W_WEP);
    beginObjectBurn(sword);
    vision_recalc(0);
    const messages = [];

    await unwieldMonsterWeapon(giant, game, {
        publish: async message => messages.push(message),
    });
    vision_recalc(0);

    assert.equal(giant.mw, null);
    assert.equal(giant.minvent.includes(sword), true);
    assert.equal(sword.lamplit, false);
    assert.equal(cansee(16, 10), false);
    assert.ok(messages.some(message => /Sunsword.*stops shining/.test(message)));
});

test('Sunsword starts lighting the room after the monster\'s wielding message is acknowledged', async () => {
    darkRoom();
    const input = resetInputState();
    const giant = await createMonsterAt('giant', 14, 10, NO_MINVENT);
    addObjectToMonsterInventory(giant, artifactObject('Sunsword'));
    giant.weaponCheck = NEED_HTH_WEAPON;
    beginObjectBurn(floorObject(OIL_LAMP, 11, 10, { age: 100 }));
    vision_recalc(0);
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const wielding = wieldMonsterWeapon(giant);
    await input.waitUntilBlocked();
    assert.equal(cansee(16, 10), false);
    input.feed('   ');
    await wielding;
    vision_recalc(0);

    assert.equal(cansee(16, 10), true);
    assert.equal(giant.mw.lamplit, true);
});
