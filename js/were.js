// Were-creature transformations and hero lycanthropy.
// C refs: were.c counter_were(), new_were(), you_unwere();
// mondata.c set_mon_data().
import { heroIsHallucinating } from './senses.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, PARANOID_WERECHANGE } from './const.js';
import { tameMonster } from './monster_taming.js';
import { threateningMonsterNearby } from './do.js';
import { game, requirePlayingGame } from './gstate.js';
import { setHeroSpecies } from './hero_species.js';
import { makemonNear, splitHeroMonsterForm } from './mklev.js';
import { adjustMonsterClothingAfterPolymorph } from './monworn.js';
import { canSeeMonster, newsym, plineWithContinuation, } from './display.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsHuman, } from './monster_data.js';
import { counterWereSpecies, setMonsterSpecies, } from './monster_species.js';
import { heroCanControlPolymorph, heroHasProtectionFromShapeChangers, heroIsPolymorphed, heroIsUnchanging, heroMonsterForm, polymonHero, returnHeroToHumanForm, } from './polyself.js';
import { paranoidQuery } from './query.js';
import { rn2, rnd } from './rng.js';
import { monsterSentenceSubject, sessionIsNight, } from './monster_sound.js';
import { heroIsDeaf } from './senses.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
const M2_WERE = 0x00000004;
const PM_GREMLIN = 40;
const PM_SEWER_RAT = 88;
const PM_GIANT_RAT = 89;
const PM_RABID_RAT = 90;
const PM_WERERAT = 91;
const PM_JACKAL = 12;
const PM_FOX = 13;
const PM_COYOTE = 14;
const PM_WEREJACKAL = 15;
const PM_WOLF = 20;
const PM_WEREWOLF = 21;
const PM_WARG = 23;
const PM_WINTER_WOLF = 24;
const PM_WINTER_WOLF_CUB = MONSTER_NAME.indexOf('winter wolf cub');
const PM_HUMAN_WERERAT = 261;
const PM_HUMAN_WEREJACKAL = 262;
const PM_HUMAN_WEREWOLF = 263;
const HUMAN_WERE_CORPSE = new Map([
    [PM_HUMAN_WERERAT, PM_WERERAT],
    [PM_HUMAN_WEREJACKAL, PM_WEREJACKAL],
    [PM_HUMAN_WEREWOLF, PM_WEREWOLF],
]);
export function catchLycanthropyFromCorpse(mnum, state = game) {
    const beast = HUMAN_WERE_CORPSE.get(mnum);
    if (beast === undefined)
        return false;
    setHeroLycanthropy(beast, state);
    return true;
}
// C set_ulycn(): infection and its innate resistance change together.
export function setHeroLycanthropy(species, state = game) {
    requirePlayingGame(state);
    state.u.ulycn = species;
    setHeroSpecies(state.u.umonnum, state);
}
function summonedWereAlly(form, random) {
    if (form === PM_WERERAT || form === PM_HUMAN_WERERAT) {
        return random(3) ? PM_SEWER_RAT
            : random(3) ? PM_GIANT_RAT : PM_RABID_RAT;
    }
    if (form === PM_WEREJACKAL || form === PM_HUMAN_WEREJACKAL) {
        return random(7) ? PM_JACKAL
            : random(3) ? PM_COYOTE : PM_FOX;
    }
    if (form === PM_WEREWOLF || form === PM_HUMAN_WEREWOLF) {
        return random(5) ? PM_WOLF
            : random(2) ? PM_WARG : PM_WINTER_WOLF;
    }
    return null;
}
// C were_beastie(): ordinary relatives can request the infected beast form.
export function wereBeastForSpecies(mnum) {
    if ([PM_WERERAT, PM_SEWER_RAT, PM_GIANT_RAT, PM_RABID_RAT].includes(mnum))
        return PM_WERERAT;
    if ([PM_WEREJACKAL, PM_JACKAL, PM_FOX, PM_COYOTE].includes(mnum))
        return PM_WEREJACKAL;
    if ([PM_WEREWOLF, PM_WOLF, PM_WARG, PM_WINTER_WOLF, PM_WINTER_WOLF_CUB]
        .includes(mnum))
        return PM_WEREWOLF;
    return null;
}
export function heroCanSummonWerePack(state = game) {
    const form = heroMonsterForm(state);
    return form != null && isWereMonster({ mnum: form });
}
export async function useHeroWereSummon({ state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    if (!heroCanSummonWerePack(state))
        return { used: false, spentTime: false, reason: 'not-were' };
    if ((state.u?.uen ?? 0) < 10) {
        await publish('You lack the energy to send forth a call for help!');
        return { used: false, spentTime: false, reason: 'energy' };
    }
    state.u.uen -= 10;
    await publish('You call upon your brethren for help!');
    await exerciseAttribute(A_WIS, true, state);
    const helpers = [];
    const form = heroMonsterForm(state);
    for (let count = rollOne(5); count > 0; count--) {
        const species = form == null ? null : summonedWereAlly(form, random);
        if (species === null)
            continue;
        const monster = await makemonNear(species, state.u.ux, state.u.uy, 0, true);
        if (!monster)
            continue;
        await tameMonster(monster, null, { state });
        helpers.push(monster);
    }
    if (!helpers.length)
        await publish('But none arrive.');
    return { used: true, spentTime: true, helpers };
}
function lycanthropeBeastMnum(state) {
    const mnum = state.u?.ulycn;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return (flags & M2_WERE) && !monsterIsHuman(mnum) ? mnum : null;
}
function beastFormName(beast) {
    return (MONSTER_NAME[beast] || 'creature').replace(/^were/u, '');
}
async function queryControlledWereChange(state, prompt) {
    const paranoiaBits = state.flags?.paranoia_bits ?? 0;
    return paranoidQuery(!!(paranoiaBits & PARANOID_WERECHANGE), prompt, paranoiaBits);
}
export async function applyHeroWaterVaporChange({ state = game, potion, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    const u = state.u;
    if (u.umonnum === PM_GREMLIN) {
        const clone = await splitHeroMonsterForm(state);
        if (clone)
            await publish('You multiply!');
        return {
            kind: clone ? 'cloned' : 'clone-suppressed',
            changed: !!clone,
            clone,
        };
    }
    const beast = lycanthropeBeastMnum(state);
    if (beast === null)
        return { kind: 'ordinary', changed: false };
    if (potion?.blessed && u.umonnum === beast)
        return revertHeroWereForm({ state, publish });
    if (potion?.cursed && !heroIsPolymorphed(state))
        return applyHeroWereChange({ state, publish });
    return { kind: 'unaffected', changed: false };
}
// C were.c:you_were(). The same admission applies to vapor and drinking.
export async function applyHeroWereChange({ state = game, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    const beast = lycanthropeBeastMnum(state);
    if (beast === null || heroIsUnchanging(state) || state.u.umonnum === beast)
        return { kind: 'blocked', changed: false };
    if (heroCanControlPolymorph(state)) {
        const name = beastFormName(beast);
        const article = /^[aeiou]/iu.test(name) ? 'an' : 'a';
        if (!await queryControlledWereChange(state, `Do you want to change into ${article} ${name}?`))
            return { kind: 'declined', changed: false };
    }
    else if (threateningMonsterNearby(state))
        return { kind: 'blocked', changed: false };
    if (state !== game)
        throw new Error('hero polymon owner requires live game state');
    state.were_changes = (state.were_changes ?? 0) + 1;
    const transformed = await polymonHero(beast, { sexChangeAllowed: false });
    return { kind: 'transformed', changed: true, transformed };
}
// C were.c:you_unwere(). Purification cures infection even when the body
// cannot change; an unchanged beast receives a finite remaining lifetime.
export async function revertHeroWereForm({ state = game, publish = plineWithContinuation, purify = false, } = {}) {
    requirePlayingGame(state);
    if (purify) {
        await publish('You feel purified.');
        setHeroLycanthropy(-1, state);
    }
    if (!isWereMonster({ mnum: state.u.umonnum }))
        return { cured: purify, changed: false };
    const unchanging = heroIsUnchanging(state);
    const nearbyThreat = !unchanging && threateningMonsterNearby(state);
    let remain = false;
    if (!unchanging && !nearbyThreat && heroCanControlPolymorph(state))
        remain = await queryControlledWereChange(state, 'Remain in beast form?');
    if (!unchanging && !nearbyThreat && !remain) {
        const restored = await returnHeroToHumanForm(state, { publish });
        return { kind: 'rehumanized', cured: purify, changed: restored.changed, restored };
    }
    if (!state.u.mtimedone) {
        state.u.mtimedone = 200 + rn2(200);
        return { kind: 'duration-restored', cured: purify, changed: false,
            duration: state.u.mtimedone };
    }
    return { kind: remain ? 'remained' : 'blocked', cured: purify, changed: false };
}
export async function purifyHeroLycanthropy({ state = game, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    if (!(state.u.ulycn >= 0) && !isWereMonster({ mnum: state.u.umonnum }))
        return { cured: false, changed: false };
    return revertHeroWereForm({ state, publish, purify: true });
}
export function isWereMonster(monster) {
    const mnum = monster?.mnum;
    return mnum !== undefined && !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_WERE);
}
export function isHumanWereMonster(monster) {
    const mnum = monster?.mnum;
    if (mnum === undefined)
        return false;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return !!(flags & M2_WERE) && monsterIsHuman(mnum);
}
function changedWereFormName(monster) {
    if (isHumanWereMonster(monster))
        return 'human';
    return (MONSTER_NAME[monster.mnum] || 'creature').replace(/^were/u, '');
}
function unseenWereHowl(monster, state) {
    if (heroIsDeaf(state)
        || canSeeMonster(monster))
        return null;
    if (monster.mnum === PM_WEREWOLF)
        return 'wolf';
    if (monster.mnum === PM_WEREJACKAL)
        return 'jackal';
    return null;
}
export async function wereChange(monster, state = game, random = rn2, { publish = plineWithContinuation, } = {}) {
    if (!isWereMonster(monster))
        return null;
    const changedFromHuman = isHumanWereMonster(monster);
    const protectedHero = heroHasProtectionFromShapeChangers(state);
    if (changedFromHuman) {
        if (protectedHero)
            return null;
        const fullMoon = state.flags?.moonphase === 4;
        const denominator = sessionIsNight(state.datetime)
            ? (fullMoon ? 3 : 30) : (fullMoon ? 10 : 50);
        if (random(denominator) !== 0)
            return null;
    }
    else if (random(30) !== 0 && !protectedHero) {
        return null;
    }
    const oldMnum = monster.mnum;
    if (!await transformWereMonster(monster, state, { publish }))
        return null;
    state.were_changes = (state.were_changes ?? 0) + 1;
    const howler = changedFromHuman ? unseenWereHowl(monster, state) : null;
    return {
        monster,
        oldMnum,
        newMnum: monster.mnum,
        howlMessage: howler
            ? `You hear a ${howler} howling at the moon.` : null,
        wakeDistance: howler ? 16 : 0,
    };
}
export async function presentWereChange(change, { publish = plineWithContinuation, wakeNearby, } = {}) {
    if (!change)
        return null;
    if (change.howlMessage) {
        await publish(change.howlMessage);
        if (typeof wakeNearby !== 'function') {
            throw new TypeError('presentWereChange requires wakeNearby for an unseen howl');
        }
        wakeNearby(change.monster.mx, change.monster.my, change.wakeDistance);
    }
    return change;
}
export async function transformWereMonster(monster, state = game, { repaint = state === game, publish = plineWithContinuation, } = {}) {
    if (!isWereMonster(monster))
        return false;
    if (isHumanWereMonster(monster)
        && heroHasProtectionFromShapeChangers(state))
        return false;
    const oldMnum = monster.mnum;
    const newMnum = counterWereSpecies(oldMnum);
    if (newMnum === null || !Number.isInteger(newMnum))
        return false;
    if (canSeeMonster(monster) && !heroIsHallucinating(state)) {
        const form = changedWereFormName({ mnum: newMnum });
        await publish(`${monsterSentenceSubject(monster)} changes into a ${form}.`);
    }
    setMonsterSpecies(monster, newMnum);
    if (monster.msleeping || monster.mfrozen || monster.mcanmove === 0) {
        monster.msleeping = 0;
        monster.mfrozen = 0;
        monster.mcanmove = 1;
    }
    if (Number.isFinite(monster.mhp) && Number.isFinite(monster.mhpmax)) {
        const healing = Math.trunc((monster.mhpmax - monster.mhp) / 4);
        monster.mhp = Math.min(monster.mhpmax, monster.mhp + healing);
    }
    if (repaint)
        newsym(monster.mx, monster.my);
    await adjustMonsterClothingAfterPolymorph(monster, state, { publish });
    await updateMonsterWeaponAfterPolymorph(monster, state, { publish });
    return true;
}
//# sourceMappingURL=were.js.map