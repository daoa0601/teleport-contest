// C pickup.c:able_to_loot(): floor-container admission for loot and tip.
import { HOLE, TRAPDOOR, is_pit } from './const.js';
import { floorReachProblem } from './floor_reach.js';
import { game, requireGameLevel } from './gstate.js';
import { displayLiquidName, plineWithContinuation as pline } from './display.js';
import { heroHasNoLimbs } from './polyself.js';
import { heroHasFreeHand } from './weapon_type.js';
import { heroHandName } from './body_parts.js';
import { MONSTER_NAME } from './monster_data.js';
import { heroIsBlind } from './senses.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
export async function ableToLoot(x, y, looting) {
    const verb = looting ? 'loot' : 'tip';
    const trap = requireGameLevel().traps.find(trap => trap.tx === x && trap.ty === y);
    const reach = floorReachProblem(game, { checkPit: !!trap && is_pit(trap.ttyp) });
    if (reach) {
        if (reach === 'riding' && game.u.usteed) {
            await pline(`You aren't skilled enough to reach from your ${MONSTER_NAME[game.u.usteed.mnum]}.`);
        }
        else {
            const surface = trap?.ttyp === HOLE ? 'edge of the hole'
                : trap?.ttyp === TRAPDOOR ? 'trap door' : surfaceName(x, y);
            await pline(heroIsBlind(game) ? 'You cannot reach anything here.' : `You cannot reach the ${surface}.`);
        }
        return false;
    }
    const lava = isLavaAt(x, y);
    if (lava || isPoolAt(x, y) && (looting || !(game.underwater || game.u.uinwater))) {
        await pline(`You cannot ${verb} things that are deep in the ${displayLiquidName(lava ? 'lava' : 'water')}.`);
        return false;
    }
    if (heroHasNoLimbs(game)) {
        await pline(`Without limbs, you cannot ${verb} anything.`);
        return false;
    }
    if (looting && !heroHasFreeHand(game)) {
        await pline(`Without a free ${heroHandName()}, you cannot loot anything.`);
        return false;
    }
    return true;
}
//# sourceMappingURL=container_location.js.map