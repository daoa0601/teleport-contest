// A monster's passive response when the hero or an object strikes it.
// C ref: uhitm.c passive() and passive_obj().

import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import {
    A_DEX, A_STR, A_WIS,
    M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR,
    Upolyd,
} from './const.js';
import {
    canSeeMonster, plineWithContinuation, randomDisplayMonsterName, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import {
    corrodeHeroObject, corrodeRandomHeroArmor,
} from './hero_erosion.js';
import {
    MONSTER_ATTACKS, MONSTER_NAME, MONSTER_RESISTS, monsterTypeName,
} from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    AD_ACID, AD_COLD, AD_CORR, AD_ELEC, AD_ENCH, AD_FIRE, AD_MAGM,
    AD_PHYS, AD_PLYS, AD_RUST, AD_STON, AD_STUN,
    AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_EXPL,
    AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG,
    AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    DWARVISH_CLOAK, OBJECT_CHARGED, OBJECT_MATERIAL, OBJECT_NAMES,
    SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { hasWornProperty } from './properties.js';
import { heroMonsterForm, rehumanizeHero } from './polyself.js';
import { heroReflectionSource, heroReflectsRay } from './ray.js';
import { d, rnl, rn2 } from './rng.js';
import { resolveImmediatePetrification } from './stoning.js';
import { cansee } from './vision.js';

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_ELEC = 0x10;
const MR_ACID = 0x40;
const MR_STONE = 0x80;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');

export async function applyHeroContactPassive(monster, {
    hit,
    attackType = AT_WEAP,
    weapon = null,
    weaponWasDestroyed = false,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    die = finishHeroDeath,
} = {}) {
    const attack = passiveAttack(monster);
    if (!attack) return { handled: false, heroDied: false };

    const damageType = attack[1];
    const damage = passiveDamage(monster, attack, rollDice);
    const context = {
        monster,
        damageType,
        damage,
        hit: !!hit,
        attackType,
        weapon,
        weaponWasDestroyed,
        state,
        publish,
        random,
        die,
    };
    const immediate = await applyImmediatePassive(context);
    if (immediate.heroDied) {
        return {
            handled: damageType !== AD_PHYS,
            damageType,
            damage,
            ...immediate,
        };
    }

    let surviving = {};
    const monsterAlive = !monster.dead && (monster.mhp ?? 1) > 0;
    if (monsterAlive && !monster.mcan && random(3) !== 0)
        surviving = await applySurvivingMonsterPassive(context);
    return {
        handled: damageType !== AD_PHYS,
        damageType,
        damage,
        ...immediate,
        ...surviving,
    };
}

async function applyImmediatePassive(context) {
    if (context.damageType === AD_ACID)
        return applyAcidPassive(context);
    if ([AD_FIRE, AD_RUST, AD_CORR].includes(context.damageType))
        return applyEquipmentPassive(context);
    if (context.damageType === AD_STON)
        return applyStonePassive(context);
    if (context.damageType === AD_MAGM)
        return applyMagicMissilePassive(context);
    if (context.damageType === AD_ENCH)
        return applyEnchantmentPassive(context);
    return { heroDied: false };
}

async function applyAcidPassive({
    monster, damage, hit, attackType, weapon, state, publish, random, die,
}) {
    let appliedDamage = 0;
    let heroDied = false;
    const splashed = hit && random(2) !== 0;

    if (splashed) {
        if (state.u?.blind || state.flags?.verbose === false) {
            await publish('You are splashed!');
        } else {
            await publish(
                `You are splashed by ${possessiveMonsterName(monster)} acid!`,
            );
        }

        if (heroResistsAcid(state)) {
            monstersObserveHeroResistance(M_SEEN_ACID, state);
        } else {
            appliedDamage = damage;
            heroDied = await damageHero(monster, damage, {
                state, publish, die,
            });
            monstersForgetHeroResistance(M_SEEN_ACID, state);
        }

        if (!heroDied && random(30) === 0) {
            await corrodeRandomHeroArmor({
                state,
                publish,
                random,
            });
        }
    }

    const object = objectTouchedByAttack(state, attackType, weapon);
    if (!heroDied && hit && object && random(6) === 0) {
        await corrodeHeroObject(object, {
            state,
            publish,
            random,
            verbose: attackType === AT_KICK,
        });
    }

    if (!heroDied) exerciseAttribute(A_STR, false, state);
    return { splashed, appliedDamage, heroDied };
}

async function applyEquipmentPassive(context) {
    const {
        monster, hit, attackType, weapon, state,
    } = context;
    if (!hit || monster.mcan || !weapon
        || ![AT_KICK, AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH]
            .includes(attackType)) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, weapon, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}

async function applyStonePassive({
    monster, hit, attackType, weapon, weaponWasDestroyed, state, publish, die,
}) {
    if (!hit || attackProtectedFromStone(
        attackType, weapon, weaponWasDestroyed, state,
    ) || heroResists(state, 'stoneResistance', MR_STONE)) {
        return { heroDied: false };
    }
    const result = await resolveImmediatePetrification({
        state,
        killer: monsterName(monster),
        publish,
        die,
    });
    return { heroDied: result.died, transformed: result.transformed };
}

async function applyMagicMissilePassive({
    monster, damage, state, publish, die,
}) {
    if (heroResistsMagic(state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await publish('A hail of magic missiles narrowly misses you!');
        return { resisted: true, heroDied: false };
    }

    await publish('You are hit by magic missiles appearing from thin air!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    monstersForgetHeroResistance(M_SEEN_MAGR, state);
    return { resisted: false, appliedDamage: damage, heroDied };
}

async function applyEnchantmentPassive({
    monster, hit, attackType, weapon, state,
}) {
    if (!hit) return { heroDied: false };
    const object = objectTouchedByEnchantment(
        state, attackType, weapon,
    );
    if (!object) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, object, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}

async function applySurvivingMonsterPassive(context) {
    if (context.damageType === AD_PLYS)
        return applyParalysisPassive(context);
    if (context.damageType === AD_COLD)
        return applyColdPassive(context);
    if (context.damageType === AD_STUN)
        return applyStunPassive(context);
    if (context.damageType === AD_FIRE)
        return applyFirePassive(context);
    if (context.damageType === AD_ELEC)
        return applyElectricPassive(context);
    return { heroDied: false };
}

async function applyParalysisPassive({
    monster, damage, state, publish, random,
}) {
    if (monster.mnum !== PM_FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await publish('You momentarily stiffen.');
            return { resisted: true, heroDied: false };
        }
        await publish(
            `You are frozen by ${displayMonsterNameWithArticle(monster, state)}!`,
        );
        freezeHero(state, damage, `frozen by ${monsterName(monster)}`, true);
        exerciseAttribute(A_DEX, false, state);
        return { stopped: true, heroDied: false };
    }

    if (!canSeeMonster(monster, monster.mx, monster.my))
        return { heroDied: false };
    if (monster.mcansee !== 0) {
        const owner = possessiveDisplayMonsterName(monster, state);
        if (heroReflectsRay(state)) {
            const source = heroReflectionSource(state);
            await publish(
                `${capitalize(owner)} gaze is reflected by your ${
                    source?.noun || 'body'
                }.`,
            );
            return { reflected: true, heroDied: false };
        }
        if (heroHallucinates(state) && random(4) !== 0) {
            const first = random(2) === 0 ? '' : 'rather ';
            const second = random(2) === 0 ? '' : 'rather ';
            const reaction = random(2) === 0 ? 'numb' : 'stupefied';
            await publish(
                `${displayMonsterSubject(monster, state)} looks ${
                    first
                }${second}${reaction}.`,
            );
            return { hallucinatedEscape: true, heroDied: false };
        }
        if (heroHasFreeAction(state)) {
            await publish(`You momentarily stiffen under ${owner} gaze!`);
            return { resisted: true, heroDied: false };
        }

        await publish(`You are frozen by ${owner} gaze!`);
        const duration = currentAttribute(A_WIS, state) > 12
            || random(4) !== 0 ? damage : 127;
        freezeHero(
            state,
            duration,
            `frozen by ${possessiveMonsterName(monster)} gaze`,
            false,
        );
        return { stopped: true, heroDied: false };
    }

    await publish(
        `${displayMonsterSubject(monster, state)} cannot defend itself.`,
    );
    if (random(500) === 0) {
        state.u.uluck = Math.max(-13, (state.u.uluck ?? 0) - 1);
    }
    return { heroDied: false };
}

async function applyColdPassive(context) {
    const {
        monster, damage, state, publish, random, die,
    } = context;
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'coldResistance', MR_COLD)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel a mild chill.');
        monstersObserveHeroResistance(M_SEEN_COLD, state);
        await applyGolemEffects(AD_COLD, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_COLD, state);
    await publish('You are suddenly very cold!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    if (heroDied) return { appliedDamage: damage, heroDied };

    healMonsterFromCold(monster, damage, random);
    if ((monster.mhpmax ?? 0) > ((monster.m_lev ?? 0) + 1) * 8)
        splitMonster(monster, state);
    return { appliedDamage: damage, heroDied: false };
}

async function applyStunPassive({ damage, state, publish }) {
    const hero = state.u;
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0 || damage <= 0)
        return { heroDied: false };
    await publish(hero.usteed ? 'You wobble in the saddle.' : 'You stagger...');
    hero.stunnedTurns = damage;
    hero.stunned = true;
    return { heroDied: false };
}

async function applyFirePassive({ monster, damage, state, publish, die }) {
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'fireResistance', MR_FIRE)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel mildly warm.');
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
        await applyGolemEffects(AD_FIRE, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_FIRE, state);
    await publish('You are suddenly very hot!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function applyElectricPassive({ monster, damage, state, publish, die }) {
    if (heroResists(state, 'shockResistance', MR_ELEC)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel a mild tingle.');
        monstersObserveHeroResistance(M_SEEN_ELEC, state);
        await applyGolemEffects(AD_ELEC, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_ELEC, state);
    await publish('You are jolted with electricity!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function damageHero(monster, amount, { state, publish, die }) {
    if (amount <= 0) return false;
    const hero = state.u;
    if (Upolyd(hero)) {
        hero.mh = (hero.mh ?? 1) - amount;
        if (hero.mh > 0) return false;
        if (hero.unchanging || state.unchanging) {
            return die({ killer: 'killed while stuck in creature form' });
        }
        const restored = rehumanizeHero(state);
        if (restored.changed)
            await publish(`You return to ${restored.race} form!`);
        return false;
    }

    hero.uhp = (hero.uhp ?? 1) - amount;
    if (hero.uhp > 0) return false;
    return die({ killer: monsterName(monster) });
}

function heroResists(state, property, mask) {
    const hero = state.u || {};
    const snakeCase = property.replace(/[A-Z]/g, letter =>
        `_${letter.toLowerCase()}`);
    if (hero[property] || hero[snakeCase]
        || hasWornProperty(property, state)) return true;
    const form = heroMonsterForm(state);
    return form !== null && ((MONSTER_RESISTS[form] ?? 0) & mask) !== 0;
}

function heroResistsAcid(state) {
    return heroResists(state, 'acidResistance', MR_ACID);
}

function heroResistsMagic(state) {
    const hero = state.u || {};
    if (hero.antimagic || hero.magicResistance || hero.magic_resistance
        || hasWornProperty('antimagic', state)) return true;
    const form = heroMonsterForm(state);
    if (form === null) return false;
    const name = MONSTER_NAME[form];
    return name === 'baby gray dragon'
        || (MONSTER_ATTACKS[form] || []).some(
            attack => attack[1] === AD_MAGM,
        );
}

function objectTouchedByAttack(state, attackType, weapon) {
    if (attackType === AT_KICK)
        return weapon || state.uarmf || state.u?.uarmf || null;
    return [AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH].includes(attackType)
        ? weapon : null;
}

function objectTouchedByEnchantment(state, attackType, weapon) {
    if (attackType === AT_KICK) return weapon;
    if (attackType === AT_BITE || attackType === AT_BUTT
        || (attackType >= AT_STNG && attackType < AT_WEAP)) return null;
    return weapon || state.uwep || state.u?.uwep
        || state.uarmg || state.u?.uarmg || null;
}

function attackProtectedFromStone(
    attackType, weapon, weaponWasDestroyed, state,
) {
    if ([AT_NONE, AT_SPIT, AT_EXPL, AT_BOOM, AT_GAZE, AT_BREA]
        .includes(attackType)) return true;
    if ([AT_CLAW, AT_TUCH, AT_WEAP, AT_MAGC].includes(attackType)) {
        return !!(state.uarmg || state.u?.uarmg
            || weapon || weaponWasDestroyed);
    }
    if (attackType === AT_KICK)
        return !!(state.uarmf || state.u?.uarmf);
    if (attackType === AT_BUTT)
        return !!(state.uarmh || state.u?.uarmh);
    if (attackType === AT_HUGS) {
        return !!(state.uarmc || state.u?.uarmc)
            && !!(state.uarmg || state.u?.uarmg);
    }
    return false;
}

function freezeHero(state, turns, reason, showRecoveryMessage) {
    state._occupation = null;
    state._helplessTurns = Math.max(0, turns);
    state._helplessReason = reason;
    state._helplessDoneMessage = showRecoveryMessage
        ? 'You can move again.' : '';
}

function monsterNearHero(monster, state) {
    return Math.max(
        Math.abs((monster.mx ?? 0) - (state.u?.ux ?? 0)),
        Math.abs((monster.my ?? 0) - (state.u?.uy ?? 0)),
    ) <= 1;
}

function healMonsterFromCold(monster, damage, random) {
    const amount = Math.trunc((damage + random(2)) / 2);
    const overheal = Math.trunc((damage + 1) / 2);
    const maximum = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) + amount > maximum + overheal) {
        monster.mhpmax = maximum + overheal;
        monster.mhp = monster.mhpmax;
        return;
    }
    monster.mhp = (monster.mhp ?? 0) + amount;
    if (monster.mhp > maximum) monster.mhpmax = monster.mhp;
}

async function applyGolemEffects(damageType, damage, state, publish) {
    const form = heroMonsterForm(state);
    const name = form === null ? null : MONSTER_NAME[form];
    let healing = 0;
    if (damageType === AD_ELEC && name === 'flesh golem')
        healing = Math.trunc((damage + 5) / 6);
    else if (damageType === AD_FIRE && name === 'iron golem')
        healing = damage;
    if (healing <= 0 || (state.u.mh ?? 0) >= (state.u.mhmax ?? 0)) return;

    state.u.mh = Math.min(state.u.mhmax, state.u.mh + healing);
    await publish('Strangely, you feel better than before.');
    exerciseAttribute(A_STR, true, state);
}

function passiveAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(
        ([attackType]) => attackType === AT_NONE,
    ) || null;
}

