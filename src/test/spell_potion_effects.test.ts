import { objectTypeKnown } from '../js/shk.js';
import type { InventoryObjectOverrides } from './support/game-objects.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { currentAttribute } from '../js/attrib.js';
import { applyArmorOnEffects, wearHeroArmor, removeHeroArmor } from '../js/armor.js';
import { A_DEX, A_STR, NO_MINVENT, P_ESCAPE_SPELL, P_EXPERT, P_SKILLED, SICK_ALL, STONE, TIMEOUT, WEAK } from '../js/const.js';
import { canSeeMonster, map_invisible, pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsInvisible } from '../js/hero_invisibility.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { resetInputState } from '../js/input.js';
import {
    LONG_SWORD, MUMMY_WRAPPING, SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE,
    SPE_HASTE_SELF, SPE_INVISIBILITY, SPE_LEVITATION, SPE_RESTORE_ABILITY,
    SPEED_BOOTS,
} from '../js/object_data.js';
import {
    levitationAtWill, grantIntrinsicProperty, hasIntrinsicProperty,
    hasPermanentIntrinsicProperty, propertyIsActive, propertyTimeout, setPropertyTimeout,
} from '../js/properties.js';
import { heroDetectsMonsters } from '../js/senses.js';
import { switchHeroTerrain } from '../js/terrain_movement.js';
import { castSpell } from '../js/spell.js';
import { applyPotionSpell } from '../js/spell_potion_effects.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { vision_recalc } from '../js/vision.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';

async function source(type: number, properties: InventoryObjectOverrides = {}) {
    return addInventoryObject(type, { initialize: false, ...properties });
}

for (const [blessed, minimum, maximum] of [[false, 100, 109], [true, 160, 169]] satisfies [boolean, number, number][]) {
    void test(`${blessed ? 'blessed' : 'ordinary'} haste lasts for the native spell duration without permanent speed`, async () => {
        const input = freshTurnRoom({ role: 'caveman' });
        requirePlayingGame(game);
        const spell = await source(SPE_HASTE_SELF, { blessed });
        const result = await applyPotionSpell(spell);
        assert.equal(result.heroDied, false);
        assert.equal(game.u.veryFast, true);
        const duration = propertyTimeout('fast');
        assert.ok(duration >= minimum && duration <= maximum,
            `Haste duration ${duration} must be between ${minimum} and ${maximum} turns`);
        assert.equal(propertyIsActive('fast'), true);
        assert.equal(hasPermanentIntrinsicProperty('fast'), false);
        assert.equal(game.inventory.includes(spell), true);
        assert.equal(game.u.uconduct?.literate || 0, 0);

        // Exercise the final world turn without waiting through the whole spell.
        setPropertyTimeout('fast', 1);
        const moves = game.moves;
        input.feed('..');
        await moveloop_core();
        await moveloop_core();

        assert.equal(game.moves, moves + 1);
        assert.equal(propertyTimeout('fast'), 0);
        assert.equal(propertyIsActive('fast'), false);
        assert.equal(game.u.veryFast, false);
        assert.equal(hasPermanentIntrinsicProperty('fast'), false);
    });
}

void test('haste leaves wounded legs intact instead of taking the speed-potion cure branch', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await woundHeroLegs('left', 20);
    await applyPotionSpell(await source(SPE_HASTE_SELF));
    assert.equal(game.u._woundedLegTurns, 20);
    assert.equal(game.u.veryFast, true);
});

void test('haste through speed boots renews energy instead of announcing a new acceleration', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const boots = await addInventoryObject(SPEED_BOOTS);
    wearHeroArmor(boots);
    await applyArmorOnEffects(boots);
    resetInputState().feed(' '); // Haste feedback follows wearing effects.
    await applyPotionSpell(await source(SPE_HASTE_SELF));
    assert.match(game._pending_message, /legs get new energy/);
    assert.ok((game.u.veryFastTurns ?? 0) >= 100);
});

void test('haste commits its duration after its actual speed feedback resumes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const spell = await source(SPE_HASTE_SELF);
    await pline('You carefully examine the old inscriptions covering this long corridor.');
    const input = resetInputState();
    const action = applyPotionSpell(spell);
    try {
        await input.waitUntilBlocked();
        assert.ok(!game.u.veryFastTurns);
    } finally { input.feed(' '); await action; }
    assert.ok((game.u.veryFastTurns ?? 0) >= 100);
});

