import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MAGIC_PORTAL, VIBRATING_SQUARE } from '../js/const.js';
import { makeInvocationArea } from '../js/invocation_area.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { addTrap } from './support/level-state.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
void test('#wizwhere retains the invocation position after the ritual removes its trap', async () => {
    const level = freshObjectRoom({ left: 6, right: 26, top: 3, bottom: 19, heroX: 16, heroY: 11,
        flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 8 } } });
    game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 9, flags: { hellish: true } })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    level.invocationPosition = { x: 16, y: 11 };
    addTrap(level, VIBRATING_SQUARE, 16, 11);
    installPagerInput(resetInputState(), { expected: /floor shakes|walls around|stairwell/, limit: 4 });
    await makeInvocationArea();
    assert.equal(level.traps.some(trap => trap.ttyp === VIBRATING_SQUARE), false);
    const diagnostics = [];
    resetInputState().beforeRead = () => {
        const line = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''))
            .find(row => row.includes('Invocation position'));
        if (line)
            diagnostics.push(line.trim());
    };
    await runExtendedCommand('wizwhere', ' ');
    assert.equal(diagnostics.at(-1), 'Invocation position @ (16,11), hero @ (16,11)');
    assert.equal(game.context.move, 0);
});
void test('#wizwhere marks the current special level and reports a portal location', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    game.specialLevels = new Map([['oracle', createSpecialLevel({ dnum: 0, dlevel: 8 })]]);
    addTrap(level, MAGIC_PORTAL, 14, 10);
    const pages = [];
    resetInputState().beforeRead = () => {
        pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
    };
    await runExtendedCommand('wizwhere', ' ');
    assert.match(pages.join('\n'), /\* oracle: 8/);
    assert.match(pages.join('\n'), /Portal @ \(14,10\), hero @ \(10,10\)/);
    assert.equal(game.context.move, 0);
});
void test('wizard level teleport from the endgame offers only endgame destinations', async () => {
    freshObjectRoom({ flags: { debug: true }, hero: { uz: { dnum: 1, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
        createDungeon({ dname: 'The Elemental Planes', num_dunlevs: 5, depth_start: -5 }),
    ];
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 5 });
    game.specialLevels = new Map([
        ['oracle', createSpecialLevel({ dnum: 0, dlevel: 8 })],
        ['earth', createSpecialLevel({ dnum: 1, dlevel: 1 })],
        ['astral', createSpecialLevel({ dnum: 1, dlevel: 5 })],
    ]);
    const pages = [];
    resetInputState().beforeRead = () => {
        pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
    };
    await runExtendedCommand('wizlevelport', '?\n\x1b');
    const menu = pages.find(page => page.includes('Level teleport to where:'));
    assert.ok(menu, 'The level teleport menu must open');
    assert.match(menu, /The Elemental Planes/);
    assert.doesNotMatch(menu, /The Dungeons of Doom|oracle/);
});
//# sourceMappingURL=wizard_dungeon_layout.test.js.map