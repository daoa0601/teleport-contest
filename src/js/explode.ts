// C explode.c:explode(), scatter(), explode_oil() and splatter_burning_oil().
// Floor and monster effects precede damage to the hero; scattered floor
// objects fly outward from the blast or a collapsing structure.

import { WEAPON_CLASS, RING_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, VENOM_CLASS, RANDOM_CLASS } from './objclass.js';
import {
    objectBaseDirection, POT_OIL, SCR_FIRE, WAN_DIGGING, WAN_MAGIC_MISSILE, WAN_SLEEP,
    ACID_VENOM, BLINDING_VENOM, BOULDER, CREAM_PIE, EGG, GOLD_PIECE, STATUE,
} from './object_data.js';
import { monsterHasMagicResistance } from './mondata.js';
import { burnArmorByFire, burnHeroArmorByFire, igniteItems, deleteTrap, petrifyMonsterFromContact } from './trap.js';
import { heroHasArtifactDefense } from './artifact.js';
import { exerciseAttribute } from './attrib.js';
import { A_STR, BURNING, BURNING_OIL, COLNO, DOOR, D_CLOSED, D_LOCKED, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, EXPL_NOXIOUS, LARGEST_INT, LOST_EXPLODING, M_AP_MONSTER, M_AP_TYPE, MON_EXPLODE, PHYS_EXPL_TYPE, ROWNO, SHOPBASE, SINK, STATUE_TRAP, TRAP_EXPLODE, Upolyd, PLNMSG_CAUGHT_IN_EXPLOSION, PLNMSG_TOWER_OF_FLAME, KILLED_BY, KILLED_BY_AN, NO_KILLER_PREFIX, ZAP_POS } from './const.js';
import { canSeeMonster, canSpotMonster, flush_screen, map_invisible, newsym, SHIELD_STATIC, show_glyph_cell, unmap_invisible, explosionGlyph, shieldGlyph, TemporaryMapEffect } from './display.js';
import type { DisplayGlyph } from './display.js';
import { formatHeardMessage, plineWithContinuation, impossible, publishHeardMessage } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler, OrdinaryDeathOptions } from './end.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { burnAwayHeroSlime, endVoluntaryMultiTurn, roomsAt } from './hack.js';
import { heroFormSticks, heroSpecies, applyHeroGolemEffects, returnHeroToHumanForm } from './polyself.js';
import { angerAttackedMonster, applyMonsterGolemEffects, finishMonsterKilled, wakeMonster, revealMonsterAppearance, wakeMonstersNearWithMessages,
    finishHeroMonsterKillOutcome, finishEnvironmentalMonsterDeath, hideHeroUnder, maybeUnhideAt,
    wakeAttackedMonster, finishHeroMonsterKill,
} from './mon.js';
import type { MonsterExplosionOptions, MonsterDeathHandler, HeroMonsterKillOptions, HeroMonsterKillOutcome } from './mon.js';
import { AD_ACID, AD_COLD, AD_DGST, AD_DISE, AD_DISN, AD_DRCO, AD_DREN, AD_DRDX, AD_DRST, AD_ELEC, AD_ENCH, AD_FIRE, AD_MAGM, AD_PEST, AD_PHYS, AD_RBRE, AD_SPEL, AT_ENGL, AT_SPIT, AT_WEAP } from './monster_attack_types.js';
import type { DamageType } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { monsterName, randomDisplayMonsterName, monsterTypeName, displayLiquidName } from './do_name.js';
import { possessiveName, dist2 } from './hacklib.js';
import { monsterAtPosition } from './steed.js';
import { propertyIsActive } from './properties.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { payForShopDamage, addShopObjectToBill, costlySpot } from './shk.js';
import { cansee } from './vision.js';
import { applyRayFloorFeatures, destroyInventoryByElement, destroyMonsterInventoryByElement, monsterResistsEffect, rayDamageType, breakStatue, fractureRock, rayHitMessage, rayMissMessage } from './zap.js';
import type { InventoryDamageType, MagicDamageResult, RayFloorKind } from './zap.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { PropertyName } from './property_types.js';
import type { GameObject } from './object_types.js';

import {
    monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage,
    monsterHasAcidResistance, monsterHasColdResistance, monsterHasDisintegrationResistance,
    monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance, monsterIsDemon,
    monsterIsNonliving, monsterIsVampireShifter, monsterObjectPronoun, monsterHasStoneResistance,
    monsterHatesSilver, monsterHidesUnder, monsterIsAmorphous, monsterIsBig, monsterIsNoncorporeal,
    passes_rocks, touchPetrifies, canBlnd,
} from './mondata.js';
import { currency, delobj, stack_object } from './invent.js';
import { isok } from './cmd.js';
import { applyFloorEffects } from './do.js';
import { unlinkObject, placeObject, splitObjectStack } from './mkobj.js';
import type { Position } from './map_types.js';
import type { PotionHitOptions } from './potion.js';
import { hitMonsterWithSupportedPotion } from './potion.js';
import { applyMonsterBlindness } from './blinding_attack.js';
import { applyMonsterPassiveToObject } from './uhitm.js';
import { captureHeroProjectileName, verbForSubject, withIndefiniteArticle, objectCombatName, objectNameIsPlural, capitalizedDefiniteName } from './objnam.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { stopHeroOccupation } from './allmain.js';
import { unpunishHero } from './read.js';
import { findMonsterArmorClass } from './worn.js';
import { observeObject, objectMaterial } from './o_init.js';
import { shipObject } from './dokick.js';
import { isPoisonableObject } from './object_properties.js';
import { shouldMulchMissile, breakFloorObject, rangedTargetHitBonus } from './dothrow.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { endObjectBurn } from './timeout.js';

