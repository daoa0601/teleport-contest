import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, G_GENOD, G_GONE, MM_NOCOUNTBIRTH, MM_NOGRP, MM_NOMSG, NO_MINVENT, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { doGenocide } from '../js/genocide.js';
import { pushKeys } from '../js/input.js';
import { generateMedusaLevel, makemonAt, mksobj, rndmonnum, splitHeroMonsterForm, } from '../js/mklev.js';
import { MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_NAME, SPECIAL_PM, requireMonsterData, } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjects } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { memoryStorage } from './support/memory-storage.js';
const NEWT = MONSTER_NAME.indexOf('newt');
const JACKAL = MONSTER_NAME.indexOf('jackal');
const CREATION_FLAGS = MM_NOGRP | MM_NOMSG | NO_MINVENT;
function speciesVital(species) {
    const vital = game.mvitals?.[species];
    assert.ok(vital, `Species ${species} must have its native population record`);
    return vital;
}
function markCommonSpeciesGone() {
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
        mvflags: species % 2 ? G_EXTINCT : G_GENOD, born: 0, died: 0,
    }));
}
void test('random creation produces no monster when all common species are gone', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    markCommonSpeciesGone();
    const monster = await makemonAt(null, 12, 10, CREATION_FLAGS);
    assert.equal(monster, null);
    assert.equal(game.level.monsters.length, 0);
});
void test('random creation excludes extinct and genocided species', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    markCommonSpeciesGone();
    speciesVital(JACKAL).mvflags = 0;
    const monster = await makemonAt(null, 12, 10, CREATION_FLAGS);
    assert.ok(monster);
    assert.equal(monster.mnum, JACKAL);
    assert.equal(speciesVital(monster.mnum).mvflags & G_GONE, 0);
    assert.ok(game.level.monsters.includes(monster));
});
void test('Quest random creation does not override genocide with a quest enemy', async () => {
    freshGameplayRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    game.dungeons = [{
            dname: 'The Quest', num_dunlevs: 5, entry_lev: 1, dunlev_ureached: 1, depth_start: 1,
            flags: { maze_like: false, hellish: false, alignment: null },
            bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        }];
    game.mvitals = Array.from({ length: SPECIAL_PM }, () => ({
        mvflags: G_GENOD, born: 0, died: 0,
    }));
    const monster = await makemonAt(null, 12, 10, CREATION_FLAGS);
    assert.equal(monster, null);
    assert.equal(game.level.monsters.length, 0);
});
void test('explicit creation permits extinction while respecting genocide', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    speciesVital(NEWT).mvflags = G_EXTINCT;
    const extinct = await makemonAt(NEWT, 12, 10, CREATION_FLAGS);
    assert.ok(extinct);
    pushKeys('newt\n' + ' '.repeat(20));
    await doGenocide(1);
    const genocided = await makemonAt(NEWT, 12, 10, CREATION_FLAGS);
    assert.ok(speciesVital(NEWT).mvflags & G_GENOD);
    assert.equal(genocided, null);
    assert.equal(game.level.monsters.length, 0);
});
void test('object species selection still chooses common species after extinction', () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    markCommonSpeciesGone();
    initRng(1n);
    const choices = Array.from({ length: 12 }, () => rndmonnum());
    assert.ok(choices.every(species => Number.isInteger(species)
        && species >= 0 && species < SPECIAL_PM));
    // C mkobj.c's fallback ignores extinction and level difficulty, while
    // excluding unique, special-only, and Gehennom-only species.
    assert.ok(choices.every(species => !(requireMonsterData(MONSTER_GENO, species)
        & (0x1000 | 0x0200 | 0x0400))));
    assert.ok(new Set(choices).size > 1);
    assert.ok(choices.some(species => requireMonsterData(MONSTER_DIFFICULTY, species) > 1));
});
void test('a statue retains a valid species when no living species can be generated', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    markCommonSpeciesGone();
    const statue = await mksobj(STATUE, false, false);
    assert.ok(statue.corpsenm !== undefined && Number.isInteger(statue.corpsenm));
    assert.ok(statue.corpsenm >= 0 && statue.corpsenm < SPECIAL_PM);
    assert.ok(speciesVital(statue.corpsenm).mvflags & G_GONE);
});
void test('the last ordinary birth makes a species unavailable for random creation', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    markCommonSpeciesGone();
    assert.ok(game.mvitals);
    game.mvitals[NEWT] = { mvflags: 0, born: 119, died: 0 };
    const lastBirth = await makemonAt(null, 12, 10, CREATION_FLAGS);
    const afterExtinction = await makemonAt(null, 13, 10, CREATION_FLAGS);
    assert.ok(lastBirth);
    assert.equal(lastBirth.mnum, NEWT);
    assert.equal(speciesVital(NEWT).born, 120);
    assert.ok(speciesVital(NEWT).mvflags & G_EXTINCT);
    assert.equal(afterExtinction, null);
});
void test('saved birth history reaches extinction after restore and retains it without living actors', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.plname = 'BirthHistory';
    markCommonSpeciesGone();
    assert.ok(game.mvitals);
    game.mvitals[NEWT] = { mvflags: 0, born: 0, died: 0 };
    const storage = memoryStorage();
    // Departed actors cannot supply the historical count when restoring.
    for (let birth = 0; birth < 119; birth++) {
        const monster = await makemonAt(NEWT, 12, 10, CREATION_FLAGS);
        assert.ok(monster, `ordinary birth ${birth + 1}`);
        await removeMonsterFromGame(monster);
    }
    assert.equal(game.level.monsters.length, 0);
    assert.equal(await saveGame(storage), true);
    freshGameplayRoom();
    requirePlayingGame(game);
    assert.equal(restoreGame('BirthHistory', storage), true);
    assert.equal(speciesVital(NEWT).born, 119);
    const lastBirth = await makemonAt(null, 12, 10, CREATION_FLAGS);
    assert.ok(lastBirth);
    assert.equal(lastBirth.mnum, NEWT);
    assert.equal(speciesVital(NEWT).born, 120);
    assert.ok(speciesVital(NEWT).mvflags & G_EXTINCT);
    await removeMonsterFromGame(lastBirth);
    assert.equal(await saveGame(storage), true);
    freshGameplayRoom();
    requirePlayingGame(game);
    assert.equal(restoreGame('BirthHistory', storage), true);
    const afterExtinction = await makemonAt(null, 12, 10, CREATION_FLAGS);
    assert.equal(speciesVital(NEWT).born, 120);
    assert.ok(speciesVital(NEWT).mvflags & G_EXTINCT);
    assert.equal(afterExtinction, null);
    assert.equal(game.level.monsters.length, 0);
});
void test('temporary creation does not count toward ordinary extinction', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.mvitals = [];
    assert.ok(game.mvitals);
    game.mvitals[NEWT] = { mvflags: 0, born: 119, died: 0 };
    const monster = await makemonAt(NEWT, 12, 10, CREATION_FLAGS | MM_NOCOUNTBIRTH);
    assert.ok(monster);
    assert.equal(speciesVital(NEWT).born, 119);
    assert.equal(speciesVital(NEWT).mvflags & G_EXTINCT, 0);
});
for (const [name, limit] of [['erinys', 3], ['Nazgul', 9]]) {
    void test(`${name} becomes extinct at its special birth limit`, async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        const species = MONSTER_NAME.indexOf(name);
        game.mvitals = [];
        game.mvitals[species] = { mvflags: 0, born: limit - 1, died: 0 };
        const monster = await makemonAt(species, 12, 10, CREATION_FLAGS);
        assert.ok(monster);
        assert.equal(speciesVital(species).born, limit);
        assert.ok(speciesVital(species).mvflags & G_EXTINCT);
    });
}
void test('a unique birth marks extinction even when its count is suppressed', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const species = MONSTER_NAME.indexOf('Medusa');
    const monster = await makemonAt(species, 12, 10, CREATION_FLAGS | MM_NOCOUNTBIRTH);
    assert.ok(monster);
    assert.equal(speciesVital(species).born, 0);
    assert.ok(speciesVital(species).mvflags & G_EXTINCT);
});
void test('high clerics retain the native exception to unique extinction', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const species = MONSTER_NAME.indexOf('high cleric');
    const monster = await makemonAt(species, 12, 10, CREATION_FLAGS);
    assert.ok(monster);
    assert.equal(speciesVital(species).born, 1);
    assert.equal(speciesVital(species).mvflags & G_EXTINCT, 0);
});
void test('species excluded from random generation do not become extinct by birth count', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const species = MONSTER_NAME.indexOf('human');
    game.mvitals = [];
    game.mvitals[species] = { mvflags: 0, born: 119, died: 0 };
    const monster = await makemonAt(species, 12, 10, CREATION_FLAGS);
    assert.ok(monster);
    assert.equal(speciesVital(species).born, 120);
    assert.equal(speciesVital(species).mvflags & G_EXTINCT, 0);
});
void test('the birth counter stops at its native maximum', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.mvitals = [];
    game.mvitals[NEWT] = { mvflags: G_EXTINCT, born: 255, died: 0 };
    const monster = await makemonAt(NEWT, 12, 10, CREATION_FLAGS);
    assert.ok(monster);
    assert.equal(speciesVital(NEWT).born, 255);
});
void test('a hero clone counts as one birth through the shared constructor', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    installPolymorphedHero('gremlin');
    const species = game.u.umonnum;
    const clone = await splitHeroMonsterForm();
    assert.ok(clone);
    assert.equal(clone.mnum, species);
    assert.equal(speciesVital(species).born, 1);
});
void test('Medusa rejects stone-resistant statue trials without counting their births', async () => {
    const active = freshSpecialLevel({
        prototype: 'medusa', variant: 2, seed: 142, depth: 21,
        monsterAlignment: 'chaos',
    });
    requirePlayingGame(game);
    const cockatrice = MONSTER_NAME.indexOf('cockatrice');
    game.mvitals = Array.from({ length: SPECIAL_PM }, () => ({
        mvflags: G_GENOD, born: 0, died: 0,
    }));
    speciesVital(cockatrice).mvflags = 0;
    speciesVital(MONSTER_NAME.indexOf('Medusa')).mvflags = 0;
    await generateMedusaLevel(active);
    const rejectedStatues = floorObjects(game.level).filter(object => object.otyp === STATUE && object.corpsenm === cockatrice);
    const livingCockatrices = game.level.monsters.filter(monster => monster.mnum === cockatrice);
    assert.ok(rejectedStatues.length > 0);
    assert.equal(speciesVital(cockatrice).born, livingCockatrices.length);
    assert.equal(speciesVital(cockatrice).mvflags & G_EXTINCT, 0);
});
//# sourceMappingURL=monster_generation_selection.test.js.map