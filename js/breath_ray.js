// Breath rays fired by the hero or a monster.
// C refs: polyself.c dobreathe(), mthrowu.c breamm(), and zap.c dobuzz().

import {
    G_NOCORPSE, STRAT_WAITMASK,
    W_ARM, W_ARMC, W_ARMU, W_ARMS,
} from './const.js';
import { artifactById } from './artifacts.js';
import {
    canProjectMonster, plineWithContinuation, shieldeff,
} from './display.js';
import { game } from './gstate.js';
import { heroHasEyes } from './polyself.js';
import {
    effectiveBreathDamage, hitHeroWithBreath,
} from './hero_breath.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import {
    damageMonsterObjectWithAcid, corrodeRandomMonsterArmor,
} from './monster_erosion.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_NAME,
} from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import {
    AD_ACID, AD_BLND, AD_COLD, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE,
    AD_MAGM, AD_RBRE, AD_SLEE, AT_EXPL, AT_GAZE,
} from './monster_attack_types.js';
import {
    BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, OBJECT_NAMES,
} from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { createPoisonGasCloud } from './regions.js';
import { d, rn2, rnd } from './rng.js';
import { syncBlindness } from './senses.js';
import {
    CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_ORANGE, CLR_WHITE,
    NO_COLOR,
} from './terminal.js';
import {
    discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay,
    monsterReflectsRay, rayHitsHero, rayHitsMonster, rayMonsterAt, runRay,
} from './ray.js';
import {
    applyRayFloorFeatures, coldRayDamageMonster,
    destroyMonsterInventoryByElement, fireRayDamageMonster,
    monsterHasElementalResistance, monsterResistsRayDamage,
    sleepMonsterFromRay,
    INVENTORY_DAMAGE,
} from './zap.js';

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_SLEEP = 0x04;
const MR_DISINT = 0x08;
const MR_ELEC = 0x10;
const MR_POISON = 0x20;
const MR_ACID = 0x40;
const M1_NOEYES = 0x00001000;

const DIRECTIONS = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
    '<': [0, 0], '>': [0, 0],
});

export async function breatheInDirection(
    direction,
    {
        state = game,
        attack,
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
        finishMonsterKill = finishHeroMonsterKill,
        sourceMonster = null,
        originX = state.u.ux,
        originY = state.u.uy,
    } = {},
) {
    const delta = DIRECTIONS[direction];
    if (!delta || !attack)
        return { used: false, heroDied: false, hits: 0 };

    const [dx, dy] = delta;
    const damageType = effectiveBreathDamage(attack[1]);
    const context = {
        state,
        attack,
        damageType,
        name: breathRayName(damageType),
        publish,
        random,
        rollDice,
        rollOne,
        finishMonsterKill,
        sourceMonster,
        hits: 0,
    };
    if (!sourceMonster && state.u.uswallow && state.u.ustuck)
        return breatheWhileSwallowed(context);

    const stopped = await runRay({
        state,
        direction,
        range: dx || dy ? 7 + random(7) : 1,
        color: breathColor(damageType),
        originX,
        originY,
        random,
        canSee: (x, y) => cellIsVisible(state, x, y),
        onCell: cell => hitBreathCell(cell, context),
        onBounce: () => publish(`${capitalize(context.name)} bounces!`),
        onVanish: () => publish(
            `${capitalize(context.name)} vanishes into the aether!`,
        ),
    });
    return stopped || {
        used: true,
        heroDied: false,
        hits: context.hits,
    };
}

export function breatheFromMonster(
    sourceMonster, target, options = {},
) {
    const dx = Math.sign(target.mx - sourceMonster.mx);
    const dy = Math.sign(target.my - sourceMonster.my);
    const direction = Object.entries(DIRECTIONS).find(
        ([, delta]) => delta[0] === dx && delta[1] === dy,
    )?.[0];
    if (!direction)
        return { used: false, heroDied: false, hits: 0 };
    return breatheInDirection(direction, {
        ...options,
        sourceMonster,
        originX: sourceMonster.mx,
        originY: sourceMonster.my,
    });
}

