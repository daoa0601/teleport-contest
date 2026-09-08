import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { A_NONE } from '../js/const.js';
import { angryGods, godsUpset, godZapsHero } from '../js/divine_wrath.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, BLACK_DRAGON_SCALE_MAIL, DAGGER,
    LEATHER_CLOAK, SHIELD_OF_REFLECTION,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';

test('angering the hero\'s god removes divine protection and delays prayer', async () => {
    freshObjectRoom({ hero: { ugangr: 0, ublessed: 4, uluck: 13 } });

    await godsUpset(game.u.ualign.type);

    assert.equal(game.u.ugangr, 1);
    assert.equal(game.u.ublessed, 0);
    assert.ok(game.u.ublesscnt > 0);
});

test('divine punishment installs a real ball and chain on the floor', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    initRng(3n);
    pushKeys(' '.repeat(40));

    await angryGods(game.u.ualign.type);

    assert.ok(game.uball && game.uchain);
    const pile = floorObjectsAt(game.level, game.u.ux, game.u.uy);
    assert.ok(pile.includes(game.uball));
    assert.ok(pile.includes(game.uchain));
    assert.equal(game.u.punished, true);
});

test('divine curses affect the actual inventory', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    const dagger = addInventoryObject(DAGGER);
    initRng(5n);
    pushKeys(' '.repeat(40));

    await angryGods(game.u.ualign.type);

    assert.equal(dagger.cursed, true);
});

test('an angry god sends a hostile minion', async () => {
    freshObjectRoom({ hero: { ugangr: 5, uluck: 0 } });
    initRng(47n);
    pushKeys(' '.repeat(40));

    await angryGods(game.u.ualign.type);

    assert.ok(game.level.monsters.some(monster =>
        monster.isminion && !monster.mpeaceful
        && monster.emin.min_align === game.u.ualign.type));
});

test('Moloch answers divine anger in Gehennom', async () => {
    freshObjectRoom({ hero: { ugangr: 0, uluck: 13, ualign: { type: 1, record: 0 } } });
    game.dungeons = [{ flags: { hellish: true } }];

    await angryGods(1);

    assert.match(game._pending_message, /Moloch is displeased/);
    assert.notEqual(game.u.ualign.type, A_NONE);
});

test('divine disintegration removes exposed armor but preserves armor granting resistance', async () => {
    freshObjectRoom();
    const shield = addInventoryObject(SHIELD_OF_REFLECTION);
    const suit = addInventoryObject(BLACK_DRAGON_SCALE_MAIL);
    const cloak = addInventoryObject(LEATHER_CLOAK);
    for (const armor of [shield, suit, cloak]) {
        wearHeroArmor(armor);
        applyArmorOnEffects(armor);
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

test('a divine bolt can kill the swallower without breaking pacifist conduct', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('purple worm', 10, 10);
    installSwallowedHero(worm);
    grantIntrinsicProperty('disintegrationResistance', 'outside');
    pushKeys(' '.repeat(100));

    await godZapsHero(game.u.ualign.type);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.level.monsters.includes(worm), false);
    assert.equal(game.u.uconduct.killer || 0, 0);
    assert.ok(game.u.uexp > 0);
    assert.ok(!game.program_state.gameover);
});

test('life saving from divine lightning does not stop the following disintegration', async () => {
    freshObjectRoom({ flags: { disclose: '-i-a-v-c-o', bones: false } });
    const amulet = addInventoryObject(AMULET_OF_LIFE_SAVING);
    wearHeroAccessory(amulet, 'uamul');
    pushKeys(' '.repeat(300));

    await godZapsHero(game.u.ualign.type);

    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(game._lifeSavedCount, 1);
    assert.equal(game.program_state.gameover, true);
    assert.match(game._deathKiller, /^the wrath of /);
});
