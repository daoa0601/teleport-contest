import type { PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { MM_ADJACENTOK, MM_EMIN, MM_NOMSG } from './const.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { requireInitializedGame, requireLiveGame } from './gstate.js';
import { findMonsterNearPosition, finishSpecialRoamer, makemonAt } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName } from './monster_name.js';
import { rn1 } from './rng.js';
import { heroIsDeaf } from './senses.js';

const PM_ANGEL = MONSTER_NAME.indexOf('Angel');

// C minion.c:lose_guardian_angel(). A guardian has minion data, not pet data.
export async function loseGuardianAngel(
    monster: Monster | null,
    state: PlayingGameState = requireInitializedGame(),
): Promise<{ heroDied: boolean }> {
    requireLiveGame(state);
    if (monster) {
        if (canSpotMonster(monster)) {
            const name = monsterName(monster, { state, capitalized: true });
            if (heroIsDeaf(state)) {
                await plineWithContinuation(`${name} vanishes!`);
            } else {
                await plineWithContinuation(`${name} rebukes you, saying:`);
                await plineWithContinuation('"Since you desire conflict, have some more!"');
            }
        }
        await removeMonsterFromGame(monster);
        if (state.program_state.gameover) return { heroDied: true };
    }

    for (let remaining = rn1(3, 2); remaining > 0; remaining--) {
        const position = findMonsterNearPosition(PM_ANGEL, state.u.ux, state.u.uy, { state });
        if (!position) continue;
        // enexto supplied an empty square, so mk_roamer's relocation insurance
        // is unnecessary; birth and roamer finalization retain their owners.
        const angel = await makemonAt(
            PM_ANGEL, position.x, position.y, MM_ADJACENTOK | MM_EMIN | MM_NOMSG,
        );
        if (state.program_state.gameover) return { heroDied: true };
        if (angel) finishSpecialRoamer(angel, state.u.ualign.type, false);
    }
    return { heroDied: false };
}
