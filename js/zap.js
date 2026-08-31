// Ray attacks and elemental damage to carried objects.
// C ref: zap.c dobuzz(), zhitm(), zhitu(), and destroy_items().

import { findArmorClass } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import {
    COLNO, DOOR, D_CLOSED, D_LOCKED, IS_ROOM, ROWNO, STONE,
    STRAT_WAITMASK, Upolyd, W_RING, ZAP_POS,
} from './const.js';
import {
    canProjectMonster, flush_screen, lastDirtyMapCursor, newsym,
    plineWithContinuation, shieldeff, show_glyph_cell,
} from './display.js';
import { game } from './gstate.js';
import { igniteInventoryItems } from './light.js';
import { makePlural } from './object_grammar.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE,
    MONSTER_NAME, MONSTER_RESISTS,
} from './monster_data.js';
import {
    AMULET_OF_REFLECTION, DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME,
    OBJECT_CHARGED, OBJECT_MATERIAL, OBJECT_NAMES, POT_OIL,
    RIN_PROTECTION, RIN_REGENERATION, RIN_SHOCK_RESISTANCE, SCR_FIRE,
    SHIELD_OF_REFLECTION, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL,
    WAN_LIGHTNING,
} from './object_data.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import {
    OBJECT_TIMER_KIND, stopObjectTimer,
} from './object_timers.js';
import { applySupportedPotionVapor } from './potion_hit.js';
import { d, rn2, rnd } from './rng.js';
import { CLR_ORANGE, CLR_WHITE } from './terminal.js';
import { burnArmorByFire, burnHeroArmorByFire } from './trap.js';
import { cansee } from './vision.js';

const RING_CLASS = 4;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const MAX_ITEMS_DESTROYED = 20;
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});

export function rayPositionIsValid(x, y) {
    return x >= 1 && x < COLNO && y >= 0 && y < ROWNO;
}

