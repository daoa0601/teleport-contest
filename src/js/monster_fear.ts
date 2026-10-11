// C monmove.c:onscary(). The full actor predicate also checks role and perception.
import { A_LAWFUL, ALTAR } from './const.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsVampireShifter,
} from './monster_data.js';
import { SCR_SCARE_MONSTER } from './object_data.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { shopkeeperInOwnShop } from './shk.js';
import { priestIsInOwnTemple } from './priest.js';
import { engravingAt, hasCompletedEngraving } from './engrave.js';
import { heroIsDisplaced } from './armor.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

// goodpos() also asks about a zeroed temporary monster for a proposed species
// or the hero's current body. Such a probe has no shop or priest role state.
export type MonsterFearProbe = Pick<Monster, 'mnum'>
    & Partial<Pick<Monster, 'm_id' | 'cham' | 'mcansee'>> & {
        iswiz?: never;
        isshk?: never;
        isgd?: never;
        ispriest?: never;
        isminion?: never;
        mpeaceful?: never;
        mux?: never;
        muy?: never;
    };

const M2_MINION = 0x00001000;
const S_HUMAN = 53;
const S_VAMPIRE = 48;
const G_UNIQ = 0x1000;
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');
const PM_MINOTAUR = 177;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;

export function monsterIsScaredAt(
    monster: Monster | MonsterFearProbe, state: GameState, x: number, y: number,
): boolean {
    const auditoryScare = x === 0 && y === 0;
    if (monster?.iswiz || monster?.mnum === PM_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(monster?.mnum)
        || (((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MINION)
            && monsterAlignmentType(monster) === A_LAWFUL)) return false;

    const symbol = MONSTER_SYMBOL[monster?.mnum];
    if (!auditoryScare && (symbol === S_HUMAN
        || ((MONSTER_GENO[monster?.mnum] ?? 0) & G_UNIQ))) return false;
    if ((monster.isshk && shopkeeperInOwnShop(monster, state))
        || (monster.ispriest && priestIsInOwnTemple(monster, state))) return false;

    if (auditoryScare) return true;

    if (state?.level?.at?.(x, y)?.typ === ALTAR
        && (symbol === S_VAMPIRE || monsterIsVampireShifter(monster))) return true;

    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (pile.some(object => object.otyp === SCR_SCARE_MONSTER)) return true;

    const engraving = engravingAt(x, y, state?.level);
    if (!engraving || !hasCompletedEngraving('Elbereth', x, y, state)) return false;
    const protectsSquare = state?.u?.ux === x && state?.u?.uy === y
        || (heroIsDisplaced(state)
            && monster?.mux === x && monster?.muy === y)
        || (engraving.guardobjects && pile.length > 0);
    if (!protectsSquare) return false;

    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    const endgame = !!state?.u?.uz && !!state?.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    return !(monster?.isshk || monster?.isgd
        || monster?.mcansee === false || monster?.mcansee === 0
        || monster?.mpeaceful || monster?.mnum === PM_MINOTAUR
        || inHell || endgame);
}
