// Anti-magic trap effects on the hero.
// C ref: trap.c trapeffect_anti_magic().

import {
    artifactById, heroHasArtifactDefense, heroHasCarriedArtifactFlag,
} from './artifacts.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { drainHeroEnergy } from './hero_energy.js';
import { OBJECT_MATERIAL, OBJECT_NAMES } from './object_data.js';
import {
    heroFormFlags, heroIsPolymorphed, heroIsUnchanging, rehumanizeHero,
} from './polyself.js';
import { propertyIsActive } from './properties.js';
import { d, rnd } from './rng.js';
import { chargeAlteredUnpaidObject } from './shk.js';

const M1_WALLWALK = 0x00000008;
const IRON = 11;

export async function triggerHeroAntiMagicTrap(trap) {
    const hero = game.u;
    const shoes = ironShoes();
    if (shoes && (shoes.spe ?? 0) > 0) {
        trap.tseen = true;
        await plineWithContinuation(
            `A lethargic aura surrounds your ${objectName(shoes, 'shoes')}.`,
        );
        await chargeAlteredUnpaidObject(shoes, 'disenchant', game);
        shoes.spe--;
        if (Number.isInteger(shoes.enchantment))
            shoes.enchantment = shoes.spe;
        return;
    }

    trap.tseen = true;
    if (hero.antimagic || propertyIsActive('antimagic', game)
        || heroHasArtifactDefense('magic', game)) {
        const damage = implosionDamage();
        const hitPoints = heroIsPolymorphed(game)
            ? hero.mh ?? 1 : hero.uhp ?? 1;
        const feeling = damage >= hitPoints
            ? 'unbearably torpid!'
            : damage >= Math.trunc(hitPoints / 4)
                ? 'very lethargic.' : 'sluggish.';
        await plineWithContinuation(`You feel ${feeling}`);
        if (await damageHero(damage)) return;
    }

    let drain = d(2, 6);
    const halfDrain = rnd(Math.trunc(drain / 2));
    let maximumAlreadyDrained = false;
    if ((hero.uenmax ?? 0) > drain) {
        hero.uenmax -= halfDrain;
        drain -= halfDrain;
        maximumAlreadyDrained = true;
    }
    await plineWithContinuation(drainHeroEnergy(game, drain, {
        maximumAlreadyDrained,
    }));
}

function heroObject(slot) {
    return game[slot] || game.u?.[slot] || null;
}

function ironShoes() {
    const shoes = heroObject('uarmf');
    return shoes && OBJECT_MATERIAL[shoes.otyp] === IRON ? shoes : null;
}

function objectName(object, fallback) {
    return object?.name || OBJECT_NAMES[object?.otyp] || fallback;
}

function heroPassesWalls() {
    return !!game.u?.passesWalls
        || !!(heroFormFlags(game) & M1_WALLWALK);
}

function heroWieldsMagicbane() {
    return artifactById(heroObject('uwep')?.oartifact)?.name === 'Magicbane';
}

function heroCarriesNonQuestMagicDefense() {
    return (game.inventory || []).some(object => {
        const artifact = artifactById(object?.oartifact);
        return artifact && !artifact.questArtifact
            && artifact.carriedDefense === 'magic';
    });
}

function implosionDamage() {
    const hero = game.u;
    let damage = rnd(4);
    if (hero.halfPhysicalDamage || hero.halfSpellDamage
        || heroHasCarriedArtifactFlag('SPFX_HPHDAM', game)
        || heroHasCarriedArtifactFlag('SPFX_HSPDAM', game)) {
        damage += rnd(4);
    }
    if (heroWieldsMagicbane()) damage += rnd(4);
    if (heroCarriesNonQuestMagicDefense()) damage += rnd(4);
    if (heroPassesWalls()) damage = Math.trunc((damage + 3) / 4);
    return damage;
}

async function damageHero(amount) {
    const hero = game.u;
    if (heroIsPolymorphed(game)) {
        hero.mh = (hero.mh ?? 1) - amount;
        if (hero.mh > 0) return false;
        if (!heroIsUnchanging(game)) {
            const restored = rehumanizeHero(game);
            if (restored.changed) {
                await plineWithContinuation(
                    `You return to ${restored.race} form!`,
                );
            }
            return false;
        }
    } else {
        hero.uhp = (hero.uhp ?? 1) - amount;
        if (hero.uhp > 0) return false;
    }

    await finishHeroDeath({ killer: 'anti-magic implosion' });
    return !!game.program_state?.gameover;
}
