import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('#wizcustom shows the active symbol set without taking a turn', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    game.symset = 'DECgraphics';
    const pages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        input.feed(' ');
    };

    await runExtendedCommand('wizcustom');

    const text = pages.join('\n');
    assert.match(text, /#wizcustom: colorcount=\d+ DECgraphics, active, handler=DEC/);
    assert.match(text, /glyph identifier.*customcolor/);
    assert.match(text, /G_vwall_mines/);
    assert.equal(game.context.move, 0);
});

void test('#wizcustom updates the base wall color when color is toggled', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    applyNethackrc('OPTIONS=symset:DECgraphics');
    const rows: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        rows.push(...(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) ?? []));
        input.feed(' ');
    };

    for (const { option, color } of [
        { option: '!color', color: '08' },
        { option: 'color', color: '07' },
        { option: '!color', color: '08' },
    ]) {
        applyNethackrc(`OPTIONS=${option}`);
        rows.length = 0;
        await runExtendedCommand('wizcustom');

        const wall = rows.find(row => row.includes('G_vwall_mines')) ?? '';
        assert.ok(wall.includes(`'\\248' ${color} 00001000003`),
            `${option} must update the base color and retain the custom palette: ${wall}`);
        assert.equal(game.context.move, 0);
    }
});

for (const { label, options, byte, color, primary } of [
    { label: 'default Rogue symbols', options: 'color', byte: 124, color: '08', primary: false },
    { label: 'RogueIBM', options: 'color,roguesymset:RogueIBM', byte: 186, color: '08', primary: false },
    { label: 'RogueEpyx', options: 'color,roguesymset:RogueEpyx', byte: 186, color: '07', primary: false },
    { label: 'RogueEpyx without color', options: '!color,roguesymset:RogueEpyx', byte: 186, color: '08', primary: false },
    { label: 'primary symbols with RogueEpyx configured', options: 'color,roguesymset:RogueEpyx', byte: 248, color: '08', primary: true },
]) {
    void test(`#wizcustom reports branch wall colors on Rogue with ${label}`, async () => {
        await freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        game.rogue_level = { ...game.u.uz };
        applyNethackrc(`OPTIONS=symset:DECgraphics,${options}`);
        if (primary) game.shownSymbols = { rogue: false, name: 'DECgraphics' };
        const rows: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            rows.push(...(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) ?? []));
            input.feed(' ');
        };

        await runExtendedCommand('wizcustom');

        for (const branch of ['mines', 'gehennom', 'knox', 'sokoban']) {
            const wall = rows.find(row => row.includes(`G_vwall_${branch}`)) ?? '';
            assert.ok(wall.includes(`'\\${byte}' ${color}`),
                `${label} must report the loaded symbol and base color ${color}: ${wall}`);
        }
        assert.equal(game.context.move, 0);
    });
}

for (const { symset, vertical, horizontal } of [
    { symset: 'DECgraphics', vertical: 248, horizontal: 241 },
    { symset: 'curses', vertical: 248, horizontal: 241 },
    { symset: 'IBMgraphics', vertical: 179, horizontal: 196 },
    { symset: 'IBMGraphics_1', vertical: 179, horizontal: 196 },
    { symset: 'IBMGraphics_2', vertical: 179, horizontal: 196 },
]) {
    void test(`#wizcustom reports the loaded ${symset} wall bytes`, async () => {
        await freshObjectRoom({ flags: { debug: true } });
        applyNethackrc(`OPTIONS=symset:${symset}`);
        const rows: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            rows.push(...(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) ?? []));
            input.feed(' ');
        };

        await runExtendedCommand('wizcustom');

        const verticalWall = rows.find(row => row.includes('G_vwall_mines')) ?? '';
        const horizontalWall = rows.find(row => row.includes('G_hwall_mines')) ?? '';
        assert.ok(verticalWall.includes(`'\\${vertical}'`),
            `${symset} vertical wall must report raw byte ${vertical}: ${verticalWall}`);
        assert.ok(horizontalWall.includes(`'\\${horizontal}'`),
            `${symset} horizontal wall must report raw byte ${horizontal}: ${horizontalWall}`);
        assert.equal(game.context.move, 0);
    });
}