export function closedRayDoor(location) {
    return location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

export function rayPositionIsOpen(x, y, state = game) {
    if (!rayPositionIsValid(x, y)) return false;
    const location = state.level?.at(x, y);
    return !!location && ZAP_POS(location.typ) && !closedRayDoor(location);
}

export function rayMonsterAt(x, y, state = game) {
    return state.level?.monsters?.find(monster => (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

export async function captureRayTraversalFrame(state = game) {
    const frameCursor = lastDirtyMapCursor();
    const messageCursor = state._pending_message
        ? [state._pending_message.length, 0] : null;
    await flush_screen(1);
    if (frameCursor)
        state.nhDisplay?.setCursor(...frameCursor);
    else if (messageCursor)
        state.nhDisplay?.setCursor(...messageCursor);
    await state.animationFrame?.();
}

export function rayHitsMonster(monster, random = rn2, rollOne = rnd) {
    const armorClass = Number.isFinite(monster.mac) ? monster.mac
        : Number.isFinite(monster.ac) ? monster.ac
            : MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10;
    const chance = random(20);
    if (!chance) return rollOne(10) < armorClass;
    const effectiveArmorClass = armorClass >= 0
        ? armorClass : -rollOne(-armorClass);
    return 3 - chance < effectiveArmorClass;
}

export function rayHitsHero(
    state = game, random = rn2, rollOne = rnd,
) {
    const armorClass = Number.isFinite(state.u?.uac) ? state.u.uac : 10;
    const chance = random(20);
    if (!chance) return rollOne(10) < armorClass;
    const effectiveArmorClass = armorClass >= 0
        ? armorClass : -rollOne(-armorClass);
    return 3 - chance < effectiveArmorClass;
}

export function heroReflectionSource(state = game) {
    if (state.uarms?.otyp === SHIELD_OF_REFLECTION)
        return { object: state.uarms, noun: 'shield' };
    const amulet = state.uamul || state.u?.uamul;
    if (amulet?.otyp === AMULET_OF_REFLECTION)
        return { object: amulet, noun: 'medallion' };
    return null;
}

export function heroReflectsRay(state = game) {
    return !!(state.u?.reflecting || state.reflecting
        || heroReflectionSource(state));
}

export function discoverHeroReflectionSource(
    source = heroReflectionSource(), state = game,
) {
    const object = source?.object;
    if (!object || state._knownObjectTypes?.has(object.otyp)) return;
    exerciseAttribute(4, true, state);
    recordObjectKnowledge(object.otyp, state);
    object.typeKnown = true;
}

export function discoverReflectingShield(state = game) {
    const shield = state.uarms;
    if (!shield || shield.otyp !== SHIELD_OF_REFLECTION) return;
    discoverHeroReflectionSource({ object: shield, noun: 'shield' }, state);
}

export function rayBounceDirection(
    x, y, dx, dy, bounceback, state = game, random = rn2,
) {
    if (!dx || !dy || (bounceback > 0 && random(bounceback) === 0))
        return { dx: -dx, dy: -dy };

    const previousX = x - dx;
    const previousY = y - dy;
    let bounce = 0;
    const vertical = state.level?.at(x, previousY);
    if (rayPositionIsOpen(x, previousY, state)
        && (IS_ROOM(vertical.typ)
            || rayPositionIsOpen(x + dx, previousY, state))) {
        bounce = 1;
    }
    const horizontal = state.level?.at(previousX, y);
    if (rayPositionIsOpen(previousX, y, state)
        && (IS_ROOM(horizontal.typ)
            || rayPositionIsOpen(previousX, y + dy, state))
        && (!bounce || random(2))) {
        bounce = 2;
    }
    if (bounce === 2) return { dx: -dx, dy };
    if (bounce === 1) return { dx, dy: -dy };
    return { dx: -dx, dy: -dy };
}

function monsterHasElementalResistance(monster, mask, explicit) {
    return !!((MONSTER_RESISTS[monster?.mnum] || 0) & mask)
        || !!monster?.[explicit];
}

function monsterResistsWandDamage(monster, random, rollOne) {
    const attackLevel = 12;
    const defenseLevel = Math.max(1, Math.min(
        50, monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 1,
    ));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return random(100 + attackLevel - defenseLevel) < magicResistance;
}

export async function coldRayDamageMonster(
    monster,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
    } = {},
) {
    if (monsterHasElementalResistance(
        monster, MR_COLD, 'defendedCold',
    )) {
        await shieldeff(monster.mx, monster.my, state);
        return { damage: 0, resisted: true };
    }

    let damage = rollDice(6, 6);
    const sourceDamage = damage;
    if (monsterHasElementalResistance(monster, MR_FIRE, 'defendedFire'))
        damage += rollDice(6, 3);
    if (random(3) === 0) {
        damage += await destroyColdMonsterInventory(monster, sourceDamage, {
            carrierName: MONSTER_NAME[monster.mnum] || 'monster',
            publish,
            random,
            rollOne,
            visible: canProjectMonster(monster, monster.mx, monster.my),
        });
    }
    if (damage > 0 && monsterResistsWandDamage(
        monster, random, rollOne,
    )) damage = Math.trunc(damage / 2);
    monster.mhp = (monster.mhp ?? 1) - damage;
    return { damage, resisted: false };
}

export async function fireRayDamageMonster(
    monster,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
    } = {},
) {
    if (monsterHasElementalResistance(
        monster, MR_FIRE, 'defendedFire',
    )) {
        await shieldeff(monster.mx, monster.my, state);
        return { damage: 0, resisted: true };
    }

    let damage = rollDice(6, 6);
    const sourceDamage = damage;
    if (monsterHasElementalResistance(monster, MR_COLD, 'defendedCold'))
        damage += 7;
    const bodyHit = await burnArmorByFire(
        monster, state, publish, [], random,
    );
    if (bodyHit && random(3) === 0) {
        const carrierName = MONSTER_NAME[monster.mnum] || 'monster';
        damage += await destroyFireMonsterInventory(
            monster, sourceDamage, {
                carrierName,
                publish,
                random,
                rollOne,
                visible: canProjectMonster(monster, monster.mx, monster.my),
            },
        );
        await igniteInventoryItems(monster.minvent || monster.inventory, {
            carrierName,
            state,
            publish,
            random,
            visible: canProjectMonster(monster, monster.mx, monster.my),
        });
    }
    if (damage > 0 && monsterResistsWandDamage(
        monster, random, rollOne,
    )) damage = Math.trunc(damage / 2);
    monster.mhp = (monster.mhp ?? 1) - damage;
    return { damage, resisted: false };
}

function paintRayCell(cells, x, y, dx, dy, color) {
    cells.set(`${x},${y}`, { x, y });
    if (dy === 0) show_glyph_cell(x, y, 'q', color, true);
    else if (dx === 0) show_glyph_cell(x, y, 'x', color, true);
    else show_glyph_cell(x, y, dx === dy ? '\\' : '/', color, false);
}

function clearRayCells(cells) {
    for (const cell of cells.values()) newsym(cell.x, cell.y);
}

export async function zapColdRay(
    direction,
    { finishMonsterKill } = {},
) {
    exerciseAttribute(2, true);
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    const beamCells = new Map();

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                paintRayCell(beamCells, x, y, dx, dy, CLR_WHITE);
                await captureRayTraversalFrame();
            }

            const monster = rayMonsterAt(x, y);
            if (monster) {
                monster.mstrategy = (monster.mstrategy || 0)
                    & ~STRAT_WAITMASK;
                if (rayHitsMonster(monster)) {
                    if (monster.reflecting) {
                        dx = -dx;
                        dy = -dy;
                    } else {
                        const { damage } = await coldRayDamageMonster(monster);
                        const name = MONSTER_NAME[monster.mnum] || 'monster';
                        if ((monster.mhp ?? 0) <= 0) {
                            await finishMonsterKill?.(monster, x, y, {
                                weaponHit: false,
                            });
                        } else {
                            if (canProjectMonster(monster, x, y)) {
                                await plineWithContinuation(
                                    `The bolt of cold hits the ${name}${
                                        damage <= 4 ? '.' : '!'
                                    }`,
                                );
                            }
                            monster.msleeping = 0;
                        }
                    }
                    range -= 2;
                } else if (cansee(x, y)) {
                    const name = MONSTER_NAME[monster.mnum] || 'monster';
                    await plineWithContinuation(
                        `The bolt of cold misses the ${name}.`,
                    );
                }
            } else if (x === game.u.ux && y === game.u.uy && range >= 0) {
                if (rayHitsHero()) {
                    range -= 2;
                    await plineWithContinuation('The bolt of cold hits you!');
                    const reflectionSource = heroReflectionSource();
                    if (heroReflectsRay()) {
                        await plineWithContinuation(
                            `But it reflects from your ${
                                reflectionSource?.noun || 'shield'
                            }!`,
                        );
                        await shieldeff(game.u.ux, game.u.uy);
                        if (reflectionSource)
                            discoverHeroReflectionSource(reflectionSource);
                        dx = -dx;
                        dy = -dy;
                    } else {
                        const damage = d(6, 6);
                        const coldResistant = !!(game.u?.coldResistance
                            || game.u?.cold_resistance);
                        if (coldResistant) {
                            await shieldeff(game.u.ux, game.u.uy);
                            await plineWithContinuation(
                                "You don't feel cold.",
                            );
                        }
                        if (rn2(3) === 0)
                            await destroyColdInventory(damage);
                        let appliedDamage = coldResistant ? 0 : damage;
                        if (appliedDamage
                            && (game.u?.halfSpellDamage
                                || game.u?.half_spell_damage)) {
                            appliedDamage = Math.trunc(
                                (appliedDamage + 1) / 2,
                            );
                        }
                        game.u.uhp = Math.max(
                            0, (game.u.uhp || 0) - appliedDamage,
                        );
                        if (game.u.uhp <= 0) return { heroDied: true };
                    }
                } else if (cansee(x, y)) {
                    await plineWithContinuation(
                        'The bolt of cold whizzes by you!',
                    );
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The bolt of cold bounces!');
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }

    clearRayCells(beamCells);
    return { heroDied: false };
}

export async function zapFireRay(
    direction,
    { finishMonsterKill } = {},
) {
    exerciseAttribute(2, true);
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    const beamCells = new Map();

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                paintRayCell(beamCells, x, y, dx, dy, CLR_ORANGE);
            }
            await captureRayTraversalFrame();

            const monster = rayMonsterAt(x, y);
            if (monster) {
                monster.mstrategy = (monster.mstrategy || 0)
                    & ~STRAT_WAITMASK;
                if (rayHitsMonster(monster)) {
                    if (monster.reflecting) {
                        dx = -dx;
                        dy = -dy;
                    } else {
                        const { damage } = await fireRayDamageMonster(monster);
                        const name = MONSTER_NAME[monster.mnum] || 'monster';
                        if ((monster.mhp ?? 0) <= 0) {
                            await finishMonsterKill?.(monster, x, y, {
                                weaponHit: false,
                                noCorpse: [PM_STRAW_GOLEM, PM_PAPER_GOLEM]
                                    .includes(monster.mnum),
                            });
                        } else {
                            if (canProjectMonster(monster, x, y)) {
                                await plineWithContinuation(
                                    `The bolt of fire hits the ${name}${
                                        damage <= 4 ? '.' : '!'
                                    }`,
                                );
                            }
                            monster.msleeping = 0;
                        }
                    }
                    range -= 2;
                } else if (cansee(x, y)) {
                    const name = MONSTER_NAME[monster.mnum] || 'monster';
                    await plineWithContinuation(
                        `The bolt of fire misses the ${name}.`,
                    );
                }
            } else if (x === game.u.ux && y === game.u.uy && range >= 0
                && rayHitsHero()) {
                range -= 2;
                await plineWithContinuation('The bolt of fire hits you!');
                const reflectionSource = heroReflectionSource();
                if (heroReflectsRay()) {
                    await plineWithContinuation(
                        `But it reflects from your ${
                            reflectionSource?.noun || 'shield'
                        }!`,
                    );
                    await shieldeff(game.u.ux, game.u.uy);
                    if (reflectionSource)
                        discoverHeroReflectionSource(reflectionSource);
                    dx = -dx;
                    dy = -dy;
                } else {
                    const damage = d(6, 6);
                    const fireResistant = !!(game.u?.fireResistance
                        || game.u?.fire_resistance);
                    if (fireResistant) {
                        await shieldeff(game.u.ux, game.u.uy);
                        await plineWithContinuation("You don't feel hot!");
                    }
                    if ((game.u?.slimedTurns ?? 0) > 0 || game.u?.slimed) {
                        game.u.slimedTurns = 0;
                        game.u.slimed = false;
                        await plineWithContinuation(
                            'The slime that covers you is burned away!',
                        );
                    }
                    const bodyHit = await burnHeroArmorByFire(
                        game, plineWithContinuation, [], rn2,
                    );
                    if (bodyHit) {
                        if (rn2(3) === 0)
                            await destroyFireInventory(damage);
                        if (rn2(3) === 0) {
                            await igniteInventoryItems(game.inventory, {
                                state: game,
                                publish: plineWithContinuation,
                            });
                        }
                    }

                    let appliedDamage = fireResistant ? 0 : damage;
                    if (appliedDamage
                        && (game.u?.halfSpellDamage
                            || game.u?.half_spell_damage)) {
                        appliedDamage = Math.trunc(
                            (appliedDamage + 1) / 2,
                        );
                    }
                    game.u.uhp = Math.max(
                        0, (game.u.uhp || 0) - appliedDamage,
                    );
                    if (game.u.uhp <= 0) return { heroDied: true };
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The bolt of fire bounces!');
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }

    clearRayCells(beamCells);
    return { heroDied: false };
}

function objectClass(object) {
    if (Number.isInteger(object?.oclass)) return object.oclass;
    return {
        Rings: RING_CLASS,
        Potions: POTION_CLASS,
        Scrolls: SCROLL_CLASS,
        Spellbooks: SPBOOK_CLASS,
        Wands: WAND_CLASS,
    }[object?.class] ?? 0;
}

function destroyable(object, damageType) {
    if (!object || object.artifact || object.oartifact) return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1) return false;
    const itemClass = objectClass(object);
    if (damageType === INVENTORY_DAMAGE.FIRE) {
        if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp)) return false;
        return object.otyp === GLOB_OF_GREEN_SLIME
            || [POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS]
                .includes(itemClass);
    }
    if (damageType === INVENTORY_DAMAGE.COLD)
        return itemClass === POTION_CLASS && object.otyp !== POT_OIL;
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        return [RING_CLASS, WAND_CLASS].includes(itemClass)
            && ![RIN_SHOCK_RESISTANCE, WAN_LIGHTNING]
                .includes(object.otyp);
    }
    return false;
}

