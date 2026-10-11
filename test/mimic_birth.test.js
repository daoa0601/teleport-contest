import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, DOOR, D_CLOSED, G_EXTINCT, G_NOCORPSE, HWALL, M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, MM_NOMSG, NO_MINVENT, ROOMOFFSET, TEMPLE, } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { init_dungeons } from '../js/dungeon.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_GENO, MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, CHEST, CORPSE, RIN_PROTECTION_FROM_SHAPE_CHANGERS, TIN } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { restoreGame, saveGame } from '../js/save.js';
import { initializeSourceStartup } from '../js/startup.js';
const MIMIC = MONSTER_NAME.indexOf('giant mimic');
const birthFlags = NO_MINVENT | MM_NOMSG;
function speciesVital(species) {
    const vital = game.mvitals?.[species];
    assert.ok(vital, `Species ${species} must have its native population record`);
    return vital;
}
void test('a loaded Sokoban graph excludes maze-statue mimic disguises', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
        freshObjectRoom();
        requirePlayingGame(game);
        game.flags.debug = true;
        await init_dungeons();
        const dnum = game.dungeons.findIndex(dungeon => dungeon.dname === 'Sokoban');
        game.u.uz = { dnum, dlevel: 2 };
        game.level.flags.is_maze_lev = true;
        const location = game.level.requireAt(12, 10);
        location.typ = CORR;
        location.roomno = 0;
        initRng(BigInt(seed));
        const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
        assert.ok(mimic);
        assert.equal(game.sokoban_dnum, dnum);
        assert.equal(M_AP_TYPE(mimic), M_AP_OBJECT);
        assert.equal(mimic.mappearance, BOULDER);
    }
});
void test('door mimics use furniture before any maze or room disguise', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.flags.is_maze_lev = true;
    const location = game.level.requireAt(12, 10);
    location.typ = DOOR;
    location.doormask = D_CLOSED;
    game.level.requireAt(11, 10).typ = HWALL;
    const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
    assert.ok(mimic);
    assert.equal(M_AP_TYPE(mimic), M_AP_FURNITURE);
    assert.equal(mimic.mappearance, 16); // S_hcdoor
    newsym(12, 10);
    const glyph = glyphAt(12, 10);
    assert.ok(glyph?.kind === 'terrain');
    assert.equal(glyph.terrainName, 'closed door');
    assert.equal(game.level.requireAt(12, 10).disp_ch, '+');
});
void test('a floor object takes precedence even when the mimic occupies a door', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 12, 10);
    const location = game.level.requireAt(12, 10);
    location.typ = DOOR;
    location.doormask = D_CLOSED;
    const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
    assert.ok(mimic);
    assert.equal(M_AP_TYPE(mimic), M_AP_OBJECT);
    assert.equal(mimic.mappearance, CHEST);
    assert.equal(chest.where, 'floor');
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(chest));
});
void test('temple mimics appear as altars with a represented alignment', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.rooms = [{
            lx: 7, hx: 16, ly: 6, hy: 14, rtype: TEMPLE, rlit: 1,
            doorct: 0, fdoor: 0, irregular: false, needjoining: true,
            nsubrooms: 0, sbrooms: [], roomnoidx: 0, needfill: 0,
        }];
    level.nroom = 1;
    level.requireAt(12, 10).roomno = ROOMOFFSET;
    const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
    assert.ok(mimic);
    assert.equal(M_AP_TYPE(mimic), M_AP_FURNITURE);
    assert.equal(mimic.mappearance, 33); // S_altar
    assert.ok(mimic.mcorpsenm !== undefined && [1, 2, 4].includes(mimic.mcorpsenm));
});
void test('shapechanger protection suppresses a newborn mimic disguise', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
    assert.ok(mimic);
    assert.equal(M_AP_TYPE(mimic), M_AP_NOTHING);
});
for (const appearance of [CORPSE, TIN]) {
    void test(`mimic object shape ${appearance} respects species which leave no corpse`, async () => {
        freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 2 }, ulevel: 1 } });
        requirePlayingGame(game);
        await floorObject(appearance, 12, 10);
        const gasSpore = MONSTER_NAME.indexOf('gas spore');
        for (let species = 0; species < MONSTER_GENO.length; species++) {
            if (species !== gasSpore)
                speciesVital(species).mvflags |= G_EXTINCT;
        }
        const mimic = await makemonAt(MIMIC, 12, 10, birthFlags);
        assert.ok(mimic);
        assert.equal(mimic.mappearance, appearance);
        if (appearance === TIN)
            assert.equal(mimic.mcorpsenm, -1);
        else
            assert.ok(mimic.mcorpsenm !== undefined && mimic.mcorpsenm >= MONSTER_NAME.indexOf('archeologist')
                && mimic.mcorpsenm <= MONSTER_NAME.indexOf('wizard'), 'a no-corpse species must use a human adventurer corpse disguise');
    });
}
void test('native new-game vitals initialize no-corpse species without resetting restored birth history', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await initializeSourceStartup();
    const gasSpore = MONSTER_NAME.indexOf('gas spore');
    assert.ok(speciesVital(gasSpore).mvflags & G_NOCORPSE);
    const monster = await makemonAt(gasSpore, 12, 10, birthFlags);
    assert.ok(monster);
    const born = speciesVital(gasSpore).born;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname || 'player', storage), true);
    assert.equal(speciesVital(gasSpore).born, born);
    assert.ok(speciesVital(gasSpore).mvflags & G_NOCORPSE);
});
//# sourceMappingURL=mimic_birth.test.js.map