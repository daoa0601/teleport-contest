// Were-creature transformations and hero lycanthropy.
// C refs: were.c counter_were(), new_were(), you_unwere();
// mondata.c set_mon_data().

import { exerciseAttribute } from './attrib.js';
import { A_WIS, PARANOID_WERECHANGE } from './const.js';
import { tameMonster } from './dog.js';
import { threateningMonsterNearby } from './do.js';
import { game } from './gstate.js';
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
import {
    monsterSentenceSubject, sessionIsNight,
} from './monster_sound.js';
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
    if (beast === undefined) return false;
    setHeroLycanthropy(beast, state);
    return true;
}

// C set_ulycn(): infection and its innate resistance change together.
export function setHeroLycanthropy(species, state = game) {
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
        .includes(mnum)) return PM_WEREWOLF;
    return null;
}

export function heroCanSummonWerePack(state = game) {
    const form = heroMonsterForm(state);
    return form !== null && isWereMonster({ mnum: form });
}

export async function useHeroWereSummon({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
} = {}) {
    if (!heroCanSummonWerePack(state))
        return { used: false, spentTime: false, reason: 'not-were' };
    if ((state.u?.uen ?? 0) < 10) {
        await publish('You lack the energy to send forth a call for help!');
        return { used: false, spentTime: false, reason: 'energy' };
    }

    state.u.uen -= 10;
    await publish('You call upon your brethren for help!');
    exerciseAttribute(A_WIS, true, state);

    const helpers = [];
    const form = heroMonsterForm(state);
    for (let count = rollOne(5); count > 0; count--) {
        const species = summonedWereAlly(form, random);
        if (species === null) continue;
        const monster = await makemonNear(
            species, state.u.ux, state.u.uy, 0, true,
        );
        if (!monster) continue;
        tameMonster(monster, state);
        helpers.push(monster);
    }
    if (!helpers.length) await publish('But none arrive.');
    return { used: true, spentTime: true, helpers };
}

function lycanthropeBeastMnum(state) {
    const mnum = state.u?.ulycn;
    if (!Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return (flags & M2_WERE) && !monsterIsHuman(mnum) ? mnum : null;
}

function beastFormName(beast) {
    return (MONSTER_NAME[beast] || 'creature').replace(/^were/u, '');
}

async function queryControlledWereChange(state, prompt) {
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
} = {}) {
    const u = state.u || {};
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

    if (potion?.blessed && u.umonnum === beast) {
        const unchanging = heroIsUnchanging(state);
        const nearbyThreat = !unchanging
            && threateningMonsterNearby(state);
        const controllable = heroCanControlPolymorph(state);
        let remain = false;
        if (!unchanging && !nearbyThreat && controllable) {
            remain = await queryControlledWereChange(
                state, 'Remain in beast form?',
            );
        }
        if (!unchanging && !nearbyThreat && (!controllable || !remain)) {
            const restored = await returnHeroToHumanForm(state, { publish });
            return { kind: 'rehumanized', changed: restored.changed, restored };
        }
        if (!u.mtimedone) {
            u.mtimedone = 200 + rn2(200);
            return {
                kind: 'duration-restored', changed: false,
                duration: u.mtimedone,
            };
        }
        return {
            kind: remain ? 'remained' : 'blocked', changed: false,
        };
    }

    if (potion?.cursed && !heroIsPolymorphed(state)
        && u.umonnum !== beast) {
        if (heroIsUnchanging(state))
            return { kind: 'blocked', changed: false };
        if (heroCanControlPolymorph(state)) {
            const name = beastFormName(beast);
            const article = /^[aeiou]/iu.test(name) ? 'an' : 'a';
            const accepted = await queryControlledWereChange(
                state, `Do you want to change into ${article} ${name}?`,
            );
            if (!accepted) return { kind: 'declined', changed: false };
        } else if (threateningMonsterNearby(state)) {
            return { kind: 'blocked', changed: false };
        }
        if (state !== game)
            throw new Error('hero polymon owner requires live game state');
        state.were_changes = (state.were_changes ?? 0) + 1;
        const transformed = await polymonHero(
            beast, { sexChangeAllowed: false },
        );
        return { kind: 'transformed', changed: true, transformed };
    }
    return { kind: 'unaffected', changed: false };
}