export interface ExplosionOptions {
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
    killer?: string | null;
    heroCaused?: boolean;
    random?: typeof rn2;
}
interface ExplosionKind {
    name: string;
    floor: RayFloorKind;
    items?: InventoryDamageType;
    property?: PropertyName;
    defense?: 'magic' | 'fire' | 'cold' | 'shock' | 'poison';
    resists: (monster: Monster) => boolean;
}
interface ExplosionSource {
    type: number;
    damageType: DamageType;
    heroDamage: number;
    name: string;
    floor: RayFloorKind;
    floorNoun: 'blast' | 'spell' | 'bolt';
    explodingObject: number;
}
interface ExplosionCell {
    x: number;
    y: number;
    shield: number;
    glyph: DisplayGlyph;
}
interface ExplosionMonsterDeathOptions {
    damageType: DamageType;
    state: PlayingGameState;
    publish: MessagePublisher;
    heroCaused: boolean;
    creditedMonster: Monster | null;
    burnsCompletely: boolean;
    random: typeof rn2;
}

const RAY = 3;
const resistanceLevels = new Map([
    [WAND_CLASS, 12], [TOOL_CLASS, 10], [WEAPON_CLASS, 10],
    [SCROLL_CLASS, 9], [POTION_CLASS, 6], [RING_CLASS, 5],
]);
const damageKinds = new Map<DamageType, ExplosionKind>([
    [AD_MAGM, {
        name: 'magical blast', floor: 'magic', property: 'antimagic',
        defense: 'magic', resists: monsterHasMagicResistance,
    }],
    [AD_FIRE, {
        name: 'fireball', floor: 'fire', items: 'fire', property: 'fireResistance',
        defense: 'fire', resists: monsterHasFireResistance,
    }],
    [AD_COLD, {
        name: 'ball of cold', floor: 'cold', items: 'cold', property: 'coldResistance',
        defense: 'cold', resists: monsterHasColdResistance,
    }],
    [AD_DISN, {
        name: 'disintegration field', floor: 'disintegration',
        property: 'disintegrationResistance', resists: monsterHasDisintegrationResistance,
    }],
    [AD_ELEC, {
        name: 'ball of lightning', floor: 'lightning', items: 'electric',
        property: 'shockResistance', defense: 'shock', resists: monsterHasShockResistance,
    }],
    [AD_DRST, {
        name: 'poison gas cloud', floor: 'poison', property: 'poisonResistance',
        defense: 'poison', resists: monsterHasPoisonResistance,
    }],
    [AD_ACID, {
        name: 'splash of acid', floor: 'acid', property: 'acidResistance',
        resists: monsterHasAcidResistance,
    }],
    [AD_PHYS, { name: 'explosion', floor: null, resists: () => false }],
]);

const explosionStyles = new Map<DamageType, number>([
    [AD_ELEC, EXPL_MAGICAL], [AD_SPEL, EXPL_MAGICAL],
    [AD_DREN, EXPL_MAGICAL], [AD_ENCH, EXPL_MAGICAL],
    [AD_FIRE, EXPL_FIERY], [AD_COLD, EXPL_FROSTY],
    [AD_DRST, EXPL_NOXIOUS], [AD_DRDX, EXPL_NOXIOUS],
    [AD_DRCO, EXPL_NOXIOUS], [AD_DISE, EXPL_NOXIOUS],
    [AD_PEST, EXPL_NOXIOUS], [AD_PHYS, EXPL_NOXIOUS],
]);