async function hitBreathCell(
    { x, y, remainingRange }, context,
) {
    const {
        state, attack, damageType, name, publish, random, rollDice, rollOne,
        finishMonsterKill,
    } = context;
    let floor = { absorbed: false, rangeChange: 0 };
    let reflected = false;
    let leavesPoisonCloud = damageType === AD_DRST;
    let rangeChange = 0;

    if (damageType !== AD_DRST) {
        floor = await applyRayFloorFeatures(
            floorKind(damageType), x, y, state,
            { rayNoun: 'blast', random },
        );
        rangeChange += floor.rangeChange;
    }

    const monster = breathTargetAt(x, y, floor, context);
    if (monster) {
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        if (rayHitsMonster(monster, random, rollOne)) {
            context.hits++;
            rangeChange -= 2;
            if (monsterReflectsRay(monster, state)) {
                await showMonsterReflection(monster, name, state, publish);
                reflected = true;
                leavesPoisonCloud = false;
            } else {
                const hit = await hitMonsterWithBreath(monster, attack, {
                    state, publish, random, rollDice, rollOne,
                });
                await finishMonsterBreathHit(
                    monster, hit, {
                        state, breath: name, finishMonsterKill, publish,
                        random, sourceMonster: context.sourceMonster,
                    },
                );
                if (hit.reintegrated) {
                    return {
                        stop: true,
                        result: {
                            used: true,
                            heroDied: false,
                            hits: context.hits,
                        },
                    };
                }
            }
        } else if (canProjectMonster(monster, x, y)) {
            await publish(`${capitalize(name)} misses the ${
                MONSTER_NAME[monster.mnum] || 'monster'
            }.`);
        }
    } else if (!floor.absorbed
        && x === state.u.ux && y === state.u.uy && remainingRange >= 0) {
        const heroHit = await hitHeroOnRay(x, y, context);
        context.hits += heroHit.hit ? 1 : 0;
        rangeChange -= heroHit.hit ? 2 : 0;
        reflected = heroHit.reflected;
        leavesPoisonCloud = leavesPoisonCloud && !reflected;
        if (heroHit.heroDied) {
            return {
                stop: true,
                result: {
                    used: true,
                    heroDied: true,
                    hits: context.hits,
                },
            };
        }
    }

    if (damageType === AD_DRST) {
        if (leavesPoisonCloud)
            createPoisonGasCloud(state, x, y, 1, 8, random);
        floor = await applyRayFloorFeatures(
            'poison', x, y, state, { rayNoun: 'blast', random },
        );
        rangeChange += floor.rangeChange;
    }

    return { absorbed: floor.absorbed, rangeChange, reflected };
}

async function breatheWhileSwallowed(context) {
    const { state, attack, name, publish, random, rollDice, rollOne } = context;
    const monster = state.u.ustuck;
    const hit = await hitMonsterWithBreath(monster, attack, {
        state, publish, random, rollDice, rollOne,
    });
    context.hits = 1;
    const insideHit = hit.disintegrated
        ? { ...hit, disintegrated: false, noCorpse: false }
        : hit;
    await finishMonsterBreathHit(
        monster, insideHit, {
            state,
            breath: name,
            finishMonsterKill: context.finishMonsterKill,
            publish,
            random,
            deathContext: { kind: 'swallowed-breath' },
        },
    );
    return { used: true, heroDied: false, hits: 1 };
}

function breathTargetAt(x, y, floor, context) {
    if (floor.absorbed) return null;
    const { state, random, sourceMonster } = context;
    const monster = rayMonsterAt(x, y, state);
    if (monster) return monster;
    if (x !== state.u.ux || y !== state.u.uy) return null;

    const steed = state.u.usteed;
    if (steed && steed !== sourceMonster
        && random(3) === 0 && !monsterReflectsRay(steed, state))
        return steed;
    return null;
}

async function showMonsterReflection(monster, name, state, publish) {
    if (!canProjectMonster(monster, monster.mx, monster.my)) return;
    await publish(`${capitalize(name)} hits the ${
        MONSTER_NAME[monster.mnum] || 'monster'
    }.`);
    await shieldeff(monster.mx, monster.my, state);
    await publish('But it reflects!');
}

