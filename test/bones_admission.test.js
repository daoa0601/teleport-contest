import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, initializeArtifacts, nameArtifact } from '../js/artifacts.js';
import { canMakeBones } from '../js/bones_admission.js';
import { restoreBonesMonsters } from '../js/bones_monster.js';
import { DEFUNCT_MONSTER, G_EXTINCT, G_GENOD, MAGIC_PORTAL, NO_MINVENT } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { maketrap, mklev, mksobj, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { DAGGER, SACK, WAN_MAGIC_MISSILE } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { corpseObject, knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
const NEWT = MONSTER_NAME.indexOf('newt');
const CHAMELEON = MONSTER_NAME.indexOf('chameleon');
function eligibleBonesRoom() {
    freshPlayableRoom({
        flags: { bones: true, debug: true },
        hero: { uz: { dnum: 0, dlevel: 7 } },
    });
    game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D',
        })];
}
void test('the bones option and swallowing prevent even wizard bones', () => {
    eligibleBonesRoom();
    assert.equal(canMakeBones(), true);
    game.flags.bones = false;
    assert.equal(canMakeBones(), false);
    game.flags.bones = true;
    game.u.uswallow = true;
    assert.equal(canMakeBones(), false);
});
void test('bones require a level within the dungeon ledger', () => {
    eligibleBonesRoom();
    game.u.uz = { dnum: 0, dlevel: 0 };
    assert.equal(canMakeBones(), false);
    game.u.uz = { dnum: 0, dlevel: 11 };
    assert.equal(canMakeBones(), false);
    game.dungeons.push(createDungeon({
        dname: 'The Gnomish Mines', num_dunlevs: 8, depth_start: 5, bonetag: 'M',
    }));
    game.u.uz = { dnum: 1, dlevel: 1 };
    assert.equal(canMakeBones(), true, 'a branch-local first level has a valid global ledger number');
    game.u.uz = { dnum: 1, dlevel: 9 };
    assert.equal(canMakeBones(), false);
});
void test('dungeons and special levels independently require a bones tag', () => {
    eligibleBonesRoom();
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.bonetag = undefined;
    assert.equal(canMakeBones(), false);
    dungeon.bonetag = 'D';
    const special = createSpecialLevel({ ...game.u.uz });
    game.specialLevels = new Map([['special', special]]);
    assert.equal(canMakeBones(), false);
    special.bonetag = 'S';
    assert.equal(canMakeBones(), true);
});
void test('a dungeon bottom cannot leave bones even with its own special bones tag', () => {
    eligibleBonesRoom();
    game.u.uz = { dnum: 0, dlevel: 10 };
    game.specialLevels = new Map([['bottom', createSpecialLevel({
                ...game.u.uz, bonetag: 'B',
            })]]);
    assert.equal(canMakeBones(), false);
});
void test('the invocation level is excluded while the preceding Gehennom level can leave bones', () => {
    eligibleBonesRoom();
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.flags.hellish = true;
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1, bonetag: 'V' });
    game.u.uz = { dnum: 0, dlevel: 8 };
    assert.equal(canMakeBones(), true);
    game.u.uz.dlevel = 9;
    assert.equal(canMakeBones(), false);
});
for (const endpoint of ['end1', 'end2']) {
    void test(`a multiway branch at its ${endpoint} cannot leave bones`, () => {
        eligibleBonesRoom();
        requirePlayingGame(game);
        const branch = {
            end1: { dnum: 1, dlevel: 1 }, end2: { dnum: 2, dlevel: 1 },
            end1_up: false, type: 'stair', portal: false,
        };
        branch[endpoint] = { ...game.u.uz };
        game.branches = [branch];
        assert.equal(canMakeBones(), false);
    });
}
void test('a portal blocks ordinary bones but permits bones at a first-level branch entrance', async () => {
    eligibleBonesRoom();
    const portal = await maketrap(12, 10, MAGIC_PORTAL);
    assert.ok(portal);
    assert.equal(canMakeBones(), false);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.branches = [{
            end1: { dnum: 1, dlevel: 5 }, end2: { ...game.u.uz },
            end1_up: false, type: 'portal', portal: true,
        }];
    assert.equal(canMakeBones(), true);
});
void test('nonpositive dungeon depth cannot produce bones despite a valid local level', () => {
    eligibleBonesRoom();
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.depth_start = -6;
    assert.equal(canMakeBones(), false);
});
void test('the first three depths need wizard mode while deeper levels can win the bones trial', () => {
    eligibleBonesRoom();
    game.flags.debug = false;
    game.u.uz = { dnum: 0, dlevel: 3 };
    assert.equal(canMakeBones(), false);
    game.flags.debug = true;
    assert.equal(canMakeBones(), true);
    game.flags.debug = false;
    game.u.uz.dlevel = 4;
    assert.equal(canMakeBones(game, () => 1), true);
    assert.equal(canMakeBones(game, () => 0), false);
});
void test('an explicit game supplies its own dungeon and special-level metadata', () => {
    eligibleBonesRoom();
    requirePlayingGame(game);
    const state = {
        ...game,
        dungeons: [createDungeon({ dname: 'Other dungeon', num_dunlevs: 9, bonetag: 'O' })],
        specialLevels: new Map([['excluded', createSpecialLevel({ ...game.u.uz })]]),
    };
    assert.equal(canMakeBones(state), false);
    state.specialLevels.clear();
    assert.equal(canMakeBones(state), true);
    const dungeon = state.dungeons[0];
    assert.ok(dungeon);
    dungeon.num_dunlevs = 6;
    assert.equal(canMakeBones(state), false);
    assert.equal(canMakeBones(), true);
});
for (const mode of ['explore', 'discover']) {
    void test(`${mode} rejects bones without changing the following wand's charges or beatitude`, async () => {
        for (const seed of [1n, 7n, 21n, 83n]) {
            eligibleBonesRoom();
            game.flags.debug = false;
            init_objects();
            initRng(seed);
            canMakeBones();
            const expected = await mksobj(WAN_MAGIC_MISSILE, true, false);
            eligibleBonesRoom();
            game.flags.debug = false;
            init_objects();
            if (mode === 'explore')
                game.flags.explore = true;
            else
                game.discover = true;
            initRng(seed);
            assert.equal(canMakeBones(), false);
            const actual = await mksobj(WAN_MAGIC_MISSILE, true, false);
            assert.equal(actual.spe, expected.spe, `${mode}, seed ${seed}: following wand charges`);
            assert.equal(actual.blessed, expected.blessed, `${mode}, seed ${seed}: following wand blessing`);
            assert.equal(actual.cursed, expected.cursed, `${mode}, seed ${seed}: following wand curse`);
        }
    });
}
void test('Lua special-level bones permissions survive saving and restoring the dungeon graph', async () => {
    eligibleBonesRoom();
    initRng(271n);
    await init_dungeons();
    game.plname = 'BonesEligibility';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    eligibleBonesRoom();
    assert.equal(restoreGame('BonesEligibility', storage), true);
    for (const [name, eligible] of [['oracle', true], ['medusa', false], ['minend', false]]) {
        const special = game.specialLevels?.get(name);
        assert.ok(special, `the Lua dungeon graph must contain ${name}`);
        game.u.uz = { dnum: special.dnum, dlevel: special.dlevel };
        assert.equal(canMakeBones(), eligible, `${name} bones admission after restore`);
    }
});
function freshBonesRoom(storage) {
    freshPlayableRoom({
        seed: 8701n,
        hero: { uz: { dnum: 0, dlevel: 7 }, ualign: { type: 1, record: 10 } },
    });
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    game.storage = storage;
    game.flags.debug = true;
    init_objects();
    initializeArtifacts(game);
}
void test('a saved bones monster keeps its cargo and tallies the last permitted birth', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(newt, dagger);
    assert.equal(saveBonesLevel(), true);
    freshBonesRoom(storage);
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    game.mvitals = [];
    game.mvitals[NEWT] = { born: 119, died: 0, mvflags: 0 };
    pushKeys('yn');
    await mklev();
    const restored = requireGameLevel().monsters.find((monster) => monster.mnum === NEWT);
    assert.ok(restored);
    assert.ok(restored.mhpmax > 0);
    assert.equal(requireMonsterVital(NEWT).born, 120);
    assert.ok(requireMonsterVital(NEWT).mvflags & G_EXTINCT);
    assert.ok(restored.minvent);
    const restoredCargo = restored.minvent[0];
    assert.ok(restoredCargo);
    assert.equal(restored.minvent.length, 1);
    assert.equal(restoredCargo.otyp, DAGGER);
    assert.equal(restoredCargo.where, 'minvent');
    assert.equal(restoredCargo.carrierMid, restored.m_id);
});
for (const [name, limit] of [
    ['newt', 120],
    ['erinys', 3],
    ['Nazgul', 9],
]) {
    void test(`bones admission respects the ${name} birth limit`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        assert.ok(game.mvitals);
        const species = MONSTER_NAME.indexOf(name);
        const last = await createMonsterAt(name, 12, 10, NO_MINVENT);
        const excess = await createMonsterAt(name, 13, 10, NO_MINVENT);
        game.mvitals[species] = { born: limit - 1, died: 0, mvflags: 0 };
        await restoreBonesMonsters(game.level, game);
        assert.ok(requireGameLevel().monsters.includes(last));
        assert.ok(last.mhp > 0);
        assert.equal(requireGameLevel().monsters.includes(excess), false);
        assert.equal(excess.dead, true);
        assert.equal(excess.mhpmax, DEFUNCT_MONSTER);
        assert.equal(requireMonsterVital(species).born, limit);
        assert.ok(requireMonsterVital(species).mvflags & G_EXTINCT);
    });
}
for (const [name, flags] of [
    ['extinct', G_EXTINCT],
    ['genocided', G_GENOD],
]) {
    void test(`${name} bones actors are purged without tallying their births`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        assert.ok(game.mvitals);
        const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
        game.mvitals[NEWT] = { born: 5, died: 0, mvflags: flags };
        await restoreBonesMonsters(game.level, game);
        assert.equal(requireGameLevel().monsters.includes(newt), false);
        assert.equal(newt.mhpmax, DEFUNCT_MONSTER);
        assert.equal(newt.dead, true);
        assert.equal(requireMonsterVital(NEWT).born, 5);
        assert.equal(requireMonsterVital(NEWT).mvflags & flags, flags);
    });
}
void test('bones admission checks a shapechanger base rather than its current form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const chameleon = await createMonsterAt('chameleon', 12, 10, NO_MINVENT);
    await changeMonsterForm(chameleon, NEWT);
    assert.equal(chameleon.cham, CHAMELEON);
    game.mvitals[CHAMELEON] = { born: 10, died: 0, mvflags: G_GENOD };
    game.mvitals[NEWT] = { born: 4, died: 0, mvflags: 0 };
    await restoreBonesMonsters(game.level, game);
    assert.equal(requireGameLevel().monsters.includes(chameleon), false);
    assert.equal(chameleon.mhpmax, DEFUNCT_MONSTER);
    assert.equal(requireMonsterVital(CHAMELEON).born, 10);
    assert.equal(requireMonsterVital(NEWT).born, 4);
});
void test('an admitted shapechanger tallies only its base species', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const chameleon = await createMonsterAt('chameleon', 12, 10, NO_MINVENT);
    await changeMonsterForm(chameleon, NEWT);
    game.mvitals[CHAMELEON] = { born: 10, died: 0, mvflags: 0 };
    game.mvitals[NEWT] = { born: 4, died: 0, mvflags: G_GENOD };
    await restoreBonesMonsters(game.level, game);
    assert.ok(requireGameLevel().monsters.includes(chameleon));
    assert.ok(chameleon.mhpmax > 0);
    assert.equal(requireMonsterVital(CHAMELEON).born, 11);
    assert.equal(requireMonsterVital(NEWT).born, 4);
});
void test('only the first bones actor of a unique species is admitted', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const medusa = MONSTER_NAME.indexOf('Medusa');
    const first = await createMonsterAt('Medusa', 12, 10, NO_MINVENT);
    const duplicate = await createMonsterAt('Medusa', 13, 10, NO_MINVENT);
    game.mvitals[medusa] = { born: 0, died: 0, mvflags: 0 };
    await restoreBonesMonsters(game.level, game);
    assert.ok(requireGameLevel().monsters.includes(first));
    assert.equal(requireGameLevel().monsters.includes(duplicate), false);
    assert.equal(duplicate.mhpmax, DEFUNCT_MONSTER);
    assert.equal(requireMonsterVital(medusa).born, 1);
    assert.ok(requireMonsterVital(medusa).mvflags & G_EXTINCT);
});
void test('rejecting a genocided unique bones actor still marks unique extinction', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const medusa = MONSTER_NAME.indexOf('Medusa');
    const monster = await createMonsterAt('Medusa', 12, 10, NO_MINVENT);
    game.mvitals[medusa] = { born: 0, died: 0, mvflags: G_GENOD };
    await restoreBonesMonsters(game.level, game);
    assert.equal(requireGameLevel().monsters.includes(monster), false);
    assert.equal(requireMonsterVital(medusa).born, 0);
    assert.equal(requireMonsterVital(medusa).mvflags & (G_GENOD | G_EXTINCT), G_GENOD | G_EXTINCT);
});
void test('bones high clerics keep the native exception to unique extinction', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const species = MONSTER_NAME.indexOf('high cleric');
    const first = await createMonsterAt('high cleric', 12, 10, NO_MINVENT);
    const second = await createMonsterAt('high cleric', 13, 10, NO_MINVENT);
    game.mvitals[species] = { born: 0, died: 0, mvflags: 0 };
    await restoreBonesMonsters(game.level, game);
    assert.ok(requireGameLevel().monsters.includes(first));
    assert.ok(requireGameLevel().monsters.includes(second));
    assert.equal(requireMonsterVital(species).born, 2);
    assert.equal(requireMonsterVital(species).mvflags & G_EXTINCT, 0);
});
void test('bones birth limits also apply to species excluded from random generation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const species = MONSTER_NAME.indexOf('human');
    const human = await createMonsterAt('human', 12, 10, NO_MINVENT);
    game.mvitals[species] = { born: 120, died: 0, mvflags: 0 };
    await restoreBonesMonsters(game.level, game);
    assert.equal(requireGameLevel().monsters.includes(human), false);
    assert.equal(human.mhpmax, DEFUNCT_MONSTER);
    assert.equal(requireMonsterVital(species).born, 120);
    assert.equal(requireMonsterVital(species).mvflags & G_EXTINCT, 0);
});
void test('purging a bones actor drops protected cargo and deletes other cargo and timers', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    const troll = await createMonsterAt('troll', 12, 10, NO_MINVENT);
    const artifact = artifactByName(game.urole.artifactName);
    assert.ok(artifact);
    const protectedCargo = await knownObject(artifact.baseType);
    assert.equal(nameArtifact(protectedCargo, artifact), true);
    const sack = await knownObject(SACK);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('giant ant'));
    const dagger = await knownObject(DAGGER);
    await addObjectToContainer(sack, corpse);
    await addObjectToMonsterInventory(troll, protectedCargo);
    await addObjectToMonsterInventory(troll, sack);
    await addObjectToMonsterInventory(troll, dagger);
    assert.ok(objectTimers(corpse).length > 0);
    game.mvitals[troll.mnum] = { born: 120, died: 0, mvflags: G_EXTINCT };
    await restoreBonesMonsters(game.level, game);
    assert.equal(requireGameLevel().monsters.includes(troll), false);
    assert.equal(troll.mhpmax, DEFUNCT_MONSTER);
    assert.equal(troll.minvent.length, 0);
    assert.equal(protectedCargo.where, 'floor');
    assert.ok(floorObjects(game.level).includes(protectedCargo));
    assert.equal(dagger.where, 'gone');
    assert.equal(sack.where, 'gone');
    assert.equal(corpse.where, 'gone');
    assert.equal(objectTimers(corpse).length, 0);
});
//# sourceMappingURL=bones_admission.test.js.map