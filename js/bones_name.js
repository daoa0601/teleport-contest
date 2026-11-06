import { game } from './gstate.js';
// C bones.c:sanitize_name(): while loading bones, strip text that could
// disrupt display. High-bit control bytes are still controls; printable
// high-bit characters follow the tty eight-bit input option. The port's
// bones names are UTF-8-decoded strings, so this masks per character; the
// fruit option's byte buffer is masked per byte in options.ts
// (sanitizeFruitCopy), which is where C's caller actually sees bytes.
export function sanitizeName(name, iflags = game.iflags) {
    return [...String(name || '')].map(character => {
        const code = character.charCodeAt(0);
        const lowBits = code & 127;
        if (lowBits < 32 || lowBits === 127)
            return '.';
        if (code > 127 && !iflags.wc_eight_bit_input)
            return '_';
        return character;
    }).join('');
}
//# sourceMappingURL=bones_name.js.map