// C explode.c:explode(). The whole explosion: source naming, the 3x3
// mask, the visual, floor and monster damage, and the hero's injury.
// A negative type is a monster zap, except that WAND_CLASS uses -otyp.
export async function explode(x: number, y: number, type: number, damage: number, objectClass: number, style: number, {
    state = game, publish = plineWithContinuation, die = finishHeroDeath,
    killer = null, heroCaused = !state.context.mon_moving, random = rn2,
}: ExplosionOptions = {}): Promise<MagicDamageResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const source = await explosionSource(type, damage, objectClass, state);
    if (!source) return { damage, heroDied: false };
    type = source.type;
    let damageType = source.damageType;
    const creditedMonster = style < 0 ? monsterAtPosition(state.level, x, y) : null;
    const insideEngulfer = !!state.u.uswallow && type >= 0;
    const held = !state.u.uswallow ? state.u.ustuck : null;
    const grabbing = !!held && Upolyd(state.u) && heroFormSticks(state);
    const grabbed = !!held && !grabbing;
    const grabPosition = held ? { x: held.mx, y: held.my } : null;
    const youExploding = objectClass === MON_EXPLODE && type >= 0;
    const monsterExplosion = objectClass === MON_EXPLODE && !youExploding;
    const hallucinate = monsterExplosion && heroIsHallucinating(state)
        && /(?:'s|s') explosion/i.test(killer || '');
    let description = monsterExplosion ? killer || source.name : source.name;
    const cells = await explosionCells(x, y, damageType, objectClass, Math.abs(style), state);
    const visible = cells.some(cell => cansee(cell.x, cell.y));
    if (visible) {
        await paintExplosion(cells, state);
    }
    else if ([MON_EXPLODE, TRAP_EXPLODE].includes(objectClass)) description = 'explosion';
    if (!heroIsDeaf(state)) {
        const message = visible || objectClass === SCROLL_CLASS
            ? 'Boom!' : formatHeardMessage('a blast.', state);
        if (message) await publish(message);
    }

    let heroHurt = 0;
    let shopDamage = false;
    if (damage) {
        for (const cell of cells) {
            const heroHere = state.u.ux === cell.x && state.u.uy === cell.y;
            if (heroHere) {
                heroHurt = cell.shield & 2 ? 1 : 2;
                if (heroCaused && youExploding) heroHurt = 0;
            } else if (insideEngulfer) continue;

            if (!(state.u.uswallow && heroCaused) && type !== PHYS_EXPL_TYPE) {
                const floor = await applyRayFloorFeatures(source.floor, cell.x, cell.y, state, {
                    rayNoun: source.floorNoun, heroCaused: type >= 0,
                    explodingWand: source.explodingObject, heroBurnsObjects: type > 0, publish, random,
                });
                shopDamage ||= !!floor.shopDamage;
                if (state.program_state.gameover) return { damage, heroDied: true };
                const target = monsterAtPosition(state.level, cell.x, cell.y);
                if (target) {
                    const woken = await wakeMonster(target, { attacked: type >= 0 });
                    if (woken.heroDied || state.program_state.gameover)
                        return { damage, heroDied: true };
                }
            }
            const monster = occupant(cell.x, cell.y, state);
            if (!monster) continue;
            if (hallucinate) description = hallucinatedExplosion(20);
            if (state.u.uswallow && state.u.ustuck === monster)
                await engulferMessage(monster, damageType, objectClass, state, publish);
            else if (cansee(cell.x, cell.y)) {
                if (monster.m_ap_type) await revealMonsterAppearance(monster);
                await publish(`${monsterName(monster, { state, capitalized: true })} is caught in the ${description}!`);
            }
            const seen = canSeeMonster(monster);
            const itemDamage = await destroyMonsterInventoryByElement(
                monster, damageKinds.get(damageType)?.items, damage,
                { state, publish, random, visible: seen },
            );
            if (damageType === AD_FIRE) {
                await burnArmorByFire(monster, state, publish, [], random, { visible: seen });
                await igniteItems(monster.minvent || monster.inventory || [], { state, publish, random, visible: seen });
            }
            if (cell.shield & 1) {
                await applyMonsterGolemEffects(monster, damageType, damage, { state, publish });
                monster.mhp -= itemDamage;
            } else {
                let bodyDamage = damage;
                if (monsterResistsEffect(monster, (resistanceLevels.get(objectClass) ?? state.u.ulevel), random)) {
                    if (cansee(cell.x, cell.y) || insideEngulfer)
                        await publish(`${monsterName(monster, { state, capitalized: true })} resists the ${description}!`);
                    bodyDamage = Math.trunc((damage + 1) / 2);
                }
                if (grabbed && monster === state.u.ustuck
                    && Math.abs(x - state.u.ux) <= 1 && Math.abs(y - state.u.uy) <= 1) bodyDamage *= 2;
                if (damageType === AD_FIRE && monsterHasColdResistance(monster)
                    || damageType === AD_COLD && monsterHasFireResistance(monster)) bodyDamage *= 2;
                monster.mhp -= bodyDamage + itemDamage;
            }
            if (monster.mhp <= 0) {
                const burnsCompletely = damageType === AD_FIRE
                    && ['paper golem', 'straw golem'].includes(MONSTER_NAME[monster.mnum] ?? '');
                const death = await finishExplosionMonsterDeath(monster, {
                    state, publish, heroCaused, creditedMonster, burnsCompletely, random, damageType,
                });
                // Native monkilled receives positive AD_RBRE and still leaves remains.
                // The changed adtyp also affects later targets, unlike the floor type.
                if (!heroCaused && monster !== creditedMonster && burnsCompletely) damageType = AD_RBRE;
                if (death.heroDied || state.program_state.gameover) return { damage, heroDied: true };
            } else if (heroCaused) {
                await angerAttackedMonster(monster);
                if (state.program_state.gameover) return { damage, heroDied: true };
            }
        }
    }

    if (heroHurt) {
        if (state.flags.verbose && (type < 0 || objectClass !== SCROLL_CLASS)) {
            if (hallucinate) description = hallucinatedExplosion();
            await publish(`You are caught in the ${description}!`);
            state._lastPlineKind = PLNMSG_CAUGHT_IN_EXPLOSION;
        }
        if (damageType === AD_FIRE) await burnAwayHeroSlime(state, publish);
        let heroDamage = source.heroDamage;
        if (propertyIsActive('invulnerable', state)) {
            heroDamage = 0;
            await publish('You are unharmed!');
        } else if ([AD_PHYS, AD_ACID].includes(damageType)
            && state.u.halfPhysicalDamage) heroDamage = Math.trunc((heroDamage + 1) / 2);
        if (damageType === AD_FIRE) {
            await burnHeroArmorByFire(state, publish, [], random);
            await igniteItems(state.inventory, { state, publish, random });
        }
        const items = await destroyInventoryByElement(damageKinds.get(damageType)?.items, damage, {
            state, publish, die, random,
        });
        if (items.heroDied) return { damage, heroDied: true };
        await applyHeroGolemEffects(damageType, heroDamage, { state, publish });
        const hpKey = Upolyd(state.u) ? 'mh' : 'uhp';
        const hpBefore = state.u[hpKey];
        if (heroHurt === 2) {
            if (grabbing && grabPosition && (grabPosition.x - x) ** 2 + (grabPosition.y - y) ** 2 <= 2) heroDamage *= 2;
            state.u[hpKey] -= heroDamage;
            state.context.botl = true;
        }
        const observe = heroHurt === 1 ? monstersObserveHeroResistance : monstersForgetHeroResistance;
        observe(seenResistanceForDamage(damageType), state);
        if (state.u.uhp <= 0 || Upolyd(state.u) && state.u.mh <= 0) {
            if (Upolyd(state.u)) {
                if ((await returnHeroToHumanForm(state, { publish, die })).died)
                    return { damage, heroDied: true };
            } else {
                const cause = explosionDeathCause(type, objectClass, description, killer, state);
                const caught = [PLNMSG_CAUGHT_IN_EXPLOSION, PLNMSG_TOWER_OF_FLAME].includes(state._lastPlineKind ?? 0);
                await publish(caught ? 'It is fatal.' : `The ${description} is fatal.`);
                if (await die({ ...cause, deathLineShown: true, deathType: damageType === AD_FIRE ? BURNING : null,
                    damage: { hpKey, hpBefore, damage: heroHurt === 2 ? heroDamage : 0 },
                }))
                    return { damage, heroDied: true };
            }
        }
        await exerciseAttribute(A_STR, false, state);
    }
    if (shopDamage) await payForShopDamage(damageType === AD_FIRE ? 'burn away'
        : damageType === AD_COLD ? 'shatter' : damageType === AD_DISN ? 'disintegrate' : 'destroy', { state });
    if (state.program_state.gameover) return { damage, heroDied: true };
    const noise = Math.max(50, damage * damage);
    await wakeMonstersNearWithMessages(x, y, insideEngulfer ? Math.trunc((noise + 3) / 4) : noise, state, publish);
    return { damage, heroDied: false };
}

