import test from 'node:test';
import assert from 'node:assert/strict';
import { LARGE_BOX, OIL_LAMP } from '../js/object_data.js';
import { SIZEOF_OEXTRA } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { rhack } from '../js/cmd.js';
import { create_monster } from '../js/sp_lev.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { beginObjectBurn } from '../js/timeout.js';
import { restoreGame, saveGame } from '../js/save.js';
import { saveBonesLevel } from '../js/bones.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initializeArtifacts } from '../js/artifact.js';
import { pushKeys } from '../js/input.js';
import { createDungeon } from './support/topology.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createGasCloudSelection, restoreLevelRegions, runLevelRegions, updateMonsterRegions } from '../js/region.js';
import { restoreLevelLightSources } from '../js/light.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
// The bones-room setup from bones.test.ts: a room on a bones-enabled level
// whose save the next freshBonesWizardRoom call can load.
function freshBonesWizardRoom(storage) {
    freshPlayableRoom({
        seed: 8701n,
        hero: {
            uz: { dnum: 0, dlevel: 7 },
            ualign: { type: 1, record: 10 },
        },
    });
    requirePlayingGame(game);
    game.storage = storage;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.flags.debug = true;
    init_objects();
    initializeArtifacts(game);
}
// Each wizard window waits for a dismiss key; capture the screen at every
// wait so the test sees every page the native game would show.
function captureScreens() {
    const screens = [];
    resetInputState().beforeRead = () => {
        screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')));
    };
    return screens;
}
// C wizcmds.c:1112-1114: the #stats row template "%-27s  %4ld  %6ld" and the
// fixed header and separator lines.
function statsRow(label, count, size) {
    return `${label.padEnd(27)}  ${String(count).padStart(4)}  ${String(size).padStart(6)}`;
}
const STATS_HDR = '                             count  bytes';
const STATS_SEP = '---------------------------  ----- -------';
async function freshLitLampRoom() {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP);
    // C timeout.c:1789-1793: begin_burn() lights the lamp and registers its
    // light source at the hero's square.
    assert.equal(beginObjectBurn(lamp, game), true);
    return lamp;
}
void test('#lightsources lists a carried lit lamp with C\'s column layout', async () => {
    const lamp = await freshLitLampRoom();
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    // The '#' editor reads the command name key by key; keep only the
    // rendered listing screens.
    const windowScreens = screens.filter(rows => rows.some(row => row.includes('Mobile light sources:')));
    assert.equal(windowScreens.length, 1, 'the listing waits for one dismiss key');
    const firstScreen = windowScreens[0];
    assert.ok(firstScreen, 'the listing must render a screen');
    const listing = firstScreen.join('\n');
    // C light.c:945: "Mobile light sources: hero @ (%2d,%2d)".
    assert.match(listing, /Mobile light sources: hero @ \(10,10\)/);
    // C light.c:950-951: the column header and its underline.
    assert.match(listing, /location range flags  type    id/);
    assert.match(listing, /-------- ----- ------ ----  -------/);
    // C light.c:953: "  %2d,%2d   %2d   0x%04x  %s  %s".  The lamp sits at
    // the hero, its range is the lamp value 3 (light.c:874), and its flags
    // show LSF_SHOW (light.c:41), set by the vision pass that followed the
    // lighting.  C's id column is fmt_ptr() of the object address; the port
    // shows the stable o_id in the same shape.
    assert.match(listing, new RegExp(`10,10 {4}3 {3}0x0001 {2}obj {2}0x${lamp.o_id.toString(16)}`));
    assert.equal(game.context.move, 0);
});
void test('#lightsources shows <none> without light sources', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    // C light.c:968-969: the empty-listing branch.
    const windowScreens = screens.filter(rows => rows.some(row => row.includes('Mobile light sources:')));
    const firstScreen = windowScreens[0];
    assert.ok(firstScreen, 'the listing must render a screen');
    assert.match(firstScreen.join('\n'), /<none>/);
    assert.doesNotMatch(firstScreen.join('\n'), /location range flags/);
});
void test('#lightsources restores the hero form light ahead of a lamp lit later', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    resetInputState();
    await runExtendedCommand('polyself', 'gold dragon\n                        ');
    assert.equal(game.u.formLightRange, 2);
    resetInputState();
    const lamp = await addInventoryObject(OIL_LAMP);
    assert.equal(beginObjectBurn(lamp, game), true);
    game.plname = 'Formlight';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Formlight', storage), true);
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    const screen = screens.find(rows => rows.some(row => row.includes('Mobile light sources:')));
    assert.ok(screen, 'the restored light listing must render');
    const sources = screen.filter(row => /0x[0-9a-f]{4}  (you|obj)  /.test(row));
    assert.equal(sources.length, 2, `expected the form and lamp lights:\n${screen.join('\n')}`);
    // C light.c:16-17 keeps youmonst.mx at 0; maybe_write_ls():586 uses
    // "is_global = !mon_is_local(ls->id.a_monst)".  restore_light_sources()
    // (:490-491) prepends each saved entry: "ls->next = gl.light_base;
    // gl.light_base = ls;", reversing the global batch, hero included.
    // do_light_sources():198-203 keeps LSF_SHOW on both: radius 2 first,
    // then radius 3.  A lamp-first traversal suppresses the hero's flag.
    assert.match(sources[0] ?? '', /10,10 {4}2 {3}0x0001 {2}you {2}0x1/);
    assert.match(sources[1] ?? '', /10,10 {4}3 {3}0x0001 {2}obj {2}0x[0-9a-f]+/);
});
void test('#stats reports the reference build\'s memory table', async () => {
    await freshLitLampRoom();
    const screens = captureScreens();
    await runExtendedCommand('stats', ' \x1b');
    // The empty room with one lit lamp yields a two-page NHW_TEXT window.
    const expected = [
        'Current memory statistics:',
        STATS_HDR,
        '  Objects, base size 112',
        statsRow('invent', 1, 112),
        statsRow('fobj', 0, 0),
        STATS_SEP,
        statsRow('  Obj total', 1, 112),
        '',
        '  Monsters, base size 192',
        statsRow('fmon', 0, 0),
        STATS_SEP,
        statsRow('  Mon total', 0, 0),
        '',
        '  Overview',
        statsRow('general, size 384', 0, 0),
        STATS_SEP,
        statsRow('  Over total', 0, 0),
        '',
        '  Miscellaneous',
        statsRow('traps, size 32', 0, 0),
        statsRow('engravings, size 64+text', 0, 0),
        statsRow('light sources, size 32', 1, 32),
        statsRow('timers, size 48', 1, 48),
        STATS_SEP,
        statsRow('  Misc total', 2, 80),
        '',
        STATS_SEP,
        statsRow('  Grand total', 3, 192),
    ];
    // The '#' editor reads the command name key by key; the text window's
    // full pages are the screens whose last row is the pager marker.
    const windowScreens = screens.filter(rows => rows[23]?.trimEnd() === '--More--');
    assert.equal(windowScreens.length, 2, 'the window pages every 23 rows');
    const pageSize = 23;
    for (const [page, screen] of windowScreens.entries()) {
        const rows = expected.slice(page * pageSize, (page + 1) * pageSize);
        while (rows.length < pageSize)
            rows.push('');
        for (const [row, text] of rows.entries())
            assert.equal(screen[row]?.trimEnd(), text, `page ${page + 1} row ${row + 1}`);
        assert.equal(screen[pageSize]?.trimEnd(), '--More--', `page ${page + 1} pager row`);
    }
    assert.equal(game.context.move, 0);
});
async function statsWindowRows() {
    const screens = captureScreens();
    await runExtendedCommand('stats', ' \x1b');
    return screens.filter(rows => rows[23]?.trimEnd() === '--More--')
        .flatMap(rows => rows.slice(0, 23).map(row => row.trimEnd()));
}
// Run #lightsources and return its printed source rows, newest first, in
// the window's own order (the data rows of light.c:953's listing).
async function lightsourcesWindowRows() {
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    const windowScreens = screens.filter(rows => rows.some(row => row.includes('Mobile light sources:')));
    const window = windowScreens[0];
    assert.ok(window, 'the listing must render a window');
    return window.filter(row => /^ *\d+, *\d+ +\d/.test(row));
}
void test('#lightsources keeps its last sighted lamp position while blind, including after restore', async () => {
    await freshLitLampRoom();
    await vision_recalc(0);
    setHeroBlindnessTurns(20);
    await rhack('l'.charCodeAt(0));
    await vision_recalc(0);
    assert.equal(game.u.ux, 11);
    // C vision.c:583's "goto skip" bypasses do_light_sources():703 while
    // Blind, retaining light.c:187-203's cached coordinates and LSF_SHOW.
    let rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /10,10 {4}3 {3}0x0001 {2}obj/);
    game.plname = 'Blindlight';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Blindlight', storage), true);
    rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /10,10 {4}3 {3}0x0001 {2}obj/);
    setHeroBlindnessTurns(0);
    await vision_recalc(0);
    rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /11,10 {4}3 {3}0x0001 {2}obj/);
});
void test('#lightsources leaves lights registered while blind at their creation positions with flags zero', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(20);
    const lamp = await addInventoryObject(OIL_LAMP);
    assert.equal(beginObjectBurn(lamp, game), true);
    await createMonsterAt('fire vortex', 12, 10);
    await rhack('l'.charCodeAt(0));
    await vision_recalc(0);
    // C light.c:new_light_core():84-89 sets the creation coordinates and
    // "ls->flags = 0"; Blind vision leaves both unchanged.
    let rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /12,10 {4}1 {3}0x0000 {2}mon/);
    assert.match(rows[1] ?? '', /10,10 {4}3 {3}0x0000 {2}obj/);
    setHeroBlindnessTurns(0);
    await vision_recalc(0);
    rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /12,10 {4}1 {3}0x0001 {2}mon/);
    assert.match(rows[1] ?? '', /11,10 {4}3 {3}0x0001 {2}obj/);
});
void test('#lightsources still refreshes a swallowed hero\'s carried light', async () => {
    await freshLitLampRoom();
    await vision_recalc(0);
    const worm = await createMonsterAt('purple worm', 12, 10);
    game.u.ustuck = worm;
    game.u.uswallow = 1;
    game.u.ux = worm.mx;
    game.u.uy = worm.my;
    // C vision.c:545-547 leaves the sight array empty but falls through
    // to do_light_sources():703; it does not take Blind's "goto skip".
    await vision_recalc(0);
    const rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /12,10 {4}3 {3}0x0001 {2}obj/);
});
void test('#lightsources registers a special-level appearance light ahead of an older lamp', async () => {
    await freshLitLampRoom();
    initRng(2n);
    const monster = await create_monster({ xstart: 0, ystart: 0, width: 80, height: 21 }, {
        point: { x: 12, y: 10 }, monsterType: MONSTER_NAME.indexOf('chameleon'), monsterClass: null,
        nameFemale: null, group: false,
        appearance: { kind: 'monster', type: MONSTER_NAME.indexOf('fire elemental') },
    });
    assert.ok(monster);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('fire elemental'));
    // C sp_lev.c:2100-2108 calls new_light_source() after the appearance
    // change.  light.c:83-90 prepends it: "ls->next = gl.light_base".
    const rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /12,10 {4}1 {3}0x0001 {2}mon/);
    assert.match(rows[1] ?? '', /10,10 {4}3 {3}0x0001 {2}obj/);
});
void test('#lightsources orders sources by registration across kinds', async () => {
    await freshLitLampRoom();
    const olderVortex = await createMonsterAt('fire vortex', 12, 10);
    // C light.c:83-90 prepends every registration: the newborn's light was
    // registered after the lamp's, so the monster line leads the listing
    // (light.c:953's row format "  %2d,%2d   %2d   0x%04x  %s  %s").
    let rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', / 12,10 {4}1 {3}0x0001 {2}mon {2}0x[0-9a-f]+/);
    assert.match(rows[1] ?? '', / 10,10 {4}3 {3}0x0001 {2}obj {2}0x[0-9a-f]+/);
    // A still newer registration takes the head.
    const newerVortex = await createMonsterAt('fire vortex', 13, 10);
    rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', new RegExp(`13,10 {4}1 {3}0x0001 {2}mon {2}0x${newerVortex.m_id.toString(16)}`));
    assert.match(rows[1] ?? '', new RegExp(`12,10 {4}1 {3}0x0001 {2}mon {2}0x${olderVortex.m_id.toString(16)}`));
    assert.match(rows[2] ?? '', / 10,10 {4}3 {3}0x0001 {2}obj {2}0x[0-9a-f]+/);
});
void test('#lightsources clears the coordinates of unlocatable sources', async () => {
    const lamp = await freshLitLampRoom();
    // zap.c:687: a source that get_obj_location() cannot resolve — a lit
    // lamp inside a closed container — reports (0,0) with LSF_SHOW cleared
    // (light.c:187-190).
    const box = await addInventoryObject(LARGE_BOX);
    game.inventory = game.inventory.filter(object => object !== lamp);
    box.contents = [...(box.contents || []), lamp];
    lamp.where = 'contained';
    lamp.container = box;
    // zap.c:701-707: a buried monster also reports (0,0) without
    // LSF_SHOW, while the type column's mon_is_local() test (mx > 0,
    // light.c:373) still prints "mon".
    const vortex = await createMonsterAt('fire vortex', 12, 10);
    vortex.mburied = 1;
    const listing = (await lightsourcesWindowRows()).join('\n');
    assert.match(listing, new RegExp(`0, 0 {4}3 {3}0x0000 {2}obj {2}0x${lamp.o_id.toString(16)}`));
    assert.match(listing, new RegExp(`0, 0 {4}1 {3}0x0000 {2}mon {2}0x${vortex.m_id.toString(16)}`));
});
void test('#stats counts retained oextra and mextra allocations', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP);
    // A bare omid (a corpse's ghost id, bones.ts:369) means C's oextra is
    // allocated; a cleared name leaves the record behind
    // (bones_object.ts).  C wizcmds.c:1121-1122 and 1235-1236 count the
    // allocations regardless of what they still hold.
    lamp.omid = 7;
    const box = await addInventoryObject(LARGE_BOX);
    box.oextra = {};
    const vortex = await createMonsterAt('fire vortex', 12, 10);
    vortex.mextra = {};
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('invent', 2, 2 * 112 + 2 * SIZEOF_OEXTRA)), `invent row missing from:\n${rows.join('\n')}`);
    assert.ok(rows.includes(statsRow('fmon', 1, 192 + 64)), `fmon row missing from:\n${rows.join('\n')}`);
});
void test('#stats keeps the region array\'s retained capacity after clouds expire', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    // One cloud: add_region() grew the region array to ten slots
    // (region.c:289-298).
    await createGasCloudSelection(game, [{ x: 9, y: 9 }, { x: 10, y: 9 }], 1, 0);
    // Two turns age the ttl-1 cloud to expiry through run_regions().
    await runLevelRegions(game);
    await runLevelRegions(game);
    assert.equal(game.level?.regions.length, 0);
    // C region_stats() (region.c:910) still sizes max_regions slots.
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('regions, size 96+8*rect+N', 0, 960)), `retained-capacity row missing from:\n${rows.join('\n')}`);
    // A level reload (rest_regions(), region.c:814) forgets that capacity.
    await restoreLevelRegions(game, 0);
    const reloaded = await statsWindowRows();
    assert.equal(reloaded.includes(statsRow('regions, size 96+8*rect+N', 0, 960)), false);
});
void test('a level reload reverses its monster light batch ahead of older lights', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const vortex = await createMonsterAt('fire vortex', 12, 10);
    const lamp = await addInventoryObject(OIL_LAMP);
    assert.equal(beginObjectBurn(lamp, game), true);
    // The lamp was lit after the newborn, so it currently leads the
    // listing.
    let rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', /10,10 {4}3 {3}0x0001 {2}obj/);
    // C light.c:487-491: restore_light_sources() pushes each saved entry
    // back onto the front of light_base, so the level's batch — its
    // resident monsters included (light.c:452-453 saves a monster's source
    // with its level when mon_is_local()) — returns ahead of the hero's
    // carried lights that never left the list.
    restoreLevelLightSources(game);
    rows = await lightsourcesWindowRows();
    assert.match(rows[0] ?? '', new RegExp(`12,10 {4}1 {3}0x0001 {2}mon {2}0x${vortex.m_id.toString(16)}`));
    assert.match(rows[1] ?? '', /10,10 {4}3 {3}0x0001 {2}obj/);
});
void test('#stats records a restored region capacity even without a live allocation', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    // A cloud saved with the game loses the session's allocation
    // bookkeeping on reload (gm.max_regions is runtime-only); rest_regions()
    // (region.c:814-815) still records the restored count for the level.
    await createGasCloudSelection(game, [{ x: 9, y: 9 }], 1, 0);
    game.plname = 'Regioncap';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Regioncap', storage), true);
    // Two turns age the ttl-1 cloud to expiry; region_stats() (region.c:910)
    // still sizes the restored slot.
    await runLevelRegions(game);
    await runLevelRegions(game);
    assert.equal(game.level?.regions.length, 0);
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('regions, size 96+8*rect+N', 0, 96)), `restored-capacity row missing from:\n${rows.join('\n')}`);
});
void test('#stats excludes a null oextra like the unallocated pointer', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP);
    // shk.c:3673 creates the used-up part of a billed stack with a null
    // oextra; wizcmds.c:1121 skips unallocated extensions.
    lamp.oextra = null;
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('invent', 1, 112)), `invent row missing from:\n${rows.join('\n')}`);
});
void test('#stats sizes a region\'s retained monster-id capacity', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 9, 9);
    // The founding newt joined through add_mon_to_reg(), leaving
    // MONST_INC = 5 id slots (region.c:174-184); walking out never shrinks
    // them (remove_mon_from_reg(), region.c:192-202), and region_stats()
    // sizes that retained capacity (region.c:919).
    await createGasCloudSelection(game, [{ x: 9, y: 9 }, { x: 10, y: 9 }], 4, 0);
    updateMonsterRegions(newt, game, { x: 14, y: 12 });
    const rows = await statsWindowRows();
    // 10 region slots + 2 cells + 5 id slots.
    assert.ok(rows.includes(statsRow('regions, size 96+8*rect+N', 1, 10 * 96 + 2 * 8 + 5 * 4)), `retained monster-id capacity missing from:\n${rows.join('\n')}`);
    // A level reload resets max_monst to the restored membership
    // (rest_regions(), region.c:873).
    await restoreLevelRegions(game, 0);
    const reloaded = await statsWindowRows();
    assert.ok(reloaded.includes(statsRow('regions, size 96+8*rect+N', 1, 96 + 2 * 8)), `rest capacity missing from:\n${reloaded.join('\n')}`);
});
void test('#stats sizes an allocated emin record without isminion', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const demon = await createMonsterAt('newt', 12, 10);
    // msummon demons get EMIN through MM_EMIN without isminion
    // (minion.c:148-160); wizcmds.c:1245 sizes the allocation.
    demon.emin = { parentmid: demon.m_id, min_align: 0, renegade: 0 };
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('fmon', 1, 192 + 64 + 8)), `emin-sized fmon row missing from:\n${rows.join('\n')}`);
});
void test('#stats counts every installed delayed killer', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    // make_sick() installs delayed_killer(SICK,...) (potion.c:178-188; the
    // port's record is u.sickCause), and a polymorphed hero who genocides
    // their own species installs delayed_killer(POLYMORPH,...)
    // (read.c:2984-2985; the port's record is the genocide cause).
    game.u.sickCause = 'food poisoning';
    game._polymorphGenocideCause = 'scroll';
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('delayed killers, size 272', 2, 544)), `delayed-killer row missing from:\n${rows.join('\n')}`);
});
void test('#stats sizes a bones cloud\'s monster-id capacity from its saved members', async () => {
    const storage = memoryStorage();
    freshBonesWizardRoom(storage);
    const soldier = await createMonsterAt('soldier', 12, 10);
    const cloud = await createGasCloudSelection(game, [{ x: 12, y: 10 }], 4, 0);
    assert.ok(cloud, 'the cloud must join the level');
    // The saved bones region also references a member that no longer exists
    // when the level is restored.
    cloud.monsterIds.push(soldier.m_id + 999);
    assert.equal(saveBonesLevel(), true);
    freshBonesWizardRoom(storage);
    pushKeys('yn');
    await mklev();
    // C region.c:873 sets max_monst from the saved membership before
    // reset_region_mids() (region.c:888-889) drops the unmappable id,
    // which lowers n_monst but never max_monst: one region slot, one cell,
    // two id slots.
    const rows = await statsWindowRows();
    assert.ok(rows.includes(statsRow('regions, size 96+8*rect+N', 1, 96 + 8 + 2 * 4)), `bones region capacity missing from:\n${rows.join('\n')}`);
});
//# sourceMappingURL=wizard_lightsources_stats.test.js.map