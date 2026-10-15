import { formatFeltMessage } from './hero_speech.js';
import type { Monster } from './monster_types.js';
import type { PlayingGameState } from './game_state.js';
import type { RandomBelow } from './monster_action_types.js';

export interface MonsterSummoningResult {
    count: number;
    created: Monster[];
}

// Monster summoning by demons, minions, and the Wizard of Yendor.
// C ref: minion.c msummon(), dprince(), dlord(), and ndemon().

import { artifactById } from './artifacts.js';
import { deityName } from './alignment.js';
import { A_NONE, In_endgame, MM_EMIN, MM_NOMSG, STRAT_APPEARMSG } from './const.js';
import { canSeeMonster, canSpotMonster, pline, plineWithContinuation } from './display.js';
import { game, requireInitializedGame } from './gstate.js';
import { makemonNear, mkclassAligned } from './mklev.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { rn1, rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { isWereMonster, summonWereAttackHelp } from './were.js';

const S_DEMON = 56;
const M2_DEMON = 0x00000100;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_MINION = 0x00001000;
const M2_PNAME = 0x00080000;
const G_GONE = 0x03;

const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_JUIBLEX = MONSTER_NAME.indexOf('Juiblex');
const PM_YEENOGHU = MONSTER_NAME.indexOf('Yeenoghu');
const PM_ORCUS = MONSTER_NAME.indexOf('Orcus');
const PM_DEMOGORGON = MONSTER_NAME.indexOf('Demogorgon');
const ELEMENTALS = ['air elemental', 'fire elemental', 'earth elemental', 'water elemental'].map(
    (name) => MONSTER_NAME.indexOf(name),
);

function summonedElemental(): number {
    const mnum = ELEMENTALS[rn2(ELEMENTALS.length)];
    if (mnum === undefined)
        throw new RangeError('Elemental summon selected outside its species table');
    return mnum;
}

// C minion.c:summon_minion(). The new servant is hostile without changing
// the alignment penalty for killing it.
export async function summonMinion(alignment: number, talk = false): Promise<Monster | null> {
    const mnum =
        alignment === 1
            ? lawfulMinion()
            : alignment === 0
              ? summonedElemental()
              : normalDemon(alignment);
    if (mnum == null) return null;
    const specialRole = ['shopkeeper', 'guard', 'aligned cleric', 'high cleric'].includes(
        MONSTER_NAME[mnum] ?? '',
    );
    const flags = MM_NOMSG | (specialRole ? 0 : MM_EMIN);
    const monster = await makemonNear(mnum, game.u.ux, game.u.uy, flags);
    if (!monster) return null;
    if (!specialRole) {
        monster.isminion = 1;
        monster.emin = { min_align: alignment, renegade: 0 };
        monster.mextra = { ...monster.mextra, emin: monster.emin };
    }
    if (talk) {
        const deity = deityName(alignment);
        const possessive = deity.endsWith('s') ? `${deity}'` : `${deity}'s`;
        await plineWithContinuation(
            heroIsDeaf(game)
                ? formatFeltMessage(`${possessive} booming voice:`)
                : `The voice of ${deity} booms:`,
        );
        await plineWithContinuation('"Thou shalt pay for thine indiscretion!"');
        if (canSpotMonster(monster))
            await plineWithContinuation(`${summonedMonsterName(monster)} appears before you.`);
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
    }
    monster.mpeaceful = false;
    return monster;
}

// C mhitu.c:summonmu(), before offensive items and attack slots.
export async function summonMonsterAttackHelp(
    monster: Monster,
    state: PlayingGameState = requireInitializedGame(),
    random: RandomBelow = rn2,
): Promise<MonsterSummoningResult | null> {
    if (
        monster.mcan ||
        (monster.cham ?? -1) >= 0 ||
        (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON)
            && !isWereMonster(monster))
    )
        return null;
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('Summoning during an attack requires the perceived hero position');
    if (Math.abs(monster.mx - monster.mux) > 1 || Math.abs(monster.my - monster.muy) > 1)
        return null;
    if (isWereMonster(monster)) {
        await summonWereAttackHelp(monster, state, random);
        return null;
    }
    if (['balrog', 'amorous demon'].includes(MONSTER_NAME[monster.mnum] ?? ''))
        return null;
    const inHell = !!state.dungeons?.[state.u.uz.dnum]?.flags?.hellish;
    if (random(inHell ? 10 : 16) !== 0) return null;
    return msummon(monster);
}

function monsterIsGone(mnum: number) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}

function matchesAlignment(mnum: number, alignment: number) {
    return alignment === A_NONE || Math.sign(MONSTER_ALIGNMENT[mnum] ?? 0) === Math.sign(alignment);
}

export function normalDemon(alignment: number): number | null {
    const mnum = mkclassAligned(S_DEMON, 0, alignment);
    if (mnum == null) return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return flags & M2_DEMON && !(flags & (M2_LORD | M2_PRINCE)) ? mnum : null;
}

export function demonLord(alignment: number): number | null {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_YEENOGHU + 1 - PM_JUIBLEX, PM_JUIBLEX);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment)) return mnum;
    }
    return normalDemon(alignment);
}

function demonPrince(alignment: number): number | null {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_DEMOGORGON + 1 - PM_ORCUS, PM_ORCUS);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment)) return mnum;
    }
    return demonLord(alignment);
}