void test('ordinary restoration recovers one drained base attribute', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 5;
    game.u.amax.a[A_STR] = 16;
    game.u.acurr.a[A_DEX] = 6;
    game.u.amax.a[A_DEX] = 18;
    await applyPotionSpell(await source(SPE_RESTORE_ABILITY));
    const { acurr, amax } = game.u;
    const restored = [A_STR, A_DEX].filter(attribute => acurr.a[attribute] === amax.a[attribute]);
    assert.equal(restored.length, 1);
    const remaining = restored[0] === A_STR ? A_DEX : A_STR;
    assert.equal(game.u.acurr.a[remaining], remaining === A_STR ? 5 : 6);
    assert.match(game._pending_message, /makes you feel good/);
});

void test('blessed restoration recovers all drained bases and clears abuse while retaining positive exercise', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 5;
    game.u.amax.a[A_STR] = 16;
    game.u.acurr.a[A_DEX] = 6;
    game.u.amax.a[A_DEX] = 18;
    game.u._exercise = [0, 0, 0, 0, 0, 0];
    game.u._exercise[A_STR] = -8;
    game.u._exercise[A_DEX] = 5;
    grantIntrinsicProperty('sustainAbility', 'outside', game);
    assert.equal(propertyIsActive('sustainAbility'), true);
    await applyPotionSpell(await source(SPE_RESTORE_ABILITY, { blessed: true }));
    assert.equal(game.u.acurr.a[A_STR], 16);
    assert.equal(game.u.acurr.a[A_DEX], 18);
    assert.equal(game.u._exercise?.[A_STR], 0);
    assert.equal(game.u._exercise?.[A_DEX], 5);
    assert.match(game._pending_message, /makes you feel great/);
});

void test('restoration preserves hunger and leg penalties and reports only feeling better', async () => {
    freshObjectRoom({ hero: { uhs: WEAK } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 5;
    game.u.amax.a[A_STR] = 16;
    game.u.atemp.a[A_STR] = -1;
    await woundHeroLegs('left', 20);
    await applyPotionSpell(await source(SPE_RESTORE_ABILITY, { blessed: true }));
    assert.equal(game.u.acurr.a[A_STR], 16);
    assert.equal(currentAttribute(A_STR), 15);
    assert.equal(game.u.atemp.a[A_DEX], -1);
    assert.equal(game.u._woundedLegTurns, 20);
    assert.match(game._pending_message, /makes you feel better/);
});

void test('restoration does not recover lost levels or cure illness and deafness', async () => {
    freshObjectRoom({ hero: { ulevel: 3, ulevelmax: 8, sickTurns: 10, sickType: SICK_ALL, deafTurns: 9 } });
    requirePlayingGame(game);
    await applyPotionSpell(await source(SPE_RESTORE_ABILITY, { blessed: true }));
    assert.equal(game.u.ulevel, 3);
    assert.equal(game.u.sickTurns, 10);
    assert.equal(game.u.deafTurns, 9);
    assert.match(game._pending_message, /feel better/);
});

void test('restoration applies base recovery only after its prose is acknowledged', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 5;
    const spell = await source(SPE_RESTORE_ABILITY, { blessed: true });
    await pline('You carefully examine the old inscriptions covering this long corridor.');
    const input = resetInputState();
    const action = applyPotionSpell(spell);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.acurr.a[A_STR], 5);
    } finally { input.feed(' '); await action; }
    assert.equal(game.u.acurr.a[A_STR], game.u.amax.a[A_STR]);
});

for (const [blessed, minimum, maximum] of [[false, 11, 150], [true, 251, 300]] satisfies [boolean, number, number][]) {
    void test(`${blessed ? 'blessed' : 'ordinary'} levitation grants the source duration and descent control`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const spell = await source(SPE_LEVITATION, { blessed });
        await applyPotionSpell(spell);
        assert.equal(propertyIsActive('levitation'), true);
        assert.ok((game.u.levitationTurns ?? 0) >= minimum && (game.u.levitationTurns ?? 0) <= maximum);
        assert.equal(levitationAtWill(), blessed);
        assert.equal(game.inventory.includes(spell), true);
    });
}

