// Breath weapons used by a polymorphed hero against their own square.
// C refs: polyself.c dobreathe() and zap.c ubreatheu()/zhitu().

import { disintegrateWornArmor } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_CON, A_DEX, A_STR, Upolyd,
} from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { erodeArmor, damageObjectWithAcid } from './object_erosion.js';
import { putHeroToSleep } from './hero_sleep.js';
import { igniteItems } from './light.js';
import {
    MONSTER_ATTACKS,
} from './monster_data.js';
import {
    AD_ACID, AD_COLD, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE, AD_MAGM,
    AD_RBRE, AD_SLEE, AT_BREA,
} from './monster_attack_types.js';
import { hasWornProperty } from './properties.js';
import { heroMonsterForm, returnHeroToHumanForm } from './polyself.js';
import { poisonHero } from './poison.js';
import { d, rn2, rnd } from './rng.js';
import { clearHeroSliming } from './slime.js';
import { burnHeroArmorByFire } from './trap.js';
import {
    destroyColdInventory, destroyElectricInventory, destroyFireInventory,
} from './zap.js';

export function heroBreathAttack(state = game, damageType = null) {
    const form = heroMonsterForm(state);
    if (form == null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType, attackDamage]) => attackType === AT_BREA
            && (damageType == null || attackDamage === damageType),
    ) || null;
}

export function heroAcidBreathAttack(state = game) {
    return heroBreathAttack(state, AD_ACID);
}

export async function hitHeroWithBreath({
    state = game,
    attack = heroBreathAttack(state),
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    rollOne = rnd,
    die = finishHeroDeath,
} = {}) {
    if (!attack) return { hit: false, damage: 0, heroDied: false };

    const damageType = effectiveBreathDamage(attack[1]);
    const context = {
        state, attack, damageType, publish, random, rollDice, rollOne, die,
    };
    let result;
    if (damageType === AD_MAGM) result = await hitWithMagic(context);
    else if (damageType === AD_FIRE) result = await hitWithFire(context);
    else if (damageType === AD_COLD) result = await hitWithCold(context);
    else if (damageType === AD_SLEE) result = await hitWithSleep(context);
    else if (damageType === AD_DISN)
        result = await hitWithDisintegration(context);
    else if (damageType === AD_ELEC)
        result = await hitWithLightning(context);
    else if (damageType === AD_DRST) result = await hitWithPoison(context);
    else result = await hitWithAcid(context);
    return { hit: true, damageType, ...result };
}

async function hitWithMagic(context) {
    const { state, attack, publish, rollDice } = context;
    if (state.u.antimagic) {
        await shieldHero(state);
        await publish('The missiles bounce off!');
        return { resisted: true, damage: 0, heroDied: false };
    }
    exerciseAttribute(A_STR, false, state);
    return applyOrdinaryBreathDamage(
        context, rollDice(attack[2], 6), 'blast of missiles',
    );
}

async function hitWithFire(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = !!state.u.fireResistance;
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel hot!");
    }
    if (clearHeroSliming(state))
        await publish('The slime that covers you is burned away!');

    const bodyHit = await burnHeroArmorByFire(
        state, publish, [], random,
    );
    if (bodyHit && random(3) === 0) {
        await destroyFireInventory(sourceDamage, {
            state, publish, random, rollOne,
        });
    }
    if (bodyHit && random(3) === 0) {
        await igniteItems(state.inventory, {
            state, publish, random,
        });
    }
    return applyOrdinaryBreathDamage(
        context, resisted ? 0 : sourceDamage, 'blast of fire', resisted,
    );
}

async function hitWithCold(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = !!state.u.coldResistance;
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel cold.");
    }
    if (random(3) === 0) {
        await destroyColdInventory(sourceDamage, {
            state, publish, random, rollOne,
        });
    }
    return applyOrdinaryBreathDamage(
        context, resisted ? 0 : sourceDamage, 'blast of frost', resisted,
    );
}

async function hitWithSleep(context) {
    const { state, attack, publish, rollDice } = context;
    const resisted = !!state.u.sleepResistance;
    if (resisted) {
        await shieldHero(state);
        await publish("You don't feel sleepy.");
    } else {
        putHeroToSleep(rollDice(attack[2], 25), { state });
    }
    return { resisted, damage: 0, heroDied: false };
}

