// Waking monsters near a noise or disturbance.
// C ref: mon.c wake_msg() and wake_nearto_core().

import { STRAT_WAITMASK } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { MONSTER_GENO, MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { disturbBuriedZombies } from './object_impact.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

const G_UNIQ = 0x1000;
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');

function monstersNear(x: number, y: number, distance: number, state: GameState): Monster[] {
    return (state.level?.monsters || []).slice().reverse().filter(monster => {
        if (!monster || (monster.mhp ?? 1) <= 0) return false;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        return !distance || dx * dx + dy * dy < distance;
    });
}

function wakeMonster(monster: Monster): void {
    monster.msleeping = 0;
    if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
}

export async function publishMonsterWake(
    monster: Monster, interesting = false, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    requireLiveGame(state);
    if (!monster.msleeping || !canSeeMonster(monster)) return;
    const punctuation = interesting ? '!' : '.';
    const alive = monster.mnum === PM_FLESH_GOLEM ? " It's alive!" : '';
    await publish(`${monsterName(monster, { capitalized: true, state })} wakes up${punctuation}${alive}`);
}

export async function wakeMonstersNearWithMessages(
    x: number, y: number, distance: number, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
    { petCall = false }: { petCall?: boolean } = {},
): Promise<void> {
    requireLiveGame(state);
    for (const monster of monstersNear(x, y, distance, state)) {
        await publishMonsterWake(monster, false, state, publish);
        wakeMonster(monster);
        if (petCall && !state.context.mon_moving && monster.mtame) {
            if (!monster.isminion) {
                if (!monster.edog) throw new Error(`Pet ${monster.m_id} has no pet state`);
                monster.edog.whistletime = state.moves;
            }
            monster.mtrack = [];
        }
    }
    disturbBuriedZombies(x, y, state);
}
