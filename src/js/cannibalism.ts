// Native eat.c:maybe_cannibal(), shared by the first bite and tainted meat.
import { LUCKMIN, Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS2, requireMonsterData } from './monster_data.js';
import { sameMonsterRace } from './monster_race.js';
import { grantIntrinsicProperty } from './properties.js';
import { rn1 } from './rng.js';
import { wereBeastForSpecies } from './were.js';

export function heroMayEatOwnKind(state: GameState = game): boolean {
    requirePlayingGame(state);
    return state.urole.key === 'caveman' || state.urace.name === 'orc';
}

export async function applyCannibalPenalty(
    mnum: number, { state = game, announce = true }: { state?: GameState; announce?: boolean } = {},
): Promise<boolean> {
    requirePlayingGame(state);
    if ((state._cannibalCheckMove ?? 0) === state.moves) return false;
    state._cannibalCheckMove = state.moves;
    const ownRace = !!(requireMonsterData(MONSTER_FLAGS2, mnum) & state.urace.selfmask);
    const sameForm = Upolyd(state.u) && sameMonsterRace(heroSpecies(state), mnum);
    const sameWereKind = state.u.ulycn >= 0 && wereBeastForSpecies(mnum) === state.u.ulycn;
    if (heroMayEatOwnKind(state) || !(ownRace || sameForm || sameWereKind)) return false;
    if (announce) {
        if (Upolyd(state.u) && ownRace)
            await plineWithContinuation('You have a bad feeling deep inside.');
        await plineWithContinuation('You cannibal!  You will regret this!');
    }
    grantIntrinsicProperty('aggravateMonster', 'outside', state);
    state.u.uluck = Math.max(LUCKMIN, (state.u.uluck || 0) - rn1(4, 2));
    return true;
}