// Part of C explode.c:explode(): the olet/type normalization, the role
// damage reduction, and the adstr damage-type names ("burning oil",
// "tower of flame", "death field").
async function explosionSource(type: number, damage: number, objectClass: number, state: PlayingGameState): Promise<ExplosionSource | null> {
    let explodingObject = 0;
    let heroDamage = damage;
    if (objectClass === WAND_CLASS) {
        if (type < 0) {
            explodingObject = -type;
            type = objectBaseDirection(explodingObject) === RAY && ![WAN_DIGGING, WAN_SLEEP].includes(explodingObject)
                ? explodingObject - WAN_MAGIC_MISSILE : 0;
            if (type < 0 || type > 9) {
                await impossible(`explode: wand has bad zap type (${type}).`);
                type = 0;
            }
        }
        const role = state.urole.key;
        if (['priest', 'monk', 'wizard'].includes(role)) heroDamage = Math.trunc(damage / 5);
        else if (['healer', 'knight'].includes(role)) heroDamage = Math.trunc(damage / 2);
    } else if (objectClass === BURNING_OIL) explodingObject = POT_OIL;
    else if (objectClass === SCROLL_CLASS) explodingObject = SCR_FIRE;
    else if (objectClass === TRAP_EXPLODE) type = 0;
    const damageType = type === PHYS_EXPL_TYPE ? AD_PHYS : rayDamageType(type);
    const kind = damageKinds.get(damageType);
    if (!kind) {
        await impossible(`explosion base type ${type}?`);
        return null;
    }
    const name = damageType === AD_FIRE && objectClass === BURNING_OIL ? 'burning oil'
        : damageType === AD_FIRE && objectClass === SCROLL_CLASS ? 'tower of flame'
        : damageType === AD_DISN && objectClass === WAND_CLASS ? 'death field' : kind.name;
    const floor = damageType === AD_DISN && Math.abs(type) !== 24 ? 'death' : kind.floor;
    const floorNoun = explodingObject || Math.abs(type) >= 20 ? 'blast' : Math.abs(type) >= 10 ? 'spell' : 'bolt';
    return { type, damageType, heroDamage, name, floor, floorNoun, explodingObject };
}

// Part of C explode.c:explode(): m_at() with the u.usteed fallback for
// the hero's square.
function occupant(x: number, y: number, state: PlayingGameState): Monster | null {
    return monsterAtPosition(state.level, x, y)
        || (state.u.ux === x && state.u.uy === y ? state.u.usteed ?? null : null);
}

// C explode.c:explosionmask() results, as the port's per-cell shield bits.
const EXPL_NONE = 0;
const EXPL_MON = 1;
const EXPL_HERO = 2;

// Part of C explode.c:explosionmask(): the AD_DISN WAND_CLASS test
// (nonliving(m->data) || is_demon(m->data)).
function ignoresDeathField(mnum: number) {
    return monsterIsNonliving(mnum) || monsterIsDemon(mnum);
}

// Part of C explode.c:explosionmask(): the hero branch. C takes one monster
// pointer that may be &gy.youmonst; the hero port is not a Monster, so the
// hero and monster resistance branches stay separate functions.
function heroResists(damageType: DamageType, objectClass: number, state: GameState) {
    if (damageType === AD_DISN && objectClass === WAND_CLASS)
        return ignoresDeathField(heroSpecies(state));
    const kind = damageKinds.get(damageType);
    if (!kind) throw new Error(`Unknown explosion damage type ${damageType}`);
    return !!kind.property && (state.u[kind.property] || propertyIsActive(kind.property, state))
        || !!kind.defense && heroHasArtifactDefense(kind.defense, state);
}

// C explode.c:explosionmask()
// One target's shield outcome: EXPL_HERO for the hero's square, EXPL_MON
// for a resisting monster.  C takes a single monster pointer that may be
// &gy.youmonst; the hero port is not a Monster, so the hero and monster
// resistance switches stay heroResists()/monsterResists() and this restores
// C's one-question shape.
function explosionMask(
    target: Monster | 'hero', damageType: DamageType, objectClass: number, state: GameState,
): number {
    if (target === 'hero')
        return heroResists(damageType, objectClass, state) ? EXPL_HERO : EXPL_NONE;
    return monsterResists(target, damageType, objectClass) ? EXPL_MON : EXPL_NONE;
}

// Part of C explode.c:explosionmask(): the monster branch of the shield test.
function monsterResists(monster: Monster, damageType: DamageType, objectClass: number) {
    if (damageType === AD_DISN && objectClass === WAND_CLASS)
        return ignoresDeathField(monster.mnum) || monsterIsVampireShifter(monster);
    const kind = damageKinds.get(damageType);
    if (!kind) throw new Error(`Unknown explosion damage type ${damageType}`);
    return kind.resists(monster);
}

// Part of C explode.c:explode(): the 3x3 explmask loop (isok, hero and
// monster shields, map_invisible/unmap_invisible, visibility).
async function explosionCells(x: number, y: number, damageType: DamageType, objectClass: number, style: number, state: PlayingGameState): Promise<ExplosionCell[]> {
    const cells: ExplosionCell[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const cx = x + dx, cy = y + dy;
            if (cx < 1 || cx >= COLNO || cy < 0 || cy >= ROWNO) continue;
            let shield = EXPL_NONE;
            if (state.u.ux === cx && state.u.uy === cy)
                shield |= explosionMask('hero', damageType, objectClass, state);
            const monster = occupant(cx, cy, state);
            const living = monster && monster.mhp > 0;
            if (living) shield |= explosionMask(monster, damageType, objectClass, state);
            if (living && cansee(cx, cy) && !canSpotMonster(monster)) await map_invisible(cx, cy);
            else if (!living) await unmap_invisible(cx, cy);
            const glyph = explosionGlyph(style, dx, dy);
            cells.push({ x: cx, y: cy, shield, glyph });
        }
    }
    return cells;
}