async function hitHeroOnRay(x, y, context) {
    const {
        state, attack, damageType, name, publish, random, rollDice, rollOne,
    } = context;
    state._occupation = null;
    if (!rayHitsHero(state, random, rollOne)) {
        if (!state.blind)
            await publish(`${capitalize(name)} whizzes by you!`);
        else if (damageType === AD_ELEC)
            await publish('Your arm tingles.');
        if (damageType === AD_ELEC)
            blindHeroWithLightning(state, attack, rollDice);
        return { hit: false, reflected: false, heroDied: false };
    }

    await publish(`${capitalize(name)} hits you!`);
    if (heroReflectsRay(state)) {
        const source = heroReflectionSource(state);
        await publish(`But it reflects from your ${
            source?.noun || 'shield'
        }!`);
        await shieldeff(x, y, state);
        if (source) discoverHeroReflectionSource(source, state);
        if (damageType === AD_ELEC)
            blindHeroWithLightning(state, attack, rollDice);
        return { hit: true, reflected: true, heroDied: false };
    }

    const hit = await hitHeroWithBreath({
        state, attack, publish, random, rollDice, rollOne,
    });
    if (damageType === AD_ELEC)
        blindHeroWithLightning(state, attack, rollDice);
    return { hit: true, reflected: false, heroDied: hit.heroDied };
}

async function hitMonsterWithBreath(
    monster, attack,
    { state, publish, random, rollDice, rollOne },
) {
    const damageType = effectiveBreathDamage(attack[1]);
    if (damageType === AD_FIRE) {
        return fireRayDamageMonster(monster, {
            state, publish, random, rollDice, rollOne, dice: attack[2],
        });
    }
    if (damageType === AD_COLD) {
        return coldRayDamageMonster(monster, {
            state, publish, random, rollDice, rollOne, dice: attack[2],
        });
    }
    if (damageType === AD_SLEE) {
        const slept = sleepMonsterFromRay(monster, {
            dice: attack[2], random, rollDice,
        });
        if (!slept) await shieldeff(monster.mx, monster.my, state);
        return {
            damage: 0, slept, sleepEffect: true, resisted: !slept,
        };
    }
    if (damageType === AD_DISN)
        return disintegrateMonster(monster, state);

    const inherentResistance = damageType === AD_MAGM
        ? monsterResistsMagic(monster)
        : monsterHasElementalResistance(
            monster, resistanceMask(damageType),
            monsterResistanceField(damageType),
        );
    let damage = 0;
    let sourceDamage = 0;
    if (damageType === AD_ELEC) {
        sourceDamage = rollDice(attack[2], 6);
        damage = inherentResistance ? 0 : sourceDamage;
    } else if (!inherentResistance) {
        sourceDamage = rollDice(attack[2], 6);
        damage = sourceDamage;
    }
    if (inherentResistance) {
        await shieldeff(monster.mx, monster.my, state);
    }

    if (damageType === AD_ELEC) {
        if (attack[2] > 2 && !monsterResistsBlindness(monster, state)) {
            monster.mcansee = 0;
            monster.mblinded = Math.min(
                127, (monster.mblinded ?? 0) + rollOne(50),
            );
        }
        if (random(3) === 0) {
            damage += await destroyMonsterInventoryByElement(
                monster, INVENTORY_DAMAGE.ELECTRIC, sourceDamage,
                {
                    carrierName: MONSTER_NAME[monster.mnum] || 'monster',
                    publish, random, rollOne,
                    visible: canProjectMonster(
                        monster, monster.mx, monster.my,
                    ),
                },
            );
        }
    } else if (damageType === AD_ACID && !inherentResistance) {
        if (random(6) === 0) {
            await damageMonsterObjectWithAcid(
                monster, monsterWieldedWeapon(monster),
                { state, publish, random },
            );
        }
        if (random(6) === 0) {
            await corrodeRandomMonsterArmor(
                monster, { state, publish, random },
            );
        }
    }

    if (damage > 0 && monsterResistsRayDamage(monster, random, rollOne))
        damage = Math.trunc(damage / 2);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    return { damage, resisted: inherentResistance };
}

