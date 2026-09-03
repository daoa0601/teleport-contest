// Artifact powers used by the #invoke command.
// C ref: artifact.c arti_invoke() and its invoke_* helpers.

import { Upolyd } from './const.js';
import { newsym, pline } from './display.js';
import { game } from './gstate.js';
import {
    hasNonArtifactConflict, syncHeroConflict,
} from './hero_conflict.js';
import {
    hasNonArtifactInvisibility, invisibilityIsBlocked,
    syncHeroInvisibility,
} from './hero_invisibility.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { doEnlightenmentEffect } from './insight.js';
import { mksobj } from './mklev.js';
import { ARROW } from './object_data.js';
import {
    hasInvokedProperty, setInvokedProperty,
} from './properties.js';
import { d, rnd, rnz } from './rng.js';
import { heroIsBlind, setHeroBlindnessTurns } from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { addInventoryItem } from './u_init.js';
import { untrap } from './untrap.js';
import { objectWeight } from './weight.js';

const SUPPORTED_POWERS = new Set([
    'healing', 'energy-boost', 'enlightening', 'create-ammo',
    'invisibility', 'conflict', 'untrap',
]);

const PROPERTY_POWERS = Object.freeze({
    conflict: {
        property: 'conflict',
        hasOtherSource: hasNonArtifactConflict,
        sync: syncHeroConflict,
    },
    invisibility: {
        property: 'invisible',
        hasOtherSource: hasNonArtifactInvisibility,
        sync: syncHeroInvisibility,
    },
});

export function artifactInvokeIsActive(artifact, state = game) {
    const power = PROPERTY_POWERS[artifact?.invokePower];
    return !!power && hasInvokedProperty(power.property, state);
}

async function nothingSpecial(object, state, publish) {
    if ((state.inventory || []).includes(object)) {
        await publish(
            'You feel a surge of power, but nothing seems to happen.',
        );
    }
}

async function beginInvocation(
    object, artifact, state, publish, rollDice, scaledRandom,
) {
    const turn = state.moves ?? 0;
    if ((object.age ?? 0) > turn) {
        await publish(`You feel that ${artifact.name} is ignoring you.`);
        object.age += rollDice(3, 10);
        return false;
    }
    object.age = turn + scaledRandom(100);
    return true;
}

async function invokeProperty(
    object, artifact, state, publish, rollDice, scaledRandom,
) {
    const power = PROPERTY_POWERS[artifact.invokePower];
    const turn = state.moves ?? 0;
    const on = !hasInvokedProperty(power.property, state);
    setInvokedProperty(power.property, object, on, state);

    if (on && (object.age ?? 0) > turn) {
        setInvokedProperty(power.property, object, false, state);
        power.sync(state);
        await publish(`You feel that ${artifact.name} is ignoring you.`);
        object.age += rollDice(3, 10);
        return { used: true, ready: false, on: false };
    }
    if (!on) object.age = turn + scaledRandom(100);

    const hasOtherSource = power.hasOtherSource(state);
    power.sync(state);
    if (hasOtherSource) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }

    if (artifact.invokePower === 'conflict') {
        await publish(on
            ? 'You feel like a rabble-rouser.'
            : 'You feel the tension decrease around you.');
        return { used: true, ready: true, on };
    }

    if (invisibilityIsBlocked(state) || heroIsBlind(state)) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }
    newsym(state.u.ux, state.u.uy);
    if (on) {
        const transparency = state.u?.hallucinating
            || (state.u?.hallucinationTurns ?? 0) > 0
            ? 'normal' : 'strange';
        await publish(`Your body takes on a ${transparency} transparency...`);
    } else {
        await publish('Your body seems to unfade...');
    }
    return { used: true, ready: true, on };
}

async function invokeHealing(object, state, publish) {
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const hitPoints = polymorphed ? 'mh' : 'uhp';
    const maximumHitPoints = polymorphed ? 'mhmax' : 'uhpmax';
    const current = hero[hitPoints] ?? 0;
    const maximum = hero[maximumHitPoints] ?? current;
    const healing = Math.trunc((maximum + 1 - current) / 2);
    const cream = hero.ucreamed ?? 0;
    const curesBlindness = (hero.blindTurns ?? 0) > cream;
    const helps = healing > 0 || heroIsSick(state)
        || heroIsSliming(state) || curesBlindness;

    if (!helps) {
        await nothingSpecial(object, state, publish);
        return;
    }
    await publish('You feel better.');
    if (healing > 0) hero[hitPoints] = current + healing;
    cureHeroSickness(state);
    clearHeroSliming(state);
    if (curesBlindness) setHeroBlindnessTurns(cream, state);
}

async function invokeEnergyBoost(object, state, publish) {
    const hero = state.u;
    const missing = Math.max(0, (hero.uenmax ?? 0) - (hero.uen ?? 0));
    let restored = Math.trunc((missing + 1) / 2);
    if (restored > 120) restored = 120;
    else if (restored < 12) restored = missing;

    if (!restored) {
        await nothingSpecial(object, state, publish);
        return;
    }
    hero.uen = (hero.uen ?? 0) + restored;
    await publish('You feel re-energized.');
}

function invokeCreateAmmo(object, rollOne) {
    const arrows = mksobj(ARROW, true, false);
    arrows.blessed = !!object.blessed;
    arrows.cursed = !!object.cursed;
    arrows.bknown = !!object.bknown;
    arrows.oeroded = 0;
    arrows.oeroded2 = 0;
    if (object.blessed) {
        if (arrows.spe < 0) arrows.spe = 0;
        arrows.quan += rollOne(10);
    } else if (object.cursed) {
        if (arrows.spe > 0) arrows.spe = 0;
    } else {
        arrows.quan += rollOne(5);
    }
    arrows.quantity = arrows.quan;
    arrows.owt = objectWeight(arrows);
    return addInventoryItem(arrows);
}

export async function invokeArtifactPower(
    object, artifact, {
        state = game,
        publish = pline,
        rollDice = d,
        rollOne = rnd,
        scaledRandom = rnz,
        enterTrap = null,
    } = {},
) {
    const power = artifact?.invokePower;
    if (!SUPPORTED_POWERS.has(power)) return { used: false };
    if (PROPERTY_POWERS[power]) {
        return invokeProperty(
            object, artifact, state, publish, rollDice, scaledRandom,
        );
    }
    const ready = await beginInvocation(
        object, artifact, state, publish, rollDice, scaledRandom,
    );
    if (!ready) return { used: true, ready: false };

    switch (power) {
    case 'healing':
        await invokeHealing(object, state, publish);
        break;
    case 'energy-boost':
        await invokeEnergyBoost(object, state, publish);
        break;
    case 'enlightening':
        await doEnlightenmentEffect();
        break;
    case 'create-ammo':
        invokeCreateAmmo(object, rollOne);
        break;
    case 'untrap': {
        const spentTime = await untrap({
            state, force: true, enterTrap, publish,
        });
        if (!spentTime) object.age = 0;
        return { used: true, ready: true, spentTime };
    }
    }
    return { used: true, ready: true };
}

export async function deactivateArtifactProperty(
    object, artifact, {
        state = game,
        publish = pline,
        rollDice = d,
        scaledRandom = rnz,
    } = {},
) {
    const power = PROPERTY_POWERS[artifact?.invokePower];
    if (!artifactInvokeIsActive(artifact, state)) return false;
    await invokeProperty(
        object, artifact, state, publish, rollDice, scaledRandom,
    );
    return true;
}
