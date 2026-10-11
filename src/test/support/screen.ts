import { game } from '../../js/gstate.js';
import type { TerminalCell } from '../../js/terminal.js';
import { decodeScreen } from '../../frozen/screen-decode.mjs';

export function screenText(encoded: string): string {
    return decodeScreen(encoded).map(row =>
        row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

export function requireScreenRow(row: number): readonly TerminalCell[] {
    const display = game.nhDisplay;
    if (!display) throw new Error('Screen assertions need a live display');
    const cells = display.grid[row];
    if (!cells) throw new RangeError(`Display row ${row} is outside the screen`);
    return cells;
}

export function requireScreenCell(column: number, row: number): TerminalCell {
    const cell = requireScreenRow(row)[column];
    if (!cell) throw new RangeError(`Display cell ${column},${row} is outside the screen`);
    return cell;
}

export function capturedScreen(capture: { getScreens(): readonly string[] }, index = -1): string {
    const screen = capture.getScreens().at(index);
    if (screen === undefined) throw new RangeError(`No captured screen at index ${index}`);
    return screen;
}