// Part of C explode.c:explode(): the visual — the DISP_BEAM tmp_at walk,
// the shield sparkle with flags.sparkle, and the delays.
async function paintExplosion(cells: readonly ExplosionCell[], state: GameState) {
    const paint = async (cell: ExplosionCell) => await show_glyph_cell(cell.x, cell.y,
        cell.glyph.ch, cell.glyph.color, cell.glyph.decgfx, 0, cell.glyph);
    const flush = async () => {
        await flush_screen(1);
        state.nhDisplay?.setCursor(state.u.ux - 1, state.u.uy + 1);
    };
    const first = cells[0];
    if (!first) return;
    const effect = new TemporaryMapEffect('beam', first.glyph);
    await effect.start();
    try {
        for (const cell of cells) {
            effect.changeGlyph(cell.glyph);
            await effect.tmp_at(cell.x, cell.y);
        }
        await flush();
        if (state.flags.sparkle !== false && cells.some(cell => cell.shield)) {
            for (const ch of SHIELD_STATIC) {
                const glyph = shieldGlyph(ch);
                for (const cell of cells) {
                    if (cell.shield) await show_glyph_cell(cell.x, cell.y,
                        glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
                }
                await flush();
                await state.animationFrame?.();
            }
            for (const cell of cells) if (cell.shield) await paint(cell);
        } else {
            await state.animationFrame?.();
            await state.animationFrame?.();
        }
    } finally {
        await effect.clear();
    }
}

// Part of C explode.c:explode(): the do_hallu rndmonnam() loop that
// avoids capitalized names.
function hallucinatedExplosion(limit = Infinity) {
    let name;
    let tries = 0;
    do {
        name = `${possessiveName(randomDisplayMonsterName())} explosion`;
    } while (name.charAt(0) !== name.charAt(0).toLowerCase() && ++tries < limit);
    return name;
}

// C explode.c:engulfer_explosion_msg(): what the engulfer suffers when
// the blast goes off inside it.
async function engulferMessage(monster: Monster, damageType: DamageType, objectClass: number, state: GameState, publish: MessagePublisher) {
    const digesting = (MONSTER_ATTACKS[monster.mnum] || [])
        .some(([method, damage]) => method === AT_ENGL && damage === AD_DGST);
    const effects = new Map([
        [AD_FIRE, ['heartburn', 'toasted']],
        [AD_COLD, ['chilly', 'chilly']],
        [AD_DISN, objectClass === WAND_CLASS
            ? ['irradiated by pure energy', 'overwhelmed by pure energy']
            : ['perforated', 'perforated']],
        [AD_ELEC, ['shocked', 'shocked']],
        [AD_DRST, ['poisoned', 'intoxicated']],
        [AD_ACID, ['an upset stomach', 'burned']],
    ]);
    const effect = effects.get(damageType)?.[digesting ? 0 : 1] || 'fried';
    await publish(`${monsterName(monster, { state, capitalized: true })} gets ${digesting ? '' : 'slightly '}${effect}!`);
}

// Part of C explode.c:explode(): the DEADMONSTER disposition —
// xkilled() for hero-caused, the mdef "burned completely" message, else
// monkilled().
async function finishExplosionMonsterDeath(monster: Monster, {
    state, publish, heroCaused, creditedMonster, burnsCompletely, random, damageType,
}: ExplosionMonsterDeathOptions) {
    if (heroCaused)
        return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { noCorpse: burnsCompletely, publish });
    if (monster === creditedMonster) {
        if (cansee(monster.mx, monster.my) || canSpotMonster(monster)) {
            const fate = burnsCompletely ? 'burned completely' : monsterIsNonliving(monster.mnum) ? 'destroyed' : 'killed';
            await publish(`${monsterName(monster, { state, capitalized: true })} is ${fate}!`);
        }
        return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
            noCorpse: burnsCompletely, publish, showKillMessage: false, recordConduct: false,
        });
    }
    return finishMonsterKilled(monster, state, {
        publish, random, damageType: burnsCompletely ? AD_RBRE : damageType,
    });
}

// Part of C explode.c:explode(): the killer.format/name assignment when
// the hero dies ("caught %self in ...").
function explosionDeathCause(type: number, objectClass: number, description: string, killer: string | null, state: GameState): OrdinaryDeathOptions {
    if (objectClass === MON_EXPLODE) return { killer: killer || description, killerFormat: KILLED_BY_AN };
    const himself = state.flags.female ? 'herself' : 'himself';
    if (objectClass === TRAP_EXPLODE) {
        const cause = `caught ${himself} in a ${description}`;
        return { killer: cause, killerFormat: NO_KILLER_PREFIX };
    }
    if (type >= 0 && objectClass !== SCROLL_CLASS) {
        const cause = `caught ${himself} in ${state.flags.female ? 'her' : 'his'} own ${description}`;
        return { killer: cause, killerFormat: NO_KILLER_PREFIX };
    }
    return { killer: description, killerFormat: ['tower of flame', 'fireball'].includes(description)
        ? KILLED_BY_AN : KILLED_BY };
}

export interface ScatterOptions {
    state?: GameState;
    onlyObject?: GameObject | null;
    mayDestroy?: boolean;
    mayFracture?: boolean;
    mayHitHero?: boolean;
    mayHitMonsters?: boolean;
    heroCaused?: boolean;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    rollDice?: (count: number, sides: number) => number;
    finishMonsterDeath?: MonsterDeathHandler | null;
    finishMonsterKill?: typeof finishHeroMonsterKill | null;
}

// The public entry point resolves every optional setting before objects move.
type ScatterSettings = Required<ScatterOptions> & { force: number };

interface ScatterNode extends Position {
    object: GameObject | null;
    dx: number;
    dy: number;
    range: number;
    stopped: boolean;
}

const GLASS = 19;
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

// Part of C explode.c:scatter(): the floor pile read.
function floorPile(state: GameState, x: number, y: number): GameObject[] {
    return state.level?.objects?.[x]?.[y] || [];
}

