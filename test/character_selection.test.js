import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { memoryStorage } from './support/memory-storage.js';
async function selection(moves, options = '') {
    const engine = await runSegment({
        seed: 19,
        datetime: '20260801120000',
        nethackrc: `OPTIONS=name:Selector,!legacy,!tutorial,!tips${options ? ',' + options : ''}`,
        moves,
        storage: memoryStorage(),
    });
    await engine.lua.destroy();
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()).join('\n');
}
void test('Ranger uses lowercase r when a neutral alignment excludes Rogue', async () => {
    const menu = await selection('n', 'align:neutral');
    assert.match(menu, /r - a Ranger/);
    assert.doesNotMatch(menu, /R - a Ranger|a Rogue/);
});
void test('Rogue keeps lowercase r and Ranger uses uppercase R when both are offered', async () => {
    const menu = await selection('n');
    assert.match(menu, /r - a Rogue\nR - a Ranger/);
});
for (const [role, femaleName] of [['priest', 'Priestess'], ['caveman', 'Cavewoman']]) {
    void test(`the race menu calls a female ${role} ${femaleName}`, async () => {
        const menu = await selection('n', `role:${role},gender:female`);
        assert.match(menu, /Pick a race or species/);
        assert.ok(menu.includes(`${femaleName} <race> female <alignment>`), menu);
    });
}
void test('the opening question names the unspecified facets of a female Priestess', async () => {
    const menu = await selection('', 'role:priest,gender:female');
    assert.match(menu, /Shall I pick your Priestess' race and alignment for you\? \[ynaq\]/);
});
void test('choosing gender first updates role names and route labels', async () => {
    const menu = await selection('n"F');
    assert.match(menu, /Pick a role or profession/);
    assert.match(menu, /c - a Cavewoman/);
    assert.match(menu, /p - a Priestess/);
    assert.match(menu, /" - Pick another gender first/);
});
void test('filtering has a second page with gender and alignment choices', async () => {
    const menu = await selection('n~>');
    assert.match(menu, /Unacceptable genders\nM - male\nF - female/);
    assert.match(menu, /Unacceptable alignments\nL - lawful\nN - neutral\nC - chaotic/);
    assert.match(menu, /\(2 of 2\)/);
});
void test('filtering out Rogue reassigns r to Ranger and r selects it', async () => {
    const menu = await selection('n~r\nr');
    assert.match(menu, /Pick a race or species/);
    assert.match(menu, /Ranger <race>/);
});
void test('rejecting confirmation clears the previous choices', async () => {
    const menu = await selection('nphfln');
    assert.match(menu, /Pick a role or profession/);
    assert.match(menu, /<role> <race> <gender> <alignment>/);
});
void test('quit at the opening question stops before making a hero', async () => {
    const engine = await runSegment({
        seed: 19, datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Selector,!legacy,!tutorial,!tips',
        moves: 'q', storage: memoryStorage(),
    });
    await engine.lua.destroy();
    assert.equal(engine.lastRunResult?.kind, 'stopped');
    assert.equal(game.urole, null);
});
void test('the unconstrained question lists race, role, gender and alignment in native order', async () => {
    const menu = await selection('');
    assert.match(menu, /Shall I pick character's race, role, gender and alignment for you\? \[ynaq\]/);
});
void test('the opening question uses combined role names before gender is chosen', async () => {
    const menu = await selection('', 'role:priest');
    assert.match(menu, /your Priest\/Priestess's race, gender and alignment/);
});
void test('a race chosen first constrains the role accelerator and alignment route', async () => {
    const menu = await selection('n/g');
    assert.match(menu, /<role> gnome <gender> <alignment>/);
    assert.match(menu, /r - a Ranger/);
    assert.match(menu, /race forces neutral/);
    assert.doesNotMatch(menu, /\[ - Pick/);
});
void test('a role that forces race and alignment offers neither route', async () => {
    const menu = await selection('ns');
    assert.match(menu, /Pick a gender or sex/);
    assert.match(menu, /Samurai human <gender> lawful/);
    assert.match(menu, /role forces human/);
    assert.match(menu, /role forces lawful/);
    assert.doesNotMatch(menu, /\/ - Pick|\[ - Pick/);
});
void test('a selected female gender changes the alignment menu summary', async () => {
    const menu = await selection('nchf');
    assert.match(menu, /Pick an alignment or creed/);
    assert.match(menu, /Cavewoman human female <alignment>/);
});
void test('return selects the preselected random role', async () => {
    const menu = await selection('n\n');
    assert.doesNotMatch(menu, /Pick a role or profession/);
    assert.match(menu, /Pick a race|Pick a gender|Is this ok/);
});
void test('star chooses a compatible random race and proceeds to gender', async () => {
    const menu = await selection('np*');
    assert.match(menu, /Pick a gender or sex/);
    assert.match(menu, /Priest (?:human|elf) <gender>/);
});
void test('uppercase race and alignment shortcuts select the corresponding choices', async () => {
    const menu = await selection('npHfL');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /Selector the lawful female human Priestess/);
    assert.match(menu, /y \* Yes; start game/);
});
void test('confirmation rename retains every selected facet', async () => {
    const menu = await selection('nphflaChanged\n');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /Changed the lawful female human Priestess/);
});
void test('confirmation rename normalizes the name and ignores character suffixes', async () => {
    const menu = await selection('nphflaA.da-wiz-elf-m-cha\n');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /A_da the lawful female human Priestess/);
    assert.equal(game.plname, 'A_da');
});
void test('automatic picking produces a complete confirmation identity', async () => {
    const menu = await selection('y', 'role:priest,gender:female');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /Selector the (?:lawful|neutral|chaotic) female (?:human|elven) Priestess/);
    assert.doesNotMatch(menu, /<role>|<race>|<gender>|<alignment>/);
});
void test('excluding male on the filter second page forces female and disables its route', async () => {
    const menu = await selection('n~>M\np');
    assert.match(menu, /Priestess <race> female <alignment>/);
    assert.match(menu, /filter forces gender/);
    assert.doesNotMatch(menu, /" - Pick/);
});
void test('reset filtering edits existing exclusions instead of clearing them immediately', async () => {
    const menu = await selection('n~r\n~');
    assert.match(menu, /Pick all that apply and\/or unpick any that no longer apply/);
    assert.match(menu, /r \* a Rogue/);
});
void test('cancelling filter editing preserves the previous exclusions', async () => {
    const menu = await selection('n~r\n~r\x1b');
    assert.match(menu, /Pick a role or profession/);
    assert.match(menu, /r - a Ranger/);
    assert.doesNotMatch(menu, /a Rogue/);
});
void test('quit in a facet menu stops character selection', async () => {
    const engine = await runSegment({
        seed: 19, datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Selector,!legacy,!tutorial,!tips',
        moves: 'nq', storage: memoryStorage(),
    });
    await engine.lua.destroy();
    assert.equal(engine.lastRunResult?.kind, 'stopped');
});
void test('role-menu separators are omitted only when needed to fit the terminal', async () => {
    const display = new GameDisplay(new Terminal(null, { cols: 80, rows: 30 }));
    const engine = new Engine({
        seed: 19, display, storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Selector,!legacy,!tutorial,!tips',
    });
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
    await engine.lua.destroy();
    const rows = display.grid.map(row => row.map(cell => cell.ch).join('').trim());
    const randomRow = rows.findIndex(row => row === '* * Random');
    assert.ok(randomRow > 0);
    assert.equal(rows[randomRow + 1], '');
    assert.equal(rows[randomRow + 2], '/ - Pick race first');
});
void test('resolving a random alignment restores the role summary separator on a short terminal', async () => {
    const display = new GameDisplay(new Terminal(null, { cols: 80, rows: 23 }));
    const engine = new Engine({
        seed: 19, display, storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Selector,!legacy,!tutorial,!tips,role:healer,race:elf,align:random',
    });
    engine.inputGate.feed('n?');
    await engine.runUntilInputNeeded();
    await engine.lua.destroy();
    const rows = display.grid.map(row => row.map(cell => cell.ch).join('').trim());
    assert.ok(rows.includes('Pick a role or profession'), 'the role menu must be open');
    const summaryRow = rows.findIndex(row => /^<role> <race> <gender> (lawful|neutral|chaotic)$/.test(row));
    assert.ok(summaryRow >= 0, 'the summary must show the resolved random alignment');
    assert.equal(rows[summaryRow + 1], '', 'the summary separator must fit after alignment narrows the roles');
    const randomRow = rows.findIndex(row => row === '* * Random');
    assert.ok(randomRow > summaryRow, 'the role choices must include Random');
    assert.equal(rows[randomRow + 1], '/ - Pick race first', 'the Random separator uses the earlier role count');
});
for (const shortcut of ['a', '*', '@']) {
    void test(`${shortcut} at the opening question picks all remaining facets and starts immediately`, async () => {
        const menu = await selection(shortcut, 'role:priest,gender:female');
        requirePlayingGame(game);
        assert.equal(game.urole.key, 'priest');
        assert.equal(game.flags.female, true);
        assert.doesNotMatch(menu, /Is this ok|Pick a race|Pick a gender|Pick an alignment/);
    });
}
void test('random gender and alignment choices reach confirmation', async () => {
    const menu = await selection('nph**');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /Selector the (?:lawful|neutral|chaotic) (?:male|female) human Priest(?:ess)?/);
});
void test('explicitly random role configuration starts without confirmation when other facets are given', async () => {
    const menu = await selection('', 'role:random,race:human,gender:female,align:neutral');
    requirePlayingGame(game);
    assert.equal(game.urace.name, 'human');
    assert.equal(game.flags.female, true);
    assert.equal(game.initAlignment?.name, 'neutral');
    assert.doesNotMatch(menu, /Shall I pick|Is this ok/);
});
void test('rigid initial choices go directly to confirmation when they resolve the missing facets', async () => {
    const menu = await selection('', 'role:samurai,gender:male');
    assert.match(menu, /Is this ok\? \[ynaq\]/);
    assert.match(menu, /Selector the lawful male human Samurai/);
    assert.doesNotMatch(menu, /Shall I pick/);
});
void test('filter editing marks roles made unavailable by a gender exclusion', async () => {
    const menu = await selection('n~>F\n~');
    assert.match(menu, /v \* a Valkyrie/);
});
void test('the native role table resolves the r configuration prefix to Rogue', async () => {
    await selection('', 'role:r,race:human,gender:male,align:chaotic');
    requirePlayingGame(game);
    assert.equal(game.urole.key, 'rogue');
});
void test('an incompatible configured race is replaced by the role required race', async () => {
    const menu = await selection('', 'role:samurai,race:elf,gender:male,align:lawful');
    requirePlayingGame(game);
    assert.equal(game.urace.name, 'human');
    assert.doesNotMatch(menu, /Shall I pick|Is this ok/);
});
void test('random alignment waits for an incompatible configured race to be corrected', async () => {
    const menu = await selection('', 'role:samurai,race:elf,gender:male,align:random');
    requirePlayingGame(game);
    assert.equal(game.urole.key, 'samurai');
    assert.equal(game.urace.name, 'human');
    assert.equal(game.initAlignment?.name, 'lawful');
    assert.doesNotMatch(menu, /Shall I pick|Is this ok/);
});
void test('a deferred random alignment resolves before the manual gender menu', async () => {
    const menu = await selection('n', 'role:samurai,race:elf,align:random');
    assert.match(menu, /Pick a gender or sex/);
    assert.match(menu, /Samurai human <gender> lawful/);
});
void test('accepting filter edits discards a deferred random alignment with the other choices', async () => {
    const menu = await selection('~\nhpm', 'role:healer,race:elf,gender:male,align:random');
    assert.match(menu, /Pick an alignment or creed/);
    assert.match(menu, /Priest human male <alignment>/);
});
void test('leaving a tall role menu keeps status blank before hero initialization', async () => {
    const menu = await selection('nr', 'align:neutral');
    assert.match(menu, /Pick a race or species/);
    assert.match(menu, /Ranger <race>/);
    for (const row of requireGameDisplay().grid.slice(-2))
        assert.equal(row.map(cell => cell.ch).join('').trim(), '', 'character selection has no hero status');
});
void test('answering a wrapped question clears its continuation beside the race menu', async () => {
    const menu = await selection('n', 'role:caveman');
    assert.match(menu, /Pick a race or species/);
    assert.doesNotMatch(menu, /\]/, 'the answered question must not remain beside the race menu');
});
void test('the opening question preserves the name-entry base window', async () => {
    const engine = await runSegment({
        seed: 19, datetime: '20260801120000',
        nethackrc: 'OPTIONS=!legacy,!tutorial,!tips',
        moves: 'Selector\n', storage: memoryStorage(),
    });
    await engine.lua.destroy();
    const menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(menu, /Shall I pick character's race, role, gender and alignment/);
    assert.match(menu, /NetHack, Copyright/);
});
void test('dismissing corner character menus clears the covered name-entry text', async () => {
    const engine = await runSegment({
        seed: 19, datetime: '20260801120000',
        nethackrc: 'OPTIONS=!legacy,!tutorial,!tips,role:priest',
        moves: 'AbcdefghijklmnopqrstuvwxyzABCDE\nnhfl', storage: memoryStorage(),
    });
    await engine.lua.destroy();
    const display = requireGameDisplay();
    const rows = display.grid.map(row => row.map(cell => cell.ch).join(''));
    assert.match(rows.join('\n'), /Is this ok\? \[ynaq\]/);
    const nameRow = rows[12];
    assert.ok(nameRow, 'the name-entry row must be present');
    assert.ok(nameRow.startsWith('Who are you? '), 'the uncovered name prompt remains visible');
    assert.equal(nameRow.slice(display.cols / 2).trim(), '', 'dismissed character menus must clear the name tail below confirmation');
});
void test('the question drops an incompatible alignment before describing an elven Priest', async () => {
    const menu = await selection('', 'role:priest,race:elf,align:lawful');
    assert.match(menu, /Shall I pick your elven Priest\/Priestess's gender for you\? \[ynaq\]/);
});
//# sourceMappingURL=character_selection.test.js.map