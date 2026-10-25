// C refs: dungeon.c show_overview()/print_mapseen() with final > 0.  The
// end-of-game dungeon overview discloses every visited level in every
// dungeon with the full mapseen projection: dungeon headings with the
// reached-level range, learned feature lines, and the hero's own final
// resting place.  Interest filtering applies only to the live #overview.
import assert from 'node:assert/strict';
import test from 'node:test';
import { TRICKED } from '../js/const.js';
import { dungeonOverviewDisclosure } from '../js/cmd.js';
import { initOverviewRecord } from '../js/dungeon.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { InputGate, resetInputState } from '../js/input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
const MINES = 1;
function twoBranchDungeons() {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 5 }),
        createDungeon({
            dname: 'The Gnomish Mines', num_dunlevs: 4,
            depth_start: 3, dunlev_ureached: 2,
        }),
    ];
    game.branches = [];
    initOverviewRecord({ dnum: 0, dlevel: 1 }, game);
    initOverviewRecord({ dnum: MINES, dlevel: 1 }, game);
    initOverviewRecord({ dnum: MINES, dlevel: 2 }, game);
    const minesEntry = game._overviewRecords?.get(`${MINES}:1`);
    assert.ok(minesEntry, 'the mines record exists');
    minesEntry.features.nfount = 2;
}
function disclosureText(ending, cause) {
    const lines = dungeonOverviewDisclosure(ending, cause);
    return lines.map(line => typeof line === 'string' ? line : line.text).join('\n');
}
async function settleEnding(input, ending) {
    for (let guard = 0; guard < 16; guard++) {
        const done = await Promise.race([
            ending.then(() => true),
            input.waitUntilBlocked().then(() => false),
        ]);
        if (done)
            return;
        const row = game.nhDisplay?.grid[0]
            ?.map(cell => cell.ch).join('').trimEnd() || '';
        input.feed(/Do you want/.test(row) ? 'n' : ' ');
    }
    await ending;
}
void test('a death in a branch dungeon discloses that branch with its features', async () => {
    twoBranchDungeons();
    game.u.uz = { dnum: MINES, dlevel: 2 };
    game.storage = memoryStorage();
    game.flags.tombstone = false;
    const input = resetInputState();
    const ending = finishOrdinaryDeath({ killer: 'gas spore explosion' });
    try {
        for (let guard = 0; guard < 12; guard++) {
            await input.waitUntilBlocked();
            const row = game.nhDisplay?.grid[0]
                ?.map(cell => cell.ch).join('').trimEnd() || '';
            if (/dungeon overview/.test(row))
                break;
            input.feed(/Do you want/.test(row) ? 'n' : ' ');
        }
        input.feed('y');
        await input.waitUntilBlocked();
        const screen = (game.nhDisplay?.grid ?? [])
            .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
        assert.match(screen, /The Dungeons of Doom:$/m);
        assert.match(screen, /The Gnomish Mines: levels 3 to 4$/m);
        assert.match(screen, / {3}Level 3:$/m);
        assert.match(screen, / {3}Level 4: <- You were here\.$/m);
        assert.match(screen, / {6}Some fountains\.$/m);
        assert.match(screen, / {6}Final resting place for$/m);
        assert.match(screen, / {9}you, killed by a gas spore explosion\.$/m);
        input.feed('\x1b');
        await input.waitUntilBlocked();
    }
    finally {
        await settleEnding(input, ending);
    }
});
void test('surviving endings keep their own here-marking and resting place', () => {
    twoBranchDungeons();
    game.u.uz = { dnum: MINES, dlevel: 2 };
    const escaped = disclosureText('escaped', 'escaped');
    assert.match(escaped, / {3}Level 4: <- You left from here\.$/);
    assert.doesNotMatch(escaped, /Final resting place/);
    const quit = disclosureText('quit', 'quit');
    assert.match(quit, / {3}Level 4: <- You were here\.$/);
    assert.doesNotMatch(quit, /Final resting place/);
});
void test('a death on the dungeon top suppresses the level range in the heading', () => {
    twoBranchDungeons();
    game.u.uz = { dnum: 0, dlevel: 1 };
    const died = disclosureText(null, 'killed by a gas spore');
    // dunlev_ureached equals entry_lev, so print_mapseen() shows no range.
    assert.match(died, /The Dungeons of Doom:\n {3}Level 1: <- You were here\./);
});
void test('the hero death cause reads in the second person', () => {
    twoBranchDungeons();
    game.u.uz = { dnum: 0, dlevel: 1 };
    const died = disclosureText(null, 'killed by his own fire');
    assert.match(died, / {9}you, killed by your own fire\.$/m);
    // strsubst() replaces only the first match of each phrase.
    const twice = disclosureText(null, 'killed by his cat and his dog');
    assert.match(twice, / {9}you, killed by your cat and his dog\.$/m);
});
void test('a tricked ending discloses as a non-death without a resting place', async () => {
    twoBranchDungeons();
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.storage = memoryStorage();
    game.flags.tombstone = false;
    const input = resetInputState();
    // C: how >= PANICKED passes final 1 to show_overview(), so a tricked
    // "death" keeps the were-here marker but lists no resting place.
    const ending = finishOrdinaryDeath({ killer: 'a nasty trap', deathType: TRICKED });
    try {
        for (let guard = 0; guard < 12; guard++) {
            await input.waitUntilBlocked();
            const row = game.nhDisplay?.grid[0]
                ?.map(cell => cell.ch).join('').trimEnd() || '';
            if (/dungeon overview/.test(row))
                break;
            input.feed(/Do you want/.test(row) ? 'n' : ' ');
        }
        input.feed('y');
        await input.waitUntilBlocked();
        const screen = (game.nhDisplay?.grid ?? [])
            .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
        assert.match(screen, / {3}Level 1: <- You were here\.$/m);
        assert.doesNotMatch(screen, /Final resting place/);
        input.feed('\x1b');
        await input.waitUntilBlocked();
    }
    finally {
        await settleEnding(input, ending);
    }
});
void test('a tutorial death discloses the start level through the shared projection', () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom' }),
        createDungeon({ dname: 'The Tutorial' }),
    ];
    game.branches = [];
    initOverviewRecord({ dnum: 0, dlevel: 1 }, game);
    initOverviewRecord({ dnum: 1, dlevel: 1 }, game);
    game.u.uz = { dnum: 1, dlevel: 1 };
    const died = disclosureText(null, 'killed by a falling rock');
    assert.equal(died, [
        'The Dungeons of Doom:',
        '   Level 1:',
        'The Tutorial:',
        '   Level 1: <- You were here.',
        '      Final resting place for',
        '         you, killed by a falling rock.',
    ].join('\n'));
});
void test('a death in the Planes discloses endgame levels before the dungeon', () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom' }),
        createDungeon({ dname: 'The Elemental Planes', num_dunlevs: 6, depth_start: -5 }),
    ];
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.branches = [];
    initOverviewRecord({ dnum: 0, dlevel: 1 }, game);
    for (let dlevel = 1; dlevel <= 5; dlevel++)
        initOverviewRecord({ dnum: 1, dlevel }, game);
    game.u.uz = { dnum: 1, dlevel: 1 };
    const died = disclosureText(null, 'killed by Famine');
    const lines = died.split('\n');
    assert.equal(lines[0], 'The Elemental Planes:');
    assert.equal(lines[1], '   Astral Plane: <- You were here.');
    assert.equal(lines[2], '      Final resting place for');
    assert.equal(lines[3], '         you, killed by Famine.');
    assert.equal(lines[4], '   Plane of Water:');
    assert.equal(lines[7], '   Plane of Earth:');
    assert.equal(lines[8], 'The Dungeons of Doom:');
    assert.equal(lines[9], '   Level 1:');
});
//# sourceMappingURL=dungeon_disclosure.test.js.map