async function disintegrateMonster(monster, state) {
    if (monsterIsRider(monster)) {
        monster.mhp = monster.mhpmax;
        return { damage: 0, reintegrated: true, resisted: true };
    }
    if (monsterResistsDisintegration(monster)) {
        await shieldeff(monster.mx, monster.my, state);
        return { damage: 0, resisted: true };
    }

    const shield = monsterWornObject(monster, W_ARMS);
    if (shield) {
        destroyObjectFromMonsterInventory(monster, shield, state);
        return { damage: 0, armorDestroyed: shield, resisted: false };
    }
    const suit = monsterWornObject(monster, W_ARM);
    if (suit) {
        const cloak = monsterWornObject(monster, W_ARMC);
        if (cloak) destroyObjectFromMonsterInventory(monster, cloak, state);
        destroyObjectFromMonsterInventory(monster, suit, state);
        return { damage: 0, armorDestroyed: suit, resisted: false };
    }
    for (const mask of [W_ARMC, W_ARMU]) {
        const object = monsterWornObject(monster, mask);
        if (object) destroyObjectFromMonsterInventory(monster, object, state);
    }
    monster.mhp = 0;
    return { damage: 0, disintegrated: true, noCorpse: true };
}

function monsterResistsDisintegration(monster) {
    if (monsterHasElementalResistance(
        monster, MR_DISINT, 'defendedDisintegration',
    )) return true;
    const suit = monsterWornObject(monster, W_ARM);
    return !!suit && [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES]
        .includes(suit.otyp);
}

async function finishMonsterBreathHit(
    monster, hit, {
        state, breath, finishMonsterKill, publish, random,
        sourceMonster = null, deathContext = null,
    },
) {
    const visible = canProjectMonster(monster, monster.mx, monster.my);
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if (hit.reintegrated) {
        if (visible) {
            await publish(`${capitalize(breath)} hits ${name}.`);
            await publish(`The ${name} disintegrates.`);
            await publish(`The ${name}'s body reintegrates before your eyes!`);
            await publish(`The ${name} resurrects!`);
        }
        return;
    }
    if (hit.armorDestroyed) {
        if (visible) {
            const armor = hit.armorDestroyed.name
                || hit.armorDestroyed.description
                || OBJECT_NAMES[hit.armorDestroyed.otyp]
                || 'armor';
            await publish(`The ${name}'s ${armor} is disintegrated!`);
        }
        wakeMonster(monster, !sourceMonster);
        return;
    }
    if ((monster.mhp ?? 0) <= 0) {
        if (hit.disintegrated && visible)
            await publish(`The ${name} is disintegrated!`);
        if (hit.disintegrated)
            destroyDisintegratedMonsterInventory(monster, state, random);
        await finishMonsterKill(monster, monster.mx, monster.my, {
            noCorpse: !!hit.noCorpse
                || !!((MONSTER_GENO[monster.mnum] ?? 0) & G_NOCORPSE),
            showKillMessage: !hit.disintegrated,
            deathContext,
        });
        return;
    }
    if (visible)
        await publish(`${capitalize(breath)} hits the ${name}!`);
    if (!hit.sleepEffect) wakeMonster(monster, !sourceMonster);
}

function wakeMonster(monster, angered) {
    monster.msleeping = 0;
    if (angered) monster.mpeaceful = 0;
}

function destroyDisintegratedMonsterInventory(monster, state, random) {
    const lifeSaver = wornMonsterLifeSaver(monster);
    const inventory = [...(monster.minvent || monster.inventory || [])];
    for (const object of inventory) {
        if (objectSurvivesDisintegration(object, lifeSaver, state, random))
            continue;
        destroyObjectFromMonsterInventory(monster, object, state);
    }
}

function objectSurvivesDisintegration(
    object, lifeSaver, state, random,
) {
    if (object === lifeSaver || object.disintegrationResistance
        || [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES]
            .includes(object.otyp)) return true;
    const artifact = artifactById(object.oartifact, state);
    if (object.questArtifact || object.isQuestArtifact
        || artifact?.questArtifact) return true;
    return objectResistsDestruction(object, 5, 50, random);
}

