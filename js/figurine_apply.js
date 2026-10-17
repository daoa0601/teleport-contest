// C apply.c:use_figurine(). Placement is shared with the timer owner.
import { setMulti } from './command_state.js';
import { Is_airlevel, Is_waterlevel } from './const.js';
import { map_invisible, plineWithContinuation as pline } from './display.js';
import { makeFamiliar } from './familiar.js';
import { figurinePlacementFailure } from './figurine.js';
import { game, requireLiveGame } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import { OBJECT_TIMER_KIND, stopObjectTimer } from './object_timers.js';
import { heroIsBlind } from './senses.js';
import { isPoolAt } from './terrain_properties.js';
import { promptDirection } from './tty_prompts.js';
export async function useFigurine(object) {
    requireLiveGame(game);
    if (game.u.uswallow) {
        await pline("You don't have enough room in here.");
        return { spentTime: false, object };
    }
    const direction = await promptDirection();
    if (!direction) {
        setMulti(0);
        return { spentTime: false, object };
    }
    const x = game.u.ux + direction.dx, y = game.u.uy + direction.dy;
    const refusal = figurinePlacementFailure(object, x, y, game);
    if (refusal) {
        await pline(refusal);
        return { spentTime: true, object };
    }
    const placement = direction.dx || direction.dy ? 'set the figurine beside you'
        : Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz) || isPoolAt(x, y, game)
            ? 'release the figurine' : direction.dz < 0 ? 'toss the figurine into the air'
            : 'set the figurine on the ground';
    await pline(`You ${placement} and it ${heroIsBlind(game) ? 'supposedly ' : ''}transforms.`);
    await makeFamiliar(object, x, y, false);
    stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    await consumeInventoryItem(object, game);
    if (heroIsBlind(game))
        map_invisible(x, y);
    return { spentTime: true, object: null };
}
//# sourceMappingURL=figurine_apply.js.map