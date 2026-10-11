// C monmove.c:mb_trapped(). A remotely struck door has the same effect as
// a door opened by its occupant; the explosion precedes damage and death.
import { game, requireLiveGame } from './gstate.js';
import { TRAPPED_DOOR } from './const.js';
import { plineWithContinuation } from './display.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroIsDeaf } from './senses.js';
import { formatHeardMessage } from './hero_speech.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterLearnsTrap } from './trap_knowledge.js';
import { rnd, rn2 } from './rng.js';
import type { MonsterDeathResult } from './monster_death.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';

export async function triggerMonsterDoorTrap(monster: Monster, visible: boolean, {
    state = game, publish = plineWithContinuation, rollOne = rnd, random = rn2,
}: { state?: GameState; publish?: MessagePublisher; rollOne?: (sides: number) => number;
    random?: (limit: number) => number } = {}): Promise<{
        killed: boolean; heroDied: boolean; damage: number; death: MonsterDeathResult | null;
    }> {
    requireLiveGame(state);
    if (state.flags.verbose) {
        const dx = monster.mx - state.u.ux, dy = monster.my - state.u.uy;
        const message = visible && !heroIsUnaware(state)
            ? 'KABOOM!!  You see a door explode.'
            : !heroIsDeaf(state)
                ? formatHeardMessage(`a ${dx * dx + dy * dy > 49 ? 'distant' : 'nearby'} explosion.`, state)
                : null;
        if (message) await publish(message);
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 49, state, publish);
    monster.mstun = 1;
    const damage = rollOne(15);
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        const death = await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
        if (!death.survived || death.heroDied)
            return { killed: !death.survived, heroDied: !!death.heroDied, damage, death };
    }
    monsterLearnsTrap(monster, { ttyp: TRAPPED_DOOR });
    return { killed: false, heroDied: !!state.program_state.gameover, damage, death: null };
}
