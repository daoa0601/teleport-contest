// Were-creature transformations and hero lycanthropy.
// C refs: were.c counter_were(), new_were(), you_unwere();
// mondata.c set_mon_data().

import { exerciseAttribute } from './attrib.js';
import { A_WIS, PARANOID_WERECHANGE } from './const.js';
import { tameMonster } from './dog.js';
import { threateningMonsterNearby } from './do.js';
import { game } from './gstate.js';
import { makemonNear, splitHeroMonsterForm } from './mklev.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    heroCanControlPolymorph, heroHasProtectionFromShapeChangers,
    heroIsPolymorphed, heroIsUnchanging, heroMonsterForm, polymonHero,
    rehumanizeHero,
} from './polyself.js';
import { paranoidQuery } from './query.js';
import { rn2, rnd } from './rng.js';
import { vision_recalc } from './vision.js';

const M2_WERE = 0x00000004;
const M2_HUMAN = 0x00000008;
const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];

const COUNTER_WERE = new Map([
    [15, 262], [262, 15], // werejackal <-> human werejackal
    [21, 263], [263, 21], // werewolf <-> human werewolf
    [91, 261], [261, 91], // wererat <-> human wererat
]);
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
const PM_HUMAN_WERERAT = 261;
const PM_HUMAN_WEREJACKAL = 262;
const PM_HUMAN_WEREWOLF = 263;

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
    return (flags & M2_WERE) && !(flags & M2_HUMAN) ? mnum : null;
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
            const restored = rehumanizeHero(state);
            if (restored.regainedSight && state === game) vision_recalc(0);
            if (restored.changed) {
                await publish(`You return to ${restored.race} form!${
                    restored.regainedSight ? '  You can see again.' : ''
                }`);
                if (restored.encumbranceMessage)
                    await publish(restored.encumbranceMessage);
            }
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
    hero.ulycn = -1;

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
        const restored = rehumanizeHero(state);
        if (restored.regainedSight && state === game) vision_recalc(0);
        if (restored.changed) {
            await publish(`You return to ${restored.race} form!${
                restored.regainedSight ? '  You can see again.' : ''
            }`);
            if (restored.encumbranceMessage)
                await publish(restored.encumbranceMessage);
        }
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
    return !!(flags & M2_WERE) && !!(flags & M2_HUMAN);
}

export function transformWereMonster(monster, state = game, {
    repaint = state === game,
} = {}) {
    if (!isWereMonster(monster)) return false;
    if (isHumanWereMonster(monster)
        && heroHasProtectionFromShapeChangers(state)) return false;

    const oldMnum = monster.mnum;
    const newMnum = COUNTER_WERE.get(oldMnum);
    if (!Number.isInteger(newMnum)) return false;

    const oldSpeed = MONSTER_MOVE[oldMnum] ?? monster.mmove ?? 0;
    const newSpeed = MONSTER_MOVE[newMnum] ?? monster.mmove ?? 0;
    if ((monster.movement ?? 0) && newSpeed < oldSpeed && oldSpeed > 0)
        monster.movement = Math.trunc(monster.movement * newSpeed / oldSpeed);

    monster.mnum = newMnum;
    monster.mmove = newSpeed;
    monster.symbol = MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[newMnum] || 0] || '?';
    monster.color = MONSTER_COLOR[newMnum];
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
    return true;
}
