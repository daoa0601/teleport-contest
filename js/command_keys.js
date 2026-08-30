// command_keys.js — Default and configured keys for named commands.
// C ref: cmd.c cmd_from_ecname(), cmd_from_func().

const DEFAULT_COMMAND_KEYS = new Map([
    ['apply', 'a'], ['attributes', String.fromCharCode(24)],
    ['cast', 'Z'], ['close', 'c'], ['discoveries', '\\'], ['down', '>'],
    ['drop', 'd'], ['eat', 'e'], ['fire', 'f'], ['forcefight', 'F'],
    ['glance', ';'], ['inventory', 'i'],
    ['kick', String.fromCharCode(4)], ['look', ':'],
    ['moveeast', 'l'], ['movenorth', 'k'], ['movenortheast', 'u'],
    ['movenorthwest', 'y'], ['movesouth', 'j'], ['movesoutheast', 'n'],
    ['movesouthwest', 'b'], ['movewest', 'h'],
    ['open', 'o'], ['options', 'O'], ['pickup', ','], ['puton', 'P'],
    ['quaff', 'q'], ['quiver', 'Q'], ['read', 'r'], ['remove', 'R'],
    ['run', 'g'], ['search', 's'], ['swap', 'x'], ['swapweapon', 'x'],
    ['takeoff', 'T'], ['throw', 't'], ['travel', '_'],
    ['twoweapon', 'X'], ['up', '<'], ['wait', '.'], ['wear', 'W'],
    ['wield', 'w'], ['zap', 'z'],
]);

export function defaultCommandKey(command) {
    return DEFAULT_COMMAND_KEYS.get(String(command)) ?? null;
}

function configuredCommandKey(command, bindings) {
    for (const [key, boundCommand] of Object.entries(bindings || {})) {
        if (boundCommand !== command) continue;
        const code = Number(key);
        if (Number.isInteger(code) && code > 0 && code < 256)
            return String.fromCharCode(code);
    }
    return null;
}

function visibleKey(key) {
    const code = key.charCodeAt(0);
    if (code < 32) return `^${String.fromCharCode(code + 64)}`;
    if (code === 127) return '^?';
    if (code >= 128) return `M-${String.fromCharCode(code & 0x7f)}`;
    return key;
}

export function commandKeyDescription(command, bindings = null) {
    const name = String(command);
    const key = configuredCommandKey(name, bindings)
        ?? defaultCommandKey(name);
    return key ? visibleKey(key) : `#${name}`;
}