function protectionChance(state, damageType) {
    const hero = state.u || {};
    const property = {
        [INVENTORY_DAMAGE.COLD]: 'coldResistance',
        [INVENTORY_DAMAGE.FIRE]: 'fireResistance',
        [INVENTORY_DAMAGE.ELECTRIC]: 'shockResistance',
    }[damageType];
    const source = hero._propertySources?.[property];
    const snakeProperty = property.replace(
        /[A-Z]/gu, letter => `_${letter.toLowerCase()}`,
    );
    if (hero[`${property}FromArmor`]
        || hero[`${snakeProperty}_from_armor`]
        || ['worn', 'wielded', 'accessory', 'artifact']
            .includes(source?.kind)) return 99;
    const cloak = state.uarmc || hero.uarmc;
    return damageType !== INVENTORY_DAMAGE.ELECTRIC
        && cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}

function heroResists(state, damageType) {
    const hero = state.u || {};
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return !!(hero.fireResistance || hero.fire_resistance);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return !!(hero.shockResistance || hero.shock_resistance);
    return false;
}

function isWornRing(object, state) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}

function glovesBlockRingShock(object, state) {
    if (!isWornRing(object, state)) return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves) return false;
    const material = OBJECT_MATERIAL[gloves.otyp] ?? 0;
    return material < 11 || material > 17;
}

