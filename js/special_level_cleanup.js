// C sp_lev.c:map_cleanup(), after Lua construction and before wallification.
import { COLNO, ROWNO, CROSSWALL, ROOM, IS_LAVA, IS_POOL, MAGIC_PORTAL, VIBRATING_SQUARE, } from './const.js';
import { deleteEngraving, engravingAt } from './engrave.js';
import { game, requireGameLevel } from './gstate.js';
import { BOULDER } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { deleteTrap } from './trap_lifecycle.js';
// C sp_lev.c:remove_boundary_syms(). Mapped crosswalls delimit rooms during
// construction, then become floor before ordinary wall shaping can alter them.
export function removeSpecialLevelBoundaries(mappedCells, state = game) {
    const level = requireGameLevel(state);
    const mazeXMax = (COLNO - 1) & ~1;
    const mazeYMax = (ROWNO - 1) & ~1;
    for (let x = 0; x < mazeXMax; x++) {
        for (let y = 0; y < mazeYMax; y++) {
            const location = level.requireAt(x, y);
            if (location.typ === CROSSWALL && mappedCells.has(x, y))
                location.typ = ROOM;
        }
    }
}
export async function cleanupSpecialLevelMap(state = game) {
    const level = requireGameLevel(state);
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const terrain = level.requireAt(x, y).typ;
            if (!IS_LAVA(terrain) && !IS_POOL(terrain))
                continue;
            // This is construction cleanup, so boulders are freed without
            // settling, changing terrain, messages, or destruction rolls.
            for (const object of [...(level.objects[x]?.[y] ?? [])]) {
                if (object.otyp === BOULDER)
                    await deleteObject(object, state);
            }
            const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE)
                deleteTrap(trap, state);
            const engraving = engravingAt(x, y, level);
            if (engraving)
                deleteEngraving(engraving, level);
        }
    }
}
//# sourceMappingURL=special_level_cleanup.js.map