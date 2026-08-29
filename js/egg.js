// egg.js — Source-owned egg hatch timers for the visible floor carrier.
// C refs: timeout.c attach_egg_hatch_timeout()/hatch_egg().

import {
    G_EXTINCT, G_GENOD, MM_NOMSG, MV_KNOWS_EGG, NO_MINVENT,
} from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { makemonNear, remove_object } from './mklev.js';
import {
    MONSTER_FLAGS1, MONSTER_GENO, MONSTER_MOVE, MONSTER_SYMBOL,
    monsterTypeName, monsterYoungerForm,
} from './monster_data.js';
import { EGG } from './object_data.js';
import { makePlural } from './object_grammar.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from './object_timers.js';
import { rnd } from './rng.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

const G_UNIQ = 0x1000;
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const S_DRAGON = 21;

function indefiniteArticle(noun) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function floorHatchMessage(mnum, count) {
    const name = monsterTypeName(mnum);
    return count > 1
        ? `You see some ${makePlural(name)} hatch.`
        : `You see ${indefiniteArticle(name)} ${name} hatch.`;
}

function inventoryHatchMessage(mnum, count, blind) {
    if (blind) return 'You feel something drop from your pack!';
    const name = monsterTypeName(mnum);
    const newborn = count > 1
        ? `some ${makePlural(name)}`
        : `${indefiniteArticle(name)} ${name}`;
    return `You see ${newborn} drop out of your pack!`;
}

function ordinaryPackLocomotion(mnum) {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    return !(flags & (M1_FLY | M1_AMORPHOUS | M1_SLITHY))
        && (flags & M1_NOLIMBS) !== M1_NOLIMBS
        && (MONSTER_MOVE[mnum] ?? 0) > 0;
}

// run_timers() claims the timer before this callback.  Quantity reduction and
// monster creation precede hatch prose in C; learning, remainder scheduling,
// deletion, and repaint follow it, so finishEggHatchTimer() owns that second
// half after tty has accepted any message.
export async function runClaimedEggHatchTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.HATCH_EGG)
        return null;
    const egg = claimed.object;
    if (!egg || egg.otyp !== EGG) return null;
    if ((egg.corpsenm ?? -1) < 0) {
        return { egg, sterile: true, hatched: 0, finishPending: false };
    }

    const onFloor = egg.where === 'floor';
    const inInventory = egg.where === 'inventory';
    if (!onFloor && !inInventory) {
        throw new Error(
            'HATCH_EGG owner excludes monster-carried and non-live carriers',
        );
    }
    const silent = claimed.timer.deadline !== currentTurn;
    if (onFloor && (egg.spe ?? 0) !== 0)
        throw new Error('HATCH_EGG floor owner excludes owned-egg taming');
    if (inInventory) {
        if ((egg.spe ?? 0) !== 0 || state.flags?.female !== true) {
            throw new Error(
                'HATCH_EGG inventory owner excludes owned or male-parentage taming',
            );
        }
        if (silent)
            throw new Error('HATCH_EGG inventory owner excludes overdue carrier state');
    }

    const x = onFloor ? egg.ox : state.u?.ux;
    const y = onFloor ? egg.oy : state.u?.uy;
    const quantity = egg.quan ?? egg.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1)
        throw new Error('HATCH_EGG requires a positive egg quantity');
    const mnum = monsterYoungerForm(egg.corpsenm);
    if (inInventory && (MONSTER_SYMBOL[mnum] === S_DRAGON
        || !ordinaryPackLocomotion(mnum))) {
        throw new Error(
            'HATCH_EGG inventory owner excludes dragon taming and special locomotion',
        );
    }
    const visible = !silent && cansee(x, y);
    const desired = rnd(quantity);
    const unavailable = !!((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)
        || !!((state.mvitals?.[mnum]?.mvflags ?? 0)
            & (G_GENOD | G_EXTINCT));
    if (unavailable) {
        return {
            egg, x, y, mnum, sterile: false, unavailable: true,
            desired, hatched: 0, finishPending: false,
        };
    }

    let lastMonster = null;
    let hatched = 0;
    for (let index = 0; index < desired; index++) {
        const monster = await makemonNear(
            mnum, x, y, NO_MINVENT | MM_NOMSG, false,
        );
        if (!monster) break;
        lastMonster = monster;
        hatched++;
        if ((state.mvitals?.[mnum]?.mvflags ?? 0) & G_EXTINCT) break;
    }
    if (!lastMonster) {
        return {
            egg, x, y, mnum, sterile: false, desired, hatched: 0,
            finishPending: false,
        };
    }

    egg.quan = quantity - hatched;
    egg.quantity = egg.quan;
    return {
        egg, x, y, mnum, monster: lastMonster,
        desired, hatched,
        message: onFloor
            ? (visible ? floorHatchMessage(mnum, hatched) : null)
            : inventoryHatchMessage(
                mnum, hatched,
                !!state.blind || (state.u?.blindTurns ?? 0) > 0,
            ),
        learnPending: visible,
        redraw: onFloor && visible,
        finishPending: true,
    };
}

export function finishEggHatchTimer(
    event, state = game, currentTurn = state.moves ?? 0,
) {
    if (!event?.finishPending || !event.egg) return event;
    const egg = event.egg;
    if (event.learnPending) {
        if (!Array.isArray(state.mvitals)) state.mvitals = [];
        const adult = egg.corpsenm;
        const vital = state.mvitals[adult]
            || (state.mvitals[adult] = { mvflags: 0 });
        vital.mvflags = (vital.mvflags ?? 0) | MV_KNOWS_EGG;
    }

    if ((egg.quan ?? 0) > 0) {
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            currentTurn + rnd(12), state,
        );
        egg.owt = objectWeight(egg);
    } else {
        if (egg.where === 'floor') remove_object(egg);
        else {
            const index = (state.inventory || []).indexOf(egg);
            if (index >= 0) state.inventory.splice(index, 1);
        }
        egg.where = 'gone';
        egg.ox = egg.oy = 0;
    }
    if (event.redraw) newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}