function monsterWornObject(monster, mask) {
    const inventory = monster.minvent || monster.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & mask) !== 0)
        || null;
}

function monsterResistsMagic(monster) {
    if (monster.resistsMagic || monster.antimagic) return true;
    const name = MONSTER_NAME[monster.mnum];
    return name === 'baby gray dragon'
        || (MONSTER_ATTACKS[monster.mnum] || []).some(
            attack => attack[1] === AD_MAGM || attack[1] === AD_RBRE,
        );
}

function monsterResistsBlindness(monster, state) {
    if (monster.noEyes
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        || (monster.mblinded ?? 0) > 0
        || monster.mcansee === 0
        || !!monster.msleeping) return true;
    if ((MONSTER_ATTACKS[monster.mnum] || []).some(
        ([attackType, damageType]) => damageType === AD_BLND
            && (attackType === AT_EXPL || attackType === AT_GAZE),
    )) return true;
    const weapon = monsterWieldedWeapon(monster);
    return artifactById(weapon?.oartifact, state)?.name === 'Sunsword';
}

function monsterIsRider(monster) {
    const name = MONSTER_NAME[monster.mnum];
    return name === 'Death' || name === 'Pestilence' || name === 'Famine';
}

function blindHeroWithLightning(state, attack, rollDice) {
    const wielded = state.uwep || state.u?.uwep;
    if (state.blind || (state.u?.blindTurns ?? 0) > 0
        || state.unaware || state.u?.unaware
        || state.u?.blindResistance || !heroHasEyes(state)
        || artifactById(wielded?.oartifact, state)?.name === 'Sunsword') {
        return;
    }
    state.u.blindTurns = (state.u.blindTurns ?? 0)
        + rollDice(attack[2], 50);
    syncBlindness(state);
}

function resistanceMask(damageType) {
    if (damageType === AD_FIRE) return MR_FIRE;
    if (damageType === AD_COLD) return MR_COLD;
    if (damageType === AD_SLEE) return MR_SLEEP;
    if (damageType === AD_DISN) return MR_DISINT;
    if (damageType === AD_ELEC) return MR_ELEC;
    if (damageType === AD_DRST) return MR_POISON;
    if (damageType === AD_ACID) return MR_ACID;
    return 0;
}

function monsterResistanceField(damageType) {
    if (damageType === AD_ELEC) return 'defendedShock';
    if (damageType === AD_DRST) return 'defendedPoison';
    if (damageType === AD_ACID) return 'defendedAcid';
    return '';
}

function floorKind(damageType) {
    if (damageType === AD_FIRE) return 'fire';
    if (damageType === AD_COLD) return 'cold';
    if (damageType === AD_DISN) return 'disintegration';
    if (damageType === AD_ELEC) return 'lightning';
    if (damageType === AD_ACID) return 'acid';
    return 'breath';
}

export function breathRayName(damageType) {
    return [
        '', 'blast of missiles', 'blast of fire', 'blast of frost',
        'blast of sleep gas', 'blast of disintegration',
        'blast of lightning', 'blast of poison gas', 'blast of acid',
    ][damageType] || 'blast';
}

export function breathWeaponName(damageType) {
    return [
        '', 'fragments', 'fire', 'frost', 'sleep gas',
        'a disintegration blast', 'lightning', 'poison gas', 'acid',
    ][damageType] || 'strange breath';
}

function breathColor(damageType) {
    if (damageType === AD_FIRE) return CLR_ORANGE;
    if (damageType === AD_SLEE) return CLR_BRIGHT_BLUE;
    if (damageType === AD_DRST || damageType === AD_ACID)
        return CLR_BRIGHT_GREEN;
    if (damageType === AD_DISN) return NO_COLOR;
    return CLR_WHITE;
}

function cellIsVisible(state, x, y) {
    return !state.blind && !!(state.viz_array?.[y]?.[x] & 0x2);
}

function capitalize(value) {
    return value[0].toUpperCase() + value.slice(1);
}
