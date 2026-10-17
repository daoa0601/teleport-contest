import type { Dungeon } from '../js/dungeon_types.js';
import type { InventoryObjectOverrides } from './support/game-objects.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_WIS, SICK_ALL } from '../js/const.js';
import { setTopline } from '../js/display.js';
import { canHeroRiseUp, levelAtDepth } from '../js/dungeon.js';
import { newExperienceThreshold } from '../js/exper.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { startHeroSickness } from '../js/hero_illness.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING, AMULET_OF_YENDOR, POT_ACID, POT_GAIN_LEVEL,
    POT_OIL, POT_POLYMORPH, POT_SICKNESS, POT_WATER } from '../js/object_data.js';
import { applyPotionBodyEffect } from '../js/potion_body_effects.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { heroIsHallucinating } from '../js/senses.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { setHeroLycanthropy } from '../js/were.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoomLevel } from './support/playable-room.js';

function dungeon(dname: string, depth_start: number, num_dunlevs: number, entry_lev = 1): Dungeon {
    return { dname, depth_start, num_dunlevs, entry_lev, dunlev_ureached: 0,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined };
}

async function apply(type: number, properties: InventoryObjectOverrides = {}) {
    const source = await addInventoryObject(type, { initialize: false, ...properties });
    resetInputState().feed(' '.repeat(30));
    return applyPotionBodyEffect(source);
}

for (const [properties, message] of [
    [{}, 'That was smooth!'],
    [{ blessed: true }, 'That was smooth!'],
    [{ cursed: true }, 'This tastes like castor oil.'],
] as const) {
    void test(`unlit oil ${message} preserves health and leaves consumption to the caller`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const result = await apply(POT_OIL, properties);
        assert.equal(game._pending_message, message);
        assert.equal(game.u.uhp, 40);
        assert.equal(result.handled, true);
        assert.equal(result.unknown, 0);
        assert.equal(game.inventory.length, 1);
    });
}

void test('unlit oil abuses wisdom', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    for (let drinks = 0; drinks < 12; drinks++) await apply(POT_OIL);
    assert.ok(game.u._exercise);
    assert.ok(game.u._exercise[A_WIS] < 0);
});

void test('burning oil hurts a human and removes pending sliming', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    startHeroSliming({ turns: 7 });
    const result = await apply(POT_OIL, { lamplit: true });
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp >= 24 && game.u.uhp <= 36);
    assert.equal(game.u.slimedTurns, 0);
    assert.match(game._pending_message, /slime.*burned away/);
});

void test('fire resistance reduces burning oil damage, but cold resistance removes that reduction', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('fireResistance', 'outside');
    await apply(POT_OIL, { lamplit: true });
    assert.ok(game.u.uhp >= 32 && game.u.uhp <= 38);
    game.u.uhp = 40;
    grantIntrinsicProperty('coldResistance', 'outside');
    await apply(POT_OIL, { lamplit: true });
    assert.ok(game.u.uhp >= 24 && game.u.uhp <= 36);
});

void test('a fire elemental enjoys burning oil without losing body health', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('fire elemental');
    const result = await apply(POT_OIL, { lamplit: true });
    assert.equal(result.heroDied, false);
    assert.equal(game.u.mh, 40);
    assert.equal(game._pending_message, 'Ahh, a refreshing drink.');
    assert.ok(game.u._exercise);
    assert.ok(game.u._exercise[A_WIS] >= 0);
});

void test('ordinary water adds nutrition without the fullness/choking rule', async () => {
    freshObjectRoom({ hero: { uhunger: 2000 } });
    requirePlayingGame(game);
    const result = await apply(POT_WATER);
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhunger > 2000 && game.u.uhunger <= 2010);
    assert.equal(game.u.umortality || 0, 0);
    assert.equal(result.unknown, 0);
});

for (const alignment of [-1, 0, 1] as const) {
    void test(`holy water follows alignment ${alignment}`, async () => {
        freshObjectRoom({ hero: { ualign: { type: alignment, record: 0 } } });
        requirePlayingGame(game);
        await apply(POT_WATER, { blessed: true });
        if (alignment === -1) {
            assert.ok(game.u.uhp < 40);
            assert.equal(game._pending_message, 'This burns like acid!');
        } else {
            assert.equal(game.u.uhp, 40);
            assert.equal(game._pending_message, 'You feel full of awe.');
        }
    });
}

