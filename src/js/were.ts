// Were-creature transformations and hero lycanthropy.
// C refs: were.c counter_were(), new_were(), you_unwere();
// mondata.c set_mon_data().

import { formatFeltMessage, formatHeardMessage } from './hero_speech.js';
import { heroIsHallucinating, heroIsDeaf } from './senses.js';
import { PARANOID_WERECHANGE } from './const.js';
import { game, requirePlayingGame } from './gstate.js';
import {
    setHeroSpecies, heroCanControlPolymorph, heroHasProtectionFromShapeChangers, heroIsPolymorphed,
    heroIsUnchanging, heroMonsterForm, polymonHero, returnHeroToHumanForm,
} from './polyself.js';
import { splitHeroMonsterForm } from './potion.js';
import { makemonAt } from './makemon.js';
import { adjustMonsterClothingAfterPolymorph } from './monworn.js';
import { canSeeMonster, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { MONSTER_NAME } from './monster_data.js';
import { setMonsterSpecies, is_were, monsterIsHuman } from './mondata.js';
import { paranoidQuery } from './cmd.js';
import { rn2, rnd } from './rng.js';
import { sessionIsNight, monsterGrowlSound } from './ambient_sounds.js';
import { updateMonsterWeaponAfterPolymorph } from './weapon.js';
import { monsterIsScaredAt, makeMonsterFlee } from './monmove.js';
import { monsterName } from './do_name.js';
import { withIndefiniteArticle } from './objnam.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './pline.js';
import { tameMonster } from './dog.js';
import { threateningMonsterNearby } from './hack.js';

export interface HeroWereChangeOptions {
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroWaterVaporChangeOptions extends HeroWereChangeOptions {
    potion?: GameObject | null;
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

function lycanthropeBeastMnum(state: GameState) {
    const mnum = state.u?.ulycn;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        return null;

    return is_were(mnum) && !monsterIsHuman(mnum) ? mnum : null;
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
        if (!await queryControlledWereChange(state,
            `Do you want to change into ${withIndefiniteArticle(name)}?`))
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
    return mnum !== undefined && is_were(mnum);
}

export function isHumanWereMonster(monster: WereSpecies | null | undefined): boolean {
    const mnum = monster?.mnum;
    if (mnum === undefined) return false;

    return is_were(mnum) && monsterIsHuman(mnum);
}


// C were.c:were_summon(), shared by monster attacks and #monster.
export async function summonWerePack(
    form: number, yours: boolean, state: GameState,
    random = rn2, rollOne = rnd,
): Promise<Monster[]> {
    if (!yours && heroHasProtectionFromShapeChangers(state)) return [];
    const helpers: Monster[] = [];
    for (let count = rollOne(5); count > 0; count--) {
        const species = summonedWereAlly(form, random);
        if (species === null) continue;
        const helper = await makemonAt(species, state.u.ux, state.u.uy);
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
        await wakeNearby(
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
    if (monster.msleeping || !monster.mcanmove) {
        monster.msleeping = 0;
        monster.mfrozen = 0;
        monster.mcanmove = 1;
    }
    if (Number.isFinite(monster.mhp) && Number.isFinite(monster.mhpmax)) {
        const healing = Math.trunc((monster.mhpmax - monster.mhp) / 4);
        monster.mhp = Math.min(monster.mhpmax, monster.mhp + healing);
    }
    if (repaint) await newsym(monster.mx, monster.my);
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

// C were.c:counter_were().
const COUNTER_WERE_SPECIES = new Map<number, number>([
    [PM_WERERAT, PM_HUMAN_WERERAT],
    [PM_WEREJACKAL, PM_HUMAN_WEREJACKAL],
    [PM_WEREWOLF, PM_HUMAN_WEREWOLF],
    [PM_HUMAN_WERERAT, PM_WERERAT],
    [PM_HUMAN_WEREJACKAL, PM_WEREJACKAL],
    [PM_HUMAN_WEREWOLF, PM_WEREWOLF],
]);

// C were.c:counter_were(). The human or beast form of a lycanthrope.
export function counterWereSpecies(mnum: number): number | null {
    return COUNTER_WERE_SPECIES.get(mnum) ?? null;
}
