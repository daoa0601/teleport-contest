import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterTurn } from '../js/allmain.js';
import { farlookLocationDescription } from '../js/cmd.js';
import { CORR, IRONBARS, MM_NOGRP, NO_MINVENT, TER_OBJ } from '../js/const.js';
import {
    glyphAt, map_object, newsym, randomDisplayMonsterName,
    transientMonsterGlyph, transientObjectGlyph,
} from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    browseDetectionMap, clearDetectionMap, mapDetectedMonster, reconstrainMap, unconstrainMap,
} from '../js/magic_map_display.js';
import { monsterName } from '../js/monster_name.js';
import { changeMonsterForm, initialShapechangedBirth } from '../js/monster_polymorph.js';
import { landFloorObject } from '../js/floor_effects.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { CHEST, POT_WATER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { finishHeroThrownObjectLanding } from '../js/thrown_object.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a hallucinated monster eating bars keeps its final dochug appearance', async () => {
    const level = freshObjectRoom({ left: 10, right: 16, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('rust monster', 13, 10, MM_NOGRP | NO_MINVENT);
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.movement = 12;
    level.requireAt(12, 10).typ = IRONBARS;
    game.u.hallucinationTurns = 20;
    game.flags.verbose = false;
    initRng(17n);
    monsterName(monster, { capitalized: true });
    // dissolve_bars() redraws once, then dochug(MMOVE_DONE) redraws again.
    newsym(13, 10);
    newsym(13, 10);
    const expected = glyphAt(13, 10);
    initRng(17n);

    await performMonsterTurn(monster, game);

    assert.equal(monster.mx, 12);
    assert.equal(level.requireAt(12, 10).typ, CORR);
    const actual = glyphAt(12, 10);
    assert.ok(expected?.kind === 'monster' && actual?.kind === 'monster');
    assert.equal(actual.mnum, expected.mnum);
});

void test('a thrown potion flashes its hallucinated appearance before breaking', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    const potion = await knownObject(POT_WATER);
    initRng(31n);
    const expected = transientObjectGlyph(potion);
    initRng(31n);
    const flashes: (number | undefined)[] = [];
    game.animationFrame = async () => { flashes.push(glyphAt(13, 10)?.glyph); };

    await finishHeroThrownObjectLanding({
        object: potion, x: 13, y: 10, publish: () => {},
    });

    assert.equal(potion.where, 'gone');
    assert.equal(flashes.length, 1);
    assert.equal(flashes[0], expected.glyph);
    assert.notEqual(glyphAt(13, 10)?.glyph, expected.glyph);
});

void test('a potion shattering on hot ground leaves a hallucinated object beside it unchanged', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    game.level.flags.temperature = 1;
    placeCreatedObject(await knownObject(CHEST), 13, 10);
    initRng(23n);
    newsym(13, 10);
    const before = glyphAt(13, 10);
    const potion = await knownObject(POT_WATER);

    // breakobj() only deletes the potion; nothing redraws its square.
    await landFloorObject(potion, 13, 10, { publish: async () => {}, random: () => 99 });

    assert.equal(potion.where, 'gone');
    assert.equal(glyphAt(13, 10)?.glyph, before?.glyph);
});

for (const hallucinating of [false, true]) {
    void test(`looking at a detected engulfer preserves ${hallucinating ? 'hallucinated descriptions' : 'its identity at the hero square'}`, async () => {
        freshObjectRoom();
        const engulfer = await createMonsterAt('purple worm', 11, 10, MM_NOGRP | NO_MINVENT);
        engulfer.mx = game.u.ux;
        engulfer.my = game.u.uy;
        game.u.ustuck = engulfer;
        game.u.uswallow = 1;
        game.u.hallucinationTurns = hallucinating ? 20 : 0;
        initRng(31n);
        // lookat() checks the detected glyph against a fresh mon_to_glyph().
        const displayed = transientMonsterGlyph(engulfer);
        const inspected = transientMonsterGlyph(engulfer);
        if (hallucinating) assert.notEqual(displayed.glyph, inspected.glyph);
        const expectedNextName = randomDisplayMonsterName();
        initRng(31n);
        const constraints = unconstrainMap();
        try {
            mapDetectedMonster(engulfer, false);

            const description = await farlookLocationDescription(game.u.ux, game.u.uy);

            if (hallucinating) assert.equal(randomDisplayMonsterName(), expectedNextName);
            else assert.match(description, /purple worm/);
        } finally {
            reconstrainMap(constraints);
        }
    });
}

void test('browsing detected objects inside an engulfer preserves the next hallucinated description', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const engulfer = await createMonsterAt('purple worm', 11, 10, MM_NOGRP | NO_MINVENT);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    game.u.ustuck = engulfer;
    game.u.uswallow = 1;
    game.u.hallucinationTurns = 20;
    const potion = await knownObject(POT_WATER, { ox: game.u.ux, oy: game.u.uy });
    await clearDetectionMap();
    initRng(31n);
    transientObjectGlyph(potion);
    transientMonsterGlyph(engulfer);
    const expectedNextName = randomDisplayMonsterName();
    initRng(31n);
    const constraints = unconstrainMap();
    try {
        map_object(potion);
        pushKeys('lh.');

        await browseDetectionMap(TER_OBJ, 'object of interest');

        assert.equal(randomDisplayMonsterName(), expectedNextName);
    } finally {
        reconstrainMap(constraints);
    }
});

void test('a newborn shapechanger shows the same hallucinated form as a silent later change', async () => {
    async function changeAtBirth(newborn: boolean) {
        freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
        const monster = await createMonsterAt('chameleon', 12, 10, MM_NOGRP | NO_MINVENT);
        game.u.protectionFromShapeChangers = false;
        monster.cham = monster.mnum;
        game.u.hallucinationTurns = 20;
        initRng(19n);

        if (newborn) await initialShapechangedBirth(monster);
        else await changeMonsterForm(monster);

        const glyph = glyphAt(monster.mx, monster.my);
        assert.ok(glyph?.kind === 'monster');
        return { species: monster.mnum, perceived: glyph.mnum, name: monsterName(monster) };
    }

    const later = await changeAtBirth(false);
    const newborn = await changeAtBirth(true);

    assert.equal(newborn.species, later.species);
    assert.equal(newborn.perceived, later.perceived);
    assert.equal(newborn.name, later.name);
});

void test('Vlad keeps his birth form without choosing a discarded hallucinated name', async () => {
    freshObjectRoom();
    const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, MM_NOGRP | NO_MINVENT);
    const species = vlad.mnum;
    game.u.hallucinationTurns = 20;
    initRng(19n);
    const expectedName = monsterName(vlad);
    initRng(19n);

    const changed = await initialShapechangedBirth(vlad);

    assert.equal(changed, null);
    assert.equal(vlad.mnum, species);
    assert.equal(monsterName(vlad), expectedName);
});