void test('holy water cures fatal sickness but leaves nausea intact', async () => {
    freshObjectRoom({ hero: { vomitingTurns: 8, vomiting: true } });
    requirePlayingGame(game);
    await startHeroSickness({ turns: 15, type: SICK_ALL });
    await apply(POT_WATER, { blessed: true });
    assert.equal(game.u.sickTurns, 0);
    assert.equal(game.u.vomitingTurns, 8);
    assert.match(game._pending_message, /cured.*relief/);
});

void test('holy water burns an undead body even with lawful alignment', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 0 } } });
    requirePlayingGame(game);
    installPolymorphedHero('vampire');
    await apply(POT_WATER, { blessed: true });
    assert.ok(game.u.mh >= 28 && game.u.mh <= 38);
    assert.equal(game.u.uhp, 40);
});

void test('unholy water heals a chaotic hero without increasing maximum health', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 0 }, uhp: 37 } });
    requirePlayingGame(game);
    await apply(POT_WATER, { cursed: true });
    assert.ok(game.u.uhp >= 39 && game.u.uhp <= 40);
    assert.equal(game.u.uhpmax, 40);
    assert.equal(game._pending_message, 'You feel quite proud of yourself.');
});

void test('unholy water damages lawful heroes and gives neutral heroes dread', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 0 } } });
    requirePlayingGame(game);
    await apply(POT_WATER, { cursed: true });
    assert.ok(game.u.uhp < 40);
    freshObjectRoom({ hero: { ualign: { type: 0, record: 0 } } });
    requirePlayingGame(game);
    await apply(POT_WATER, { cursed: true });
    assert.equal(game.u.uhp, 40);
    assert.equal(game._pending_message, 'You feel full of dread.');
});

void test('holy water cures lycanthropy even while an unchanging werewolf remains in beast form', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    setHeroLycanthropy(MONSTER_NAME.indexOf('werewolf'));
    installPolymorphedHero('werewolf', { turns: 0 });
    const amulet = await addInventoryObject(AMULET_OF_UNCHANGING);
    await wearHeroAccessory(amulet, 'uamul');
    await apply(POT_WATER, { blessed: true });
    assert.equal(game.u.ulycn, -1);
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('werewolf'));
    assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399);
    assert.equal(propertyIsActive('drainResistance'), true);
});

void test('unholy water changes an infected human into its beast form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroLycanthropy(MONSTER_NAME.indexOf('werewolf'));
    await apply(POT_WATER, { cursed: true });
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('werewolf'));
    assert.ok(game.u.mh > 0);
});

void test('a Healer is immune to ordinary and blessed sickness potions', async () => {
    freshObjectRoom({ role: 'healer' });
    requirePlayingGame(game);
    const bases = game.u.acurr.a.slice();
    await apply(POT_SICKNESS);
    await apply(POT_SICKNESS, { blessed: true });
    assert.equal(game.u.uhp, 40);
    assert.deepEqual(game.u.acurr.a, bases);
});

void test('blessed sickness hurts other roles by one point and ends hallucination', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 12 } });
    requirePlayingGame(game);
    await apply(POT_SICKNESS, { blessed: true });
    assert.equal(game.u.uhp, 39);
    assert.equal(heroIsHallucinating(), false);
    assert.match(game._pending_message, /shocked back to your senses/);
});

void test('poison resistance reduces sickness damage and attribute loss without preventing either', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('poisonResistance', 'outside');
    const before = game.u.acurr.a.slice();
    await apply(POT_SICKNESS);
    assert.ok(game.u.uhp >= 38 && game.u.uhp <= 39);
    assert.ok(game.u.acurr != null);
    const after = game.u.acurr.a;
    assert.equal(before.reduce((loss, value, attribute) => {
        const current = after[attribute];
        assert.ok(current !== undefined);
        return loss + value - current;
    }, 0), 1);
});

