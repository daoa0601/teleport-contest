import { game } from '../../js/gstate.js';
import { decodeScreen } from '../../frozen/screen-decode.mjs';
export function screenText(encoded) {
    return decodeScreen(encoded).map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
export function requireScreenRow(row) {
    const display = game.nhDisplay;
    if (!display)
        throw new Error('Screen assertions need a live display');
    const cells = display.grid[row];
    if (!cells)
        throw new RangeError(`Display row ${row} is outside the screen`);
    return cells;
}
export function requireScreenCell(column, row) {
    const cell = requireScreenRow(row)[column];
    if (!cell)
        throw new RangeError(`Display cell ${column},${row} is outside the screen`);
    return cell;
}
export function capturedScreen(capture, index = -1) {
    const screen = capture.getScreens().at(index);
    if (screen === undefined)
        throw new RangeError(`No captured screen at index ${index}`);
    return screen;
}
//# sourceMappingURL=screen.js.map