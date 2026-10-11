export function sanitizeBonesName(name: string | null | undefined): string {
    return [...String(name || '')].map(character => {
        const code = character.charCodeAt(0);
        if (code < 32 || code === 127) return '.';
        if (code > 127) return '_';
        return character;
    }).join('');
}
