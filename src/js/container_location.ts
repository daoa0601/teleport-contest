// C pickup.c:able_to_loot(): floor-container admission for loot and tip.
import { is_pit, P_BASIC, P_RIDING } from './const.js';
import { floorReachProblem, heroCanReachFloor } from './floor_reach.js';
import { game, requireGameLevel } from './gstate.js';
import { displayLiquidName, plineWithContinuation as pline } from './display.js';
import { heroHasNoLimbs } from './polyself.js';
import { heroHasFreeHand } from './weapon_type.js';
import { heroHandName } from './body_parts.js';
import { monsterName } from './monster_name.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';

export async function ableToLoot(x: number, y: number, looting: boolean): Promise<boolean> {
    const verb = looting ? 'loot' : 'tip';
    const trap = requireGameLevel().traps.find(trap => trap.tx === x && trap.ty === y);
    const reach = floorReachProblem(game, { checkPit: !!trap && is_pit(trap.ttyp) });
    if (reach) {
        if (game.u.usteed && (game.u.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
            await pline(`You aren't skilled enough to reach from ${monsterName(game.u.usteed, { article: 'your' })}.`);
        } else {
            const surface = heroCanReachFloor(game) ? 'bottom of the pit' : surfaceName(x, y);
            await pline(`You can't reach the ${surface}.`);
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
