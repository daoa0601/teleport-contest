import { game } from './gstate.js';

// C bones.c:sanitize_name(). High-bit control bytes are still controls;
// printable high-bit characters follow the tty eight-bit input option.
export function sanitizeBonesName(name: string | null | undefined): string {
    return [...String(name || '')].map(character => {
        const code = character.charCodeAt(0);
        const lowBits = code & 127;
        if (lowBits < 32 || lowBits === 127) return '.';
        if (code > 127 && !game.iflags.wc_eight_bit_input) return '_';
        return character;
    }).join('');
}
