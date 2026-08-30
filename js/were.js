// were.js — Shared deterministic were-creature form transition.
// C refs: were.c counter_were(), new_were(); mondata.c set_mon_data().

import { threateningMonsterNearby } from './do.js';
import { game } from './gstate.js';
import { splitHeroMonsterForm } from './mklev.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AMULET_OF_UNCHANGING, RIN_POLYMORPH_CONTROL,
    RIN_PROTECTION_FROM_SHAPE_CHANGERS,
} from './object_data.js';
import { PARANOID_WERECHANGE } from './const.js';
import {
    heroIsPolymorphed, polymonHero, rehumanizeHero,
} from './polyself.js';
import { paranoidQuery } from './query.js';
import { rn2 } from './rng.js';
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

function wornPropertyObject(state, otyp, slots) {
    return slots.some(slot => {
        const object = state[slot] || state.u?.[slot];
        return object?.otyp === otyp && object.worn !== false;
    });
}

export function heroHasPolymorphControl(state = game) {
    return !!(state.u?.polymorphControl || state.polymorphControl)
        || wornPropertyObject(
            state, RIN_POLYMORPH_CONTROL, ['uleft', 'uright'],
        );
}

export function heroIsUnchanging(state = game) {
    return !!(state.u?.unchanging || state.unchanging)
        || wornPropertyObject(state, AMULET_OF_UNCHANGING, ['uamul']);
}

function heroIsUnaware(state) {
    return !!(state.u?.unaware || state.unaware
        || state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'sleeping off a magical draught');
}

function heroIsStunned(state) {
    return !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0);
}

function lycanthropeBeastMnum(state) {
    const mnum = state.u?.ulycn;
    if (!Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        return null;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    return (flags & M2_WERE) && !(flags & M2_HUMAN) ? mnum : null;
}

function controllableWereChange(state) {
    return heroHasPolymorphControl(state)
        && !heroIsStunned(state) && !heroIsUnaware(state);
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
        const controllable = controllableWereChange(state);
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
        if (controllableWereChange(state)) {
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

export function heroHasProtectionFromShapeChangers(state = game) {
    if (state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers) return true;
    return [state.uleft, state.uright, state.u?.uleft, state.u?.uright]
        .some(object => object?.otyp === RIN_PROTECTION_FROM_SHAPE_CHANGERS
            && object.worn !== false);
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