// Part of C explode.c:scatter(): the obj_extract_self removal.
function removeFloorObject(object: GameObject, state: GameState): void {
    unlinkObject(object, state);
}

// Part of C explode.c:scatter(): the cansee square test.
function squareIsVisible(state: GameState, x: number, y: number): boolean {
    return !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && (!state.viz_array || !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2));
}

// Part of C explode.c:scatter(): the m_at read.
function monsterAt(state: GameState, x: number, y: number): Monster | null {
    return monsterAtPosition(requireGameLevel(state), x, y);
}

// Part of C explode.c:scatter(): the ZAP_POS/closed-door flight-square
// test.
function openFlightSquare(state: GameState, x: number, y: number): boolean {
    if (!isok(x, y)) return false;
    const location = state.level?.at(x, y);
    if (!location) return false;
    return ZAP_POS(location.typ)
        && (location.typ !== DOOR
            || !(location.doormask & (D_CLOSED | D_LOCKED)));
}

// Part of C mthrowu.c:ohitmon(): the killed/monkilled finish for a
// monster killed by a scattered object.
async function finishScatteredMonsterDeath(
    monster: Monster, x: number, y: number, death: HeroMonsterKillOptions,
    state: GameState, options: ScatterSettings,
): Promise<HeroMonsterKillOutcome> {
    if (options.heroCaused && options.finishMonsterKill) {
        const killed = await options.finishMonsterKill(monster, x, y, death);
        return { killed, heroDied: !!state.program_state.gameover };
    }
    if (options.heroCaused)
        return finishHeroMonsterKillOutcome(monster, x, y, { ...death, publish: options.publish });
    const finish = options.finishMonsterDeath
        || ((victim: Monster, deathOptions: HeroMonsterKillOptions) => finishEnvironmentalMonsterDeath(victim, state, deathOptions));
    const result = await finish(monster, {
        ...death,
        random: options.random,
        publish: options.publish,
    });
    return { killed: !result.survived, heroDied: !!result.heroDied };
}

// Part of C mthrowu.c:drop_throw(): after a hit, an impact can mulch ammunition, ship it
// through a gate, or expose it to the defender's passive effect before
// floor stacking.
async function landAfterMonsterHit(object: GameObject, node: Position, state: GameState, options: ScatterSettings): Promise<void> {
    requirePlayingGame(state);
    const broken = object.otyp === CREAM_PIE || object.oclass === VENOM_CLASS || object.otyp === EGG
        || shouldMulchMissile(object, { monsterMoving: !!state.context.mon_moving });
    if (broken) {
        await delobj(object, state, options.random);
        return;
    }
    if (await shipObject(object, node.x, node.y, { state, publish: options.publish, random: options.random })) return;
    const actor = monsterAtPosition(state.level, node.x, node.y)
        || (node.x === state.u.ux && node.y === state.u.uy ? state.u : null);
    const floor = await applyFloorEffects(object, node.x, node.y, {
        state, publish: options.publish, random: options.random, verb: 'fall',
    });
    if (floor.finished || state.program_state.gameover) return;
    await placeObject(object, node.x, node.y, state);
    if (actor) await applyMonsterPassiveToObject(actor, object, {
        state, publish: options.publish, random: options.random,
    });
    if (!state.program_state.gameover) await stack_object(object, state);
}

// Part of C mthrowu.c:ohitmon(): the scatter flight's monster hit; the
// shared port is hitMonsterWithProjectile in mthrowu.ts.
async function hitMonster(monster: Monster, node: ScatterNode, state: GameState, options: ScatterSettings): Promise<boolean> {
    const object = node.object;
    if (!object) return false;
    const visible = cansee(node.x, node.y);
    const disguised = M_AP_TYPE(monster) !== 0 && M_AP_TYPE(monster) !== M_AP_MONSTER;
    state.notonhead = node.x !== monster.mx || node.y !== monster.my;
    if (visible) observeObject(object, state);
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
        if (disguised) await revealMonsterAppearance(monster);
        monster.msleeping = 0;
        const potionOptions: PotionHitOptions = {
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
            wakeNearby: (nearX, nearY, distance) =>
                wakeMonstersNearWithMessages(nearX, nearY, distance, state, options.publish),
            finishKill: (target, deathOptions = {}) =>
                finishScatteredMonsterDeath(
                    target, target.mx, target.my,
                    deathOptions, state, options,
                ),
            // ohitmon() passes POTHIT_OTHER_THROW even for a hero-caused blast.
            heroCaused: false,
        };
        const impact = await hitMonsterWithSupportedPotion(potionOptions);
        if (impact?.heroDied) return true;
        if (!impact) throw new Error(`Unsupported scattered potion ${object.otyp}`);
        node.object = null;
        node.stopped = true;
        return true;
    }

    const material = objectMaterial(object, state);

    const harmless = object.oclass !== RING_CLASS && (material === 20 || material === 21)
        && passes_rocks(monster.mnum);
    let damage = rollPhysicalWeaponDamage(object, monster, {
        state, rollOne: options.rollOne, rollDice: options.rollDice,
    });
    if (object.otyp === ACID_VENOM && monsterHasAcidResistance(monster)) damage = 0;
    if (disguised) await revealMonsterAppearance(monster);
    monster.msleeping = 0;
    if (visible) {
        if (object.otyp === EGG) {
            const species = object.corpsenm === undefined ? 'unknown' : MONSTER_NAME[object.corpsenm] ?? 'unknown';
            const egg = object.known ? `${withIndefiniteArticle(species)} egg` : 'an egg';
            await options.publish(`Splat!  ${monsterName(monster, { state, capitalized: true })} is hit with ${egg}!`);
        } else {
            await options.publish(rayHitMessage(captureHeroProjectileName(object, state), monster, {
                ...node, state, damage,
                ...(harmless ? { ending: ` but passes harmlessly through ${monsterObjectPronoun(monster, { state })}.` } : {}),
            }));
        }
    }
    if (object.opoisoned && isPoisonableObject(object)) {
        if (monsterHasPoisonResistance(monster)) {
            if (visible) await options.publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
        } else if (options.random(30) !== 0) damage += options.rollOne(6);
        else {
            if (visible) await options.publish('The poison was deadly...');
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
            finishDeath: (victim, death = {}) => finishEnvironmentalMonsterDeath(
                victim, state, {
                    ...death, random: options.random, publish: options.publish,
                }),
        });
        if (stone.heroDied) return true;
        if (monsterHasStoneResistance(monster)) damage = 0;
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
            if (state.program_state.gameover) return true;
        }
    }
    if (monster.mhp > 0 && canBlnd(null, { monster },
        object.otyp === BLINDING_VENOM ? AT_SPIT : AT_WEAP, object, state)) {
        if (visible && monster.mcansee) {
            const cause = object.oclass === VENOM_CLASS ? 'venom' : object.otyp === CREAM_PIE ? 'pie' : objectCombatName(object, { state });
            await options.publish(`${monsterName(monster, { state, capitalized: true })} is blinded by the ${cause}.`);
        }
        applyMonsterBlindness(monster, options.rollOne(25) + 20);
    }
    if (monster.mhp > 0 && options.heroCaused) await angerAttackedMonster(monster);
    if (!state.program_state.gameover) await landAfterMonsterHit(object, node, state, options);
    node.object = null;
    node.stopped = true;
    return true;
}

