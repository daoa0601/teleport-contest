import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitMonsterWithHeroObject } from '../js/hero_physical_hit.js';
import { resolveHeroObjectContact } from '../js/hero_object_contact.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { ACID_VENOM, AMULET_OF_LIFE_SAVING, CREAM_PIE, EGG, EXPENSIVE_CAMERA, MIRROR, OBJECT_NAMES, POT_ACID, POT_HEALING, POT_SPEED, ROCK, STATUE, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
const BIRTH_FLAGS = NO_MINVENT | MM_NOGRP | MM_NOWAIT;
void test('a cream-pie hit can leave a monster blind for the minimum twenty-one turns', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('goblin', 11, 10, BIRTH_FLAGS);
    monster.mpeaceful = false;
    const pie = await knownObject(CREAM_PIE);
    await resolveHeroObjectContact(monster, pie, {
        mode: 'thrown', random: () => 0, rollOne: () => 25, publish: () => { },
    });
    assert.equal(monster.mblinded, 21);
    assert.equal(monster.mcansee, 0);
    assert.equal(pie.where, 'gone');
});
async function contactRoom(expected, species = 'goblin') {
    freshObjectRoom({ gameplaySeed: 97n, flags: { verbose: true }, hero: { ulevel: 30, uhp: 500, uhpmax: 500 } });
    const monster = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    monster.mhp = monster.mhpmax = 200;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 12 });
    return { monster, input };
}
for (const mode of ['melee', 'thrown']) {
    void test(`${mode} cream-pie contact blinds without a damage-ring bonus and consumes the proper quantity`, async () => {
        const { monster } = await contactRoom(/cream pie|goblin|ring/);
        const pies = mode === 'melee'
            ? await addInventoryObject(CREAM_PIE, { quan: 3 })
            : await knownObject(CREAM_PIE, { quan: 3 });
        if (mode === 'melee')
            await setPrimaryWeapon(pies);
        await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('increase damage'), { spe: 9 }), 'uleft');
        initRng(97n);
        const result = await hitMonsterWithHeroObject(monster, pies, { mode, dieRoll: 1 });
        assert.equal(result.survived, true);
        assert.equal(monster.mhp, 200);
        assert.equal(monster.mcansee, 0);
        assert.ok((monster.mblinded ?? 0) >= 21 && (monster.mblinded ?? 0) <= 45);
        if (mode === 'melee') {
            assert.equal(pies.quan, 2);
            assert.equal(pies.where, 'inventory');
            assert.equal(game.uwep, pies);
        }
        else
            assert.equal(pies.where, 'gone');
    });
}
void test('a thrown mirror breaks one mirror without granting ordinary Strength damage', async () => {
    const { monster } = await contactRoom(/mirror|goblin/);
    const mirrors = await knownObject(MIRROR, { quan: 2 });
    game.u.udaminc = 20;
    const luck = game.u.uluck ?? 0;
    initRng(97n);
    await hitMonsterWithHeroObject(monster, mirrors, { mode: 'thrown', dieRoll: 1 });
    assert.equal(game.u.uluck, luck - 2);
    assert.equal(mirrors.quan, 1);
    assert.equal(monster.mhp, 199);
});
void test('a destroyed camera ends the object hit before ordinary damage', async () => {
    const { monster } = await contactRoom(/camera|Congratulations|imp|homunculus/);
    const camera = await addInventoryObject(EXPENSIVE_CAMERA);
    await setPrimaryWeapon(camera);
    initRng(97n);
    const result = await hitMonsterWithHeroObject(monster, camera, { mode: 'melee', dieRoll: 1 });
    assert.equal(result.objectConsumed, true);
    assert.equal(result.survived, true);
    assert.equal(monster.mhp, 200);
    assert.equal(camera.where, 'gone');
    assert.ok(!game.uwep);
});
void test('acid-resistant monsters take no bonus damage from acid venom', async () => {
    const { monster } = await contactRoom(/venom.*harmlessly|acid blob/, 'acid blob');
    const venom = await knownObject(ACID_VENOM);
    game.u.udaminc = 20;
    initRng(97n);
    const result = await hitMonsterWithHeroObject(monster, venom, { mode: 'thrown', dieRoll: 1 });
    assert.equal(monster.mhp, 200);
    assert.equal(result.survived, true);
    assert.equal(venom.where, 'gone');
});
void test('a fresh thrown egg becomes a floor rock against a cockatrice and deals nominal damage once', async () => {
    const { monster } = await contactRoom(/cockatrice|egg.*alive/, 'cockatrice');
    requirePlayingGame(game);
    const egg = await knownObject(EGG, { corpsenm: MONSTER_NAME.indexOf('newt'), age: game.moves });
    game.u.udaminc = 20;
    initRng(97n);
    await hitMonsterWithHeroObject(monster, egg, { mode: 'thrown', dieRoll: 1 });
    assert.equal(monster.mhp, 199);
    assert.equal(egg.otyp, ROCK);
    assert.equal(egg.where, 'floor');
    assert.equal(floorObjectsAt(game.level, 11, 10).filter(object => object === egg).length, 1);
});
void test('petrifying egg contact uses life saving without an extra physical hit or duplicate kill conduct', async () => {
    const { monster } = await contactRoom(/Splat|goblin|stone|medallion|lifeless/);
    requirePlayingGame(game);
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const egg = await knownObject(EGG, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    initRng(97n);
    const result = await hitMonsterWithHeroObject(monster, egg, { mode: 'thrown', dieRoll: 1 });
    assert.equal(result.survived, true);
    assert.ok(game.level.monsters.includes(monster));
    assert.equal(monster.mhp, monster.mhpmax);
    assert.equal(amulet.where, 'gone');
    assert.equal(egg.where, 'gone');
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === STATUE), false);
});
void test('an acid cure consumed during petrifying egg contact credits its fatal damage to the hero', async () => {
    const { monster } = await contactRoom(/Splat|goblin|acid|You feel/);
    requirePlayingGame(game);
    monster.mhp = 1;
    await addObjectToMonsterInventory(monster, await knownObject(POT_ACID), game);
    const egg = await knownObject(EGG, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    initRng(97n);
    const result = await hitMonsterWithHeroObject(monster, egg, { mode: 'thrown', dieRoll: 1 });
    assert.equal(result.survived, false);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.uconduct.killer, 1);
});
void test('bashing with a healing-potion stack frees one bottle and retains the wielded remainder', async () => {
    const { monster } = await contactRoom(/goblin|potion|bottle|flask|phial|flagon|carafe|jar|vial/);
    const potions = await addInventoryObject(POT_HEALING, { quan: 2 });
    await setPrimaryWeapon(potions);
    monster.mhp = 10;
    initRng(97n);
    const result = await hitMonsterWithHeroObject(monster, potions, { mode: 'melee', dieRoll: 1 });
    assert.equal(result.survived, true);
    assert.equal(potions.quan, 1);
    assert.equal(potions.where, 'inventory');
    assert.equal(game.uwep, potions);
    assert.equal(monster.mhp, 199);
});
void test('a potion hitting a worm tail describes its body at the actual impact boundary', async () => {
    const { monster, input } = await contactRoom(/long worm|potion|bottle|flask|phial|flagon|carafe|jar|vial/, 'long worm');
    const tail = monster.wormSegments?.find(segment => segment.x !== 0
        && (segment.x !== monster.mx || segment.y !== monster.my));
    assert.ok(tail, 'The long worm must have a tail to receive the potion hit');
    const potion = await addInventoryObject(POT_SPEED);
    await setPrimaryWeapon(potion);
    const messages = [];
    input.beforeRead = () => { messages.push(requireScreenRow(0).map(cell => cell.ch).join('')); };
    initRng(97n);
    await hitMonsterWithHeroObject(monster, potion, { mode: 'melee', target: tail, dieRoll: 1 });
    await flush_screen();
    messages.push(requireScreenRow(0).map(cell => cell.ch).join(''));
    assert.ok(messages.some(message => /crashes on the long worm's body/.test(message)), `Expected a visible potion impact on the worm body; saw: ${messages.join(' | ')}`);
    assert.equal(potion.where, 'gone');
});
//# sourceMappingURL=hero_object_contact.test.js.map