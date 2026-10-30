import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('#wizcustom removes and restores palette-only rows with customcolors', async () => {
    start('symset:DECgraphics');
    for (const enabled of [false, true, false]) {
        applyNethackrc(`OPTIONS=${enabled ? '' : '!'}customcolors`);
        const rows = await listing();
        assert.equal(rows.some(row => row.includes('G_vwall_mines')), enabled);
        assert.equal(game.context.move, 0);
    }
});

for (const { set, mainWall } of [
    { set: 'Enhanced1', mainWall: '2502' },
    { set: 'Enhanced2', mainWall: '2551' },
]) {
    void test(`#wizcustom lists ${set} terrain, beam, swallow and explosion replacements`, async () => {
        start(`symset:${set}`);
        const rows = await listing();

        assert.match(rowFor(rows, 'G_fountain'), /'\\123' 12 000000096ff U\+2320 <226> <140> <160>/);
        assert.ok(rowFor(rows, 'G_vwall_main').includes(`U+${mainWall}`));
        assert.match(rowFor(rows, 'G_vwall_mines'), /'\\124' 07 00000be7e00 U\+2502/);
        assert.match(rowFor(rows, 'G_fire_zap_vbeam'), /U\+2502/);
        assert.match(rowFor(rows, 'G_swallow_giant_ant_top_center'), /U\+2594/);
        assert.match(rowFor(rows, 'G_swallow_human_werejackal_middle_left'), /U\+258f/);
        assert.match(rowFor(rows, 'G_fiery_expl_mr'), /U\+2595/);
        assert.match(rowFor(rows, 'G_web'), /U\+00a4 <194> <164>/);
        assert.match(rowFor(rows, 'G_altar_other'), /'\\095' 13 00000000000 U\+03a9/);
        if (set === 'Enhanced2') {
            assert.match(rowFor(rows, 'G_generic_ring'), /U\+2299/);
            assert.match(rowFor(rows, 'G_piletop_generic_ring'), /U\+2299/);
        }
        assert.equal(game.context.move, 0);
    });
}

void test('#wizcustom keeps Unicode replacements when customcolors is disabled', async () => {
    start('symset:Enhanced1,!customcolors');
    const rows = await listing();

    assert.match(rowFor(rows, 'G_fountain'), /00000000000 U\+2320 <226> <140> <160>/);
    assert.match(rowFor(rows, 'G_vwall_mines'), /00000000000 U\+2502/);
});

void test('#wizcustom keeps palette entries when customsymbols is disabled', async () => {
    start('symset:Enhanced2,!customsymbols');
    const rows = await listing();

    assert.match(rowFor(rows, 'G_fountain'), /000000096ff/);
    assert.doesNotMatch(rows.join('\n'), /U\+/);
    assert.equal(rows.some(row => row.includes('G_corr ')), false);
});

void test('#wizcustom has no customized glyphs when both customization options are disabled', async () => {
    start('symset:Enhanced1,!customcolors,!customsymbols');
    const rows = await listing();

    assert.ok(rows.some(row => row.includes('#wizcustom:')));
    assert.doesNotMatch(rows.join('\n'), /G_\w+/);
});

void test('#wizcustom replaces enhanced glyphs when a different symbol set is loaded', async () => {
    start('symset:Enhanced1');
    assert.match(rowFor(await listing(), 'G_fountain'), /U\+2320/);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    const rows = await listing();

    assert.equal(rows.some(row => row.includes('G_fountain')), false);
    assert.match(rowFor(rows, 'G_vwall_mines'), /'\\248' 07 00001000003/);
    assert.doesNotMatch(rows.join('\n'), /U\+/);
});

function start(options: string): void {
    freshObjectRoom({ flags: { debug: true } });
    // A wide real terminal exposes the Unicode columns clipped by 80-column tty.
    game.nhDisplay = new GameDisplay(new Terminal(null, { rows: 24, cols: 160 }));
    applyNethackrc(`OPTIONS=${options}`);
}

async function listing(): Promise<string[]> {
    const rows: string[] = [];
    const input = resetInputState();
    let pages = 0;
    input.beforeRead = () => {
        assert.ok(++pages < 256, '#wizcustom must finish paging its glyphs');
        rows.push(...(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) ?? []));
        input.feed(' ');
    };
    await runExtendedCommand('wizcustom');
    return rows;
}

function rowFor(rows: readonly string[], id: string): string {
    const row = rows.find(row => row.includes(`${id} `));
    assert.ok(row, `missing customized glyph ${id}`);
    return row;
}
