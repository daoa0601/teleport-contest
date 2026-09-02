// Venom created and thrown by a monster's natural spit attack.
// C refs: mthrowu.c spitmm() and m_throw().

import { BOLT_LIM } from './const.js';
import { canProjectMonster } from './display.js';
import { distmin } from './hacklib.js';
import { mksobj } from './mklev.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    AD_ACID, AD_BLND, AD_DRST, AT_SPIT,
} from './monster_attack_types.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import {
    ACID_VENOM, BLINDING_VENOM, OBJECT_DESCRIPTIONS,
} from './object_data.js';
import { rn2, rnd } from './rng.js';
import { syncBlindness } from './senses.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterHasAcidResistance } from './monster_resistance.js';
import {
    acidVenomDamage, monsterCanBeBlindedByVenom,
} from './venom.js';

export function monsterSpitAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(
        ([attackType]) => attackType === AT_SPIT,
    ) || null;
}

export function monsterDryRattleMessage(monster, state) {
    if (!monster || state.deaf || state.u?.deaf) return null;
    if (!canProjectMonster(monster, monster.mx, monster.my))
        return 'You hear a dry rattle nearby.';
    const subject = monsterSentenceSubject(monster);
    const middleOfSentence = subject.startsWith('The ')
        ? `the ${subject.slice(4)}` : subject;
    return `A dry rattle comes from ${middleOfSentence}'s throat.`;
}

function venomTypeFor(damageType) {
    if (damageType === AD_ACID) return ACID_VENOM;
    if (damageType === AD_BLND || damageType === AD_DRST)
        return BLINDING_VENOM;
    return ACID_VENOM;
}

export function beginMonsterSpitAttack(
    monster, targetX, targetY, {
        attack = monsterSpitAttack(monster),
        random = rn2,
    } = {},
) {
    if (!attack) return null;
    if (monster.mcan)
        return { attempted: true, launched: false, dryRattle: true };

    const venomType = venomTypeFor(attack[1]);
    const venom = mksobj(venomType, true, false);
    const distance = distmin(monster.mx, monster.my, targetX, targetY);
    const launchRange = BOLT_LIM - distance;
    const launchRoll = random(launchRange);
    if (launchRoll !== 0) {
        venom.destroyed = true;
        return {
            attempted: true,
            launched: false,
            launchRoll,
            launchRange,
            venom,
            targetX,
            targetY,
            distance,
        };
    }
    return {
        attempted: true,
        launched: true,
        launchRoll,
        launchRange,
        venom,
        appearance: OBJECT_DESCRIPTIONS[venomType] || 'splash of venom',
        targetX,
        targetY,
        distance,
        deferredFlight: true,
    };
}

function destroyVenom(venom, random) {
    // Venom always breaks when its flight ends. delobj() still performs the
    // ordinary object-resistance roll before removing it.
    random(100);
    venom.destroyed = true;
}

function livingMonsterAt(state, source, x, y) {
    return state.level?.monsters?.find(monster =>
        monster !== source && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function hitMonster(monster, spit, random, rollOne) {
    const hitRoll = rollOne(20);
    const hitThreshold = 5 + findMonsterArmorClass(monster);
    const hit = hitThreshold >= hitRoll;
    Object.assign(spit, {
        target: monster, hitRoll, hitThreshold, hit,
    });
    if (!hit) return;

    if (spit.venom.otyp === ACID_VENOM) {
        spit.damage = acidVenomDamage(rollOne);
        if (monsterHasAcidResistance(monster)) {
            spit.damage = 0;
            spit.resisted = true;
        }
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - spit.damage);
    } else if (monsterCanBeBlindedByVenom(monster)) {
        const blindIncrement = rollOne(25) + 20;
        spit.newlyBlinded = !!monster.mcansee;
        monster.mcansee = 0;
        monster.mblinded = Math.min(
            127, (monster.mblinded ?? 0) + blindIncrement,
        );
        spit.blindIncrement = blindIncrement;
    }
    spit.targetDied = (monster.mhp ?? 0) <= 0;
    destroyVenom(spit.venom, random);
}

function hitHero(source, spit, state, random, rollOne) {
    let damage = 0;
    let hitLevel = 8;
    spit.heroWasBlind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
    if (spit.venom.otyp === ACID_VENOM) {
        damage = acidVenomDamage(rollOne);
        const distance = distmin(
            state.u.ux, state.u.uy, source.mx, source.my,
        );
        hitLevel = Math.max(-4, 3 - distance)
            + 8 + (spit.venom.spe ?? 0);
    }

    const hitRoll = rollOne(20);
    const hitThreshold = (state.u?.uac ?? 10) + hitLevel;
    const hit = hitThreshold > hitRoll;
    Object.assign(spit, {
        heroTarget: true,
        hitRoll,
        hitThreshold,
        hit,
        damage: hit ? damage : 0,
    });
    if (!hit) return;

    if (spit.venom.otyp === ACID_VENOM) {
        if (state.u.acidResistance || state.u.acid_resistance) {
            spit.damage = 0;
            spit.resisted = true;
        } else {
            state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
        }
    } else if (!state.u.noEyes) {
        const blindIncrement = rollOne(25);
        state.u.ucreamed = (state.u.ucreamed ?? 0) + blindIncrement;
        state.u.blindTurns = (state.u.blindTurns ?? 0) + blindIncrement;
        syncBlindness(state);
        spit.blindIncrement = blindIncrement;
    }
    destroyVenom(spit.venom, random);
}

function flyMonsterVenom(
    source, spit, state, {
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    if (!spit?.deferredFlight) return spit || null;
    delete spit.deferredFlight;

    const dx = Math.sign(spit.targetX - source.mx);
    const dy = Math.sign(spit.targetY - source.my);
    const flightPath = [];
    let x = source.mx;
    let y = source.my;

    for (let step = 1; step <= spit.distance; step++) {
        x += dx;
        y += dy;
        const remaining = spit.distance - step;
        const target = livingMonsterAt(state, source, x, y);

        if (target) {
            hitMonster(target, spit, random, rollOne);
            if (spit.hit || remaining === 0) {
                if (!spit.venom.destroyed)
                    destroyVenom(spit.venom, random);
                spit.flightPath = flightPath;
                return spit;
            }
        } else if (x === state.u?.ux && y === state.u?.uy) {
            hitHero(source, spit, state, random, rollOne);
            if (spit.hit) {
                spit.flightPath = flightPath;
                return spit;
            }
        }

        // m_throw() probes whether an object survives impact after each
        // non-stopping square, including the hero's square after a miss.
        random(5);
        if (remaining === 0) {
            destroyVenom(spit.venom, random);
            spit.flightPath = flightPath;
            return spit;
        }
        flightPath.push({ x, y });
    }
    spit.flightPath = flightPath;
    return spit;
}

export function resolveMonsterSpitFlight(
    source, spit, state, options = {},
) {
    if (!spit?.deferredFlight) return spit || null;
    const result = flyMonsterVenom(source, spit, state, options);
    if (source.mtame && !source.isminion
        && (source.edog?.hungrytime ?? 0) > 1) {
        source.edog.hungrytime -= 5;
    }
    return result;
}