function clearWornRing(object, state) {
    for (const slot of ['uleft', 'uright']) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    object.owornmask = (object.owornmask ?? 0) & ~W_RING;
    object.worn = false;
    object.wornSlot = null;
    if (object.otyp === RIN_REGENERATION) {
        const otherRing = state.uleft || state.uright
            || state.u?.uleft || state.u?.uright;
        if (otherRing?.otyp !== RIN_REGENERATION) {
            state.u.regenerationExtrinsic = false;
            state.u.regeneration = false;
        }
    }
    findArmorClass(state);
}

function removeDestroyedQuantity(state, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        return;
    }
    if (isWornRing(object, state)) clearWornRing(object, state);
    const index = state.inventory?.indexOf(object) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    if (state.uwep === object) state.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    object.lamplit = false;
    object.where = 'gone';
    object.ox = object.oy = 0;
}

function className(object) {
    const name = object.name || OBJECT_NAMES[object.otyp] || 'item';
    const itemClass = objectClass(object);
    if (itemClass === POTION_CLASS && !/\bpotion\b/u.test(name))
        return `potion of ${name}`;
    if (itemClass === SCROLL_CLASS && !/\bscroll\b/u.test(name))
        return `scroll of ${name}`;
    if (itemClass === SPBOOK_CLASS && !/\bspellbook\b/u.test(name))
        return `spellbook of ${name}`;
    if (itemClass === RING_CLASS && !/\bring\b/u.test(name))
        return `ring of ${name}`;
    if (itemClass === WAND_CLASS && !/\bwand\b/u.test(name))
        return `wand of ${name}`;
    return name;
}

