// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(level, stairs) {
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