export async function purifyHeroLycanthropy({
    state = game,
    publish = plineWithContinuation,
} = {}) {
    const hero = state.u || (state.u = {});
    const inWereForm = isWereMonster({ mnum: hero.umonnum });
    const infected = Number.isInteger(hero.ulycn) && hero.ulycn >= 0;
    if (!infected && !inWereForm) return { cured: false, changed: false };

    await publish('You feel purified.');
    setHeroLycanthropy(-1, state);

    if (!inWereForm) return { cured: true, changed: false };

    const unchanging = heroIsUnchanging(state);
    const nearbyThreat = !unchanging && threateningMonsterNearby(state);
    const controllable = heroCanControlPolymorph(state);
    let remain = false;
    if (!unchanging && !nearbyThreat && controllable) {
        remain = await queryControlledWereChange(
            state, 'Remain in beast form?',
        );
    }

    if (!unchanging && !nearbyThreat && (!controllable || !remain)) {
        const restored = await returnHeroToHumanForm(state, { publish });
        return { cured: true, changed: restored.changed, restored };
    }

    if (!hero.mtimedone) hero.mtimedone = 200 + rn2(200);
    return { cured: true, changed: false };
}

export function isWereMonster(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}

export function isHumanWereMonster(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & M2_WERE) && monsterIsHuman(monster?.mnum);
}

function heroHallucinates(state) {
    return !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
}

function changedWereFormName(monster) {
    if (isHumanWereMonster(monster)) return 'human';
    return (MONSTER_NAME[monster.mnum] || 'creature').replace(/^were/u, '');
}

function unseenWereHowl(monster, state) {
    if (heroIsDeaf(state)
        || canSeeMonster(monster, monster.mx, monster.my)) return null;
    if (monster.mnum === PM_WEREWOLF) return 'wolf';
    if (monster.mnum === PM_WEREJACKAL) return 'jackal';
    return null;
}

export function wereChange(monster, state = game, random = rn2) {
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
    const subject = monsterSentenceSubject(monster);
    const visibleBefore = canSeeMonster(monster, monster.mx, monster.my);
    if (!transformWereMonster(monster, state, { repaint: false })) return null;

    state.were_changes = (state.were_changes ?? 0) + 1;
    const howler = changedFromHuman ? unseenWereHowl(monster, state) : null;
    return {
        monster,
        oldMnum,
        newMnum: monster.mnum,
        transformationMessage: visibleBefore && !heroHallucinates(state)
            ? `${subject} changes into a ${changedWereFormName(monster)}.`
            : null,
        howlMessage: howler
            ? `You hear a ${howler} howling at the moon.` : null,
        wakeDistance: howler ? 16 : 0,
    };
}

export async function presentWereChange(change, {
    publish = plineWithContinuation,
    wakeNearby,
} = {}) {
    if (!change) return null;
    if (change.transformationMessage)
        await publish(change.transformationMessage);
    if (change.howlMessage) {
        await publish(change.howlMessage);
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

export function transformWereMonster(monster, state = game, {
    repaint = state === game,
} = {}) {
    if (!isWereMonster(monster)) return false;
    if (isHumanWereMonster(monster)
        && heroHasProtectionFromShapeChangers(state)) return false;

    const oldMnum = monster.mnum;
    const newMnum = counterWereSpecies(oldMnum);
    if (!Number.isInteger(newMnum)) return false;

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
    adjustMonsterClothingAfterPolymorph(monster, state);
    updateMonsterWeaponAfterPolymorph(monster, state);
    return true;
}
