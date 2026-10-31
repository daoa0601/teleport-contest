// Record one core-RNG draw into a monster call log. Monster scheduling
// shares this wrapper so every recorded decision appends to the same
// transcript shape regardless of which module draws it.
export function recordRandom(random, calls, range) {
    calls.push(range);
    return random(range);
}
// Live monster scheduling needs the action object across tty continuations,
// but no gameplay branch reads the diagnostic RNG transcript. Keep the
// append-shaped dependency without allocating or retaining one array per
// actor. The empty iterator preserves the one continuation which merges a
// nested action log; there is deliberately nothing to merge in live mode.
export const DISCARDED_CALL_LOG = Object.freeze({
    length: 0,
    push() {
        return 0;
    },
    *[Symbol.iterator]() { },
});
//# sourceMappingURL=monster_action_types.js.map