async function hitWithDisintegration(context) {
    const { state, publish, random, die } = context;
    if (state.u.disintegrationResistance) {
        await publish('You are not disintegrated.');
        return { resisted: true, damage: 0, heroDied: false };
    }
    if (hasWornProperty('disintegrationResistance', state)
        && random(100) < 99) {
        return { resisted: true, damage: 0, heroDied: false };
    }

    const shield = wornObject(state, 'uarms');
    if (shield) {
        await disintegrateWornArmor(shield, { state, publish });
        return { resisted: false, damage: 0, heroDied: false };
    }
    const suit = wornObject(state, 'uarm');
    if (suit) {
        const cloak = wornObject(state, 'uarmc');
        if (cloak) {
            await disintegrateWornArmor(cloak, { state, publish });
        }
        await disintegrateWornArmor(suit, { state, publish });
        return { resisted: false, damage: 0, heroDied: false };
    }

    const cloak = wornObject(state, 'uarmc');
    if (cloak) {
        await disintegrateWornArmor(cloak, { state, publish });
    }
    const shirt = wornObject(state, 'uarmu');
    if (shirt) {
        await disintegrateWornArmor(shirt, { state, publish });
    }
    const reflexive = state.flags?.female ? 'herself' : 'himself';
    const heroDied = await die({
        killer: `blast of disintegration exhaled by ${reflexive}`,
    });
    return { resisted: false, damage: 0, heroDied };
}

async function hitWithLightning(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const sourceDamage = rollDice(attack[2], 6);
    const resisted = !!state.u.shockResistance;
    if (resisted) {
        await shieldHero(state);
        await publish("You aren't affected.");
    } else {
        exerciseAttribute(A_CON, false, state);
    }
    if (random(3) === 0) {
        await destroyElectricInventory(sourceDamage, {
            state, publish, random, rollOne,
        });
    }
    return applyOrdinaryBreathDamage(
        context, resisted ? 0 : sourceDamage, 'blast of lightning', resisted,
    );
}

async function hitWithPoison(context) {
    const { state, random, rollDice, publish, die } = context;
    const poison = await poisonHero({
        reason: 'blast',
        killer: 'poisoned blast',
        attribute: A_DEX,
        fatal: 15,
        state,
        random,
        rollDice,
        publish,
        die,
    });
    return {
        resisted: !!poison.resisted,
        damage: poison.damage ?? 0,
        heroDied: poison.died,
    };
}

async function hitWithAcid(context) {
    const { state, attack, publish, random, rollDice } = context;
    const resisted = !!state.u.acidResistance;
    let damage = 0;
    if (resisted) {
        await publish("The acid doesn't hurt.");
    } else {
        await publish('The acid burns!');
        damage = rollDice(attack[2], 6);
        exerciseAttribute(A_STR, false, state);
    }

    const hero = state.u;
    const twoWeapons = !!hero.twoweap;
    if (random(twoWeapons ? 3 : 6) === 0) {
        await damageObjectWithAcid(
            state.uwep || hero.uwep,
            { state, publish, random },
        );
    }
    if (twoWeapons && random(3) === 0) {
        await damageObjectWithAcid(
            state.uswapwep || hero.uswapwep,
            { state, publish, random },
        );
    }
    if (random(6) === 0)
        await erodeArmor(state.u, 'corrosion', { state, publish, random });

    return applyOrdinaryBreathDamage(
        context, damage, 'blast of acid', resisted,
    );
}

async function applyOrdinaryBreathDamage(
    context, damage, killer, resisted = false,
) {
    const { state, publish, die } = context;
    if (damage <= 0)
        return { resisted, damage: 0, heroDied: false };

    const hero = state.u;
    if (Upolyd(hero)) {
        hero.mh = Math.max(0, (hero.mh ?? 1) - damage);
        if (hero.mh > 0)
            return { resisted, damage, heroDied: false };
        if (!(hero.unchanging || state.unchanging)) {
            const restored = await returnHeroToHumanForm(state, { publish, die });
            return { resisted, damage, heroDied: restored.died };
        }
    } else {
        hero.uhp = Math.max(0, (hero.uhp ?? 1) - damage);
        if (hero.uhp > 0)
            return { resisted, damage, heroDied: false };
    }

    const reflexive = state.flags?.female ? 'herself' : 'himself';
    const heroDied = await die({ killer: `${killer} exhaled by ${reflexive}` });
    return { resisted, damage, heroDied };
}

export function effectiveBreathDamage(damageType) {
    // BZ_OFS_AD(AD_RBRE) maps the Chromatic Dragon's hero breath to fire.
    return damageType === AD_RBRE ? AD_FIRE : damageType;
}

function wornObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}

function shieldHero(state) {
    return shieldeff(state.u.ux, state.u.uy, state);
}