void test('blocked levitation accumulates timeout without trying to float through rock', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(10, 10).typ = STONE;
    await switchHeroTerrain();
    const spell = await source(SPE_LEVITATION, { blessed: true });
    await applyPotionSpell(spell);
    assert.ok((game.u.levitationTurns ?? 0) >= 250);
    assert.ok(!game.u.levitating);
});

void test('invisibility grants temporary invisibility without consuming or identifying its source', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const spell = await source(SPE_INVISIBILITY, { observed: false, typeKnown: false, known: false });
    const result = await applyPotionSpell(spell);
    assert.equal(result.heroDied, false);
    assert.equal(heroIsInvisible(), true);
    assert.ok((game.u.invisibleTurns ?? 0) >= 106 && (game.u.invisibleTurns ?? 0) <= 700);
    assert.equal(game.inventory.includes(spell), true);
    assert.equal(objectTypeKnown(spell), false);
    assert.equal(game._knownObjectTypes?.has(spell.otyp), false);
});

void test('a spell cannot pass through worn mummy wrapping', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wrapping = await addInventoryObject(MUMMY_WRAPPING);
    wearHeroArmor(wrapping);
    await applyArmorOnEffects(wrapping);
    await applyPotionSpell(await source(SPE_INVISIBILITY));
    assert.ok(!game.u.invisibleTurns);
    assert.equal(heroIsInvisible(), false);
    assert.match(game._pending_message, /itchy under your mummy wrapping/);
});

void test('already invisible heroes get a longer spell timeout without potion fallback prose', async () => {
    freshObjectRoom({ hero: { invisibleTurns: 10 } });
    requirePlayingGame(game);
    await applyPotionSpell(await source(SPE_INVISIBILITY));
    assert.ok((game.u.invisibleTurns ?? 0) > 10);
    assert.doesNotMatch(game._pending_message || '', /feeling for a moment/);
});

void test('blessed monster detection reveals a remote monster persistently without a browse prompt', async () => {
    freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('dog', 20, 10, NO_MINVENT);
    game.level.requireAt(20, 10).lit = false;
    vision_recalc(0);
    assert.equal(canSeeMonster(monster), false);
    const spell = await source(SPE_DETECT_MONSTERS, { blessed: true });
    await applyPotionSpell(spell);
    assert.ok((game.u.monsterDetectionTurns ?? 0) >= 21 && (game.u.monsterDetectionTurns ?? 0) <= 60);
    assert.equal(heroDetectsMonsters(), true);
    assert.equal(game.level.requireAt(monster.mx, monster.my).disp_glyph?.kind, 'monster');
    assert.equal(game.level.requireAt(monster.mx, monster.my).disp_ch, monster.symbol);
});

void test('repeated long-lasting monster detection adds only one native turn', async () => {
    freshObjectRoom({ hero: { monsterDetectionTurns: 300 } });
    requirePlayingGame(game);
    await createMonsterAt('dog', 12, 10, NO_MINVENT);
    await applyPotionSpell(await source(SPE_DETECT_MONSTERS, { blessed: true }));
    assert.equal(game.u.monsterDetectionTurns, 301);
});

void test('persistent detection clears an old unseen-monster marker', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.flags.hero_memory = true;
    map_invisible(14, 10);
    await applyPotionSpell(await source(SPE_DETECT_MONSTERS, { blessed: true }));
    assert.notEqual(game.level.requireAt(14, 10).remembered_glyph?.kind, 'invisible');
    assert.match(game._pending_message, /feel lonely/);
});

void test('treasure detection senses actual non-gold objects at the hero position', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await floorObject(LONG_SWORD, 10, 10);
    const spell = await source(SPE_DETECT_TREASURE);
    const result = await applyPotionSpell(spell);
    assert.equal(result.result, 0);
    assert.match(game._pending_message, /sense objects nearby/);
    assert.equal(game.inventory.includes(spell), true);
});

void test('empty treasure detection reports absence without trying to call or consume the spell', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const spell = await source(SPE_DETECT_TREASURE);
    const result = await applyPotionSpell(spell);
    assert.equal(result.result, 1);
    assert.match(game._pending_message, /lack of something/);
    assert.equal(game.inventory.includes(spell), true);
    assert.equal(game.u.uconduct?.literate || 0, 0);
});


