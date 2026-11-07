// Monster summoning by demons, minions, and the Wizard of Yendor.
// C ref: minion.c msummon(), dprince(), dlord(), ndemon(), demon_talk(),
// bribe(), lose_guardian_angel(), and gain_guardian_angel().
import { artifactById } from './artifact.js';
import { deityName } from './pray.js';
import { A_CHA, A_NONE, FAINTED, In_endgame, In_hell, LL_UMONST, MM_ADJACENTOK, MM_EMIN, MM_NOMSG, NON_PM, RLOC_MSG, STRAT_APPEARMSG, W_ARMS } from './const.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { formatFeltMessage, pline, plineWithContinuation, recordGameLogEvent } from './pline.js';
import { cleanupTransientLight, showTransientLight } from './light.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import { makemonNear } from './mklev.js';
import { currentAttribute } from './attrib.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { giveMonsterStartingObject, makemonAt, mkclassAligned, setMonsterMalign } from './makemon.js';
import { MONSTER_ALIGNMENT, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterName } from './do_name.js';
import { currency } from './invent.js';
import { Hear_again, reset_faint } from './eat.js';
import { heroSpecies } from './polyself.js';
import { removeMonsterFromGame } from './mon.js';
import { AMULET_OF_REFLECTION, AMULET_OF_YENDOR, OBJECT_NAMES, SHIELD_OF_REFLECTION } from './object_data.js';
import { stopHeroOccupation } from './allmain.js';
import { getLine } from './query.js';
import { addCreatedObjectToMonsterInventory, addObjectToMonsterInventory } from './steal.js';
import { detachHeroGold } from './sit.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { enexto, randomMonsterRelocation, reportMonsterTeleportRestriction } from './teleport.js';
import { endVoluntaryMultiTurn, heroGoldAmount } from './hack.js';
import { mksobj, blessObjectState } from './mkobj.js';
import { selectHandToHandWeapon } from './weapon.js';
import { initializeMonsterArmor } from './worn.js';
import { finishSpecialRoamer } from './priest.js';
import { heroHasConflict } from './hero_conflict.js';
import { is_lord, is_minion, monsterIsDemon, is_ndemon, is_dlord, is_dprince, } from './mondata.js';
const S_DEMON = 56;
const G_GONE = 0x03;
const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_JUIBLEX = MONSTER_NAME.indexOf('Juiblex');
const PM_YEENOGHU = MONSTER_NAME.indexOf('Yeenoghu');
const PM_ORCUS = MONSTER_NAME.indexOf('Orcus');
const PM_DEMOGORGON = MONSTER_NAME.indexOf('Demogorgon');
const ELEMENTALS = ['air elemental', 'fire elemental', 'earth elemental', 'water elemental'].map((name) => MONSTER_NAME.indexOf(name));
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
// Part of C minion.c:summon_minion(): the ROLL_FROM elementals pick for a
// neutral summons.
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
// C minion.c:demon_talk(). The monmove.c:dochug() blackmail block checks
// mux/muy before calling this (talkToDemon in monmove.ts); the mux/muy
// branch lives there, not here.
export async function demandDemonBribe(monster, state, random = rn2, rollOne = rnd) {
    const subject = () => monsterName(monster, { state, capitalized: true, article: 'a' });
    const heroIsDemon = MONSTER_SYMBOL[heroSpecies(state)] === S_DEMON;
    const weapon = state.uwep || state.u.uwep;
    if (['Excalibur', 'Demonbane'].includes(artifactById(weapon?.oartifact, state)?.name ?? '')) {
        await plineWithContinuation(canSpotMonster(monster)
            ? `${subject()} looks very angry.`
            : formatFeltMessage('tension building.', state));
        monster.mtame = 0;
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
        await newsym(monster.mx, monster.my);
        return false;
    }
    if (state.u.uhs === FAINTED)
        await reset_faint({ state });
    else {
        await stopHeroOccupation(state);
        if ((state.multi ?? 0) > 0)
            endVoluntaryMultiTurn(state);
    }
    if (is_dprince(monster.mnum) && monster.minvis) {
        const unseen = !canSpotMonster(monster);
        monster.minvis = monster.perminvis = false;
        if (unseen && canSpotMonster(monster)) {
            await plineWithContinuation(`${subject()} appears before you.`);
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
        }
        await newsym(monster.mx, monster.my);
    }
    const deaf = heroIsDeaf(state);
    if (heroIsDemon) {
        if (!deaf)
            await plineWithContinuation(`${subject()} says, "Good hunting, ${state.flags.female ? 'Sister' : 'Brother'}."`);
        else if (canSeeMonster(monster))
            await plineWithContinuation(`${subject()} says something.`);
        if (!await reportMonsterTeleportRestriction(monster, { state }))
            await randomMonsterRelocation(monster, { state, flags: RLOC_MSG, random, rollOne });
        return true;
    }
    const cash = heroGoldAmount(state);
    const atHome = In_hell(state.u.uz) && (monster.cham ?? NON_PM) === NON_PM;
    const sameAlignment = Math.sign(state.u.ualign.type) === Math.sign(MONSTER_ALIGNMENT[monster.mnum] ?? 0);
    let demand = Math.trunc(cash * (rollOne(80) + (atHome ? 20 : 0)) / (100 * (1 + Number(sameAlignment))));
    if (!demand || heroHasInvoluntaryDelay(state)) {
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
        return false;
    }
    if (deaf || monster.minvent?.some(object => object.otyp === AMULET_OF_YENDOR))
        demand = cash + random(1000) + 125;
    if (!deaf)
        await plineWithContinuation(`${subject()} demands ${demand} ${currency(demand, { state, random })} for safe passage.`);
    else if (canSeeMonster(monster))
        await plineWithContinuation(`${subject()} seems to be demanding something.`);
    const offer = deaf ? 0 : await offerGoldToMonster(monster, 'How much will you offer?', state, random);
    if (!deaf && offer >= demand)
        await plineWithContinuation(`${subject()} vanishes, laughing about cowardly mortals.`);
    else if (offer > 0 && rollOne(5 * currentAttribute(A_CHA, state)) > demand - offer)
        await plineWithContinuation(`${subject()} scowls at you menacingly, then vanishes.`);
    else {
        await plineWithContinuation(`${subject()} gets angry...`);
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
        return false;
    }
    recordGameLogEvent(`bribed ${monsterName(monster, { state, article: 'a', exact: true })} with ${offer} ${offer === 1 ? 'zorkmid' : 'zorkmids'} for safe passage`, { state, flags: LL_UMONST });
    await removeMonsterFromGame(monster);
    return true;
}
// Part of C minion.c:dprince(), minion.c:dlord(): the genocided-or-extinct
// candidate test.
function monsterIsGone(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}
// Part of C minion.c:dprince(), minion.c:dlord(): the alignment candidate
// test.
function matchesAlignment(mnum, alignment) {
    return alignment === A_NONE || Math.sign(MONSTER_ALIGNMENT[mnum] ?? 0) === Math.sign(alignment);
}
// C minion.c:ndemon():
export function normalDemon(alignment) {
    const mnum = mkclassAligned(S_DEMON, 0, alignment);
    if (mnum == null)
        return null;
    return is_ndemon(mnum) ? mnum : null;
}
// C minion.c:dlord():
export function demonLord(alignment) {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_YEENOGHU + 1 - PM_JUIBLEX, PM_JUIBLEX);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment))
            return mnum;
    }
    return normalDemon(alignment);
}
// C minion.c:dprince():
function demonPrince(alignment) {
    const attempts = In_endgame(game.u?.uz) ? 0 : 20;
    for (let left = attempts; left > 0; left--) {
        const mnum = rn1(PM_DEMOGORGON + 1 - PM_ORCUS, PM_ORCUS);
        if (!monsterIsGone(mnum) && matchesAlignment(mnum, alignment))
            return mnum;
    }
    return demonLord(alignment);
}
// C minion.c:lminion():
function lawfulMinion() {
    for (let attempts = 20; attempts > 0; attempts--) {
        const mnum = mkclassAligned(27, 0, A_NONE);
        if (mnum != null && !is_lord(mnum))
            return mnum;
    }
    return null;
}
// C minion.c:llord():
function lawfulLord() {
    return monsterIsGone(PM_ARCHON) ? lawfulMinion() : PM_ARCHON;
}
// Part of C minion.c:msummon(): the summoner's alignment.
function summonerAlignment(monster) {
    if (monster?.ispriest)
        return monster.epri?.shralign ?? monster.mextra?.epri?.shralign ?? A_NONE;
    if (monster?.isminion)
        return monster.emin?.min_align ?? monster.mextra?.emin?.min_align ?? A_NONE;
    const alignment = MONSTER_ALIGNMENT[monster?.mnum ?? PM_WIZARD_OF_YENDOR] ?? A_NONE;
    return alignment === A_NONE ? A_NONE : Math.sign(alignment);
}
// Part of C minion.c:msummon(): the summoned-type selection chain.
function summonedType(monster, alignment) {
    const mnum = monster?.mnum ?? PM_WIZARD_OF_YENDOR;
    if ((is_dprince(mnum)) || mnum === PM_WIZARD_OF_YENDOR) {
        return {
            mnum: !rn2(20)
                ? demonPrince(alignment)
                : !rn2(4)
                    ? demonLord(alignment)
                    : normalDemon(alignment),
            double: 'demon',
        };
    }
    if (is_dlord(mnum)) {
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
    if (is_ndemon(mnum)) {
        return {
            mnum: !rn2(20) ? demonLord(alignment) : !rn2(6) ? normalDemon(alignment) : mnum,
            double: null,
        };
    }
    if (is_minion(mnum) && alignment > 0) {
        const lord = is_lord(mnum);
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
// C mondata.c:msummon_environ(): the "appears in a <cloud> of <what>"
// description.
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
// C minion.c:monster_census():
export function monsterCensus(spotted = false, state = game) {
    return requireGameLevel(state).monsters.filter(monster => !monster.dead && monster.mhp > 0
        && !(monster.isgd && monster.mx === 0)
        && (!spotted || canSpotMonster(monster))).length;
}
// C minion.c:msummon():
export async function msummon(monster = null) {
    const weapon = game.uwep || game.u?.uwep;
    if (monster &&
        monsterIsDemon(monster?.mnum ?? -1) &&
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
    if (selection.double && !rn2(4)) {
        const eligible = selection.double === 'demon'
            ? is_ndemon(mnum)
            : !is_lord(mnum);
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
// C minion.c:newemin(). Preserve an existing record and its ownership link.
export function ensureMinionData(monster) {
    const minion = monster.emin ?? monster.mextra?.emin
        ?? { parentmid: monster.m_id, min_align: 0, renegade: 0 };
    monster.emin = minion;
    monster.mextra ??= {};
    monster.mextra.emin = minion;
    return minion;
}
// C minion.c:bribe(), shared by demon and priest conversations.
export async function offerGoldToMonster(monster, prompt, state, random = rn2) {
    const text = await getLine(prompt, () => true);
    const digits = /^\s*[+-]?\d+/u.exec(text ?? '');
    let offer = digits ? Number(digits[0]) : 0;
    if (!Number.isFinite(offer))
        offer = 0;
    if (offer < 0) {
        await plineWithContinuation(`You try to shortchange ${monsterName(monster, { state })}, but fumble.`);
        return 0;
    }
    if (!offer) {
        await plineWithContinuation('You refuse.');
        return 0;
    }
    const name = monsterName(monster, { state });
    const cash = heroGoldAmount(state);
    if (offer >= cash) {
        await plineWithContinuation(`You give ${name} all your gold.`);
        offer = cash;
    }
    else
        await plineWithContinuation(`You give ${name} ${offer} ${currency(offer, { state, random })}.`);
    const gold = detachHeroGold(state, offer);
    if (gold)
        await addObjectToMonsterInventory(monster, gold, state);
    state.context.botl = true;
    return offer;
}
// C minion.c:lose_guardian_angel(). A guardian has minion data, not pet data.
export async function loseGuardianAngel(monster, state = requireInitializedGame()) {
    requireLiveGame(state);
    if (monster) {
        if (canSpotMonster(monster)) {
            const name = monsterName(monster, { state, capitalized: true });
            if (heroIsDeaf(state)) {
                await plineWithContinuation(`${name} vanishes!`);
            }
            else {
                await plineWithContinuation(`${name} rebukes you, saying:`);
                await plineWithContinuation('"Since you desire conflict, have some more!"');
            }
        }
        await removeMonsterFromGame(monster);
        if (state.program_state.gameover)
            return { heroDied: true };
    }
    for (let remaining = rn1(3, 2); remaining > 0; remaining--) {
        await createGuardianAngel(false, state);
        if (state.program_state.gameover)
            return { heroDied: true };
    }
    return { heroDied: false };
}
// C minion.c:gain_guardian_angel(), called only on the first Astral arrival.
export async function gainGuardianAngel(state = requireInitializedGame()) {
    await Hear_again({ state });
    if (heroHasConflict(state)) {
        await plineWithContinuation(heroIsDeaf(state)
            ? formatFeltMessage('a booming voice:', state) : 'A voice booms:');
        await plineWithContinuation('"Thy desire for conflict shall be fulfilled!"');
        await loseGuardianAngel(null, state);
        return;
    }
    if (state.u.ualign.record <= 8)
        return;
    await plineWithContinuation(heroIsDeaf(state)
        ? formatFeltMessage('a soft voice:', state) : 'A voice whispers:');
    await plineWithContinuation('"Thou hast been worthy of me!"');
    const angel = await createGuardianAngel(true, state);
    if (!angel)
        return;
    angel.mstrategy = (angel.mstrategy ?? 0) & ~STRAT_APPEARMSG;
    if (state.u.uconduct.pets) {
        angel.mtame = 10;
        state.u.uconduct.pets++;
    }
    await newsym(angel.mx, angel.my);
    await plineWithContinuation(heroIsBlind(state)
        ? formatFeltMessage('the presence of a friendly angel near you.', state)
        : 'An angel appears near you.');
    angel.m_lev = rn1(8, 15);
    angel.mhp = angel.mhpmax = d(angel.m_lev, 10) + 30 + rnd(30);
    let weapon = selectHandToHandWeapon(angel, state);
    if (!weapon) {
        weapon = await mksobj(SILVER_SABER, false, false);
        await addCreatedObjectToMonsterInventory(angel, weapon, state);
        if (weapon.where === 'gone')
            throw new Error("The guardian's new saber unexpectedly merged");
    }
    blessObjectState(weapon, state);
    if (weapon.spe < 4)
        weapon.spe += rnd(4);
    const shield = angel.minvent?.find(object => ((object.owornmask ?? 0) & W_ARMS) !== 0);
    if (shield?.otyp !== SHIELD_OF_REFLECTION) {
        await giveMonsterStartingObject(angel, AMULET_OF_REFLECTION);
        await initializeMonsterArmor(angel, state);
    }
}
// Part of C minion.c:gain_guardian_angel(), minion.c:lose_guardian_angel():
// creating the angel through enexto and mk_roamer.
async function createGuardianAngel(peaceful, state) {
    const position = enexto(PM_ANGEL, state.u.ux, state.u.uy, { state });
    if (!position)
        return null;
    // enexto supplies an empty square before mk_roamer creates the angel.
    const angel = await makemonAt(PM_ANGEL, position.x, position.y, MM_ADJACENTOK | MM_EMIN | MM_NOMSG);
    if (angel && !state.program_state.gameover)
        finishSpecialRoamer(angel, state.u.ualign.type, peaceful);
    return angel;
}
//# sourceMappingURL=minion.js.map