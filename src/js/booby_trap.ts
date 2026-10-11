// C trap.c:b_trapped(). Door and tin explosions share damage and stun rules.
import { A_CON, A_STR } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { level_difficulty } from './dungeon.js';
import { plineWithContinuation } from './display.js';
import { loseHeroHp } from './hero_damage.js';
import { makeStunned } from './hero_mental_status.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { rnd } from './rng.js';

interface BoobyTrapOptions {
    bodypart?: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    rollOne?: (sides: number) => number;
}

export async function triggerBoobyTrap(item: string, {
    bodypart = false, state = game, publish = plineWithContinuation, rollOne = rnd,
}: BoobyTrapOptions = {}): Promise<boolean> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const difficulty = level_difficulty();
    const damage = rollOne(5 + (difficulty < 5 ? difficulty : 2 + Math.trunc(difficulty / 2)));
    await publish(`KABOOM!!  The ${item} was booby-trapped!`);
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, state.u.ulevel * 20, state, publish);
    const half = state.u.halfPhysicalDamage;
    if (await loseHeroHp(half ? Math.trunc((damage + 1) / 2) : damage,
        'explosion', { state, publish })) return true;
    await exerciseAttribute(A_STR, false, state);
    if (bodypart) await exerciseAttribute(A_CON, false, state);
    await makeStunned((state.u.stunnedTurns || 0) + damage, { state, talk: true, publish });
    return !!state.program_state.gameover;
}
