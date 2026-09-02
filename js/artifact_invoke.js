// Artifact powers used by the #invoke command.
// C ref: artifact.c arti_invoke(), invoke_healing(), and invoke_energy_boost().

import { Upolyd } from './const.js';
import { pline } from './display.js';
import { game } from './gstate.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { doEnlightenmentEffect } from './insight.js';
import { mksobj } from './mklev.js';
import { ARROW } from './object_data.js';
import { d, rnd, rnz } from './rng.js';
import { setHeroBlindnessTurns } from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { addInventoryItem } from './u_init.js';
import { objectWeight } from './weight.js';

const SUPPORTED_POWERS = new Set([
    'healing', 'energy-boost', 'enlightening', 'create-ammo',
]);

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
    } = {},
) {
    const power = artifact?.invokePower;
    if (!SUPPORTED_POWERS.has(power)) return { used: false };
    const ready = await beginInvocation(
        object, artifact, state, publish, rollDice, scaledRandom,
    );
    if (!ready) return { used: true, ready: false };

    if (power === 'healing') {
        await invokeHealing(object, state, publish);
    } else if (power === 'energy-boost') {
        await invokeEnergyBoost(object, state, publish);
    } else if (power === 'enlightening') {
        await doEnlightenmentEffect();
    } else {
        invokeCreateAmmo(object, rollOne);
    }
    return { used: true, ready: true };
}
