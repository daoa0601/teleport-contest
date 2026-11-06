// Port only: type guard separating a real room from the hx=-1 sentinel and
// the vault reservation variants of the room-table union.
export function isRoom(entry) {
    return !!entry && 'rtype' in entry;
}
//# sourceMappingURL=map_types.js.map