import { createDungeon } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { A_NONE, A_WIS } from '../js/const.js';
import { currentAttribute } from '../js/attrib.js';
import { angryGods, godsUpset, godZapsHero } from '../js/divine_wrath.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, BLACK_DRAGON_SCALE_MAIL, DAGGER, LEATHER_CLOAK, SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION, } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
void test('angering the hero\'s god removes divine protection and delays prayer', async () => {
    freshObjectRoom({ hero: { ugangr: 0, ublessed: 4, uluck: 13 } });
    requireFixtureGame(game);
    await godsUpset(game.u.ualign.type);
    assert.equal(game.u.ugangr, 1);
    assert.equal(game.u.ublessed, 0);
    assert.ok(game.u.ublesscnt > 0);
});
void test('divine punishment installs a real ball and chain on the floor', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    requireFixtureGame(game);
    initRng(3n);
    pushKeys(' '.repeat(40));
    await angryGods(game.u.ualign.type);
    assert.ok(game.uball && game.uchain);
    const pile = floorObjectsAt(game.level, game.u.ux, game.u.uy);
    assert.ok(pile.includes(game.uball));
    assert.ok(pile.includes(game.uchain));
    assert.equal(game.u.punished, true);
});
void test('divine curses affect the actual inventory', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    requireFixtureGame(game);
    const dagger = await addInventoryObject(DAGGER);
    initRng(5n);
    pushKeys(' '.repeat(40));
    await angryGods(game.u.ualign.type);
    assert.equal(dagger.cursed, true);
});
void test('an angry god sends a hostile minion', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    requireFixtureGame(game);
    initRng(47n);
    pushKeys(' '.repeat(40));
    await angryGods(game.u.ualign.type);
    assert.ok(game.u.ualign !== null && game.u.ualign !== undefined);
    const alignment = game.u.ualign.type;
    assert.ok(game.level.monsters.some(monster => monster.isminion && !monster.mpeaceful
        && monster.emin?.min_align === alignment));
});
void test('Moloch answers divine anger in Gehennom', async () => {
    freshObjectRoom({ hero: { ugangr: 0, uluck: 13, ualign: { type: 1, record: 0 } } });
    requireFixtureGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ flags: { hellish: true } } })];
    await angryGods(1);
    assert.match(game._pending_message, /Moloch is displeased/);
    assert.notEqual(game.u.ualign.type, A_NONE);
});
void test('divine disintegration removes exposed armor but preserves armor granting resistance', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const shield = await addInventoryObject(SHIELD_OF_REFLECTION);
    const suit = await addInventoryObject(BLACK_DRAGON_SCALE_MAIL);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    for (const armor of [shield, suit, cloak]) {
        wearHeroArmor(armor);
        await applyArmorOnEffects(armor);
    }
    const health = game.u.uhp;
    pushKeys(' '.repeat(100));
    await godZapsHero(game.u.ualign.type);
    assert.equal(game.u.uhp, health);
    assert.equal(game.uarms, shield);
    assert.equal(game.uarm, suit);
    assert.equal(game.uarmc, null);
    assert.equal(cloak.where, 'gone');
    assert.ok(!game.program_state.gameover);
});
void test('a divine bolt can kill the swallower without breaking pacifist conduct', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', 10, 10);
    await installSwallowedHero(worm);
    grantIntrinsicProperty('disintegrationResistance', 'outside');
    pushKeys(' '.repeat(100));
    await godZapsHero(game.u.ualign.type);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.level.monsters.includes(worm), false);
    assert.equal(game.u.uconduct.killer || 0, 0);
    assert.ok(game.u.uexp > 0);
    assert.ok(!game.program_state.gameover);
});
void test('life saving from divine lightning does not stop the following disintegration', async () => {
    freshObjectRoom({ flags: { disclose: '-i-a-v-c-o', bones: false } });
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys(' '.repeat(300));
    await godZapsHero(game.u.ualign.type);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(game._lifeSavedCount, 1);
    assert.equal(game.program_state.gameover, true);
    assert.ok(game._deathKiller);
    assert.match(game._deathKiller, /^the wrath of /);
});
for (const armorType of [SHIELD_OF_DRAIN_RESISTANCE, BLACK_DRAGON_SCALE_MAIL]) {
    const defended = armorType === BLACK_DRAGON_SCALE_MAIL;
    void test(`divine experience loss ${defended ? 'respects black dragon body armor' : 'bypasses a shield of drain resistance'}`, async () => {
        freshObjectRoom({ hero: { ulevel: 4, ugangr: 1, uluck: 0 } });
        requireFixtureGame(game);
        const armor = await addInventoryObject(armorType);
        wearHeroArmor(armor);
        await applyArmorOnEffects(armor);
        const wisdom = currentAttribute(A_WIS);
        pushKeys(' '.repeat(100));
        initRng(4n);
        await angryGods(game.u.ualign.type);
        assert.ok(currentAttribute(A_WIS) < wisdom, 'the god selected the relearning punishment');
        assert.equal(game.u.ulevel, defended ? 4 : 3);
        assert.ok(!game.program_state.gameover);
    });
}
//# sourceMappingURL=divine_wrath.test.js.map