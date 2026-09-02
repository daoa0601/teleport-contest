// Rules applied before the pickup menu or object transfer.
// C ref: hack.c pickup_checks().

import { heroHasWaterWalking } from './armor.js';
import {
    ALTAR, D_ISOPEN, DOOR, FOUNTAIN, GRAVE, HOLE, IS_LAVA, IS_POOL,
    SINK, STAIRS, THRONE, TRAPDOOR, is_pit,
} from './const.js';
import { floorReachProblem } from './floor_reach.js';
import { game } from './gstate.js';
import {
    MONSTER_NAME, MONSTER_SYMBOL, monsterDigests,
} from './monster_data.js';
import {
    heroFormClings, heroFormFlags, heroIsFlying, heroMonsterForm,
} from './polyself.js';
import { heroIsBlind } from './senses.js';
import { surfaceName } from './terrain_name.js';

const M1_BREATHLESS = 0x00000400;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;

function monsterName(monster) {
    return monster?.name || `the ${MONSTER_NAME[monster?.mnum] || 'monster'}`;
}

function possessive(name) {
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function heroStaysAboveLiquid(state) {
    const hero = state.u || {};
    const form = heroMonsterForm(state);
    const flags = heroFormFlags(state);
    const symbol = form == null ? null : MONSTER_SYMBOL[form];
    const floater = symbol === S_EYE || symbol === S_LIGHT;
    const flying = heroIsFlying(state);
    const breathless = hero.breathless || !!(flags & M1_BREATHLESS);
    return heroHasWaterWalking(state) || floater || heroFormClings(state)
        || (flying && !breathless);
}

function heroLikesLava(state) {
    const form = heroMonsterForm(state);
    return !!(state.u?.likesLava || state.u?.likes_lava)
        || form === PM_FIRE_ELEMENTAL || form === PM_SALAMANDER;
}

function emptyFloorMessage(location) {
    if (location?.typ === THRONE)
        return `It must weigh${location.looted ? ' almost' : ''} a ton!`;
    if (location?.typ === SINK)
        return 'The plumbing connects it to the floor.';
    if (location?.typ === GRAVE)
        return "You don't need a gravestone.  Yet.";
    if (location?.typ === FOUNTAIN)
        return 'You could drink the water...';
    if (location?.typ === DOOR && location.doormask === D_ISOPEN)
        return "It won't come off the hinges.";
    if (location?.typ === ALTAR)
        return 'Moving the altar would be a very bad idea.';
    if (location?.typ === STAIRS)
        return 'The stairs are solidly affixed.';
    return 'There is nothing here to pick up.';
}

function trapAtHero(state) {
    return state.level?.traps?.find(trap =>
        trap.tx === state.u?.ux && trap.ty === state.u?.uy) || null;
}

function reachMessage(state, problem, trap) {
    if (problem === 'pit-edge')
        return 'You cannot reach the bottom of the pit.';
    if (problem === 'riding') {
        return `You aren't skilled enough to reach from your ${
            MONSTER_NAME[state.u?.usteed?.mnum] || 'steed'
        }.`;
    }
    if (heroIsBlind(state)) return 'You cannot reach anything here.';
    const surface = trap?.ttyp === HOLE ? 'edge of the hole'
        : trap?.ttyp === TRAPDOOR ? 'trap door'
            : surfaceName(state.u?.ux, state.u?.uy, state);
    return `You cannot reach the ${surface}.`;
}

export function pickupLocationProblem({
    state = game,
    objects,
    monster = null,
}) {
    if (monster) {
        if (objects.length) return null;
        if (monsterDigests(monster)) {
            return {
                messages: [
                    `You pick up ${possessive(monsterName(monster))} tongue.`,
                    "But it's kind of slimy, so you drop it.",
                ],
                spendsTurn: true,
            };
        }
        const sense = heroIsBlind(state) ? 'feel' : 'see';
        return {
            messages: [`You don't ${sense} anything in here to pick up.`],
            spendsTurn: true,
        };
    }

    const location = state.level?.at?.(state.u?.ux, state.u?.uy);
    if (IS_POOL(location?.typ)) {
        if (heroStaysAboveLiquid(state)) {
            return {
                messages: ['You cannot dive into the water to pick things up.'],
                spendsTurn: false,
            };
        }
        if (!(state.underwater || state.u?.uinwater)) {
            return {
                messages: [
                    "You can't even see the bottom, let alone pick up anything.",
                ],
                spendsTurn: false,
            };
        }
    }
    if (IS_LAVA(location?.typ)) {
        if (heroStaysAboveLiquid(state)) {
            return {
                messages: ["You can't reach the bottom to pick things up."],
                spendsTurn: false,
            };
        }
        if (!heroLikesLava(state)) {
            return {
                messages: [
                    'You would burn to a crisp trying to pick things up.',
                ],
                spendsTurn: false,
            };
        }
    }

    if (!objects.length) {
        return {
            messages: [emptyFloorMessage(location)],
            spendsTurn: false,
        };
    }

    const trap = trapAtHero(state);
    const reachProblem = floorReachProblem(state, {
        checkPit: is_pit(trap?.ttyp),
    });
    return reachProblem ? {
        messages: [reachMessage(state, reachProblem, trap)],
        spendsTurn: false,
    } : null;
}