function lawfulMinion(): number | null {
    for (let attempts = 20; attempts > 0; attempts--) {
        const mnum = mkclassAligned(27, 0, A_NONE);
        if (mnum != null && !((MONSTER_FLAGS2[mnum] ?? 0) & M2_LORD)) return mnum;
    }
    return null;
}

function lawfulLord(): number | null {
    return monsterIsGone(PM_ARCHON) ? lawfulMinion() : PM_ARCHON;
}

function summonerAlignment(monster: Monster | null): number {
    if (monster?.ispriest) return monster.epri?.shralign ?? monster.mextra?.epri?.shralign ?? A_NONE;
    if (monster?.isminion)
        return monster.emin?.min_align ?? monster.mextra?.emin?.min_align ?? A_NONE;
    const alignment = MONSTER_ALIGNMENT[monster?.mnum ?? PM_WIZARD_OF_YENDOR] ?? A_NONE;
    return alignment === A_NONE ? A_NONE : Math.sign(alignment);
}

function summonedType(
    monster: Monster | null,
    alignment: number,
): { mnum: number | null; mayDouble: boolean } {
    const mnum = monster?.mnum ?? PM_WIZARD_OF_YENDOR;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    if ((flags & M2_DEMON && flags & M2_PRINCE) || mnum === PM_WIZARD_OF_YENDOR) {
        return {
            mnum: !rn2(20)
                ? demonPrince(alignment)
                : !rn2(4)
                  ? demonLord(alignment)
                  : normalDemon(alignment),
            mayDouble: true,
        };
    }
    if (flags & M2_DEMON && flags & M2_LORD) {
        return {
            mnum: !rn2(50)
                ? demonPrince(alignment)
                : !rn2(20)
                  ? demonLord(alignment)
                  : normalDemon(alignment),
            mayDouble: true,
        };
    }
    if (MONSTER_NAME[mnum] === 'bone devil')
        return { mnum: MONSTER_NAME.indexOf('skeleton'), mayDouble: false };
    if (flags & M2_DEMON && !(flags & (M2_LORD | M2_PRINCE))) {
        return {
            mnum: !rn2(20) ? demonLord(alignment) : !rn2(6) ? normalDemon(alignment) : mnum,
            mayDouble: false,
        };
    }
    if (flags & M2_MINION && alignment > 0) {
        const lord = !!(flags & M2_LORD);
        return {
            mnum: lord && !rn2(20) ? lawfulLord() : lord || !rn2(6) ? lawfulMinion() : mnum,
            mayDouble: true,
        };
    }
    if (mnum === PM_ANGEL) {
        let summoned: number | null = PM_ANGEL;
        if (!rn2(6)) {
            summoned = alignment === 0 ? summonedElemental() : normalDemon(alignment);
        }
        return { mnum: summoned, mayDouble: true };
    }
    return { mnum: null, mayDouble: false };
}

function summonedMonsterName(monster: Monster): string {
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME) return name;
    const article = /^[aeiou]/i.test(name) ? 'An' : 'A';
    return `${article} ${name}`;
}

function summonEnvironment(monster: Monster): string {
    const name = MONSTER_NAME[monster.mnum];
    if (name === 'air elemental' || name === 'water elemental') return 'cloud of vapor';
    if (name === 'fire elemental') return 'ball of flame';
    if (name === 'earth elemental') return 'cloud of dust';
    if ((MONSTER_SYMBOL[monster.mnum] ?? 0) === 27) return 'flash of light';
    return 'cloud of smoke';
}

function existingMonsterName(monster: Monster): string {
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    return (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME ? name : `The ${name}`;
}

export async function msummon(monster: Monster | null = null): Promise<MonsterSummoningResult> {
    const summonerFlags = MONSTER_FLAGS2[monster?.mnum ?? -1] ?? 0;
    const weapon = game.uwep || game.u?.uwep;
    if (
        monster &&
        summonerFlags & M2_DEMON &&
        artifactById(weapon?.oartifact)?.name === 'Demonbane'
    ) {
        if (canSeeMonster(monster)) {
            await pline(`${existingMonsterName(monster)} looks puzzled for a moment.`);
        }
        return { count: 0, created: [] };
    }

    const alignment = summonerAlignment(monster);
    const selection = summonedType(monster, alignment);
    let { mnum } = selection;
    if (mnum == null) return { count: 0, created: [] };

    let count = 1;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    if (selection.mayDouble && !rn2(4) && !(flags & (M2_LORD | M2_PRINCE))) count = 2;
    if (monsterIsGone(mnum)) {
        mnum = normalDemon(alignment);
        if (mnum == null) return { count: 0, created: [] };
    }

    const created: Monster[] = [];
    while (count-- > 0) {
        const summoned = await makemonNear(mnum, game.u.ux, game.u.uy, MM_EMIN | MM_NOMSG);
        if (!summoned) continue;
        summoned.emin = { min_align: 0, renegade: 0 };
        if (mnum === PM_ANGEL) {
            summoned.isminion = 1;
            summoned.emin.min_align = alignment;
            summoned.emin.renegade =
                (alignment !== (game.u?.ualign?.type ?? 0)) !== !summoned.mpeaceful ? 1 : 0;
        }
        summoned.mextra = {
            ...(summoned.mextra || {}),
            emin: summoned.emin,
        };
        created.push(summoned);
        if (count === 0 && canSeeMonster(summoned)) {
            await plineWithContinuation(
                `${summonedMonsterName(summoned)} appears in a ${summonEnvironment(summoned)}!`,
            );
        }
    }
    return { count: created.length, created };
}
