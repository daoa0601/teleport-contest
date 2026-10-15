// Were-creature transformations and hero lycanthropy.
// C refs: were.c counter_were(), new_were(), you_unwere();
// mondata.c set_mon_data().

import { formatFeltMessage, formatHeardMessage } from './hero_speech.js';
import { heroIsHallucinating } from './senses.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, PARANOID_WERECHANGE } from './const.js';
import { tameMonster } from './monster_taming.js';
import { threateningMonsterNearby } from './do.js';
import { game, requirePlayingGame } from './gstate.js';
import { setHeroSpecies } from './hero_species.js';
import { makemonNear, splitHeroMonsterForm } from './mklev.js';
import { adjustMonsterClothingAfterPolymorph } from './monworn.js';
import {
    canSeeMonster, newsym, plineWithContinuation,
} from './display.js';
import {
    MONSTER_FLAGS2, MONSTER_NAME, monsterIsHuman,
} from './monster_data.js';
import {
    counterWereSpecies, setMonsterSpecies,
} from './monster_species.js';
import {
    heroCanControlPolymorph, heroHasProtectionFromShapeChangers,
    heroIsPolymorphed, heroIsUnchanging, heroMonsterForm, polymonHero,
    returnHeroToHumanForm,
} from './polyself.js';
import { paranoidQuery } from './query.js';
import { rn2, rnd } from './rng.js';
import { sessionIsNight } from './monster_sound.js';
import { heroIsDeaf } from './senses.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterName } from './monster_name.js';
import { withIndefiniteArticle, makePlural } from './object_grammar.js';
import { monsterGrowlSound } from './monster_sound.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';

