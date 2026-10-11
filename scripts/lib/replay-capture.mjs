import { arrayValue, decodeCursor } from './session-types.mjs';
/** A viewer may import an alternate port URL, so validate that boundary. */
export async function loadReplayRunner(url) {
    const module = await import(url);
    if (!isRecord(module) || !isCallable(module.runSegment)) {
        throw new Error(`${url} must export runSegment(input)`);
    }
    const runSegment = module.runSegment;
    return async (input) => {
        const game = await runSegment(input);
        if (!isRecord(game))
            throw new Error('runSegment must return a game capture');
        return {
            screens: stringArray(captureValue(game, 'getScreens'), 'getScreens'),
            cursors: cursorArray(captureValue(game, 'getCursors')),
            rngLog: stringArray(captureValue(game, 'getRngLog'), 'getRngLog'),
            rngSlices: rngSlices(captureValue(game, 'getRngSlices')),
        };
    };
}
export function createReplayStorage() {
    const entries = new Map();
    return {
        getItem: key => entries.get(key) ?? null,
        setItem: (key, value) => { entries.set(key, String(value)); },
        removeItem: key => { entries.delete(key); },
        get length() { return entries.size; },
        key: index => [...entries.keys()][index] ?? null,
    };
}
function captureValue(game, name) {
    const method = game[name];
    if (!isCallable(method))
        throw new Error(`Game capture is missing ${name}()`);
    return method.call(game);
}
function stringArray(value, field) {
    const entries = arrayValue(value, `${field}() result`);
    if (!entries.every((entry) => typeof entry === 'string')) {
        throw new Error(`${field}() must return an array of strings`);
    }
    return entries;
}
function cursorArray(value) {
    return arrayValue(value, 'getCursors() result').map(cursor => cursor === null ? null : decodeCursor(cursor));
}
function rngSlices(value) {
    return arrayValue(value, 'getRngSlices() result')
        .map((slice, index) => stringArray(slice, `getRngSlices()[${index}]`));
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCallable(value) {
    return typeof value === 'function';
}
//# sourceMappingURL=replay-capture.mjs.map