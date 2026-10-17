// Native eat.c mimic meals, eatmdone/eatmupdate, and mhitu.c interruption.
import { finishHeroHelplessness } from './allmain.js';
import { nomul } from './command_state.js';
import { DISMOUNT_FELL, M_AP_NOTHING, M_AP_OBJECT, Upolyd } from './const.js';
import {
    canSeeMonster, canSpotMonster, flushPendingTopline, flush_screen,
    map_invisible, newsym, plineWithContinuation,
} from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { recordGameLogEvent } from './gamelog.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName, requireMonsterData } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { GOLD_PIECE, ORANGE } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { heroIsUnchanging } from './polyself.js';
import { heroIsHallucinating } from './senses.js';
import { dismountHero } from './steed.js';

const S_MIMIC = requireMonsterData(MONSTER_SYMBOL, MONSTER_NAME.indexOf('small mimic'));

export async function beginMealMimicry(turns: number, { state = game }: { state?: GameState } = {}): Promise<void> {
    requirePlayingGame(state);
    const hero = state.u;
    if (requireMonsterData(MONSTER_SYMBOL, heroSpecies(state)) === S_MIMIC || heroIsUnchanging(state)) return;
    const hallucinating = heroIsHallucinating(state);
    const shape = hallucinating ? 'an orange' : 'a pile of gold';
    const conduct = hero.uconduct;
    if (!conduct.polyselfs)
        recordGameLogEvent(`changed form for the first time by mimicking ${shape}`, { state });
    conduct.polyselfs = (conduct.polyselfs || 0) + 1;
    await plineWithContinuation(`You can't resist the temptation to mimic ${shape}.`);
    if (hero.usteed) {
        await dismountHero(DISMOUNT_FELL, { state });
        if (state.program_state.gameover) return;
    }
    nomul(-turns, state);
    state._helplessReason = 'pretending to be a pile of gold';
    const original = Upolyd(hero) ? monsterTypeName(heroSpecies(state), state.flags.female) : state.urace.noun;
    const nowHallucinating = heroIsHallucinating(state);
    state._mimicMealMessage = nowHallucinating
        ? `You suddenly dread being peeled and mimic ${withIndefiniteArticle(original)} again!`
        : `You now prefer mimicking ${withIndefiniteArticle(original)} again.`;
    state._helplessDoneMessage = state._mimicMealMessage;
    state._afterMove = { kind: 'end-mimic-meal' };
    hero.m_ap_type = M_AP_OBJECT;
    hero.mappearance = nowHallucinating ? ORANGE : GOLD_PIECE;
    newsym(hero.ux, hero.uy);
    await flush_screen(1);
    await flushPendingTopline();
}

export function finishMealMimicry(state: GameState = game): void {
    if (state._helplessDoneMessage === state._mimicMealMessage)
        state._helplessDoneMessage = null;
    state._mimicMealMessage = null;
    if (state.u.m_ap_type) {
        state.u.m_ap_type = M_AP_NOTHING;
        newsym(state.u.ux, state.u.uy);
    }
}

export function updateMealMimicry(state: GameState = game): void {
    if (!state._mimicMealMessage || state._helplessDoneMessage !== state._mimicMealMessage
        || state.u.m_ap_type !== M_AP_OBJECT) return;
    const hallucinating = heroIsHallucinating(state);
    if (state.u.mappearance === ORANGE && !hallucinating) {
        state._mimicMealMessage = 'You now prefer mimicking yourself.';
        state.u.mappearance = GOLD_PIECE;
    } else if (state.u.mappearance === GOLD_PIECE && hallucinating) {
        state._mimicMealMessage = 'Your rind escaped intact.';
        state.u.mappearance = ORANGE;
    } else return;
    state._helplessDoneMessage = state._mimicMealMessage;
    newsym(state.u.ux, state.u.uy);
}

export async function disturbMealMimicry(monster: Monster, { state = game }: { state?: GameState } = {}): Promise<boolean> {
    requirePlayingGame(state);
    const hero = state.u;
    if (!state._mimicMealMessage || hero.m_ap_type !== M_AP_OBJECT || hero.uswallow
        || monster.mux !== hero.ux || monster.muy !== hero.uy
        || Math.max(Math.abs(monster.mx - hero.ux), Math.abs(monster.my - hero.uy)) > 1)
        return false;
    if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
    if (!canSeeMonster(monster)) {
        const picksUpGold = requireMonsterData(MONSTER_FLAGS2, monster.mnum) & 0x10000000
            && hero.mappearance === GOLD_PIECE;
        await plineWithContinuation(`Something ${picksUpGold ? 'tries to pick you up' : 'disturbs you'}!`);
    } else {
        const name = monsterName(monster, { state, article: 'none', exact: true });
        const shape = hero.mappearance === ORANGE ? 'orange' : 'pile of gold';
        await plineWithContinuation(`Wait, ${name}!  That ${shape} is really ${
            withIndefiniteArticle(monsterTypeName(heroSpecies(state), state.flags.female))
        } named ${state.plname}!`);
    }
    if ((state._helplessTurns ?? 0) > 0) {
        const shape = Upolyd(hero)
            ? withIndefiniteArticle(monsterTypeName(heroSpecies(state), state.flags.female)) : 'yourself';
        await finishHeroHelplessness(`You appear to be ${shape} again.`, state);
    }
    return true;
}