void test('sustain ability prevents sickness attribute loss but leaves its health damage', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('sustainAbility', 'outside');
    const before = game.u.acurr.a.slice();
    await apply(POT_SICKNESS, { cursed: true });
    assert.deepEqual(game.u.acurr.a, before);
    assert.ok(game.u.uhp >= 25 && game.u.uhp <= 34);
});

for (const [properties, minimum, maximum] of [[{ blessed: true }, 1, 4], [{}, 1, 8], [{ cursed: true }, 2, 16]] as const) {
    void test(`acid damage is ${minimum}..${maximum} for its beatitude`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const result = await apply(POT_ACID, properties);
        assert.ok(40 - game.u.uhp >= minimum && 40 - game.u.uhp <= maximum);
        assert.equal(result.unknown, 1);
    });
}

void test('acid resistance prevents damage while acid still cures petrification', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('acidResistance', 'outside');
    startHeroPetrification({ turns: 3 });
    await apply(POT_ACID, { cursed: true });
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.stonedTurns, 0);
    assert.match(game._pending_message, /You feel limber!$/u);
});

void test('acid damages the current monster body without damaging saved human health', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('dog');
    await apply(POT_ACID);
    assert.ok(game.u.mh < 40);
    assert.equal(game.u.uhp, 40);
});

void test('burning oil resumes after its message and life saving before curing slime', async () => {
    freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    startHeroSliming({ turns: 7 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const source = await addInventoryObject(POT_OIL, { lamplit: true });
    await setTopline('You carefully examine the old inscriptions covering this long corridor.');
    const input = resetInputState();
    const action = applyPotionBodyEffect(source);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.uhp, 1);
        assert.equal(game.u.slimedTurns, 7);
    } finally { input.feed(' '.repeat(20)); await action; }
    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.slimedTurns, 0);
    assert.equal(game.inventory.includes(amulet), false);
});

void test('an unchanging amulet prevents polymorph potion transformation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_UNCHANGING);
    await wearHeroAccessory(amulet, 'uamul');
    const before = game.u.umonnum;
    await apply(POT_POLYMORPH);
    assert.equal(game.u.umonnum, before);
    assert.equal(game._pending_message, 'You feel a little strange.');
});

void test('blessed polymorph offers a real form choice and gives the chosen form a short lifetime', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await addInventoryObject(POT_POLYMORPH, { blessed: true });
    const input = resetInputState();
    const action = applyPotionBodyEffect(source);
    try {
        await input.waitUntilBlocked();
        assert.equal(game._pending_message, 'You feel a little strange.');
        assert.equal(game.u.umonnum, game.u.umonster);
        input.feed(' '); // The potion's taste precedes the form-selection line.
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /Become what kind of monster/);
    } finally { input.feed('dog\n' + ' '.repeat(10)); await action; }
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('dog'));
    assert.ok(game.u.mtimedone >= 10 && game.u.mtimedone <= 24);
});

void test('ordinary gain level gains one experience level and current health', async () => {
    freshObjectRoom({ hero: { ulevel: 8, uhp: 12, uhpmax: 40 } });
    requirePlayingGame(game);
    await apply(POT_GAIN_LEVEL);
    assert.equal(game.u.ulevel, 9);
    assert.ok(game.u.uhp > 12);
    assert.equal(game.u.uexp, newExperienceThreshold(8));
});

void test('blessed gain level places experience inside the new level', async () => {
    freshObjectRoom({ hero: { ulevel: 8 } });
    requirePlayingGame(game);
    await apply(POT_GAIN_LEVEL, { blessed: true });
    assert.equal(game.u.ulevel, 9);
    assert.ok(game.u.uexp >= newExperienceThreshold(8));
    assert.ok(game.u.uexp < newExperienceThreshold(9));
});

void test('cursed gain level rises through the current ceiling using real cached levels', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    resetInputState().feed(' '.repeat(30));
    await gotoLevel({ dnum: 0, dlevel: 2 });
    const before = game.u.ulevel;
    await apply(POT_GAIN_LEVEL, { cursed: true });
    assert.ok(game.u.uz != null);
    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(requireGameLevel(), source);
    assert.equal(game.u.ulevel, before);
});