void test('removing the actual mummy wrapping lets the next invisibility spell work', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wrapping = await addInventoryObject(MUMMY_WRAPPING);
    wearHeroArmor(wrapping);
    await applyArmorOnEffects(wrapping);
    const spell = await source(SPE_INVISIBILITY);
    await applyPotionSpell(spell);
    assert.equal(heroIsInvisible(), false);
    await removeHeroArmor(wrapping);
    resetInputState().feed(' '); // The new invisibility feedback follows the blocked-spell line.
    await applyPotionSpell(spell);
    assert.equal(heroIsInvisible(), true);
    assert.ok((game.u.invisibleTurns ?? 0) >= 106);
});


void test('persistent detection caps the native timeout instead of overflowing it', async () => {
    freshObjectRoom({ hero: { monsterDetectionTurns: TIMEOUT } });
    requirePlayingGame(game);
    await createMonsterAt('dog', 12, 10, NO_MINVENT);
    await applyPotionSpell(await source(SPE_DETECT_MONSTERS, { blessed: true }));
    assert.equal(game.u.monsterDetectionTurns, TIMEOUT);
});

void test('the public skilled cast dispatch grants blessed haste and disposes only its pseudo source', async () => {
    freshObjectRoom({ role: 'wizard' });
    requirePlayingGame(game);
    installHeroWeaponSkills({ [P_ESCAPE_SPELL]: P_SKILLED });
    const book = await source(SPE_HASTE_SELF);
    const result = await castSpell(SPE_HASTE_SELF, { force: true });
    assert.equal(result.spentTime, true);
    assert.ok((game.u.veryFastTurns ?? 0) >= 160 && (game.u.veryFastTurns ?? 0) <= 169);
    assert.equal(game.inventory.length, 1);
    assert.equal(game.inventory[0], book);
    assert.equal(game.u.uconduct?.literate || 0, 0);
});

void test('expert invisibility casting remains temporary rather than gaining a blessed potion effect', async () => {
    freshObjectRoom({ role: 'wizard' });
    requirePlayingGame(game);
    installHeroWeaponSkills({ [P_ESCAPE_SPELL]: P_EXPERT });
    await castSpell(SPE_INVISIBILITY, { force: true });
    assert.equal(heroIsInvisible(), true);
    assert.ok((game.u.invisibleTurns ?? 0) >= 106 && (game.u.invisibleTurns ?? 0) <= 700);
    assert.equal(hasIntrinsicProperty('invisible', 'outside'), false);
});


void test('ordinary monster detection browses the real map without granting persistent detection', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('dog', 14, 10, NO_MINVENT);
    const spell = await source(SPE_DETECT_MONSTERS);
    const input = resetInputState();
    const action = applyPotionSpell(spell);
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /sense the presence of monsters/);
        assert.equal(game.level.requireAt(14, 10).disp_glyph?.kind, 'monster');
        assert.ok(!game.u.monsterDetectionTurns);
        input.feed(' '); // Finish the detection prose before entering the map browser.
        await input.waitUntilBlocked();
    } finally { input.feed('\x1b'); await action; }
    assert.equal(game.inventory.includes(spell), true);
    assert.equal(game.level.monsters.includes(monster), true);
    assert.ok(!heroDetectsMonsters());
});

void test('the real turn expiry removes the persistent detection view of an unseen monster', async () => {
    const input = freshTurnRoom({ right: 24 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('dog', 20, 10, NO_MINVENT);
    monster.msleeping = 1;
    game.level.requireAt(20, 10).lit = false;
    vision_recalc(0);
    await applyPotionSpell(await source(SPE_DETECT_MONSTERS, { blessed: true }));
    assert.equal(game.level.requireAt(20, 10).disp_glyph?.kind, 'monster');
    game.u.monsterDetectionTurns = 1;
    input.feed('.');
    await moveloop_core();
    const nextTurn = moveloop_core();
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.monsterDetectionTurns, 0);
        assert.equal(heroDetectsMonsters(), false);
        assert.notEqual(game.level.requireAt(monster.mx, monster.my).disp_glyph?.kind, 'monster');
    } finally { input.feed('.'); await nextTurn; }
});
