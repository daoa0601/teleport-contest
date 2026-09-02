// Anti-magic trap effects.
// C ref: trap.c trapeffect_anti_magic().

import {
    artifactById, heroHasArtifactDefense, heroHasCarriedArtifactFlag,
} from './artifacts.js';
import {
    W_ACCESSORY, W_ARMF, W_ARMOR, W_WEP,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { drainHeroEnergy } from './hero_energy.js';
import {
    CLOAK_OF_MAGIC_RESISTANCE,
    GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES,
    OBJECT_MATERIAL, OBJECT_NAMES,
} from './object_data.js';
import {
    AD_MAGM, AD_RBRE, AT_BREA, AT_MAGC,
} from './monster_attack_types.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME,
    monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import {
    heroFormFlags, heroIsPolymorphed, heroIsUnchanging, rehumanizeHero,
} from './polyself.js';
import { propertyIsActive } from './properties.js';
import { d, rn2, rnd } from './rng.js';
import { chargeAlteredUnpaidObject } from './shk.js';

const M1_WALLWALK = 0x00000008;
const IRON = 11;
const PM_BABY_GRAY_DRAGON = MONSTER_NAME.indexOf('baby gray dragon');
const MAGIC_RESISTANCE_ARMOR = new Set([
    CLOAK_OF_MAGIC_RESISTANCE,
    GRAY_DRAGON_SCALE_MAIL,
    GRAY_DRAGON_SCALES,
]);

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

export function applyMonsterAntiMagicTrap(
    monster,
    { rollDice = d, rollOne = rnd } = {},
) {
    const shoes = monsterWornIronShoes(monster);
    if (shoes && (shoes.spe ?? 0) > 0) {
        shoes.spe--;
        if (Number.isInteger(shoes.enchantment))
            shoes.enchantment = shoes.spe;
        return {
            kind: 'anti-magic-shoes',
            resisted: false,
            absorbedByShoes: true,
            energyDrain: 0,
            damage: 0,
            killed: false,
        };
    }

    if (!monsterHasMagicResistance(monster)) {
        const canUseMagic = !monster.mcan
            && (MONSTER_ATTACKS[monster.mnum] || []).some(([attackType]) =>
                attackType === AT_MAGC || attackType === AT_BREA);
        const energyDrain = canUseMagic ? rollDice(2, 6) : 0;
        if (energyDrain)
            monster.mspec_used = (monster.mspec_used ?? 0) + energyDrain;
        return {
            kind: energyDrain ? 'anti-magic-drain' : 'anti-magic',
            resisted: false, energyDrain, damage: 0, killed: false,
        };
    }

    let damage = rollOne(4);
    const weapon = monsterWeapon(monster);
    if (artifactById(weapon?.oartifact)?.name === 'Magicbane')
        damage += rollOne(4);
    if (monsterInventory(monster).some(object =>
        artifactById(object?.oartifact)?.carriedDefense === 'magic')) {
        damage += rollOne(4);
    }
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK)
        damage = Math.trunc((damage + 3) / 4);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    return {
        kind: 'anti-magic-damage',
        resisted: true,
        energyDrain: 0,
        damage,
        killed: monster.mhp <= 0,
    };
}

export async function finishMonsterAntiMagicTrap(
    monster, event, {
        finishDeath,
        random = rn2,
        publish = plineWithContinuation,
        describeMonster = actor => actor?.name
            || `The ${monsterTypeName(actor?.mnum, !!actor?.female)}`,
    } = {},
) {
    if (event.energyDrain > 0)
        await publish(`${describeMonster(monster)} seems lethargic.`);
    if (!event.killed) return null;

    const verb = monsterIsNonliving(monster.mnum)
        ? 'destroyed' : 'killed';
    const cause = 'compression from an anti-magic field';
    return finishDeath(monster, {
        deathMessage: event.inSight
            ? `${describeMonster(monster)} is ${verb} by the ${cause}!`
            : null,
        visible: event.inSight,
        spotted: event.inSight,
        random,
        publish,
    });
}

function heroObject(slot) {
    return game[slot] || game.u?.[slot] || null;
}

function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}

function monsterWeapon(monster) {
    return monster?.mw
        || monsterInventory(monster).find(object =>
            object?.wielded || ((object?.owornmask ?? 0) & W_WEP));
}

export function monsterHasMagicResistance(monster) {
    if (monster?.mnum === PM_BABY_GRAY_DRAGON
        || (MONSTER_ATTACKS[monster?.mnum] || []).some(([, damageType]) =>
            damageType === AD_MAGM || damageType === AD_RBRE)) {
        return true;
    }

    const weapon = monsterWeapon(monster);
    if (artifactById(weapon?.oartifact)?.defense === 'magic') return true;
    return monsterInventory(monster).some(object => {
        const artifact = artifactById(object?.oartifact);
        if (artifact?.carriedDefense === 'magic') return true;
        return MAGIC_RESISTANCE_ARMOR.has(object?.otyp)
            && !!((object?.owornmask ?? 0)
                & (W_ARMOR | W_ACCESSORY | W_WEP));
    });
}

export function monsterWornIronShoes(monster) {
    return monsterInventory(monster).find(object =>
        OBJECT_MATERIAL[object?.otyp] === IRON
        && !!((object?.owornmask ?? 0) & W_ARMF));
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