void test('cursed gain level cannot leave dungeon level one without the Amulet', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    await apply(POT_GAIN_LEVEL, { cursed: true });
    assert.ok(game.u.uz != null);
    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(game._pending_message, 'You have an uneasy feeling.');
});

void test('cursed gain level leaves a branch through its actual parent dungeon', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    const mainDungeon = game.dungeons[0];
    assert.ok(mainDungeon);
    mainDungeon.num_dunlevs = 10;
    game.dungeons.push(dungeon('The Gnomish Mines', 5, 4));
    game.branches = [{ type: 'stair', portal: false, end1_up: false, end1: { dnum: 0, dlevel: 4 }, end2: { dnum: 1, dlevel: 1 } }];
    game.u.uz = { dnum: 1, dlevel: 1 };
    game.stairs = { sx: 10, sy: 10, up: true, isladder: false, u_traversed: false, tolev: { dnum: 0, dlevel: 4 }, next: null };
    const destination = createRoomLevel();
    assert.ok(game._levelCache);
    game._levelCache.set('0:4', { level: destination, stairs: null, heroTrack: [], savedAt: game.moves, activeSpecialLevel: null });
    await apply(POT_GAIN_LEVEL, { cursed: true });
    assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 4 });
    assert.equal(requireGameLevel(), destination);
    assert.notEqual(requireGameLevel(), source);
});

void test('cursed gain level with the Amulet rises from level one to the Plane of Earth', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.dungeons.push(dungeon('The Elemental Planes', -5, 5, 5));
    game.earth_level = { dnum: 1, dlevel: 5, flags: { town: false }, alignment: null };
    game.astral_level = { dnum: 1, dlevel: 1, flags: { town: false }, alignment: null };
    const earth = createRoomLevel();
    assert.ok(game._levelCache);
    game._levelCache.set('1:5', { level: earth, stairs: null, heroTrack: [], savedAt: game.moves, activeSpecialLevel: null });
    await addInventoryObject(AMULET_OF_YENDOR);
    assert.ok(game.u.uhave != null);
    assert.equal(game.u.uhave.amulet, true);
    await apply(POT_GAIN_LEVEL, { cursed: true });
    assert.deepEqual(game.u.uz, game.earth_level);
    assert.equal(requireGameLevel(), earth);
});

void test('rise-up admission excludes Sokoban, endgame, and the top Wizard tower interior', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [dungeon('The Dungeons of Doom', 1, 20)];
    assert.equal(canHeroRiseUp(10, 10), true);
    game.sokoban_dnum = 0;
    assert.equal(canHeroRiseUp(10, 10), false);
    delete game.sokoban_dnum;
    game._activeSpecialLevel = { prototype: 'wizard1', file: 'wizard1.lua', upTeleportExclude: { lx: 8, ly: 8, hx: 12, hy: 12 } };
    assert.equal(canHeroRiseUp(10, 10), false);
    assert.equal(canHeroRiseUp(14, 10), true);
    delete game._activeSpecialLevel;
    game.astral_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
    assert.equal(canHeroRiseUp(10, 10), false);
});

void test('depth resolution follows the actual branch parent and clamps past its bottom', () => {
    freshObjectRoom({ hero: { uz: { dnum: 1, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [dungeon('The Dungeons of Doom', 1, 20),
        dungeon('The Gnomish Mines', 5, 4)];
    game.branches = [{ type: 'stair', portal: false, end1_up: false, end1: { dnum: 0, dlevel: 4 }, end2: { dnum: 1, dlevel: 1 } }];
    assert.deepEqual(levelAtDepth(4), { dnum: 0, dlevel: 4 });
    assert.deepEqual(levelAtDepth(20), { dnum: 1, dlevel: 4 });
    game.stairs = { sx: 10, sy: 10, up: true, isladder: false, u_traversed: false, tolev: { dnum: 0, dlevel: 4 }, next: null };
    assert.equal(canHeroRiseUp(10, 10), true);
    game.stairs = null;
    assert.equal(canHeroRiseUp(10, 10), false);
});
