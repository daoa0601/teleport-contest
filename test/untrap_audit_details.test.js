import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP, HWALL, SQKY_BOARD, WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CAN_OF_GREASE, MACE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { initializePet } from '../js/dog.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { untrap } from '../js/untrap.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createStaffedShop } from './support/shop.js';
function direction(dx, dy) {
    return () => ({ dx, dy, dz: 0, key: '.' });
}
// C trap.c:5575-5586: u_wield_art(ART_STING) tests the *primary* weapon,
// so a two-weapon hero whose secondary blade is Sting does not get the
// "Sting cuts through the web!" line; C falls through to the plain cut.
void test('a secondary Sting does not announce itself while cutting a web', async () => {
    let verified = false;
    for (let seed = 1n; seed <= 60n && !verified; seed++) {
        const level = freshPlayableRoom({});
        addTrap(level, WEB, 11, 10, { tseen: true });
        const mace = await addInventoryObject(MACE, { spe: 3 });
        await setPrimaryWeapon(mace);
        const sting = await addInventoryItem(await artifactObject('Sting'));
        game.u.twoweap = true;
        game.uswapwep = game.u.uswapwep = sting;
        const messages = [];
        initRng(seed);
        await untrap({
            chooseDirection: direction(1, 0),
            publish: message => { messages.push(message); },
            ask: async () => 'n',
        });
        if (!messages.some(message => message.includes('web')))
            continue;
        verified = true;
        const text = messages.join(' | ');
        assert.doesNotMatch(text, /Sting cuts through/, text);
        assert.match(text, /You cut through (?:your|the) web\./, text);
    }
    assert.equal(verified, true, 'some seed must remove the web');
});
// C trap.c:5485-5486 -> dog.c abuse_dog(): Aggravate_monster halves a pet's
// tameness on a failed bear-trap rescue instead of the single-point hit.
void test("aggravate monsters halves a rescued pet's tameness on failure", async () => {
    let verified = false;
    for (let seed = 1n; seed <= 60n && !verified; seed++) {
        const level = freshPlayableRoom({});
        grantIntrinsicProperty('aggravateMonster', 'outside');
        addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
        const pet = await createMonsterAt('kitten', 11, 10);
        initializePet(pet, { state: game });
        pet.mtrapped = 1;
        pet.mtame = 5;
        pet.mhp = pet.mhpmax = 200;
        const messages = [];
        initRng(seed);
        await untrap({
            chooseDirection: direction(1, 0),
            publish: message => { messages.push(message); },
            ask: async () => 'n',
        });
        if (!messages.includes('Whoops...'))
            continue;
        verified = true;
        assert.equal(pet.mtame, 2, `mtame must halve from 5: ${messages.join(' | ')}`);
    }
    assert.equal(verified, true, 'some seed must fumble the rescue');
});
// C trap.c:5461-5469: the tight-diagonal refusal in try_disarm() uses plain
// bigmonst(), so even a flexible amorphous large form cannot squeeze through.
void test('a large amorphous form still cannot disarm across a tight diagonal', async () => {
    const level = freshRoomWithPolymorphedHero('large mimic', {});
    level.requireAt(10, 11).typ = HWALL;
    level.requireAt(11, 10).typ = HWALL;
    addTrap(level, WEB, 11, 11, { tseen: true });
    const messages = [];
    initRng(1n);
    await untrap({
        chooseDirection: direction(1, 1),
        publish: message => { messages.push(message); },
        ask: async () => 'n',
    });
    assert.match(messages[0] ?? '', /^You are unable to reach the web!$/, messages.join(' | '));
});
// C trap.c:5648-5649 -> invent.c consume_obj_charge(): a can of grease used
// on a squeaky board spends one shop-billed charge.
void test('repairing a squeaky board with shop grease bills one charge', async () => {
    const level = freshPlayableRoom({ flags: { debug: true } });
    const { shopkeeper } = await createStaffedShop({ left: 8, right: 14, top: 8, bottom: 12, keeperX: 12, keeperY: 12 });
    addTrap(level, SQKY_BOARD, 11, 10, { tseen: true });
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 2, unpaid: true });
    grease.dknown = true;
    const messages = [];
    initRng(1n);
    await untrap({
        chooseDirection: direction(1, 0),
        publish: message => { messages.push(message); },
        chooseObject: async () => grease,
    });
    assert.ok(messages.includes('You repair the squeaky board.'), messages.join(' | '));
    assert.equal(grease.spe, 1, 'one grease charge is spent');
    assert.ok((shopkeeper.eshk.debit ?? 0) > 0, `the shopkeeper must bill the charge: ${messages.join(' | ')}`);
});
// C trap.c:5581 -> objnam.c bare_artifactname(uwep): the fiery-blade
// message names the primary weapon even when the burning blade is the
// secondary. xname() observes a non-artifact primary and keeps its given name.
void test("a fiery secondary blade names and observes the primary weapon while burning a web", async () => {
    const level = freshPlayableRoom({});
    const web = addTrap(level, WEB, 11, 10, { tseen: true });
    const mace = await addInventoryObject(MACE, { oname: 'Bob', dknown: false, observed: false });
    await setPrimaryWeapon(mace);
    const fireBrand = await addInventoryItem(await artifactObject('Fire Brand'));
    game.u.twoweap = true;
    game.uswapwep = game.u.uswapwep = fireBrand;
    const messages = [];
    initRng(1n);
    await untrap({
        chooseDirection: direction(1, 0),
        publish: message => { messages.push(message); },
        ask: async () => 'n',
    });
    assert.equal(messages[0], 'mace named Bob burns through the web!');
    assert.equal(mace.dknown, true, 'naming a visible weapon recognizes its appearance');
    assert.equal(level.traps.includes(web), false);
});
//# sourceMappingURL=untrap_audit_details.test.js.map