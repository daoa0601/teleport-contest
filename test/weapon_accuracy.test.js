import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT, POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DAGGER, PICK_AXE, RED_DRAGON_SCALE_MAIL, RIN_PROTECTION, SPEAR, TRIDENT, } from '../js/object_data.js';
import { rangedTargetHitBonus, weaponHitBonus } from '../js/weapon_accuracy.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
test.beforeEach(() => freshObjectRoom());
void test('enchantment adds accuracy to weapons and weapon tools, but not rings', async () => {
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    for (const type of [DAGGER, PICK_AXE]) {
        const ordinary = weaponHitBonus(await knownObject(type, { spe: 0 }), target);
        const enchanted = weaponHitBonus(await knownObject(type, { spe: 3 }), target);
        assert.equal(enchanted - ordinary, 3);
    }
    const ring = await knownObject(RIN_PROTECTION, { spe: 3 });
    assert.equal(weaponHitBonus(ring, target), 0);
});
void test('a blessed weapon is more accurate against undead than against the living', async () => {
    const zombie = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
    const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    const dagger = await knownObject(DAGGER, { spe: 0, blessed: true });
    assert.equal(weaponHitBonus(dagger, zombie) - weaponHitBonus(dagger, goblin), 2);
});
void test('a spear is more accurate against a giant', async () => {
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    const spear = await knownObject(SPEAR, { spe: 0 });
    assert.equal(weaponHitBonus(spear, giant) - weaponHitBonus(spear, goblin), 2);
});
void test('a pick is more accurate against a solid wall-passing body', async () => {
    const xorn = await createMonsterAt('xorn', 11, 10, NO_MINVENT);
    const ghost = await createMonsterAt('ghost', 12, 10, NO_MINVENT);
    const pick = await knownObject(PICK_AXE, { spe: 0 });
    assert.equal(weaponHitBonus(pick, xorn) - weaponHitBonus(pick, ghost), 2);
});
void test('a trident is more accurate against a swimmer in water', async () => {
    requirePlayingGame(game);
    const swimmer = await createMonsterAt('water elemental', 11, 10, NO_MINVENT);
    const trident = await knownObject(TRIDENT, { spe: 0 });
    const dryAccuracy = weaponHitBonus(trident, swimmer);
    game.level.requireAt(swimmer.mx, swimmer.my).typ = POOL;
    assert.equal(weaponHitBonus(trident, swimmer) - dryAccuracy, 4);
});
void test('a trident keeps a smaller advantage against a stranded eel', async () => {
    requirePlayingGame(game);
    game.level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('giant eel', 11, 10, NO_MINVENT);
    const trident = await knownObject(TRIDENT, { spe: 0 });
    game.level.requireAt(eel.mx, eel.my).typ = ROOM;
    assert.equal(weaponHitBonus(trident, eel), 2);
});
void test('weapon accuracy uses the hero\'s current monster form', async () => {
    requirePlayingGame(game);
    const spear = await knownObject(SPEAR, { spe: 0 });
    const humanAccuracy = weaponHitBonus(spear, game.u);
    installPolymorphedHero('hill giant');
    assert.equal(weaponHitBonus(spear, game.u) - humanAccuracy, 2);
});
void test('fire resistance blocks Fire Brand accuracy against the hero', async () => {
    requirePlayingGame(game);
    const sword = await artifactObject('Fire Brand', { spe: 0 });
    const rollOne = (range) => range;
    const unprotectedAccuracy = weaponHitBonus(sword, game.u, { rollOne });
    wearHeroArmor(await addInventoryObject(RED_DRAGON_SCALE_MAIL));
    const protectedAccuracy = weaponHitBonus(sword, game.u, { rollOne });
    assert.equal(unprotectedAccuracy - protectedAccuracy, 5);
});
void test('noticing an incoming object can release a monster from paralysis', async () => {
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const dagger = await knownObject(DAGGER);
    target.mcanmove = 0;
    target.mfrozen = 3;
    rangedTargetHitBonus(dagger, target, { random: () => 0 });
    assert.equal(target.mcanmove, 0);
    assert.equal(target.mfrozen, 3);
    rangedTargetHitBonus(dagger, target, { defenderNotices: true, random: () => 0 });
    assert.equal(target.mcanmove, 1);
    assert.equal(target.mfrozen, 0);
});
//# sourceMappingURL=weapon_accuracy.test.js.map