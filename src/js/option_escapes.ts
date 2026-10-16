// options.c:escapes(): byte-oriented control, numeric, and meta escapes.
export function decodeOptionEscapes(value: string): string {
    const bytes = String.fromCharCode(...new TextEncoder().encode(value));
    let decoded = '';
    let index = 0;
    while (index < bytes.length) {
        let meta = 0;
        if (/^\\[mM]./.test(bytes.slice(index))) {
            meta = 128;
            index += 2;
        }
        const character = bytes.charAt(index++);
        let code = character.charCodeAt(0);
        if (character === '^' && index < bytes.length) code = bytes.charCodeAt(index++) & 31;
        else if (character === '\\' && index < bytes.length) {
            const rest = bytes.slice(index);
            const numeric = rest.match(/^(\d{1,3})|^[oO]([0-7]{1,3})|^[xX]([0-9a-fA-F]{1,2})/);
            if (numeric) {
                const number = numeric[1] ?? numeric[2] ?? numeric[3] ?? '0';
                code = parseInt(number, numeric[1] ? 10 : numeric[2] ? 8 : 16);
                index += numeric[0].length;
            } else {
                const escaped = bytes.charAt(index++);
                code = escaped === 'n' ? 10 : escaped === 't' ? 9 : escaped === 'b' ? 8
                    : escaped === 'r' ? 13 : escaped.charCodeAt(0);
            }
        }
        decoded += String.fromCharCode((code | meta) & 255);
    }
    return decoded;
}
