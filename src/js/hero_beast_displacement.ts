// Native hack.c:domove_attackmon_at() and domove_core(), displacer-beast swap.
import { GP_ALLOW_U, IS_OBSTRUCTED, STONE } from './const.js';
import { canSenseMonster, canSpotMonster, glyphAt, map_invisible, newsym, plineWithContinuation } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { heroBadRock } from './hack.js';
import { resolveMonsterLiquid } from './mon.js';
import { MONSTER_NAME } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import type { Monster } from './monster_types.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { BOULDER } from './object_data.js';
import { rn2 } from './rng.js';
import { goodPosition } from './teleport_rules.js';

const DISPLACER_BEAST = MONSTER_NAME.indexOf('displacer beast');
const GRID_BUG = MONSTER_NAME.indexOf('grid bug');

export function beastChoosesHeroDisplacement(
    beast: Monster, state: PlayingGameState, x: number, y: number,
): boolean {
    if (beast.mnum !== DISPLACER_BEAST) return false;
    if (beast.mundetected && !state.context.forcefight && !canSenseMonster(beast)) return false;
    if (rn2(2)) return false;
    const u = state.u;
    if (beast.mux !== u.ux0 || beast.muy !== u.uy0
        || monsterIsHelpless(beast) || beast.meating || beast.mtrapped
        || u.utrap || u.ustuck || u.usteed) return false;
    if (u.dx && u.dy && (u.umonnum === GRID_BUG
        || (beastBadRock(state, x, u.uy0) && beastBadRock(state, u.ux0, y))
        || (heroBadRock(state, u.ux0, y) && heroBadRock(state, x, u.uy0)))) return false;
    return goodPosition(u.ux0, u.uy0, { kind: 'monster', monster: beast },
        { state, gpflags: GP_ALLOW_U });
}

// Displacer beasts neither tunnel nor pass walls. Sokoban boulders still
// count as rock even when the square beneath them is open floor.
function beastBadRock(state: PlayingGameState, x: number, y: number): boolean {
    return IS_OBSTRUCTED(state.level.at(x, y)?.typ ?? STONE)
        || !!(state.level.flags.sokoban_rules
            && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER));
}

export async function settleBeastHeroDisplacement(beast: Monster, state: PlayingGameState): Promise<void> {
    const u = state.u;
    const remembered = glyphAt(beast.mx, beast.my, state);
    const noticed = canSpotMonster(beast)
        || remembered?.kind === 'invisible' || remembered?.kind === 'warning';
    beast.mx = u.ux0;
    beast.my = u.uy0;
    newsym(u.ux, u.uy);
    newsym(u.ux0, u.uy0);
    beast.mux = u.ux;
    beast.muy = u.uy;
    const subject = noticed ? monsterName(beast, { state, article: 'your', capitalized: true }) : 'Something';
    await plineWithContinuation(`${subject} swaps places with you...`);
    if (!canSpotMonster(beast)) map_invisible(u.ux0, u.uy0);

    const moving = state.context.mon_moving;
    state.context.mon_moving = true;
    try {
        await resolveMonsterLiquid(beast, state, {
            announce: plineWithContinuation,
            finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, state, {
                noCorpse: !options.leaveCorpse, random: options.random,
            }),
        });
        if (!state.level.monsters.includes(beast) || beast.dead || beast.mhp <= 0
            || state.program_state.gameover) return;
        const trap = await triggerImmediateMonsterTrap(beast, state);
        await finishImmediateMonsterTrap(trap, state);
    } finally {
        if (moving === undefined) delete state.context.mon_moving;
        else state.context.mon_moving = moving;
    }
}