// Part of C explode.c:scatter(): the u_at hero hit branch with
// dmgval/hitvalu/thitu.
async function hitHero(node: ScatterNode, state: GameState, options: ScatterSettings): Promise<boolean> {
    requirePlayingGame(state);
    const object = node.object;
    if (!object) return false;
    const attack = 8 + (object.spe ?? 0)
        + (monsterIsBig(heroSpecies(state)) ? 1 : 0);
    if (state.multi) endVoluntaryMultiTurn(state);
    let damage = rollPhysicalWeaponDamageAgainstHero(object, state, {
        rollOne: options.rollOne, rollDice: options.rollDice,
    });
    if (state.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
    const result = await hitHeroWithObject(object, damage, attack, {
        state, publish: options.publish, rollOne: options.rollOne,
        random: options.random, rollDice: options.rollDice,
    });
    if (result.hit) {
        node.range -= 3;
        if (object.oclass === POTION_CLASS) {
            node.object = null;
            node.stopped = true;
        }
        if (!result.died) await stopHeroOccupation(state, options.publish);
    }
    return result.hit;
}

// Part of C explode.c:scatter(): the MAY_FRACTURE boulder/statue branch.
async function fractureObject(object: GameObject, x: number, y: number, state: GameState, options: ScatterSettings): Promise<void> {
    const boulder = object.otyp === BOULDER;
    if (!boulder) {
        const statueTrap = state.level?.traps.find(trap =>
            trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP);
        if (statueTrap) deleteTrap(statueTrap, state);
    }
    if (squareIsVisible(state, x, y)) {
        const name = capitalizedDefiniteName(objectCombatName(object, { state }), state);
        const verb = boulder ? 'break' : 'crumble';
        const action = objectNameIsPlural(object, state) ? verb : verbForSubject(null, verb);
        await options.publish(`${name} ${action}${boulder ? ' apart' : ''}.`);
    } else {
        await publishHeardMessage(boulder ? 'stone breaking.' : 'stone crumbling.', options.publish, state);
    }
    const fractureOptions = { state, random: options.random, publish: options.publish };
    if (boulder) await fractureRock(object, x, y, fractureOptions);
    else await breakStatue(object, x, y, fractureOptions);
    await placeObject(object, x, y, state);
    if (boulder) {
        // Native scatter() processes all remaining boulders before the debris.
        const nextBoulder = floorPile(state, x, y).find(candidate => candidate.otyp === BOULDER);
        if (nextBoulder) {
            unlinkObject(nextBoulder, state);
            await placeObject(nextBoulder, x, y, state);
        }
    }
    await newsym(x, y);
}

// Part of C explode.c:scatter(): one pile entry — splitobj, the direction
// roll, and the range roll.
async function prepareScatteredObject(object: GameObject, x: number, y: number, state: GameState, options: ScatterSettings): Promise<ScatterNode | null> {
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
            if (broken.destroyed) return null;
            // A fatal vapor or oil blast ends the scatter even though the
            // bottle itself reports not destroyed.
            if (state.program_state?.gameover) return null;
        }
    }

    const direction = DIRECTIONS[options.random(DIRECTIONS.length)];
    if (!direction) throw new RangeError('Scattering selected an invalid direction.');
    const maximumRange = Math.max(
        1, options.force - Math.trunc((object.owt ?? 1) / 40),
    );
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

// Part of C explode.c:scatter(): taking the next object from the pile
// with its splitobj quantity.
function nextObjectFromPile(pile: GameObject[], state: GameState, options: ScatterSettings): { object: GameObject; lastPiece: boolean } | null {
    const object = options.onlyObject || pile[0];
    if (!object || !options.onlyObject && !pile.includes(object)) return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) return { object, lastPiece: true };
    const part = splitObjectStack(
        object, options.rollOne(Math.min(quantity - 1, LARGEST_INT)), state,
    );
    if (!part) throw new Error(`Cannot split scattered object ${object.o_id}.`);
    return { object: part, lastPiece: false };
}