export interface HeroWereChangeOptions {
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroWaterVaporChangeOptions extends HeroWereChangeOptions {
    potion?: GameObject | null;
}

interface WereSummonOptions extends HeroWereChangeOptions {
    random?: typeof rn2;
    rollOne?: typeof rnd;
}

interface WerePurificationOptions extends HeroWereChangeOptions {
    purify?: boolean;
}

interface WereSpecies {
    mnum?: number;
}

export interface WereChange {
    monster: Monster;
    oldMnum: number;
    newMnum: number;
    howlMessage: string | null;
    wakeDistance: number;
}

interface WereChangePresentationOptions {
    publish?: MessagePublisher;
    wakeNearby?: (x: number, y: number, distance: number) => unknown;
}

interface WereTransformationOptions {
    repaint?: boolean;
    publish?: MessagePublisher;
}


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

export function catchLycanthropyFromCorpse(mnum: number, state: GameState = game) {
    const beast = HUMAN_WERE_CORPSE.get(mnum);
    if (beast === undefined) return false;
    setHeroLycanthropy(beast, state);
    return true;
}

// C set_ulycn(): infection and its innate resistance change together.
export function setHeroLycanthropy(species: number, state: GameState = game) {
    requirePlayingGame(state);
    state.u.ulycn = species;
    setHeroSpecies(state.u.umonnum, state);
}

function summonedWereAlly(form: number | null, random: typeof rn2) {
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
export function wereBeastForSpecies(mnum: number) {
    if ([PM_WERERAT, PM_SEWER_RAT, PM_GIANT_RAT, PM_RABID_RAT].includes(mnum))
        return PM_WERERAT;
    if ([PM_WEREJACKAL, PM_JACKAL, PM_FOX, PM_COYOTE].includes(mnum))
        return PM_WEREJACKAL;
    if ([PM_WEREWOLF, PM_WOLF, PM_WARG, PM_WINTER_WOLF, PM_WINTER_WOLF_CUB]
        .includes(mnum)) return PM_WEREWOLF;
    return null;
}

export function heroCanSummonWerePack(state: GameState = game) {
    const form = heroMonsterForm(state);
    return form != null && isWereMonster({ mnum: form });
}

export async function useHeroWereSummon({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
}: WereSummonOptions = {}) {
    requirePlayingGame(state);
    if (!heroCanSummonWerePack(state))
        return { used: false, spentTime: false, reason: 'not-were' };
    if ((state.u?.uen ?? 0) < 10) {
        await publish('You lack the energy to send forth a call for help!');
        return { used: false, spentTime: false, reason: 'energy' };
    }

    state.u.uen -= 10;
    state.context.botl = true;
    await publish('You call upon your brethren for help!');
    await exerciseAttribute(A_WIS, true, state);

    const form = heroMonsterForm(state);
    const helpers = form === null ? [] : await summonWerePack(form, true, state, random, rollOne);
    if (!helpers.length) await publish('But none arrive.');
    return { used: true, spentTime: true, helpers };
}

function lycanthropeBeastMnum(state: GameState) {
    const mnum = state.u?.ulycn;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return (flags & M2_WERE) && !monsterIsHuman(mnum) ? mnum : null;
}

function beastFormName(beast: number) {
    return (MONSTER_NAME[beast] || 'creature').replace(/^were/u, '');
}

async function queryControlledWereChange(state: GameState, prompt: string) {
    const paranoiaBits = state.flags?.paranoia_bits ?? 0;
    return paranoidQuery(
        !!(paranoiaBits & PARANOID_WERECHANGE),
        prompt,
        paranoiaBits,
    );
}

export async function applyHeroWaterVaporChange({
    state = game,
    potion,
    publish = plineWithContinuation,
}: HeroWaterVaporChangeOptions = {}) {
    requirePlayingGame(state);
    const u = state.u;
    if (u.umonnum === PM_GREMLIN) {
        const clone = await splitHeroMonsterForm(state);
        if (clone) await publish('You multiply!');
        return {
            kind: clone ? 'cloned' : 'clone-suppressed',
            changed: !!clone,
            clone,
        };
    }
    const beast = lycanthropeBeastMnum(state);
    if (beast === null) return { kind: 'ordinary', changed: false };

    if (potion?.blessed && u.umonnum === beast)
        return revertHeroWereForm({ state, publish });
    if (potion?.cursed && !heroIsPolymorphed(state))
        return applyHeroWereChange({ state, publish });
    return { kind: 'unaffected', changed: false };
}

// C were.c:you_were(). The same admission applies to vapor and drinking.
export async function applyHeroWereChange({
    state = game, publish = plineWithContinuation,
}: HeroWereChangeOptions = {}) {
    requirePlayingGame(state);
    const beast = lycanthropeBeastMnum(state);
    if (beast === null || heroIsUnchanging(state) || state.u.umonnum === beast)
        return { kind: 'blocked', changed: false };
    if (heroCanControlPolymorph(state)) {
        const name = beastFormName(beast);
        const article = /^[aeiou]/iu.test(name) ? 'an' : 'a';
        if (!await queryControlledWereChange(state,
            `Do you want to change into ${article} ${name}?`))
            return { kind: 'declined', changed: false };
    } else if (threateningMonsterNearby(state))
        return { kind: 'blocked', changed: false };
    if (state !== game)
        throw new Error('hero polymon owner requires live game state');
    state.were_changes = (state.were_changes ?? 0) + 1;
    const transformed = await polymonHero(beast, { sexChangeAllowed: false });
    return { kind: 'transformed', changed: true, transformed };
}

// C were.c:you_unwere(). Purification cures infection even when the body
// cannot change; an unchanged beast receives a finite remaining lifetime.
export async function revertHeroWereForm({
    state = game, publish = plineWithContinuation, purify = false,
}: WerePurificationOptions = {}) {
    requirePlayingGame(state);
    if (purify) {
        await publish(formatFeltMessage('purified.', state));
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

export async function purifyHeroLycanthropy({
    state = game, publish = plineWithContinuation,
}: HeroWereChangeOptions = {}) {
    requirePlayingGame(state);
    if (!(state.u.ulycn >= 0) && !isWereMonster({ mnum: state.u.umonnum }))
        return { cured: false, changed: false };
    return revertHeroWereForm({ state, publish, purify: true });
}

export function isWereMonster(monster: WereSpecies | null | undefined): boolean {
    const mnum = monster?.mnum;
    return mnum !== undefined && !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_WERE);
}

export function isHumanWereMonster(monster: WereSpecies | null | undefined): boolean {
    const mnum = monster?.mnum;
    if (mnum === undefined) return false;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return !!(flags & M2_WERE) && monsterIsHuman(mnum);
}

// C mhitu.c:summonmu(): the attack has a separate transformation chance
// from were_change(), then calls helpers using the resulting species.
export async function summonWereAttackHelp(
    monster: Monster, state: GameState = game, random = rn2,
): Promise<void> {
    const seen = canSeeMonster(monster);
    const protectedHero = heroHasProtectionFromShapeChangers(state);
    if (isHumanWereMonster(monster)) {
        if (!protectedHero && random(sessionIsNight(state.datetime) ? 3 : 5) === 0)
            await transformWereMonster(monster, state);
    } else if (protectedHero || random(30) === 0) {
        await transformWereMonster(monster, state);
    }
    if (random(10) !== 0) return;
    if (seen)
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} summons help!`);
    const helpers = await summonWerePack(monster.mnum, false, state, random);
    const visible = helpers.filter(helper => canSeeMonster(helper)).length;
    const hemmedIn = formatFeltMessage('hemmed in.', state);
    if (seen) {
        if (!helpers.length) await plineWithContinuation('But none comes.');
        else if (!visible) await plineWithContinuation(hemmedIn);
        return;
    }
    const deaf = heroIsDeaf(state);
    if (!deaf)
        await plineWithContinuation(`Something ${makePlural(monsterGrowlSound(monster))}!`);
    if (!helpers.length) return;
    if (!visible) {
        await plineWithContinuation(hemmedIn);
        return;
    }
    const generic = werePackName(monster.mnum);
    const appearance = visible === 1 ? `${withIndefiniteArticle(generic)} appears` : `${makePlural(generic)} appear`;
    await plineWithContinuation(`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}${deaf ? ' from nowhere' : ''}!`);
}

function werePackName(mnum: number): string {
    const beast = counterWereSpecies(mnum);
    const name = MONSTER_NAME[mnum] ?? '';
    const form = monsterIsHuman(mnum) ? MONSTER_NAME[beast ?? -1] ?? name : name;
    return form.replace(/^were/u, '') || 'creature';
}

// C were.c:were_summon(), shared by monster attacks and #monster.
async function summonWerePack(
    form: number, yours: boolean, state: GameState,
    random = rn2, rollOne = rnd,
): Promise<Monster[]> {
    if (!yours && heroHasProtectionFromShapeChangers(state)) return [];
    const helpers: Monster[] = [];
    for (let count = rollOne(5); count > 0; count--) {
        const species = summonedWereAlly(form, random);
        if (species === null) continue;
        const helper = await makemonNear(species, state.u.ux, state.u.uy, 0, true);
        if (!helper) continue;
        if (yours) await tameMonster(helper, null, { state });
        helpers.push(helper);
    }
    return helpers;
}

function changedWereFormName(monster: Pick<Monster, 'mnum'>) {
    if (isHumanWereMonster(monster)) return 'human';
    return (MONSTER_NAME[monster.mnum] || 'creature').replace(/^were/u, '');
}

function unseenWereHowl(monster: Monster, state: GameState) {
    if (heroIsDeaf(state)
        || canSeeMonster(monster)) return null;
    if (monster.mnum === PM_WEREWOLF) return 'wolf';
    if (monster.mnum === PM_WEREJACKAL) return 'jackal';
    return null;
}

export async function wereChange(monster: Monster, state: GameState = game, random = rn2, {
    publish = plineWithContinuation,
}: { publish?: MessagePublisher } = {}): Promise<WereChange | null> {
    if (!isWereMonster(monster)) return null;

    const changedFromHuman = isHumanWereMonster(monster);
    const protectedHero = heroHasProtectionFromShapeChangers(state);
    if (changedFromHuman) {
        if (protectedHero) return null;
        const fullMoon = state.flags?.moonphase === 4;
        const denominator = sessionIsNight(state.datetime)
            ? (fullMoon ? 3 : 30) : (fullMoon ? 10 : 50);
        if (random(denominator) !== 0) return null;
    } else if (random(30) !== 0 && !protectedHero) {
        return null;
    }

    const oldMnum = monster.mnum;
    if (!await transformWereMonster(monster, state, { publish })) return null;

    state.were_changes = (state.were_changes ?? 0) + 1;
    const howler = changedFromHuman ? unseenWereHowl(monster, state) : null;
    return {
        monster,
        oldMnum,
        newMnum: monster.mnum,
        howlMessage: howler
            ? formatHeardMessage(`a ${howler} howling at the moon.`, state) : null,
        wakeDistance: howler ? 16 : 0,
    };
}

export async function presentWereChange(change: WereChange | null | undefined, {
    publish = plineWithContinuation,
    wakeNearby,
}: WereChangePresentationOptions = {}) {
    if (!change) return null;
    if (change.howlMessage) await publish(change.howlMessage);
    // C were_change(): suppressed hearing prose does not silence the howl.
    if (change.wakeDistance > 0) {
        if (typeof wakeNearby !== 'function') {
            throw new TypeError(
                'presentWereChange requires wakeNearby for an unseen howl',
            );
        }
        wakeNearby(
            change.monster.mx,
            change.monster.my,
            change.wakeDistance,
        );
    }
    return change;
}

export async function transformWereMonster(monster: Monster, state: GameState = game, {
    repaint = state === game,
    publish = plineWithContinuation,
}: WereTransformationOptions = {}) {
    if (!isWereMonster(monster)) return false;
    if (isHumanWereMonster(monster)
        && heroHasProtectionFromShapeChangers(state)) return false;

    const oldMnum = monster.mnum;
    const newMnum = counterWereSpecies(oldMnum);
    if (newMnum === null || !Number.isInteger(newMnum)) return false;

    if (canSeeMonster(monster) && !heroIsHallucinating(state)) {
        const form = changedWereFormName({ mnum: newMnum });
        await publish(`${monsterName(monster, { state, capitalized: true })} changes into a ${form}.`);
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
    if (repaint) newsym(monster.mx, monster.my);
    await adjustMonsterClothingAfterPolymorph(monster, state, { publish });
    await updateMonsterWeaponAfterPolymorph(monster, state, { publish });
    const targetX = monster.mux, targetY = monster.muy;
    if (state.context.mon_moving && !monster.mpeaceful
        && targetX !== undefined && targetY !== undefined
        && Math.abs(monster.mx - targetX) <= 1 && Math.abs(monster.my - targetY) <= 1
        && monsterIsScaredAt(monster, state, targetX, targetY)) {
        await makeMonsterFlee(monster, {
            state, turns: 2 + rn2(9), first: true, publish,
        });
    }
    return true;
}