function passiveDamage(monster, attack, rollDice) {
    const [, , dice, sides] = attack;
    if (dice > 0) return rollDice(dice, sides);
    if (sides > 0) return rollDice((monster.m_lev ?? 0) + 1, sides);
    return 0;
}

function monsterName(monster) {
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}

function possessiveMonsterName(monster) {
    const name = monster.name || `the ${monsterName(monster)}`;
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function heroHallucinates(state) {
    return !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
}

function displayMonsterName(monster, state) {
    return heroHallucinates(state)
        ? randomDisplayMonsterName() : monsterName(monster);
}

function displayMonsterSubject(monster, state) {
    return monster.name || `The ${displayMonsterName(monster, state)}`;
}

function displayMonsterNameWithArticle(monster, state) {
    return monster.name || `the ${displayMonsterName(monster, state)}`;
}

function possessiveDisplayMonsterName(monster, state) {
    const name = displayMonsterNameWithArticle(monster, state);
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function capitalize(text) {
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// passive_obj() runs after a projectile or held object touches the monster.
// The caller still owns the object's eventual inventory or floor location.
export async function applyMonsterPassiveToObject(
    monster,
    object,
    {
        carried = false,
        attackType = null,
        state = game,
    } = {},
) {
    const passive = passiveAttack(monster);
    if (!passive) return;
    const objectName = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const subject = `${carried ? 'Your' : 'The'} ${objectName}`;
    const lowerSubject = `${carried ? 'your' : 'the'} ${objectName}`;
    const agreement = objectIsPlural(object, objectName) ? 'are' : 'is';
    const visible = carried || cansee(monster.mx, monster.my);
    const verbose = attackType === AT_KICK;
    const passiveDamageType = passive[1];

    if (passiveDamageType === AD_FIRE) {
        if (rn2(6) !== 0 || monster.mcan
            || (attackType !== AT_KICK
                && MONSTER_NAME[monster.mnum] === 'steam vortex')) return;
        if (carried && inventoryProtectsObject(
            'fireResistance', state, rn2, true,
        )) return;
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const flammable = (material > 1 && material <= 8)
            || material === 18;
        if (!flammable
            || (object.oerodeproof || object.fireproof) && object.rknown) {
            if (verbose && visible) {
                await plineWithContinuation(
                    `${subject} ${agreement} not affected by heat.`,
                );
            }
            return;
        }
        if (object.oerodeproof || object.fireproof) {
            object.rknown = true;
            if (visible) {
                await plineWithContinuation(
                    `Somehow, ${lowerSubject} ${agreement} not affected by the heat.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldBurn = object.oeroded ?? 0;
        if (oldBurn >= 3) {
            if (verbose && visible) {
                await plineWithContinuation(
                    `${subject} ${agreement === 'are' ? 'look' : 'looks'} completely burnt.`,
                );
            }
            return;
        }
        object.oeroded = oldBurn + 1;
        if (carried) state._armorClassDirty = true;
        const adverb = oldBurn + 1 === 3
            ? ' completely' : oldBurn ? ' further' : '';
        await plineWithContinuation(`${subject} smoulders${adverb}!`);
        return;
    }

    if (passiveDamageType === AD_RUST) {
        if (monster.mcan) return;
        if (object.greased) {
            await applyGreaseProtection(
                object, subject, agreement, carried, visible,
            );
            return;
        }
        if ((OBJECT_MATERIAL[object.otyp] ?? 0) !== 11
            || (object.oerodeproof || object.rustproof) && object.rknown) {
            if (verbose && visible) {
                await plineWithContinuation(
                    `${subject} ${agreement} not affected by oxidation.`,
                );
            }
            return;
        }
        if (object.oerodeproof || object.rustproof) {
            object.rknown = true;
            if (visible) {
                await plineWithContinuation(
                    `Somehow, ${lowerSubject} ${agreement} not affected by the oxidation.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldRust = object.oeroded ?? 0;
        if (oldRust >= 3) {
            if (verbose && visible) {
                await plineWithContinuation(
                    `${subject} ${agreement === 'are' ? 'look' : 'looks'} completely rusted.`,
                );
            }
            return;
        }
        object.oeroded = oldRust + 1;
        if (carried) state._armorClassDirty = true;
        const adverb = oldRust + 1 === 3
            ? ' completely' : oldRust ? ' further' : '';
        await plineWithContinuation(`${subject} rusts${adverb}!`);
        return;
    }

    if (passiveDamageType === AD_CORR) {
        if (monster.mcan) return;
        await corrodeStrikingObject(object, {
            subject, lowerSubject, agreement, carried, state, verbose, visible,
        });
        return;
    }

    if (passiveDamageType === AD_ENCH) {
        if (monster.mcan) return;
        const enchantment = Number.isInteger(object.spe)
            ? object.spe : Number.isInteger(object.enchantment)
                ? object.enchantment : 0;
        if (!OBJECT_CHARGED[object.otyp] || enchantment <= 0
            || [AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD,
                CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING]
                .includes(object.otyp)) return;
        if (rn2(100) < (object.oartifact ? 90 : 10)) return;
        object.spe = enchantment - 1;
        object.enchantment = object.spe;
        if (carried) state._armorClassDirty = true;
        if (carried && (object.known || object.typeKnown
            || object.oclass === 3)) {
            const verb = objectIsPlural(object, objectName) ? 'seem' : 'seems';
            await plineWithContinuation(
                `${subject} ${verb} less effective.`,
            );
        }
        return;
    }

    if (passiveDamageType !== AD_ACID || rn2(6) !== 0) return;
    await corrodeStrikingObject(object, {
        subject, lowerSubject, agreement, carried, state, verbose, visible,
    });
}

async function corrodeStrikingObject(
    object,
    {
        subject, lowerSubject, agreement, carried, state, verbose, visible,
    },
) {
    if (carried && inventoryProtectsObject(
        'acidResistance', state, rn2,
    )) return;
    if (object.greased) {
        await applyGreaseProtection(
            object, subject, agreement, carried, visible,
        );
        return;
    }
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    if (![11, 13].includes(material)
        || (object.oerodeproof || object.corrodeproof) && object.rknown) {
        if (verbose && visible) {
            await plineWithContinuation(
                `${subject} ${agreement} not affected by corrosion.`,
            );
        }
        return;
    }
    if (object.oerodeproof || object.corrodeproof) {
        object.rknown = true;
        if (visible) {
            await plineWithContinuation(
                `Somehow, ${lowerSubject} ${agreement} not affected by the corrosion.`,
            );
        }
        return;
    }
    if (object.blessed && rnl(4) === 0) return;

    const oldCorrosion = object.oeroded2 ?? 0;
    if (oldCorrosion >= 3) {
        if (verbose && visible) {
            await plineWithContinuation(
                `${subject} ${agreement === 'are' ? 'look' : 'looks'} completely corroded.`,
            );
        }
        return;
    }
    object.oeroded2 = oldCorrosion + 1;
    if (carried) state._armorClassDirty = true;
    const adverb = oldCorrosion + 1 === 3
        ? ' completely' : oldCorrosion ? ' further' : '';
    await plineWithContinuation(`${subject} corrodes${adverb}!`);
}

async function applyGreaseProtection(
    object, subject, agreement, carried, visible,
) {
    if (carried && visible) {
        await plineWithContinuation(
            `${subject} ${agreement} protected by the layer of grease!`,
        );
    }
    if (rn2(2) !== 0) return;
    object.greased = false;
    if (carried) await plineWithContinuation('The grease dissolves.');
}

function inventoryProtectsObject(
    property, state, random, dwarvishCloakProtects = false,
) {
    if (hasWornProperty(property, state)) return random(100) < 99;
    if (!dwarvishCloakProtects) return false;
    const cloak = state.uarmc || state.u?.uarmc;
    return cloak?.otyp === DWARVISH_CLOAK && random(100) < 90;
}

function objectIsPlural(object, name) {
    return (object.quan ?? object.quantity ?? 1) !== 1
        || /(?:boots|shoes|gloves|gauntlets|lenses|scales)$/u.test(name);
}