// C explode.c:scatter().
export async function scatterFloorObjects(
    x: number,
    y: number,
    force: number,
    {
        state = game,
        onlyObject = null,
        mayDestroy = true,
        mayFracture = true,
        mayHitHero = true,
        mayHitMonsters = true,
        heroCaused = !state.context.mon_moving,
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        rollDice = d,
        finishMonsterDeath = null,
        finishMonsterKill = null,
    }: ScatterOptions = {},
): Promise<number> {
    requireLiveGame(state);
    const options: ScatterSettings = {
        state, onlyObject, force, mayDestroy, mayFracture,
        mayHitHero, mayHitMonsters, heroCaused, publish,
        random, rollOne, rollDice, finishMonsterDeath, finishMonsterKill,
    };
    const shop = costlySpot(x, y, state)?.resident;
    const creditBefore = shop?.eshk.credit ?? 0;
    const debitBefore = shop?.eshk.debit ?? 0;
    const loanBefore = shop?.eshk.loan ?? 0;
    let lostGoods = false;
    const nodes: ScatterNode[] = [];
    const pile = floorPile(state, x, y);
    while (onlyObject || pile.length) {
        const candidate = onlyObject || pile[0];
        const chain = state.uchain || state.u.uchain;
        if (candidate && (candidate === chain || candidate === (state.uball || state.u.uball))) {
            await publish('The chain shatters!');
            await unpunishHero(state);
            if (candidate === chain) {
                if (onlyObject) break;
                continue;
            }
        }
        const next = nextObjectFromPile(pile, state, options);
        if (!next) break;
        const node = await prepareScatteredObject(
            next.object, x, y, state, options,
        );
        if (state.program_state.gameover) return 0;
        if (node) nodes.push(node);
        if (onlyObject && next.lastPiece) break;
    }

    let farthest = nodes.reduce(
        (maximum, node) => Math.max(maximum, node.range), 0,
    );
    while (farthest-- > 0) {
        for (const node of nodes) {
            if (node.stopped || node.range-- <= 0 || !node.object) continue;
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
            } else if (state.u?.ux === nextX && state.u?.uy === nextY
                && mayHitHero) {
                await hitHero(node, state, options);
            }
            if (state.program_state?.gameover) return 0;
            if (state.level?.at(nextX, nextY)?.typ === SINK) node.stopped = true;
            state._thrownObject = null;
        }
    }

    let moved = 0;
    for (const node of nodes) {
        if (!node.object) {
            await newsym(node.x, node.y);
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
        if (node.x !== x || node.y !== y) moved += quantity;
        await newsym(node.x, node.y);
    }
    await newsym(x, y);
    if (state.u.ux === x && state.u.uy === y && state.u.uundetected
        && monsterHidesUnder(heroSpecies(state))) await hideHeroUnder(state);
    const originMonster = monsterAt(state, x, y);
    if (originMonster?.mtrapped) originMonster.mtrapped = 0;
    await maybeUnhideAt(x, y, state);
    if (lostGoods && shop) {
        const creditUsed = creditBefore - (shop.eshk.credit ?? 0);
        const debitAdded = (shop.eshk.debit ?? 0) - debitBefore;
        const loanAdded = (shop.eshk.loan ?? 0) - loanBefore;
        const amount = creditUsed > 0 ? creditUsed : debitAdded > 0 ? debitAdded : loanAdded;
        if (amount > 0) await publish(`Your ${creditUsed > 0
            ? 'credit has been reduced' : 'debt has increased'} by ${amount} ${
            currency(amount, { state })}.`);
    }
    return moved;
}

export interface FireExplosionOptions extends ExplosionOptions {
    rollDice?: typeof d;
}

// C explode.c:splatter_burning_oil()
// Extinguish before the blast so death and bones cannot retain its
// light.
export async function explodeLitOilPotion(potion: GameObject, x: number, y: number, {
    state = game, heroCaused = !state.context.mon_moving, publish = plineWithContinuation,
    random = rn2, rollDice = d,
}: FireExplosionOptions = {}): Promise<MagicDamageResult> {
    const diluted = !!potion.odiluted;
    if (!potion.lamplit) {
        await impossible('exploding unlit oil', { state });
        await impossible(`end_burn: obj ${objectCombatName(potion, { state })} not lit`, { state });
    } else if (!endObjectBurn(potion, state, state.moves ?? 0)) {
        await impossible(`end_burn: obj ${objectCombatName(potion, { state })} not timed!`, { state });
    }
    potion.how_lost = LOST_EXPLODING;
    return explode(x, y, 11, rollDice(diluted ? 3 : 4, 4), BURNING_OIL, EXPL_FIERY, {
        state, heroCaused, publish, random,
    });
}

// Part of C dothrow.c:breakobj(), uhitm.c:hmon_hitmon_misc_obj(): the
// shared explode(x, y, -11, dmg, 0, EXPL_FIERY) pyrolisk-egg call.
export function createFireExplosion(x: number, y: number, damage: number, {
    state = game, heroCaused = !state.context.mon_moving, publish = plineWithContinuation, random = rn2,
}: ExplosionOptions = {}): Promise<MagicDamageResult> {
    // Pyrolisk eggs use the native generic object class, with a fire spell type.
    return explode(x, y, -11, damage, RANDOM_CLASS, EXPL_FIERY, { state, heroCaused, publish, random });
}

// Part of C explode.c:mon_explodes(): the elemental branch
// (type = -((adtyp - 1) + 20), style from adtyp_to_expltype()).
export async function createElementalMonsterExplosion(x: number, y: number, damageType: DamageType, damage: number, killer: string, options: ExplosionOptions = {}) {
    const style = await explosionStyleForDamage(damageType, options.state ?? game);
    return explode(x, y, -(damageType - 1 + 20), damage, MON_EXPLODE, style, {
        ...options, killer,
    });
}

// C explode.c:adtyp_to_expltype().
async function explosionStyleForDamage(damageType: DamageType, state: GameState): Promise<number> {
    const style = explosionStyles.get(damageType);
    if (style !== undefined) return style;
    await impossible(`adtyp_to_expltype: bad explosion type ${damageType}`, { state });
    return EXPL_FIERY;
}

// C explode.c:mon_explodes(). Kill credit and the map blast for a
// monster whose death explodes.
export function createPhysicalMonsterExplosion(sourceMonster: Monster, x: number, y: number, damage: number, options: MonsterExplosionOptions = {}) {
    const killer = `${possessiveName(monsterTypeName(sourceMonster.mnum, !!sourceMonster.female))} explosion`;
    return explode(x, y, PHYS_EXPL_TYPE, damage, MON_EXPLODE, EXPL_NOXIOUS, { ...options, killer });
}
