import { decodeScreen } from '../../frozen/screen-decode.mjs';

export function screenText(encoded) {
    return decodeScreen(encoded).map(row =>
        row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
