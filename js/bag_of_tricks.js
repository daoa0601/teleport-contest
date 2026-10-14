// C makemon.c:bagotricks(), for doapply's one-charge use.
import { M_AP_MONSTER, M_AP_TYPE } from './const.js';
import { canSeeMonster, canSenseMonster, plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { consumeObjectCharge } from './object_charge.js';
import { BAG_OF_TRICKS } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { rn2, rnd } from './rng.js';
import { objectTypeKnown } from './shk.js';
export async function useBagOfTricks(bag) {
    if (bag.spe < 1) {
        await pline('Nothing happens.');
        if (bag.dknown && objectTypeKnown(bag, game))
            bag.cknown = true;
        return;
    }
    await consumeObjectCharge(bag);
    let count = 1;
    if (!rn2(23))
        count += rnd(7);
    let created = 0, seen = 0;
    for (let index = 0; index < count; index++) {
        const monster = await makemonAt(null, game.u.ux, game.u.uy);
        if (!monster)
            continue;
        created++;
        const appearance = M_AP_TYPE(monster);
        if (canSeeMonster(monster) && (appearance === 0 || appearance === M_AP_MONSTER)
            || canSenseMonster(monster))
            seen++;
    }
    if (seen) {
        if (bag.dknown)
            learnObjectType(BAG_OF_TRICKS, game);
    }
    else
        await pline(created ? 'Nothing seems to happen.' : 'Nothing happens.');
}
//# sourceMappingURL=bag_of_tricks.js.map