// C dig.c:rot_corpse(). Carried corpses are named before they disappear.
import { plineWithContinuation, newsym } from './display.js';
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { unwieldMonsterWeapon } from './monster_weapon.js';
import { corpseName } from './objnam.js';
import { deleteObject } from './object_delete.js';
import { stopHeroOccupation } from './occupation.js';
export async function rotCorpse(corpse, state = game) {
    requireLiveGame(state);
    const { where, ox: x, oy: y } = corpse;
    if (where === 'inventory') {
        const wielded = state.uwep === corpse || state.u.uwep === corpse;
        if (state.flags.verbose) {
            const name = corpseName(corpse, { omitPrefix: true });
            await plineWithContinuation(`Your ${wielded ? 'wielded ' : ''}${name} ${corpse.quan > 1 ? 'rot' : 'rots'} away${wielded ? '!' : '.'}`);
        }
        if (corpse.owornmask) {
            await removeWornHeroItem(corpse, state);
            await stopHeroOccupation(state);
        }
        await finishInventoryRemoval(corpse, state);
    }
    else if (where === 'minvent') {
        const carrier = corpse.ocarry;
        if (carrier && corpse.owornmask && carrier.mw === corpse)
            await unwieldMonsterWeapon(carrier, state, { weapon: corpse });
    }
    else if (where === 'migrating') {
        corpse.owornmask = 0;
    }
    await deleteObject(corpse, state);
    if (where === 'floor') {
        const level = requireGameLevel(state);
        const monster = monsterAtPosition(level, x, y);
        if (monster && !level.objects[x]?.[y]?.length && monster.mundetected
            && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x80)) {
            monster.mundetected = 0;
        }
        else if (state.u.ux === x && state.u.uy === y && state.u.uundetected) {
            maybeUnhideAt(x, y, state);
        }
        newsym(x, y);
    }
}
//# sourceMappingURL=corpse_rot.js.map