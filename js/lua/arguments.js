// luaL_checkinteger accepts numbers and numeric strings, but not booleans,
// nil, or host objects. Empty strings are not numeric Lua values.
export function luaInteger(value) {
    if ((typeof value !== 'number' && typeof value !== 'string')
        || (typeof value === 'string' && value.trim() === ''))
        throw new TypeError('Lua argument must be an integer');
    const number = Number(value);
    if (!Number.isInteger(number))
        throw new TypeError('Lua argument must be an integer');
    return number;
}
// lua_tointeger() accepts integral numbers and numeric strings and
// quietly yields zero for anything else; it never raises.
export function luaToInteger(value) {
    const number = typeof value === 'number' ? value
        : typeof value === 'string' && value.trim() !== '' ? Number(value)
            : Number.NaN;
    return Number.isInteger(number) ? number : 0;
}
export function luaString(value) {
    if (typeof value === 'string' || typeof value === 'number')
        return String(value);
    throw new TypeError('Lua argument must be a string or number');
}
export function luaTruthy(value) {
    return value != null && value !== false;
}
//# sourceMappingURL=arguments.js.map