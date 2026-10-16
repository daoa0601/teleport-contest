import { formatFeltMessage } from './hero_speech.js';
// Monster summoning by demons, minions, and the Wizard of Yendor.
// C ref: minion.c msummon(), dprince(), dlord(), and ndemon().
import { artifactById } from './artifacts.js';
import { deityName } from './alignment.js';
import { A_NONE, In_endgame, MM_EMIN, MM_NOMSG, STRAT_APPEARMSG } from './const.js';
import { canSeeMonster, canSpotMonster, pline, plineWithContinuation } from './display.js';
import { cleanupTransientLight, showTransientLight } from './transient_light.js';
import { game, requireGameLevel, requireInitializedGame } from './gstate.js';
import { makemonNear, mkclassAligned } from './mklev.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { ensureMinionData } from './monster_birth_extensions.js';
import { monsterName } from './monster_name.js';
import { rn1, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { isWereMonster, summonWereAttackHelp } from './were.js';
const S_DEMON = 56;
const M2_DEMON = 0x00000100;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_MINION = 0x00001000;
const G_GONE = 0x03;
const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_JUIBLEX = MONSTER_NAME.indexOf('Juiblex');
const PM_YEENOGHU = MONSTER_NAME.indexOf('Yeenoghu');
const PM_ORCUS = MONSTER_NAME.indexOf('Orcus');
const PM_DEMOGORGON = MONSTER_NAME.indexOf('Demogorgon');
const ELEMENTALS = ['air elemental', 'fire elemental', 'earth elemental', 'water elemental'].map((name) => MONSTER_NAME.indexOf(name));
function summonedElemental() {
    const mnum = ELEMENTALS[rn2(ELEMENTALS.length)];
    if (mnum === undefined)
        throw new RangeError('Elemental summon selected outside its species table');
    return mnum;
}
// C minion.c:summon_minion(). The new servant is hostile without changing
// the alignment penalty for killing it.
export async function summonMinion(alignment, talk = false) {
    const mnum = alignment === 1
        ? lawfulMinion()
        : alignment === 0
            ? summonedElemental()
            : normalDemon(alignment);
    if (mnum == null)
        return null;
    const specialRole = ['shopkeeper', 'guard', 'aligned cleric', 'high cleric'].includes(MONSTER_NAME[mnum] ?? '');
    const flags = MM_NOMSG | (specialRole ? 0 : MM_EMIN);
    const monster = await makemonNear(mnum, game.u.ux, game.u.uy, flags);
    if (!monster)
        return null;
    if (!specialRole) {
        monster.isminion = 1;
        const minion = ensureMinionData(monster);
        minion.min_align = alignment;
        minion.renegade = 0;
    }
    if (talk) {
        const deity = deityName(alignment);
        const possessive = deity.endsWith('s') ? `${deity}'` : `${deity}'s`;
        await plineWithContinuation(heroIsDeaf(game)
            ? formatFeltMessage(`${possessive} booming voice:`)
            : `The voice of ${deity} booms:`);
        await plineWithContinuation('"Thou shalt pay for thine indiscretion!"');
        if (canSpotMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true, article: 'a' })} appears before you.`);
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
    }
    monster.mpeaceful = false;
    return monster;
}
// C mhitu.c:summonmu(), before offensive items and attack slots.
export async function summonMonsterAttackHelp(monster, state = requireInitializedGame(), random = rn2) {
    if (monster.mcan ||
        (monster.cham ?? -1) >= 0 ||
        (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON)
            && !isWereMonster(monster)))
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
    if (random(inHell ? 10 : 16) !== 0)
        return null;
    return msummon(monster);
}
function monsterIsGone(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}
function matchesAlignment(mnum, alignment) {
    return alignment === A_NONE || Math.sign(MONSTER_ALIGNMENT[mnum] ?? 0) === Math.sign(alignment);
}
export function normalDemon(alignment) {
    const mnum = mkclassAligned(S_DEMON, 0, alignment);
    if (mnum == null)
        return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return flags & M2_DEMON && !(flags & (M2_LORD | M2_PRINCE)) ? mnum : null;
}
export function demonLord(alignment) {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_YEENOGHU + 1 - PM_JUIBLEX, PM_JUIBLEX);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment))
            return mnum;
    }
    return normalDemon(alignment);
}
function demonPrince(alignment) {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_DEMOGORGON + 1 - PM_ORCUS, PM_ORCUS);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment))
            return mnum;
    }
    return demonLord(alignment);
}
function lawfulMinion() {
    for (let attempts = 20; attempts > 0; attempts--) {
        const mnum = mkclassAligned(27, 0, A_NONE);
        if (mnum != null && !((MONSTER_FLAGS2[mnum] ?? 0) & M2_LORD))
            return mnum;
    }
    return null;
}
function lawfulLord() {
    return monsterIsGone(PM_ARCHON) ? lawfulMinion() : PM_ARCHON;
}
function summonerAlignment(monster) {
    if (monster?.ispriest)
        return monster.epri?.shralign ?? monster.mextra?.epri?.shralign ?? A_NONE;
    if (monster?.isminion)
        return monster.emin?.min_align ?? monster.mextra?.emin?.min_align ?? A_NONE;
    const alignment = MONSTER_ALIGNMENT[monster?.mnum ?? PM_WIZARD_OF_YENDOR] ?? A_NONE;
    return alignment === A_NONE ? A_NONE : Math.sign(alignment);
}
function summonedType(monster, alignment) {
    const mnum = monster?.mnum ?? PM_WIZARD_OF_YENDOR;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    if ((flags & M2_DEMON && flags & M2_PRINCE) || mnum === PM_WIZARD_OF_YENDOR) {
        return {
            mnum: !rn2(20)
                ? demonPrince(alignment)
                : !rn2(4)
                    ? demonLord(alignment)
                    : normalDemon(alignment),
            double: 'demon',
        };
    }
    if (flags & M2_DEMON && flags & M2_LORD) {
        return {
            mnum: !rn2(50)
                ? demonPrince(alignment)
                : !rn2(20)
                    ? demonLord(alignment)
                    : normalDemon(alignment),
            double: 'demon',
        };
    }
    if (MONSTER_NAME[mnum] === 'bone devil')
        return { mnum: MONSTER_NAME.indexOf('skeleton'), double: null };
    if (flags & M2_DEMON && !(flags & (M2_LORD | M2_PRINCE))) {
        return {
            mnum: !rn2(20) ? demonLord(alignment) : !rn2(6) ? normalDemon(alignment) : mnum,
            double: null,
        };
    }
    if (flags & M2_MINION && alignment > 0) {
        const lord = !!(flags & M2_LORD);
        return {
            mnum: lord && !rn2(20) ? lawfulLord() : lord || !rn2(6) ? lawfulMinion() : mnum,
            double: 'minion',
        };
    }
    if (mnum === PM_ANGEL) {
        let summoned = PM_ANGEL;
        if (!rn2(6)) {
            summoned = alignment === 0 ? summonedElemental() : normalDemon(alignment);
        }
        return { mnum: summoned, double: 'minion' };
    }
    return { mnum: null, double: null };
}
function summonEnvironment(monster) {
    if (MONSTER_SYMBOL[monster.mnum] === 27 || MONSTER_SYMBOL[monster.mnum] === 25)
        return 'flash of light';
    switch (MONSTER_NAME[monster.mnum] ?? '') {
        case 'water demon':
        case 'air elemental':
        case 'water elemental':
        case 'fog cloud':
        case 'ice vortex':
        case 'freezing sphere':
            return 'cloud of vapor';
        case 'steam vortex':
            return 'cloud of steam';
        case 'energy vortex':
        case 'shocking sphere':
            return 'shower of sparks';
        case 'earth elemental':
        case 'dust vortex':
            return 'cloud of dust';
        case 'fire elemental':
        case 'fire vortex':
        case 'flaming sphere':
            return 'ball of flame';
        default:
            return 'cloud of smoke';
    }
}
export function monsterCensus(spotted = false) {
    return requireGameLevel().monsters.filter(monster => monster.mhp > 0
        && !(monster.isgd && monster.mx === 0)
        && (!spotted || canSpotMonster(monster))).length;
}
export async function msummon(monster = null) {
    const summonerFlags = MONSTER_FLAGS2[monster?.mnum ?? -1] ?? 0;
    const weapon = game.uwep || game.u?.uwep;
    if (monster &&
        summonerFlags & M2_DEMON &&
        artifactById(weapon?.oartifact)?.name === 'Demonbane') {
        if (canSeeMonster(monster)) {
            await pline(`${monsterName(monster, { capitalized: true })} looks puzzled for a moment.`);
        }
        return { count: 0, created: [] };
    }
    const alignment = summonerAlignment(monster);
    const selection = summonedType(monster, alignment);
    let { mnum } = selection;
    if (mnum == null)
        return { count: 0, created: [] };
    let count = 1;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    if (selection.double && !rn2(4)) {
        const eligible = selection.double === 'demon'
            ? !!(flags & M2_DEMON) && !(flags & (M2_LORD | M2_PRINCE))
            : !(flags & M2_LORD);
        if (eligible)
            count = 2;
    }
    if ((MONSTER_GENO[mnum] ?? 0) & 0x1000)
        count = 1;
    if (monsterIsGone(mnum)) {
        mnum = normalDemon(alignment);
        if (mnum == null)
            return { count: 0, created: [] };
    }
    const census = monsterCensus();
    let litAngel = false;
    const created = [];
    while (count-- > 0) {
        const summoned = await makemonNear(mnum, game.u.ux, game.u.uy, MM_EMIN | MM_NOMSG);
        if (!summoned)
            continue;
        const minion = ensureMinionData(summoned);
        if (mnum === PM_ANGEL) {
            summoned.isminion = 1;
            minion.min_align = alignment;
            minion.renegade =
                (alignment !== (game.u?.ualign?.type ?? 0)) !== !summoned.mpeaceful ? 1 : 0;
        }
        created.push(summoned);
        if (MONSTER_SYMBOL[summoned.mnum] === 27 && !heroIsBlind(game)) {
            await showTransientLight(null, summoned.mx, summoned.my, requireInitializedGame());
            litAngel = true;
        }
        if (count === 0 && canSeeMonster(summoned)) {
            await plineWithContinuation(`${monsterName(summoned, { capitalized: true, article: 'a' })} appears in a ${summonEnvironment(summoned)}!`);
        }
    }
    if (litAngel)
        await cleanupTransientLight(requireInitializedGame());
    return { count: created.length ? monsterCensus() - census : 0, created };
}
//# sourceMappingURL=minion.js.map