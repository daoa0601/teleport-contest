// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(level, stairs) {
    // Trap arrays run backwards to represent C's ftrap chain; getlev()
    // prepends each restored trap, reversing that chain.
    level.traps.reverse();
    // C restdamage() prepends the saved pending repairs.
    level.damagelist?.reverse();
    let restored = null;
    let saved = stairs;
    while (saved) {
        const next = saved.next;
        saved.next = restored;
        restored = saved;
        saved = next;
    }
    return restored;
}
//# sourceMappingURL=level_restore.js.map