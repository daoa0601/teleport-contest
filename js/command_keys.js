// command_keys.js — Default and configured keys for named commands.
// C ref: cmd.c cmd_from_ecname(), cmd_from_func().

const DEFAULT_COMMAND_KEYS = new Map([
    ['#', '#'],
    ['apply', 'a'], ['attributes', String.fromCharCode(24)],
    ['autopickup', '@'],
    ['cast', 'Z'], ['close', 'c'], ['discoveries', '\\'], ['down', '>'],
    ['drop', 'd'], ['eat', 'e'], ['fire', 'f'], ['fight', 'F'],
    ['glance', ';'], ['help', '?'], ['inventory', 'i'],
    ['kick', String.fromCharCode(4)], ['look', ':'],
    ['moveeast', 'l'], ['movenorth', 'k'], ['movenortheast', 'u'],
    ['movenorthwest', 'y'], ['movesouth', 'j'], ['movesoutheast', 'n'],
    ['movesouthwest', 'b'], ['movewest', 'h'],
    ['open', 'o'], ['options', 'O'], ['pay', 'p'], ['pickup', ','], ['puton', 'P'],
    ['quaff', 'q'], ['quiver', 'Q'], ['read', 'r'], ['remove', 'R'],
    ['reqmenu', 'm'], ['run', 'G'], ['rush', 'g'], ['save', 'S'],
    ['search', 's'], ['swap', 'x'],
    ['seeamulet', '"'], ['seearmor', '['], ['seerings', '='], ['seeweapon', ')'],
    ['showgold', '$'], ['showspells', '+'], ['terrain', String.fromCharCode(127)],
    ['takeoff', 'T'], ['throw', 't'], ['travel', '_'],
    ['twoweapon', 'X'], ['up', '<'], ['wait', '.'], ['wear', 'W'],
    ['wield', 'w'], ['zap', 'z'],
    ['teleport', String.fromCharCode(20)], ['wizgenesis', String.fromCharCode(7)],
    ['wizlevelport', String.fromCharCode(22)], ['wizmap', String.fromCharCode(6)],
    ['wizwish', String.fromCharCode(23)],
]);

// C reset_commands() gives Ctrl-direction keys their rush bindings.
// tty normalizes carriage return to Ctrl-J/rush south.
const CONTROL_RUSH_DIRECTION = new Map([
    [2, 'b'], [8, 'h'], [10, 'j'], [11, 'k'],
    [12, 'l'], [14, 'n'], [21, 'u'], [25, 'y'],
]);

export function controlRushDirection(key) {
    return CONTROL_RUSH_DIRECTION.get(key === 13 ? 10 : key) || null;
}

export function defaultCommandKey(command) {
    return DEFAULT_COMMAND_KEYS.get(String(command)) ?? null;
}

export function defaultCommandName(key) {
    const direction = 'hykulnjb'.indexOf(key.toLowerCase());
    if (direction >= 0 && key !== key.toLowerCase()) {
        return `run${defaultCommandName(key.toLowerCase()).slice(4)}`;
    }
    const controlDirection = controlRushDirection(key.charCodeAt(0));
    if (controlDirection)
        return `rush${defaultCommandName(controlDirection).slice(4)}`;
    for (const [name, binding] of DEFAULT_COMMAND_KEYS) {
        if (binding === key) return name;
    }
    return null;
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
