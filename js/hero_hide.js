// Hiding with #monster while polymorphed.
// C refs: cmd.c domonability(), polyself.c dohide(), insight.c youhiding().

import {
    M_AP_NOTHING, M_AP_OBJECT, SPIKED_PIT, STONING, TT_PIT,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { levelHasCeiling } from './mon.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterDigests,
} from './monster_data.js';
import { CORPSE } from './object_data.js';
import {
    makePlural, simpleObjectNameWithArticle,
} from './object_grammar.js';
import {
    heroFormClings, heroFormHidesUnderObjects,
    heroFormHidesWithoutCover, heroFormSticks, heroIsFlying,
    heroMonsterForm,
} from './polyself.js';
import { touchPetrifies } from './stoning.js';
import { ceilingName, surfaceName } from './terrain_name.js';

const M1_HUMANOID = 0x00020000;
const S_MIMIC = 13;

function heroHidingAbility(state) {
    const form = heroMonsterForm(state);
    if (form == null) return null;

    const hidesUnder = heroFormHidesUnderObjects(state);
    const hidesWithoutCover = heroFormHidesWithoutCover(state);
    if (!hidesUnder && !hidesWithoutCover) return null;

    const flying = heroIsFlying(state);
    return {
        form,
        hidesUnder,
        mimic: MONSTER_SYMBOL[form] === S_MIMIC,
        flying,
        onCeiling: flying || heroFormClings(state),
    };
}

export function heroHasHidingAbility(state = game) {
    return !!heroHidingAbility(state);
}

function revealHero(ability, state, refresh) {
    state.u.uundetected = 0;
    if (ability.mimic) state.u.m_ap_type = M_AP_NOTHING;
    refresh(state.u.ux, state.u.uy);
}

function heldReason(ability, state) {
    const holder = state.u.ustuck;
    if (!holder) return 'trapped';
    if (state.u.uswallow)
        return monsterDigests(holder) ? 'swallowed' : 'engulfed';
    if (!heroFormSticks(state)) return 'being held';
    return ((MONSTER_FLAGS1[holder.mnum] ?? 0) & M1_HUMANOID)
        ? 'holding someone' : 'holding that creature';
}

function floorObjects(state) {
    return state.level?.objects?.[state.u.ux]?.[state.u.uy] || [];
}

function petrifyingCorpseCover(objects) {
    if (!objects.length || objects.some(object =>
        object.otyp !== CORPSE || !touchPetrifies(object.corpsenm))) {
        return null;
    }

    const count = objects.reduce(
        (total, object) => total + (object.quan ?? object.quantity ?? 1),
        0,
    );
    const species = MONSTER_NAME[objects[0].corpsenm] || 'monster';
    const corpse = `${species} corpse`;
    if (count === 1)
        return `${/^[aeiou]/i.test(corpse) ? 'an' : 'a'} ${corpse}`;
    return `${species} ${makePlural('corpse')}`;
}

function sameLevel(left, right) {
    return !!left && !!right
        && left.dnum === right.dnum && left.dlevel === right.dlevel;
}

function isAirLevel(state) {
    return !!state.level?.flags?.is_airlevel
        || sameLevel(state.u?.uz, state.air_level);
}

function isWaterLevel(state) {
    return !!state.level?.flags?.is_waterlevel
        || sameLevel(state.u?.uz, state.water_level);
}

function hidingDescription(ability, state, objects) {
    if (ability.mimic) return 'mimicking a strange object';
    if (ability.hidesUnder) {
        return `hiding underneath ${simpleObjectNameWithArticle(objects[0])}`;
    }
    if (ability.onCeiling) {
        return `hiding on the ${
            ceilingName(state.u.ux, state.u.uy, state)
        }`;
    }
    if (state.u.utrap && state.u.utraptype === TT_PIT) {
        const trap = state.level?.traps?.find(candidate =>
            candidate.tx === state.u.ux && candidate.ty === state.u.uy);
        return `hiding in a ${trap?.ttyp === SPIKED_PIT ? 'spiked ' : ''}pit`;
    }
    return `hiding on the ${surfaceName(state.u.ux, state.u.uy, state)}`;
}

export async function useHeroHide({
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
    refresh = newsym,
} = {}) {
    const ability = heroHidingAbility(state);
    if (!ability) return { used: false, spentTime: false };

    const trapped = state.u.utrap
        && (state.u.utraptype !== TT_PIT || ability.onCeiling);
    if (state.u.ustuck || trapped) {
        await publish(`You can't hide while you're ${
            heldReason(ability, state)
        }.`);
        if (state.u.uundetected
            || (ability.mimic
                && (state.u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING)) {
            revealHero(ability, state, refresh);
        }
        return { used: true, spentTime: false, reason: 'blocked' };
    }

    const objects = floorObjects(state);
    if (ability.hidesUnder && !objects.length) {
        state.u.uundetected = 0;
        await publish('There is nothing to hide under here.');
        return { used: true, spentTime: false, reason: 'no-cover' };
    }

    const corpseCover = ability.hidesUnder
        && !(state.u.stoneResistance || state.u.stone_resistance)
        ? petrifyingCorpseCover(objects) : null;
    if (corpseCover) {
        await publish(`Hiding under ${corpseCover} is a fatal mistake...`);
        await publish('You turn to stone...');
        const died = await die({
            killer: `hiding under ${corpseCover}`,
            deathVerb: 'turned to stone',
            deathLineShown: true,
            deathType: STONING,
        });
        if (!died) state.u.uundetected = 0;
        return { used: true, spentTime: true, died: !!died };
    }

    if (ability.onCeiling && !levelHasCeiling(state)) {
        state.u.uundetected = 0;
        await publish('There is nowhere to hide above you.');
        return { used: true, spentTime: false, reason: 'no-ceiling' };
    }
    if (!ability.flying && heroFormHidesWithoutCover(state)
        && (isAirLevel(state) || isWaterLevel(state))) {
        state.u.uundetected = 0;
        await publish('There is nowhere to hide beneath you.');
        return { used: true, spentTime: false, reason: 'no-floor' };
    }

    const alreadyHidden = state.u.uundetected
        || (ability.mimic
            && (state.u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING);
    if (alreadyHidden) {
        await publish(`You are already ${
            hidingDescription(ability, state, objects)
        }.`);
        return { used: true, spentTime: false, reason: 'already-hidden' };
    }

    if (ability.mimic) {
        state.u.m_ap_type = M_AP_OBJECT;
        state.u.mappearance = 0; // STRANGE_OBJECT
    } else {
        state.u.uundetected = 1;
    }
    refresh(state.u.ux, state.u.uy);
    await publish(`You are now ${hidingDescription(ability, state, objects)}.`);
    return { used: true, spentTime: true };
}
