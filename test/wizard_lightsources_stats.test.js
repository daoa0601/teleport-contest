import test from 'node:test';
import assert from 'node:assert/strict';
import { LARGE_BOX, OIL_LAMP } from '../js/object_data.js';
import { SIZEOF_OEXTRA } from '../js/const.js';
import { beginObjectBurn } from '../js/timeout.js';
import { createGasCloudSelection, regionStats, restoreLevelRegions, runLevelRegions } from '../js/region.js';
import { lightSourceRecords, restoreLevelLightSources } from '../js/light.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
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
void test('#lightsources orders sources by registration across kinds', async () => {
    await freshLitLampRoom();
    const olderVortex = await createMonsterAt('fire vortex', 12, 10);
    // C light.c:83-90 prepends every registration: the newborn's light was
    // registered after the lamp's, so the monster line leads the listing.
    let records = lightSourceRecords(game);
    assert.equal(records[0]?.kind, 'mon');
    assert.equal(records[1]?.kind, 'obj');
    // A still newer registration takes the head.
    const newerVortex = await createMonsterAt('fire vortex', 13, 10);
    records = lightSourceRecords(game);
    assert.equal(records[0]?.idText, `0x${newerVortex.m_id.toString(16)}`);
    assert.equal(records[1]?.idText, `0x${olderVortex.m_id.toString(16)}`);
    assert.equal(records[2]?.kind, 'obj');
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
    const records = lightSourceRecords(game);
    const lampRecord = records.find(record => record.kind === 'obj' && record.idText === `0x${lamp.o_id.toString(16)}`);
    assert.deepEqual([lampRecord?.x, lampRecord?.y, lampRecord?.show], [0, 0, false]);
    const vortexRecord = records.find(record => record.kind === 'mon');
    assert.deepEqual([vortexRecord?.x, vortexRecord?.y, vortexRecord?.show], [0, 0, false]);
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
    // The lamp was lit after the newborn, so it currently leads.
    assert.equal(lightSourceRecords(game)[0]?.kind, 'obj');
    // C light.c:487-491: restore_light_sources() pushes each saved entry
    // back onto the front of light_base, so the level's batch — its
    // resident monsters included (light.c:452-453 saves a monster's source
    // with its level when mon_is_local()) — returns ahead of the hero's
    // carried lights that never left the list.
    restoreLevelLightSources(game);
    const records = lightSourceRecords(game);
    assert.equal(records[0]?.idText, `0x${vortex.m_id.toString(16)}`);
    assert.equal(records[1]?.kind, 'obj');
});
void test('#stats records a restored region capacity even without a live allocation', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    // A level whose regions arrived from a save (not through add_region())
    // has no capacity entry yet; rest_regions() (region.c:814-815) still
    // records max_regions for it.
    const level = game.level;
    assert.ok(level, 'the fixture must install a level');
    level.regions.push({ kind: 'gas-cloud', visible: true, damage: 0, ttl: 1,
        cells: [{ x: 9, y: 9 }], monsterIds: [], heroInside: false });
    await restoreLevelRegions(game, 0);
    // Expiry later removes the region; the recorded capacity remains.
    level.regions.length = 0;
    const stats = regionStats(game);
    assert.deepEqual([stats.count, stats.size], [0, 96]);
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
//# sourceMappingURL=wizard_lightsources_stats.test.js.map