function destructionMessage(
    object, damageType, count, quantity, carrierName = null,
) {
    const one = count === 1;
    const prefix = carrierName
        ? one && quantity === 1 ? `The ${carrierName}'s `
            : one ? `One of the ${carrierName}'s `
                : count < quantity ? `Some of the ${carrierName}'s `
                    : quantity === 2 ? `Both of the ${carrierName}'s `
                        : `All of the ${carrierName}'s `
        : one && quantity === 1 ? 'Your '
            : one ? 'One of your '
                : count < quantity ? 'Some of your '
                    : quantity === 2 ? 'Both of your ' : 'All of your ';
    const singular = className(object);
    const name = one && quantity === 1 ? singular : makePlural(singular);
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${
            one ? 'freezes and shatters' : 'freeze and shatter'
        }!`;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        const wand = objectClass(object) === WAND_CLASS;
        return `${prefix}${name} ${wand
            ? 'breaks apart and explodes'
            : 'turns to dust and vanishes'}!`;
    }
    if (objectClass(object) === POTION_CLASS) {
        const verb = object.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}

function damageHero(state, amount) {
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(
        0, (state.u[hitPoints] ?? 1) - amount,
    );
}

async function rechargeRing(object, state, publish, random, rollOne) {
    if (!OBJECT_CHARGED[object.otyp] || random(3) === 0) return null;
    const enchantment = object.spe ?? object.enchantment ?? 0;
    if (enchantment > random(7) || enchantment <= -5) {
        await publish(
            `Your ${className(object)} pulsates momentarily, then explodes!`,
        );
        removeDestroyedQuantity(
            state, object, object.quan ?? object.quantity ?? 1,
        );
        let damage = rollOne(3 * Math.abs(enchantment));
        if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
            damage = Math.trunc((damage + 1) / 2);
        damageHero(state, damage);
        return damage;
    }
    await publish(`Your ${className(object)} spins clockwise for a moment.`);
    object.spe = enchantment + 1;
    object.enchantment = object.spe;
    if (object.otyp === RIN_PROTECTION) findArmorClass(state);
    return 0;
}

function itemDamage(object, damageType, rollOne) {
    if (damageType === INVENTORY_DAMAGE.COLD) return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return objectClass(object) === WAND_CLASS ? rollOne(10) : 0;
    if (objectClass(object) === POTION_CLASS) return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}

async function destroyChosenItem(
    state,
    object,
    damageType,
    publish,
    random,
    rollOne,
) {
    const protection = protectionChance(state, damageType);
    if (protection && random(100) < protection) return 0;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
        if (!blind) {
            await publish(
                'The Book of the Dead glows a strange dark red, but remains intact.',
            );
        }
        return 0;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && objectClass(object) === RING_CLASS) {
        if (glovesBlockRingShock(object, state)) return 0;
        const rechargeDamage = await rechargeRing(
            object, state, publish, random, rollOne,
        );
        if (rechargeDamage !== null) return rechargeDamage;
    }

    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = itemDamage(object, damageType, rollOne);
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0) destroyed++;
    }
    if (!destroyed) return 0;

    await publish(destructionMessage(
        object, damageType, destroyed, quantity,
    ));
    if (damageType === INVENTORY_DAMAGE.FIRE
        && objectClass(object) === POTION_CLASS) {
        await applySupportedPotionVapor({
            state,
            potion: object,
            publish,
        });
    }
    removeDestroyedQuantity(state, object, destroyed);

    if (!damage) return 0;
    const resistant = heroResists(state, damageType);
    const resistanceStopsDamage
        = damageType === INVENTORY_DAMAGE.ELECTRIC
            ? objectClass(object) !== RING_CLASS
            : damageType === INVENTORY_DAMAGE.FIRE
                && objectClass(object) !== POTION_CLASS
                && object.otyp !== GLOB_OF_GREEN_SLIME;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return 0;
    }
    damageHero(state, damage);
    exerciseAttribute(0, false, state);
    return damage;
}

export async function destroyInventoryByElement(
    damageType,
    sourceDamage,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    if (!Object.values(INVENTORY_DAMAGE).includes(damageType)) return 0;
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;

    const chosen = chooseStacks(
        state.inventory || [], damageType, limit, random,
    );

    let damage = 0;
    for (const object of chosen) {
        if (object && state.inventory?.includes(object)) {
            damage += await destroyChosenItem(
                state, object, damageType, publish, random, rollOne,
            );
        }
    }
    return damage;
}

function destructionLimit(sourceDamage, random) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5)) limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}

function chooseStacks(objects, damageType, limit, random) {
    const chosen = Array(limit).fill(null);
    let eligible = 0;
    for (const object of objects) {
        if (!destroyable(object, damageType)) continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit) chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit));
}

function removeMonsterQuantity(monster, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    object.quan = remaining;
    object.quantity = remaining;
    if (remaining > 0) return;
    const inventory = (monster.minvent || monster.inventory || [])
        .filter(candidate => candidate !== object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    object.lamplit = false;
    object.where = 'gone';
    object.ocarry = null;
}

export async function destroyMonsterInventoryByElement(
    monster,
    damageType,
    sourceDamage,
    {
        carrierName = 'monster',
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        visible = false,
    } = {},
) {
    if (![INVENTORY_DAMAGE.COLD, INVENTORY_DAMAGE.FIRE]
        .includes(damageType)) return 0;
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(
        inventory, damageType, limit, random,
    );
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object)) continue;
        if (damageType === INVENTORY_DAMAGE.FIRE
            && object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                await publish(
                    `The ${carrierName}'s Book of the Dead glows a strange dark red, but remains intact.`,
                );
            }
            continue;
        }
        const stackDamage = itemDamage(object, damageType, rollOne);
        const total = object.quan ?? object.quantity ?? 1;
        const quantity = Math.max(0, total - Number(!!object.in_use));
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        if (visible) {
            await publish(destructionMessage(
                object, damageType, destroyed, quantity,
                carrierName,
            ));
        }
        removeMonsterQuantity(monster, object, destroyed);
        damage += stackDamage;
    }
    return damage;
}

export function destroyColdMonsterInventory(
    monster, sourceDamage, options,
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyFireMonsterInventory(
    monster, sourceDamage, options,
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyFireInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyColdInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyElectricInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options,
    );
}
