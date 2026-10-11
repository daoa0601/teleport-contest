import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, MM_NOTAIL, NO_MINVENT, P_BOW, P_EXPERT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitMonsterWithAppliedWeapon, hitMonsterWithThrownObject } from '../js/hero_ranged_attack.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { ARROW, AXE, BOULDER, BOW, HEAVY_IRON_BALL, OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';
function rangedRoom() {
    const level = freshObjectRoom({
        right: 22, flags: { verbose: true }, hero: { ulevel: 30, uhitinc: 50 },
    });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    installPagerInput(resetInputState(), {
        expected: /hits|misses|shoot|throw|wield|weapon|worm|arrow|rock|boulder|iron ball/,
        limit: 12,
    });
    return level;
}
void test('a hand-thrown rock receives the hero damage bonus through the ordinary hit rules', async () => {
    rangedRoom();
    requirePlayingGame(game);
    game.u.udaminc = 7;
    const rock = await addInventoryObject(ROCK);
    const target = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
    target.mhp = target.mhpmax = 100;
    initRng(1n);
    await throwInventoryObject(rock);
    const damage = 100 - target.mhp;
    assert.ok(damage >= 8 && damage <= 9, `A hand-thrown stone should deal 1d2 plus 7 damage, received ${damage}`);
    assert.equal(game.u.uconduct.weaphit ?? 0, 0);
});
for (const objectType of [BOULDER, HEAVY_IRON_BALL]) {
    void test(`a thrown ${objectType === BOULDER ? 'boulder' : 'iron ball'} uses heavy-object accuracy and physical damage`, async () => {
        rangedRoom();
        const object = await knownObject(objectType);
        const target = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
        target.mhp = target.mhpmax = 100;
        initRng(1n);
        const hit = await hitMonsterWithThrownObject(target, object);
        assert.equal(hit.heroDied, undefined);
        assert.ok('hit' in hit && hit.hit);
        assert.ok(target.mhp < 100);
        assert.equal(object.where, 'free', 'The flight owner retains the heavy object for landing.');
    });
}
void test('an applied polearm miss wakes its defender without recording a weapon hit', async () => {
    rangedRoom();
    requirePlayingGame(game);
    game.u.uhitinc = -100;
    const polearm = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'));
    await setPrimaryWeapon(polearm);
    const target = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    target.msleeping = 1;
    const health = target.mhp;
    initRng(1n);
    const hit = await hitMonsterWithAppliedWeapon(target, polearm);
    assert.ok('hit' in hit && !hit.hit);
    assert.equal(target.msleeping, 0);
    assert.equal(target.mhp, health);
    assert.equal(game.u.uconduct.weaphit ?? 0, 0);
});
void test('a thrown axe strikes and cuts the worm segment in its actual flight path', async () => {
    const level = rangedRoom();
    const axe = await addInventoryObject(AXE);
    const worm = await createMonsterAt('long worm', 14, 11, NO_MINVENT | MM_NOTAIL);
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    assertWormBody(worm);
    worm.wormSegments = [{ x: 13, y: 10 }, { x: 12, y: 10 }];
    worm.mhp = worm.mhpmax = 100;
    initRng(2n);
    await throwInventoryObject(axe);
    assert.ok(worm.mhp < 100, 'The flight must hit the tail even though the head is off its path.');
    assert.equal(monsterAtPosition(level, 12, 10) === null, true, 'Cutting the tail tip releases its occupied square.');
    assert.equal(worm.wormSegments.length, 1);
    assert.ok(floorObjectsAt(level, 12, 10).includes(axe));
    assert.equal(worm.mx, 14);
    assert.equal(worm.my, 11);
});
void test('a real multishot volley carries each arrow ordinal into physical hit feedback', async () => {
    rangedRoom();
    requirePlayingGame(game);
    installHeroWeaponSkills({ [P_BOW]: P_EXPERT });
    const bow = await addInventoryObject(BOW);
    await setPrimaryWeapon(bow);
    const arrows = await addInventoryObject(ARROW, { quan: 10 });
    const target = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
    target.mhp = target.mhpmax = 100;
    initRng(2n);
    await throwInventoryObject(arrows);
    assert.ok(arrows.quan < 9, 'The expert archer must fire more than one arrow in this volley.');
    assert.match(game._pending_message, /The \d+(?:st|nd|rd|th) arrow hits the jackal/);
    assert.doesNotMatch(game._pending_message, /The the/);
});
//# sourceMappingURL=hero_ranged_physical.test.js.map