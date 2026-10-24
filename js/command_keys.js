// command_keys.js — Default and configured keys for named commands.
// C ref: cmd.c cmd_from_ecname(), cmd_from_func().
import { NATIVE_COMMANDS } from './command_data.js';
const DEFAULT_COMMAND_KEYS = new Map([
    ['#', '#'],
    ['apply', 'a'], ['attributes', String.fromCharCode(24)],
    ['autopickup', '@'],
    ['cast', 'Z'], ['close', 'c'], ['known', '\\'], ['knownclass', '`'], ['down', '>'],
    ['drop', 'd'], ['droptype', 'D'], ['eat', 'e'], ['fire', 'f'], ['fight', 'F'],
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
    ['seetools', '('], ['seeall', '*'], ['inventtype', 'I'],
    ['showgold', '$'], ['showspells', '+'], ['terrain', String.fromCharCode(127)],
    ['takeoff', 'T'], ['throw', 't'], ['travel', '_'],
    ['up', '<'], ['wait', '.'], ['wear', 'W'],
    ['wield', 'w'], ['zap', 'z'],
    ['teleport', String.fromCharCode(20)], ['wizgenesis', String.fromCharCode(7)],
    ['wizlevelport', String.fromCharCode(22)], ['wizmap', String.fromCharCode(6)],
    ['wizwish', String.fromCharCode(23)],
]);
// C reset_commands() gives Ctrl-direction keys their rush bindings.
const CONTROL_RUSH_DIRECTION = new Map([
    [2, 'b'], [8, 'h'], [10, 'j'], [11, 'k'],
    [12, 'l'], [14, 'n'], [21, 'u'], [25, 'y'],
]);
export function controlRushDirection(key) {
    return CONTROL_RUSH_DIRECTION.get(key) || null;
}
// These keys select existing JS handlers; they are not the live key map.
export function commandExecutionKey(command) {
    if (!command)
        return null;
    const direct = DEFAULT_COMMAND_KEYS.get(command);
    if (direct)
        return direct;
    for (const mode of ['run', 'rush']) {
        if (!command?.startsWith(mode))
            continue;
        const direction = DEFAULT_COMMAND_KEYS.get(`move${command.slice(mode.length)}`);
        if (direction)
            return mode === 'run' ? direction.toUpperCase()
                : String.fromCharCode(direction.charCodeAt(0) & 31);
    }
    return null;
}
// movecmd() recognizes a bound handler, including run/rush and vertical
// movement. This projection keeps the existing direction consumers on one
// coordinate alphabet without treating that alphabet as the live bindings.
export function movementDirectionKey(key, bindings) {
    const movement = bindings.movementForKey(key);
    return movement ? 'hykulnjb><'.charAt(movement.direction) : '';
}
export function promptedDirectionKey(key, bindings) {
    if (key === bindings.specialKey('getdir.self')
        || key === bindings.specialKey('getdir.self2'))
        return '.';
    return movementDirectionKey(key, bindings);
}
export function visibleCommandKey(code) {
    code &= 255;
    if (code >= 128)
        return `M-${visibleCommandKey(code & 127)}`;
    if (code < 32)
        return `^${String.fromCharCode(code + 64)}`;
    if (code === 127)
        return '^?';
    return String.fromCharCode(code);
}
export function commandKeyDescription(command, bindings) {
    const name = String(command);
    if (!NATIVE_COMMANDS.some(entry => entry.name === name))
        return '';
    const key = bindings.keyForCommand(name);
    return key ? visibleCommandKey(key) : `#${name}`;
}
//# sourceMappingURL=command_keys.js.map