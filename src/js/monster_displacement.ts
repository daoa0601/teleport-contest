// C mon.c:mm_displacement() and mhitm.c:mdisplacem().

import {
    ALLOW_MDISP, M_AP_MONSTER, M_AP_TYPE, M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS,
    MON_OFFMAP, STRAT_WAITMASK, W_ARMG,
} from './const.js';
import { canSpotMonster, flush_screen, newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import {
    MONSTER_NAME, MONSTER_SIZE, monsterIsDisplacer, monsterIsRider, requireMonsterData,
} from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { finishMonsterEating } from './monster_eating.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { clearMonsterWormFromMap, placeMonsterWormTailRandomly } from './monster_worm.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import {
    monsterPolymorphsWhenStoned, petrifyMonsterAttacker,
} from './monster_stoning.js';
import { rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { MonsterDeathOptions } from './monster_death.js';

const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');

export function monsterDisplacementFlags(aggressor: Monster, defender: Monster): number {
    if (!monsterIsDisplacer(aggressor.mnum)
        || monsterIsDisplacer(defender.mnum)
            && aggressor.m_lev <= defender.m_lev
        || defender.mnum === PM_GRID_BUG
            && aggressor.mx !== defender.mx && aggressor.my !== defender.my
        || defender.mtrapped
        || defender.wormno && defender.wormSegments?.length
        || !monsterIsRider(aggressor)
            && requireMonsterData(MONSTER_SIZE, aggressor.mnum)
                < requireMonsterData(MONSTER_SIZE, defender.mnum)) {
        return 0;
    }
    return ALLOW_MDISP;
}

// Movement callers admit candidates through monsterDisplacementFlags().
// This excludes live worm tails; a head-only worm keeps its wormno unchanged.
export async function displaceMonster(
    aggressor: Monster | null | undefined, defender: Monster | null | undefined,
    state: GameState = game, {
    quietly = false, random = rn2, publish = plineWithContinuation,
}: { quietly?: boolean; random?: (limit: number) => number; publish?: MessagePublisher } = {}): Promise<number> {
    requireLiveGame(state);
    if (!aggressor || !defender || aggressor === defender) return M_ATTK_MISS;
    const from = { x: aggressor.mx, y: aggressor.my };
    const to = { x: defender.mx, y: defender.my };
    const level = requireGameLevel(state);
    const at = ({ x, y }: Position) => monsterAtPosition(level, x, y);
    if (at(from) !== aggressor || at(to) !== defender) return M_ATTK_MISS;
    if (random(7) === 0) return M_ATTK_MISS;
    if (aggressor.mnum === PM_GRID_BUG && from.x !== to.x && from.y !== to.y)
        return M_ATTK_MISS;

    defender.mundetected = 0;
    const appearanceType = M_AP_TYPE(defender);
    if (appearanceType && appearanceType !== M_AP_MONSTER)
        revealMonsterAppearance(defender);
    defender.msleeping = 0;
    defender.mstrategy = (defender.mstrategy ?? 0) & ~STRAT_WAITMASK;
    finishMonsterEating(defender, state);
    const aggressorSpotted = canSpotMonster(aggressor);
    const bothSpotted = aggressorSpotted
        && canSpotMonster(defender);

    const wearsGloves = (aggressor.minvent ?? []).some(object => (object.owornmask ?? 0) & W_ARMG);
    if (touchPetrifies(defender.mnum) && !monsterHasStoneResistance(aggressor)
        && !wearsGloves) {
        if (!monsterPolymorphsWhenStoned(aggressor) && !quietly && bothSpotted)
            await publish(displacementMessage(aggressor, defender, true, state, random));
        const result = await petrifyMonsterAttacker(aggressor, {
            visible: !quietly && aggressorSpotted,
            creditHero: false,
            publish,
            finishDeath: (monster: Monster, options: MonsterDeathOptions = {}) => finishEnvironmentalMonsterDeath(
                monster, state, { ...options, random, publish },
            ),
        });
        if (result.survived) return M_ATTK_HIT;
        if (aggressor.mtame && !bothSpotted)
            await publish('You have a peculiarly sad feeling for a moment, then it passes.');
        return M_ATTK_AGR_DIED;
    }

    aggressor.mstate = (aggressor.mstate ?? 0) | MON_OFFMAP;
    const segments = defender.wormno ? clearMonsterWormFromMap(defender) : 0;
    placeMonsterAt(aggressor, to.x, to.y);
    placeMonsterAt(defender, from.x, from.y);
    if (defender.wormno)
        placeMonsterWormTailRandomly(defender, segments, { state, random });
    // Region effects derive membership from current coordinates.
    if (bothSpotted && !quietly)
        await publish(displacementMessage(aggressor, defender, false, state, random));
    newsym(from.x, from.y);
    newsym(to.x, to.y);
    await flush_screen(0);
    return M_ATTK_HIT;
}

function displacementMessage(
    aggressor: Monster, defender: Monster, trying: boolean, state: GameState,
    random: (limit: number) => number,
): string {
    const subject = monsterName(aggressor, { capitalized: true, state });
    const target = monsterName(defender, { state });
    const possessive = monsterIsRider(aggressor) ? 'the'
        : monsterPossessive(aggressor, { state, random });
    return `${subject} ${trying ? 'tries to move' : 'moves'} ${target} out of ${
        possessive
    } way${trying ? '.' : '!'}`;
}
