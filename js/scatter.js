import { publishHeardMessage } from './hero_speech.js';
import { currency } from './currency.js';
// Floor objects thrown outward by an explosion or collapsing structure.
// C ref: explode.c:scatter() and mthrowu.c:ohitmon().
import { deleteTrap } from './trap_lifecycle.js';
import { DOOR, D_CLOSED, D_LOCKED, LARGEST_INT, M_AP_MONSTER, M_AP_TYPE, SHOPBASE, SINK, STATUE_TRAP, ZAP_POS, isok, } from './const.js';
import { canSpotMonster, displayLiquidName, newsym } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object, } from './floor_object.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { unlinkObject } from './object_location.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { applyMonsterBlindness, monsterCanBeBlindedByObject } from './blinding_attack.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, monsterObjectPronoun, possessiveName } from './monster_name.js';
import { applyMonsterPassiveToObject } from './monster_passive.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance, monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { heroSpecies } from './hero_species.js';
import { dist2 } from './hacklib.js';
import { captureHeroProjectileName } from './hero_physical_messages.js';
import { hideHeroUnder, maybeUnhideAt } from './monster_hiding.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { unpunishHero } from './punishment.js';
import { addShopObjectToBill, costlySpot } from './shk.js';
import { roomsAt } from './room.js';
import { MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_NAME, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsNonliving, monsterIsVampireShifter } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { ACID_VENOM, BOULDER, CREAM_PIE, EGG, GOLD_PIECE, STATUE, } from './object_data.js';
import { breakFloorObject, } from './object_breakage.js';
import { splitObjectStack } from './object_stack.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { delobj } from './object_delete.js';
import { observeObject } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { shipObject } from './object_migration.js';
import { isPoisonableObject } from './object_properties.js';
import { shouldMulchMissile } from './projectile.js';
import { touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
import { heroIsBlind } from './senses.js';
import { d, rn2, rnd } from './rng.js';
import { breakStatue, fractureRock } from './rock_breakage.js';
import { objectCombatName, objectNameIsPlural } from './objnam.js';
import { objectDescription } from './object_description.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { capitalizedDefiniteName, rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero, } from './weapon_damage.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';
const GLASS = 19;
const POTION_CLASS = 8;
const DIRECTIONS = [
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
];
function floorPile(state, x, y) {
    return state.level?.objects?.[x]?.[y] || [];
}
function removeFloorObject(object, state) {
    unlinkObject(object, state);
}
function squareIsVisible(state, x, y) {
    return !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && (!state.viz_array || !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2));
}
function monsterAt(state, x, y) {
    return monsterAtPosition(requireGameLevel(state), x, y);
}
function openFlightSquare(state, x, y) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    return ZAP_POS(location.typ)
        && (location.typ !== DOOR
            || !(location.doormask & (D_CLOSED | D_LOCKED)));
}
async function finishScatteredMonsterDeath(monster, x, y, death, state, options) {
    if (options.heroCaused && options.finishMonsterKill) {
        const killed = await options.finishMonsterKill(monster, x, y, death);
        return { killed, heroDied: !!state.program_state.gameover };
    }
    if (!options.finishMonsterDeath && options.heroCaused)
        return finishHeroMonsterKillOutcome(monster, x, y, { ...death, publish: options.publish });
    const finish = options.finishMonsterDeath
        || ((victim, deathOptions) => finishEnvironmentalMonsterDeath(victim, state, deathOptions));
    const result = await finish(monster, {
        ...death,
        random: options.random,
        publish: options.publish,
    });
    return { killed: !result.survived, heroDied: !!result.heroDied };
}
// C drop_throw(): an impact can mulch ammunition, ship it through a gate,
// or expose it to the defender's passive effect before floor stacking.
async function landAfterMonsterHit(object, node, state, options) {
    requirePlayingGame(state);
    const broken = object.otyp === CREAM_PIE || object.oclass === 17 || object.otyp === EGG
        || shouldMulchMissile(object, { monsterMoving: !!state.context.mon_moving });
    if (broken) {
        await delobj(object, state, options.random);
        return;
    }
    if (await shipObject(object, node.x, node.y, { state, publish: options.publish, random: options.random }))
        return;
    const actor = monsterAtPosition(state.level, node.x, node.y)
        || (node.x === state.u.ux && node.y === state.u.uy ? state.u : null);
    const floor = await applyFloorEffects(object, node.x, node.y, {
        state, publish: options.publish, random: options.random, verb: 'fall',
    });
    if (floor.finished || state.program_state.gameover)
        return;
    await placeObject(object, node.x, node.y, state);
    if (actor)
        await applyMonsterPassiveToObject(actor, object, {
            state, publish: options.publish, random: options.random,
        });
    if (!state.program_state.gameover)
        await stack_object(object, state);
}
async function hitMonster(monster, node, state, options) {
    const object = node.object;
    if (!object)
        return false;
    const visible = cansee(node.x, node.y);
    const disguised = M_AP_TYPE(monster) !== 0 && M_AP_TYPE(monster) !== M_AP_MONSTER;
    state.notonhead = node.x !== monster.mx || node.y !== monster.my;
    if (visible)
        observeObject(object, state);
    const threshold = 5 + findMonsterArmorClass(monster)
        + rangedTargetHitBonus(object, monster, {
            state, random: options.random, rollOne: options.rollOne,
        });
    if (threshold < options.rollOne(20)) {
        if (visible && !disguised)
            await options.publish(rayMissMessage(captureHeroProjectileName(object, state), monster, { ...node, state }));
        return false;
    }
    if (object.oclass === POTION_CLASS) {
        if (disguised)
            revealMonsterAppearance(monster);
        monster.msleeping = 0;
        const potionOptions = {
            state,
            monster,
            potion: object,
            target: node,
            targetVisible: cansee(monster.mx, monster.my),
            targetSpotted: canSpotMonster(monster),
            resolveVapor: true,
            distance: dist2(state.u.ux, state.u.uy, monster.mx, monster.my),
            publish: options.publish,
            wakeMonster: wakeAttackedMonster,
            wakeNearby: (nearX, nearY, distance) => wakeMonstersNearWithMessages(nearX, nearY, distance, state, options.publish),
            finishKill: (target, deathOptions = {}) => finishScatteredMonsterDeath(target, target.mx, target.my, deathOptions, state, options),
            // ohitmon() passes POTHIT_OTHER_THROW even for a hero-caused blast.
            heroCaused: false,
        };
        const impact = await hitMonsterWithSupportedPotion(potionOptions);
        if (impact?.heroDied)
            return true;
        if (!impact)
            throw new Error(`Unsupported scattered potion ${object.otyp}`);
        node.object = null;
        node.stopped = true;
        return true;
    }
    const material = objectMaterial(object, state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const harmless = object.oclass !== 4 && (material === 20 || material === 21)
        && !!(flags & 0x8) && !(flags & 0x00100000);
    let damage = rollPhysicalWeaponDamage(object, monster, {
        state, rollOne: options.rollOne, rollDice: options.rollDice,
    });
    if (object.otyp === ACID_VENOM && monsterHasAcidResistance(monster))
        damage = 0;
    if (disguised)
        revealMonsterAppearance(monster);
    monster.msleeping = 0;
    if (visible) {
        if (object.otyp === EGG) {
            const species = object.corpsenm === undefined ? 'unknown' : MONSTER_NAME[object.corpsenm] ?? 'unknown';
            const egg = object.known ? `${withIndefiniteArticle(species)} egg` : 'an egg';
            await options.publish(`Splat!  ${monsterName(monster, { state, capitalized: true })} is hit with ${egg}!`);
        }
        else {
            await options.publish(rayHitMessage(captureHeroProjectileName(object, state), monster, {
                ...node, state, damage,
                ...(harmless ? { ending: ` but passes harmlessly through ${monsterObjectPronoun(monster, { state })}.` } : {}),
            }));
        }
    }
    if (object.opoisoned && isPoisonableObject(object)) {
        if (monsterHasPoisonResistance(monster)) {
            if (visible)
                await options.publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
        }
        else if (options.random(30) !== 0)
            damage += options.rollOne(6);
        else {
            if (visible)
                await options.publish('The poison was deadly...');
            damage = monster.mhp;
        }
    }
    if (material === 14 && monsterHatesSilver(monster) && visible) {
        const flesh = !monsterIsNoncorporeal(monster) && !monsterIsAmorphous(monster);
        const name = monsterName(monster, { state });
        await options.publish(`The silver sears ${flesh ? `${possessiveName(name)} flesh` : name}!`);
    }
    if (object.otyp === ACID_VENOM && cansee(monster.mx, monster.my) && visible) {
        await options.publish(monsterHasAcidResistance(monster)
            ? `${monsterName(monster, { state, capitalized: true })} is unaffected.`
            : `The ${displayLiquidName('acid', state)} burns ${monsterName(monster, { state })}!`);
    }
    if (object.otyp === EGG && touchPetrifies(object.corpsenm)) {
        // ohitmon() uses minstapetrify(FALSE), even for hero-caused scatter.
        const stone = await petrifyMonsterFromContact(monster, {
            state, publish: options.publish, rollOne: options.rollOne,
            finishDeath: (victim, death = {}) => finishEnvironmentalMonsterDeath(victim, state, {
                ...death, random: options.random, publish: options.publish,
            }),
        });
        if (stone.heroDied)
            return true;
        if (monsterHasStoneResistance(monster))
            damage = 0;
    }
    if (!harmless && monster.mhp > 0) {
        monster.mhp -= damage;
        if (monster.mhp <= 0) {
            if (visible) {
                const destroyed = monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster)
                    || !canSpotMonster(monster);
                await options.publish(`${monsterName(monster, { state, capitalized: true })} is ${destroyed ? 'destroyed' : 'killed'}!`);
            }
            await finishScatteredMonsterDeath(monster, monster.mx, monster.my, {
                showKillMessage: false,
            }, state, options);
            if (state.program_state.gameover)
                return true;
        }
    }
    if (monster.mhp > 0 && monsterCanBeBlindedByObject(monster, object.otyp, { state })) {
        if (visible && monster.mcansee) {
            const cause = object.oclass === 17 ? 'venom' : object.otyp === CREAM_PIE ? 'pie' : objectCombatName(object, { state });
            await options.publish(`${monsterName(monster, { state, capitalized: true })} is blinded by the ${cause}.`);
        }
        applyMonsterBlindness(monster, options.rollOne(25) + 20);
    }
    if (monster.mhp > 0 && options.heroCaused)
        await angerAttackedMonster(monster);
    if (!state.program_state.gameover)
        await landAfterMonsterHit(object, node, state, options);
    node.object = null;
    node.stopped = true;
    return true;
}
async function hitHero(node, state, options) {
    requirePlayingGame(state);
    const object = node.object;
    if (!object)
        return false;
    const attack = 8 + (object.spe ?? 0)
        + ((MONSTER_SIZE[heroSpecies(state)] ?? 2) >= 3 ? 1 : 0);
    if (state.multi)
        endVoluntaryMultiTurn(state);
    let damage = rollPhysicalWeaponDamageAgainstHero(object, state, {
        rollOne: options.rollOne, rollDice: options.rollDice,
    });
    if (state.u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    if (object.oclass !== POTION_CLASS) {
        const result = await hitHeroWithObject(object, damage, attack, {
            state, publish: options.publish, rollOne: options.rollOne,
        });
        if (result.hit) {
            node.range -= 3;
            await stopHeroOccupation(state, options.publish);
        }
        return result.hit;
    }
    const name = object.quan > 1 ? objectDescription(object, { state })
        : withIndefiniteArticle(objectCombatName(object, { state }));
    const terse = heroIsBlind(state) || !state.flags.verbose;
    const threshold = state.u.uac + attack;
    const roll = options.rollOne(20);
    if (threshold <= roll) {
        if (terse)
            await options.publish('It misses.');
        else if (threshold <= roll - 2) {
            const subject = name.charAt(0).toUpperCase() + name.slice(1);
            await options.publish(`${subject} ${verbForSubject(name, 'miss')} you.`);
        }
        else
            await options.publish(`You are almost hit by ${name}.`);
        return false;
    }
    const punctuation = damage > 4 ? '!' : '.';
    await options.publish(terse ? `You are hit${punctuation}` : `You are hit by ${name}${punctuation}`);
    await hitHeroWithThrownPotion(object, {
        state, publish: options.publish, random: options.random,
        rollOne: options.rollOne, rollDice: options.rollDice, source: 'propelled',
    });
    node.object = null;
    node.stopped = true;
    node.range -= 3;
    if (!state.program_state.gameover)
        await stopHeroOccupation(state, options.publish);
    return true;
}
async function fractureObject(object, x, y, state, options) {
    const boulder = object.otyp === BOULDER;
    if (!boulder) {
        const statueTrap = state.level?.traps.find(trap => trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP);
        if (statueTrap)
            deleteTrap(statueTrap, state);
    }
    if (squareIsVisible(state, x, y)) {
        const name = capitalizedDefiniteName(objectCombatName(object, { state }), state);
        const verb = boulder ? 'break' : 'crumble';
        const action = objectNameIsPlural(object, state) ? verb : verbForSubject(null, verb);
        await options.publish(`${name} ${action}${boulder ? ' apart' : ''}.`);
    }
    else {
        await publishHeardMessage(boulder ? 'stone breaking.' : 'stone crumbling.', options.publish, state);
    }
    const fractureOptions = { state, random: options.random, publish: options.publish };
    if (boulder)
        await fractureRock(object, x, y, fractureOptions);
    else
        await breakStatue(object, x, y, fractureOptions);
    await placeObject(object, x, y, state);
    if (boulder) {
        // Native scatter() processes all remaining boulders before the debris.
        const nextBoulder = floorPile(state, x, y).find(candidate => candidate.otyp === BOULDER);
        if (nextBoulder) {
            unlinkObject(nextBoulder, state);
            await placeObject(nextBoulder, x, y, state);
        }
    }
    newsym(x, y);
}
async function prepareScatteredObject(object, x, y, state, options) {
    removeFloorObject(object, state);
    if (options.mayFracture
        && (object.otyp === BOULDER || object.otyp === STATUE)
        && options.random(10) !== 0) {
        await fractureObject(object, x, y, state, options);
        return null;
    }
    if (options.mayDestroy) {
        const destructionRoll = options.random(10);
        const fragile = objectMaterial(object.otyp) === GLASS
            || object.otyp === EGG;
        if (destructionRoll === 0 || fragile) {
            // Native scatter() uses breaks(), even during the hero's turn.
            // Combat credit still depends on who caused the scatter.
            const broken = await breakFloorObject(object, {
                state,
                heroCaused: false,
                publish: options.publish,
                random: options.random,
                rollDice: options.rollDice,
            });
            if (broken.destroyed)
                return null;
            // A fatal vapor or oil blast ends the scatter even though the
            // bottle itself reports not destroyed.
            if (state.program_state?.gameover)
                return null;
        }
    }
    const direction = DIRECTIONS[options.random(DIRECTIONS.length)];
    if (!direction)
        throw new RangeError('Scattering selected an invalid direction.');
    const maximumRange = Math.max(1, options.force - Math.trunc((object.owt ?? 1) / 40));
    return {
        object,
        x,
        y,
        dx: direction.dx,
        dy: direction.dy,
        range: options.rollOne(maximumRange),
        stopped: false,
    };
}
function nextObjectFromPile(pile, state, options) {
    const object = options.onlyObject || pile[0];
    if (!object || !options.onlyObject && !pile.includes(object))
        return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1)
        return { object, lastPiece: true };
    const part = splitObjectStack(object, options.rollOne(Math.min(quantity - 1, LARGEST_INT)), state);
    if (!part)
        throw new Error(`Cannot split scattered object ${object.o_id}.`);
    return { object: part, lastPiece: false };
}
export async function scatterFloorObjects(x, y, force, { state = game, onlyObject = null, mayDestroy = true, mayFracture = true, mayHitHero = true, mayHitMonsters = true, heroCaused = false, publish = async () => { }, random = rn2, rollOne = rnd, rollDice = d, finishMonsterDeath = null, finishMonsterKill = null, } = {}) {
    requireLiveGame(state);
    const options = {
        state, onlyObject, force, mayDestroy, mayFracture,
        mayHitHero, mayHitMonsters, heroCaused, publish,
        random, rollOne, rollDice, finishMonsterDeath, finishMonsterKill,
    };
    const shop = costlySpot(x, y, state)?.resident;
    const creditBefore = shop?.eshk.credit ?? 0;
    const debitBefore = shop?.eshk.debit ?? 0;
    const loanBefore = shop?.eshk.loan ?? 0;
    let lostGoods = false;
    const nodes = [];
    const pile = floorPile(state, x, y);
    while (onlyObject || pile.length) {
        const candidate = onlyObject || pile[0];
        const chain = state.uchain || state.u.uchain;
        if (candidate && (candidate === chain || candidate === (state.uball || state.u.uball))) {
            await publish('The chain shatters!');
            await unpunishHero(state);
            if (candidate === chain) {
                if (onlyObject)
                    break;
                continue;
            }
        }
        const next = nextObjectFromPile(pile, state, options);
        if (!next)
            break;
        const node = await prepareScatteredObject(next.object, x, y, state, options);
        if (state.program_state.gameover)
            return 0;
        if (node)
            nodes.push(node);
        if (onlyObject && next.lastPiece)
            break;
    }
    let farthest = nodes.reduce((maximum, node) => Math.max(maximum, node.range), 0);
    while (farthest-- > 0) {
        for (const node of nodes) {
            if (node.stopped || node.range-- <= 0 || !node.object)
                continue;
            const nextX = node.x + node.dx;
            const nextY = node.y + node.dy;
            if (!openFlightSquare(state, nextX, nextY)) {
                node.stopped = true;
                continue;
            }
            node.x = nextX;
            node.y = nextY;
            state._thrownObject = node.object;
            state.bhitpos = { x: nextX, y: nextY };
            const monster = monsterAt(state, nextX, nextY);
            if (monster) {
                if (mayHitMonsters) {
                    node.range--;
                    await hitMonster(monster, node, state, options);
                }
            }
            else if (state.u?.ux === nextX && state.u?.uy === nextY
                && mayHitHero) {
                await hitHero(node, state, options);
            }
            if (state.program_state?.gameover)
                return 0;
            if (state.level?.at(nextX, nextY)?.typ === SINK)
                node.stopped = true;
            state._thrownObject = null;
        }
    }
    let moved = 0;
    for (const node of nodes) {
        if (!node.object) {
            newsym(node.x, node.y);
            continue;
        }
        const quantity = node.object.quan ?? node.object.quantity ?? 1;
        const object = node.object;
        const effect = await applyFloorEffects(object, node.x, node.y, {
            state, publish, random, verb: 'land',
        });
        if (!effect.finished) {
            const heroRoom = roomsAt(state.level, state.u.ux, state.u.uy, SHOPBASE)[0];
            if (shop && object.otyp === GOLD_PIECE && !costlySpot(node.x, node.y, state)
                && heroRoom !== undefined && state.u.urooms?.includes(heroRoom)) {
                await addShopObjectToBill(object, state, { ininv: false, silent: true, publish });
                lostGoods = true;
            }
            await placeObject(object, node.x, node.y, state);
            await stack_object(object, state);
        }
        if (node.x !== x || node.y !== y)
            moved += quantity;
        newsym(node.x, node.y);
    }
    newsym(x, y);
    if (state.u.ux === x && state.u.uy === y && state.u.uundetected
        && ((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & 0x80))
        hideHeroUnder(state);
    const originMonster = monsterAt(state, x, y);
    if (originMonster?.mtrapped)
        originMonster.mtrapped = 0;
    maybeUnhideAt(x, y, state);
    if (lostGoods && shop) {
        const creditUsed = creditBefore - (shop.eshk.credit ?? 0);
        const debitAdded = (shop.eshk.debit ?? 0) - debitBefore;
        const loanAdded = (shop.eshk.loan ?? 0) - loanBefore;
        const amount = creditUsed > 0 ? creditUsed : debitAdded > 0 ? debitAdded : loanAdded;
        if (amount > 0)
            await publish(`Your ${creditUsed > 0
                ? 'credit has been reduced' : 'debt has increased'} by ${amount} ${currency(amount, { state })}.`);
    }
    return moved;
}
//# sourceMappingURL=scatter.js.map