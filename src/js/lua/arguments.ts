import type { LuaValue } from './runtime.js';

// luaL_checkinteger accepts numbers and numeric strings, but not booleans,
// nil, or host objects. Empty strings are not numeric Lua values.
export function luaInteger(value: LuaValue | undefined): number {
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
export function luaToInteger(value: LuaValue | undefined): number {
    const converted = luaNumberValue(value);
    return converted !== null && isIntegralLuaInteger(converted) ? converted : 0;
}

// lua_isnumber() over the value types the bindings receive: numbers, or
// strings that luaO_str2num() accepts.
export function luaNumberValue(value: LuaValue | undefined): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return luaStrToNumber(value);
    return null;
}

// A float converts to a Lua integer only inside the lua_Integer range;
// lua_numbertointeger() rejects everything past 2^63.
function isIntegralLuaInteger(value: number): boolean {
    return Number.isInteger(value) && value >= -(2 ** 63) && value < 2 ** 63;
}

const LUA_SPACES = ' \t\n\v\f\r';

function isHexCode(code: number): boolean {
    return code >= 48 && code <= 57 || code >= 97 && code <= 102
        || code >= 65 && code <= 70;
}

function hexValue(code: number): number {
    if (code >= 97) return code - 87;
    if (code >= 65) return code - 55;
    return code - 48;
}

function isDecimalCode(code: number): boolean {
    return code >= 48 && code <= 57;
}

function skipLuaSpaces(text: string, index: number): number {
    while (index < text.length && LUA_SPACES.includes(text.charAt(index))) index++;
    return index;
}

// l_str2int(): [spaces][sign](digits | 0x hexdigits)[spaces], with C's
// unsigned wrap-around for hex and rejection of decimal overflow.
function luaStringToInteger(text: string): number | null {
    let index = skipLuaSpaces(text, 0);
    let negative = false;
    const sign = text.charAt(index);
    if (sign === '-') {
        negative = true;
        index++;
    } else if (sign === '+') index++;
    let magnitude = 0n;
    let digits = 0;
    if (text.charAt(index) === '0'
        && (text.charAt(index + 1) === 'x' || text.charAt(index + 1) === 'X')) {
        index += 2;
        while (isHexCode(text.charCodeAt(index))) {
            magnitude = magnitude * 16n + BigInt(hexValue(text.charCodeAt(index)));
            digits++;
            index++;
        }
        magnitude = BigInt.asIntN(64, negative ? -magnitude : magnitude);
        negative = false;
    } else {
        while (isDecimalCode(text.charCodeAt(index))) {
            magnitude = magnitude * 10n + BigInt(text.charCodeAt(index) - 48);
            digits++;
            index++;
        }
        if (negative ? magnitude > 2n ** 63n : magnitude > 2n ** 63n - 1n)
            return null;
    }
    if (digits === 0) return null;
    index = skipLuaSpaces(text, index);
    if (index !== text.length) return null;
    return Number(negative ? -magnitude : magnitude);
}

// l_str2d(): strtod's subject sequence -- a decimal or C99 hex float
// with optional sign and surrounding spaces -- except that the leading
// 'n'/'N' check rejects inf and nan spellings.
function luaStringToFloat(text: string): number | null {
    let mode = '';
    for (let index = 0; index < text.length; index++) {
        const candidate = text.charAt(index);
        if (candidate === 'n' || candidate === 'N') return null;
        if (candidate === '.' || candidate === 'x' || candidate === 'X') {
            mode = candidate === '.' ? '.' : 'x';
            break;
        }
    }
    let index = skipLuaSpaces(text, 0);
    let negative = false;
    const sign = text.charAt(index);
    if (sign === '-' || sign === '+') {
        negative = sign === '-';
        index++;
    }
    let value: number;
    if (text.charAt(index) === '0'
        && (text.charAt(index + 1) === 'x' || text.charAt(index + 1) === 'X')) {
        index += 2;
        let mantissa = 0n;
        let fractionDigits = 0;
        let digits = 0;
        while (isHexCode(text.charCodeAt(index))) {
            mantissa = mantissa * 16n + BigInt(hexValue(text.charCodeAt(index)));
            digits++;
            index++;
        }
        if (text.charAt(index) === '.') {
            index++;
            while (isHexCode(text.charCodeAt(index))) {
                mantissa = mantissa * 16n + BigInt(hexValue(text.charCodeAt(index)));
                fractionDigits++;
                digits++;
                index++;
            }
        }
        if (digits === 0) return null;
        let exponent = 0;
        const exponentMark = text.charAt(index);
        if (exponentMark === 'p' || exponentMark === 'P') {
            index++;
            let exponentNegative = false;
            const exponentSign = text.charAt(index);
            if (exponentSign === '-' || exponentSign === '+') {
                exponentNegative = exponentSign === '-';
                index++;
            }
            let exponentDigits = 0;
            while (isDecimalCode(text.charCodeAt(index))) {
                exponent = exponent * 10 + text.charCodeAt(index) - 48;
                exponentDigits++;
                index++;
            }
            if (exponentDigits === 0) return null;
            if (exponentNegative) exponent = -exponent;
        }
        value = Number(mantissa) * 2 ** (exponent - 4 * fractionDigits);
    } else {
        const start = index;
        while (isDecimalCode(text.charCodeAt(index))) index++;
        const integerDigits = index - start;
        let fractionDigits = 0;
        if (text.charAt(index) === '.') {
            index++;
            while (isDecimalCode(text.charCodeAt(index))) {
                fractionDigits++;
                index++;
            }
        }
        if (integerDigits === 0 && fractionDigits === 0) return null;
        let end = index;
        const exponentMark = text.charAt(index);
        if (exponentMark === 'e' || exponentMark === 'E') {
            index++;
            const exponentSign = text.charAt(index);
            if (exponentSign === '-' || exponentSign === '+') index++;
            const exponentStart = index;
            while (isDecimalCode(text.charCodeAt(index))) index++;
            if (index === exponentStart) return null;
            end = index;
        }
        value = Number(text.slice(start, end));
    }
    index = skipLuaSpaces(text, index);
    if (index !== text.length) return null;
    return negative ? -value : value;
}

// lobject.c:luaO_str2num(): integer syntax converts to an integer,
// float syntax (including C99 hex floats such as "0x1p4") to a float,
// and spellings outside Lua's grammar -- "0b1", "0o7", "Infinity",
// "NaN" -- are not numbers at all.
export function luaStrToNumber(text: string): number | null {
    return luaStringToInteger(text) ?? luaStringToFloat(text);
}

export function luaString(value: LuaValue | undefined): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    throw new TypeError('Lua argument must be a string or number');
}

export function luaTruthy(value: LuaValue | undefined): boolean {
    return value != null && value !== false;
}
