// C dig.c:rot_corpse(). Carried corpses are named before they disappear.
import { plineWithContinuation } from './pline.js';
import { newsym } from './display.js';
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import { removeWornHeroItem } from './steal.js';
import { finishInventoryRemoval } from './invent.js';
import { heroSpecies } from './polyself.js';
import { monsterAtPosition } from './steed.js';
import { hideHeroUnder } from './mon.js';
import { unwieldMonsterWeapon } from './weapon.js';
import { corpseName } from './objnam.js';
import { deleteObject } from './shk.js';
import { stopHeroOccupation } from './allmain.js';
import { monsterHidesUnder } from './mondata.js';
// C dig.c:rot_corpse().
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
            && monsterHidesUnder(monster.mnum)) {
            monster.mundetected = 0;
        }
        else if (state.u.ux === x && state.u.uy === y && state.u.uundetected
            && monsterHidesUnder(heroSpecies(state))) {
            await hideHeroUnder(state);
        }
        await newsym(x, y);
    }
}
//# sourceMappingURL=corpse_rot.js.map