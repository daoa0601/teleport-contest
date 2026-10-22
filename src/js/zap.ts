// Ray attacks, terrain changes, and elemental item damage.
// C ref: zap.c dobuzz(), zap_over_floor(), zhitm(), zhitu(), and
// destroy_items().

import { objectMaterial } from './object_material.js';
import { bypassObjectList, nextUnbypassedObject } from './object_bypass.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { monsterHasMapPosition } from './monster_location.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { applyWandEffect } from './wand_effects.js';
import { GETOBJ_EXCLUDE, GETOBJ_SUGGEST, PLNMSG_ENVELOPED_IN_GAS } from './const.js';
import { objectDirection } from './object_data.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { backfireWand, zappable } from './wand_charge.js';
import { deleteTrap } from './trap_lifecycle.js';
import { updateIceObjectTimersAt } from './floor_object.js';
import { isIceAt, isLavaAt, isMoatAt, isPoolAt } from './terrain_properties.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_STR, COLNO, DB_FLOOR, DB_ICE, DB_UNDER, DOOR, DRAWBRIDGE_UP, FOUNTAIN, SHOP_BARS_COST, SHOP_DOOR_COST, ZAP_POS, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_WALL, IS_WATERWALL, Is_rogue_level, Is_waterlevel, ismnum, LAVAWALL, PIT, POOL, ROOM, ROWNO, SDOOR, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, Upolyd, VWALL, WEB, WM_MASK, W_NONDIGGABLE, W_RING } from './const.js';
import { displayColorName, displayLiquidName, docrt, newsym, plineWithContinuation } from './display.js';
import { waterbodyName } from './terrain_name.js';
import { resetPick } from './lock_context.js';
import { game, requireLiveGame } from './gstate.js';
import { monsterHasFireResistance, monsterHasShockResistance } from './monster_resistance.js';
import { SHOPBASE } from './const.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { setHeroTrap, triggerHeroTrap } from './hero_traps.js';
import { monsterName, possessiveName } from './monster_name.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { loseHeroHp } from './hero_damage.js';
import { removeHeroAccessory } from './accessory.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { rechargeRing } from './recharge.js';
import { finishHeroDeath } from './end.js';
import { meltIce } from './ice.js';
import { consumeInventoryItem } from './invent.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { igniteItems } from './light.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { fix_wall_spines, maketrap } from './mklev.js';
import { monsterResistanceBits } from './monster_resistance.js';
import { triggerImmediateMonsterTrap } from './monmove.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import {
    DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_CHARGED, OBJECT_NAMES,
    OBJECT_PROPERTY, POT_OIL, POT_WATER, RIN_SHOCK_RESISTANCE, SCR_FIRE, SPE_BOOK_OF_THE_DEAD,
    SPE_FIREBALL, WAN_LIGHTNING, WAN_STRIKING,
} from './object_data.js';
import { observeObject } from './object_knowledge.js';
import { objectResistsDestruction } from './object_state.js';
import {
    LEVEL_TIMER_KIND, scheduleLevelTimer, stopLevelTimer,
} from './object_timers.js';
import { applySupportedPotionVapor } from './potion_hit.js';
import { heroHasNoHands } from './polyself.js';
import { createPoisonGasCloud } from './regions.js';
import { dryFountainAt } from './fountain.js';
import { dissolveBars } from './projectile_bars.js';
import { resetHeroTrap } from './terrain_movement.js';
import { stopHeroOccupation } from './occupation.js';
import { rn2, rnd } from './rng.js';
import { promptDirection } from './tty_prompts.js';
import { cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
import { chargeUnpaidUsage } from './shk.js';
import { hasWornProperty } from './properties.js';
import { closedRayDoor } from './ray.js';
import { heroIsBlind } from './senses.js';
import {
    definiteObjectAction,
    killerObjectName, objectName, ownedObjectName, observeObjectForNaming,
    observeDistantObjectForNaming, pluralizeObjectNoun,
} from './objnam.js';
import { delobj } from './object_delete.js';
import { useUpFloorObject } from './floor_consumption.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import type { PropertyName } from './property_types.js';
import type { InventoryDamageType, MagicDamageResult, RayFloorKind, RayFloorResult } from './magic_types.js';
import { requirePlayingGame } from './gstate.js';

export interface FloorBurnOptions {
    state?: GameState;
    giveFeedback?: boolean;
    heroCaused?: boolean;
    publish?: MessagePublisher;
    random?: typeof rn2;
    visible?: boolean;
    repaint?: (x: number, y: number) => void;
}
export interface RayFloorOptions {
    rayNoun?: 'bolt' | 'spell' | 'blast';
    random?: typeof rn2;
    heroCaused?: boolean;
    explodingWand?: number;
    heroBurnsObjects?: boolean;
    publish?: MessagePublisher;
}
export interface InventoryDamageOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    die?: DeathHandler;
}
export interface MonsterInventoryDamageOptions extends Omit<InventoryDamageOptions, 'die'> {
    visible?: boolean;
}
interface ChosenItemDamageOptions {
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    die: DeathHandler;
}

const RING_CLASS = 4;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const MAX_ITEMS_DESTROYED = 20;
const RAY_FIRE = 'fire';
const RAY_COLD = 'cold';
const RAY_DISINTEGRATION = 'disintegration';
const RAY_LIGHTNING = 'lightning';
const RAY_ACID = 'acid';

export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});

async function finishWandUse(wand: GameObject | null) {
    if (!wand || wand.spe >= 0) return;
    await plineWithContinuation(`${definiteObjectAction(wand, 'turn')} to dust.`);
    await useUpInventoryStack(wand);
}

// C zap.c:dozap(). Selection/charges surround the shared effect transaction.
export async function dozap(): Promise<void> {
    requirePlayingGame(game);
    if (heroHasNoHands(game)) {
        await plineWithContinuation("You aren't able to zap anything in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    let wand = await chooseInventoryObject('zap', object =>
        object?.oclass === WAND_CLASS ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    if (!wand) {
        game.context.move = 0;
        return;
    }
    await chargeUnpaidUsage(wand);
    const needsDirection = objectDirection(wand.otyp, game) !== 1;
    if (!await zappable(wand)) {
        await plineWithContinuation('Nothing happens.');
    } else if (wand.cursed && rn2(100) === 0) {
        await backfireWand(wand);
        if (game.program_state.gameover) return;
        await exerciseAttribute(A_STR, false);
        game.context.move = 1;
        return;
    } else if (needsDirection && !await promptDirection()) {
        if (!heroIsBlind()) {
            await plineWithContinuation(`${definiteObjectAction(wand, null)} glows and fades.`);
        }
    } else if (needsDirection && !game.u.dx && !game.u.dy && !game.u.dz) {
        const effect = await zapHeroWithObject(wand);
        if (effect.heroDied) return;
        if (effect.damage) {
            const damage = game.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
            const cause = `zapped ${game.flags.female ? 'herself' : 'himself'} with ${killerObjectName(wand)}`;
            if (await loseHeroHp(damage, cause, { deathCause: cause })) return;
        }
    } else {
        game._currentWand = wand;
        await applyWandEffect(wand);
        wand = game._currentWand;
        game._currentWand = null;
    }
    if (game.program_state.gameover) return;
    await finishWandUse(wand);
    game.context.move = 1;
}

function removeWebAt(x: number, y: number, state: GameState = game) {
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y && candidate.ttyp === WEB,
    );
    if (!trap) return false;
    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.utraptype !== TT_BURIEDBALL) {
            state.u.utrap = 0;
            state.u.utraptype = 0;
        }
    } else {
        const monster = state.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, state) &&
            candidate.mx === x && candidate.my === y,
        );
        if (monster) monster.mtrapped = 0;
    }
    deleteTrap(trap, state);
    return true;
}

function revealSecretDoor(location: MapLocation, state: GameState = game) {
    const oldMask = location.doormask ?? 0;
    location.typ = DOOR;
    if (Is_rogue_level(state.u?.uz)) {
        location.doormask = D_NODOOR;
    } else {
        location.doormask = oldMask & ~WM_MASK;
        if (!(location.doormask & D_LOCKED))
            location.doormask |= D_CLOSED;
    }
    location.arboreal_sdoor = 0;
}

function floorObjectBurns(object: GameObject) {
    return object?.otyp === GLOB_OF_GREEN_SLIME
        || object?.oclass === SCROLL_CLASS
        || object?.oclass === SPBOOK_CLASS;
}

async function removeBurnedFloorQuantity(object: GameObject, count: number, state: GameState, heroCaused: boolean, publish: MessagePublisher) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (!heroCaused && count < quantity) {
        object.quan = quantity - count;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
        return;
    }
    if (heroCaused) await useUpFloorObject(object, count, { state, publish });
    else await delobj(object, state);
}

function floorBurnMessage(object: GameObject, destroyed: number, state: GameState) {
    if (object.ox === state.u.ux && object.oy === state.u.uy)
        observeObjectForNaming(object, { state });
    else observeDistantObjectForNaming(object, state);
    const name = objectName({ ...object, quan: 1, quantity: 1 }, state);
    if (destroyed > 1)
        return `${destroyed} ${pluralizeObjectNoun(object, name)} burn.`;
    const subject = withIndefiniteArticle(name);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} burns.`;
}

export async function burnFloorObjectsAt(
    x: number,
    y: number,
    {
        state = game,
        giveFeedback = false,
        heroCaused = false,
        publish = plineWithContinuation,
        random = rn2,
        visible = cansee(x, y),
        repaint = newsym,
    }: FloorBurnOptions = {},
): Promise<number> {
    const pile = state.level?.objects?.[x]?.[y] || [];
    let burned = 0;
    for (const object of [...pile]) {
        if (!floorObjectBurns(object)
            || object.otyp === SCR_FIRE
            || object.otyp === SPE_FIREBALL
            || objectResistsDestruction(object, 2, 100, random)) continue;
        const quantity = object.quan ?? object.quantity ?? 1;
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        const feedback = giveFeedback ? floorBurnMessage(object, destroyed, state) : null;
        await removeBurnedFloorQuantity(object, destroyed, state, heroCaused, publish);
        burned += destroyed;
        if (feedback) await publish(feedback);
    }

    await igniteItems(pile, {
        state,
        publish,
        random,
        visible,
    });
    if (burned && couldsee(x, y)) repaint(x, y);
    return burned;
}

export function startMeltIceTimer(
    x: number, y: number, minimumTime = 0, state: GameState = game, random: typeof rn2 = rn2,
) {
    let delay = Math.max(minimumTime, 49);
    while (++delay <= 2000) {
        if (random(2000 - delay + 50) === 0) break;
    }
    if (delay > 2000) return null;
    return scheduleLevelTimer(
        x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        (state.moves ?? 0) + delay, state,
    );
}

function firmExistingIce(x: number, y: number, state: GameState = game) {
    const timer = state.level?.levelTimers?.find(candidate =>
        candidate.x === x && candidate.y === y
        && candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY,
    );
    if (!timer) return;
    const remaining = Math.max(0, timer.deadline - (state.moves ?? 0));
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    startMeltIceTimer(x, y, remaining, state);
}

function liquidMonsterAt(x: number, y: number, state: GameState = game) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function revealStrandedSwimmer(x: number, y: number, state: GameState = game) {
    const monster = liquidMonsterAt(x, y, state);
    if (!monster || !monster.mundetected
        || !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000002)) return;
    monster.mundetected = 0;
    newsym(x, y);
}

async function freezeLiquidAt(x: number, y: number, state: GameState, publish: MessagePublisher) {
    const location = state.level?.at(x, y);
    if (!location) return 0;
    if (isIceAt(x, y, state)) {
        firmExistingIce(x, y, state);
        return 0;
    }

    const lavaWall = location.typ === LAVAWALL;
    const lava = isLavaAt(x, y, state);
    if (!isPoolAt(x, y, state) && !lava) return 0;

    const visible = cansee(x, y);
    const temperature = state.level?.flags?.temperature || 0;
    const briefFreeze = IS_WATERWALL(location.typ)
        || (lavaWall && rn2(Math.max(2, 5 + temperature * 10)) !== 0);
    if (briefFreeze) {
        if (visible) {
            await publish(
                `The ${displayLiquidName(lavaWall ? 'lava' : 'water', state)} freezes for a moment.`,
            );
        } else {
            await publishHeardMessage('a soft crackling.', publish, state);
        }
        return -1000;
    }

    const waterbody = waterbodyName(x, y, state);
    const wasMoat = isMoatAt(x, y, state);
    if (location.typ === DRAWBRIDGE_UP) {
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_UNDER;
        location.drawbridgemask |= lava ? DB_FLOOR : DB_ICE;
    } else {
        location.icedpool = lava ? 0
            : location.typ === POOL ? ICED_POOL : ICED_MOAT;
        if (lavaWall) {
            const north = state.level?.at(x, y - 1);
            const south = state.level?.at(x, y + 1);
            location.typ = !!north && IS_WALL(north.typ) || !!south && IS_WALL(south.typ)
                ? VWALL : HWALL;
            fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1),
                Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        } else {
            location.typ = lava ? ROOM : ICE;
        }
    }

    await buryFloorObjectsAt(x, y, state, { publish });
    if (visible) {
        const message = lava
            ? `The ${displayLiquidName('lava', state)} cools and solidifies.`
            : wasMoat ? `The ${waterbody} is bridged with ice!`
                : `The ${displayLiquidName('water', state)} freezes.`;
        await publish(message, { noRepeat: true });
        newsym(x, y);
    } else if (!lava) {
        await publishHeardMessage('a crackling sound.', publish, state);
    }

    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.uinwater) {
            state.u.uinwater = 0;
            state.u.uundetected = 0;
            await docrt();
            state.vision_full_recalc = 1;
        } else if (state.u.utrap && state.u.utraptype === TT_LAVA) {
            if (state.u.passesWalls) {
                await publish('You pass through the now-solid rock.');
                await resetHeroTrap(true, state);
            } else {
                setHeroTrap(rnd(50) + 19, TT_INFLOOR, state);
                await publish(
                    'You are firmly stuck in the cooling rock.',
                );
            }
        }
    } else {
        revealStrandedSwimmer(x, y, state);
    }

    if (!lava) {
        startMeltIceTimer(x, y, 0, state);
        updateIceObjectTimersAt(x, y, state, { includeBuried: true });
    }
    // Cooling changes the surface without changing its vision blocking.
    // A visibility reset here would erase an active ray at the hero.
    return -3;
}

async function evaporatePoolAt(x: number, y: number, state: GameState, publish: MessagePublisher, heroCaused: boolean) {
    const location = state.level?.at(x, y);
    if (!location || !isPoolAt(x, y, state)) return 0;
    const visible = cansee(x, y);
    const deaf = !!(state.u?.deaf || state.deaf);
    const waterLevel = Is_waterlevel(state.u?.uz);
    let enveloped = false;
    if (!waterLevel) {
        await createPoisonGasCloud(state, x, y, rnd(5), 0, rn2, publish);
        enveloped = state._lastPlineKind === PLNMSG_ENVELOPED_IN_GAS;
    }

    let message = !deaf ? 'You hear hissing gas.'
        : heroCaused ? 'That seemed remarkably uneventful.' : null;
    let rangeChange = 0;
    let pit = null;
    if (location.typ === POOL) {
        rangeChange = -3;
        location.typ = ROOM;
        location.flags = 0;
        pit = await maketrap(x, y, PIT);
        if (visible) message = 'The water evaporates.';
    } else if (waterLevel) {
        message = visible || !deaf ? 'Some water boils.' : null;
    } else if (visible) {
        message = 'Some water evaporates.';
    }
    if (message && !enveloped) await publish(message, { noRepeat: true });

    if (location.typ === ROOM) {
        revealStrandedSwimmer(x, y, state);
        newsym(x, y);
        const monster = liquidMonsterAt(x, y, state);
        if (pit && state.u.ux === x && state.u.uy === y)
            await triggerHeroTrap(pit);
        else if (pit && monster) {
            requirePlayingGame(state);
            await triggerImmediateMonsterTrap(monster, state);
        }
    }
    return rangeChange;
}

export async function applyRayFloorFeatures(
    kind: RayFloorKind, x: number, y: number, state: GameState = game,
    { rayNoun = 'bolt', random = rn2, heroCaused = true,
        explodingWand = 0, heroBurnsObjects = heroCaused,
        publish = plineWithContinuation }: RayFloorOptions = {},
): Promise<RayFloorResult> {
    const location = state.level?.at(x, y);
    if (!location) return { absorbed: false, rangeChange: 0 };
    const visible = cansee(x, y);
    let rangeChange = 0;
    let shopDamage = false;
    const yourRay = heroCaused && !explodingWand;
    const wandType = [POT_OIL, SCR_FIRE].includes(explodingWand) ? 0 : explodingWand;

    if (kind === RAY_FIRE && removeWebAt(x, y, state)) {
        if (visible)
            await publish('A web bursts into flames!');
        newsym(x, y);
    }

    if (kind === RAY_FIRE && isIceAt(x, y, state)) {
        await meltIce(x, y);
    } else if (kind === RAY_FIRE) {
        rangeChange += await evaporatePoolAt(x, y, state, publish, heroCaused);
    }
    if (state.program_state.gameover) return { absorbed: false, rangeChange };
    if (kind === RAY_FIRE && location.typ === FOUNTAIN) {
        await createPoisonGasCloud(state, x, y, rnd(3), 0, random, publish);
        if (visible) await publish('Steam billows from the fountain.');
        rangeChange--;
        await dryFountainAt(x, y, { causedByHero: heroBurnsObjects, state, publish, random });
    } else if (kind === RAY_COLD) {
        rangeChange += await freezeLiquidAt(x, y, state, publish);
    } else if (kind === 'poison' && ZAP_POS(location.typ)) {
        await createPoisonGasCloud(state, x, y, 1, 8, random, publish);
    }

    const damagesBars = location.typ === IRONBARS
        && (kind === RAY_ACID || (kind === RAY_LIGHTNING && random(10) === 0));
    if (damagesBars) {
        const action = kind === RAY_ACID ? 'corrode' : 'melt';
        if ((location.wall_info ?? 0) & W_NONDIGGABLE) {
            if (visible) {
                await publish(
                    `The iron bars ${action} somewhat but remain intact.`,
                    { noRepeat: true },
                );
            }
        } else {
            rangeChange -= 3;
            // The message can pause at --More-- with the beam over intact bars.
            if (visible) {
                await publish(
                    `The iron bars ${action}${kind === RAY_ACID ? ' away' : ''}.`,
                    { noRepeat: true },
                );
            }
            await dissolveBars(x, y, state);
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_BARS_COST : 0, state);
                shopDamage ||= heroCaused;
            }
        }
    }

    if (location.typ === SDOOR) {
        revealSecretDoor(location, state);
        vision_note_blocker_change(x, y);
        newsym(x, y);
        if (visible) {
            await publish(
                `${yourRay ? 'Your' : 'The'} ${rayNoun} reveals a secret door.`,
            );
        }
    }

    let absorbed = false;

    if (closedRayDoor(location)) {
        absorbed = true;
        if (kind === RAY_FIRE || kind === RAY_COLD
            || kind === RAY_DISINTEGRATION || kind === RAY_LIGHTNING
            || wandType === WAN_STRIKING) {
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_DOOR_COST : 0, state);
                shopDamage ||= heroCaused;
            }
            location.doormask = kind === RAY_LIGHTNING || wandType === WAN_STRIKING
                ? D_BROKEN : D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible) {
                await publish(wandType === WAN_STRIKING ? 'The door crashes open!' : destroyedDoorMessage(kind));
                newsym(x, y);
            } else if (wandType === WAN_STRIKING) {
                await publish('You feel a burst of cool air.');
            } else if (kind === RAY_FIRE) {
                await publish('You smell smoke.');
            } else if (kind === RAY_COLD) {
                await publishHeardMessage('a deep cracking sound.', publish, state);
            } else {
                await publishHeardMessage(kind === RAY_DISINTEGRATION ? 'crashing wood.' : 'crackling.', publish, state);
            }
            const occupation = state._occupation;
            if (occupation?.key === 'pick-lock' && occupation.door === location) {
                await stopHeroOccupation(state, publish);
                resetPick(state);
            }
        } else if (visible) {
            await publish(wandType ? 'The door remains intact.'
                : `The door absorbs ${yourRay ? 'your' : 'the'} ${rayNoun}!`);
        } else {
            await publish(formatFeltMessage('vibrations.', state));
        }
    }
    if (absorbed) rangeChange = -1000;
    if (kind === RAY_FIRE) {
        const burned = await burnFloorObjectsAt(x, y, { state, publish, random, heroCaused: heroBurnsObjects });
        if (burned && couldsee(x, y)) {
            const blind = !!state.blind
                || (state.u?.blindTurns ?? 0) > 0;
            await publish(blind
                ? 'You smell a whiff of smoke.'
                : 'You see a puff of smoke.');
        }
    }
    return { absorbed, rangeChange, shopDamage };
}

function destroyedDoorMessage(kind: RayFloorKind) {
    if (kind === RAY_FIRE) return 'The door is consumed in flames!';
    if (kind === RAY_COLD) return 'The door freezes and shatters!';
    if (kind === RAY_DISINTEGRATION) return 'The door disintegrates!';
    return 'The door splinters!';
}

export function applyFireToFloorAt(x: number, y: number, state: GameState = game) {
    return applyRayFloorFeatures(RAY_FIRE, x, y, state);
}

export function monsterHasElementalResistance(monster: Monster, mask: number): boolean {
    return !!(monsterResistanceBits(monster) & mask);
}

export { hitMonsterWithRay, zapRayWithObject } from './ray_attack.js';


function destroyable(object: GameObject, damageType: InventoryDamageType | null | undefined) {
    if (!object || object.artifact || object.oartifact) return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1) return false;
    const itemClass = object.oclass;
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

function protectionChance(state: GameState, damageType: InventoryDamageType) {
    const hero = state.u;
    const properties: Record<InventoryDamageType, PropertyName> = {
        [INVENTORY_DAMAGE.COLD]: 'coldResistance',
        [INVENTORY_DAMAGE.FIRE]: 'fireResistance',
        [INVENTORY_DAMAGE.ELECTRIC]: 'shockResistance',
    };
    const property = properties[damageType];
    if (hasWornProperty(property, state) || heroHasArtifactDefense(damageType, state))
        return 99;
    const cloak = state.uarmc || hero.uarmc;
    return damageType !== INVENTORY_DAMAGE.ELECTRIC
        && cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}

function heroResists(state: GameState, damageType: InventoryDamageType) {
    if (heroHasArtifactDefense(damageType, state)) return true;
    const hero = state.u;
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return !!(hero.fireResistance);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return !!(hero.shockResistance);
    return false;
}

function isWornRing(object: GameObject, state: GameState) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}

function glovesBlockRingShock(object: GameObject, state: GameState) {
    if (!isWornRing(object, state)) return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves) return false;
    const material = objectMaterial(gloves.otyp);
    return material < 11 || material > 17;
}

function destructionMessage(
    object: GameObject, damageType: InventoryDamageType, count: number, quantity: number, state: GameState = game,
) {
    const one = count === 1;
    const prefix = one ? (quantity === 1 ? '' : 'One of ')
        : count < quantity ? 'Some of ' : quantity === 2 ? 'Both of ' : 'All of ';
    // C destroy_items() uses yname()/Yname2(), whose mon_owns() names a pet as "your".
    const name = ownedObjectName(object, state, { capitalized: !prefix });
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${
            one ? 'freezes and shatters' : 'freeze and shatter'
        }!`;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        const wand = object.oclass === WAND_CLASS;
        return `${prefix}${name} ${wand
            ? 'breaks apart and explodes'
            : 'turns to dust and vanishes'}!`;
    }
    if (object.oclass === POTION_CLASS || object.otyp === GLOB_OF_GREEN_SLIME) {
        const verb = object.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}

function itemDamage(object: GameObject, damageType: InventoryDamageType, rollOne: typeof rnd) {
    if (damageType === INVENTORY_DAMAGE.COLD) return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return object.oclass === WAND_CLASS ? rollOne(10) : 0;
    if (object.oclass === POTION_CLASS) return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}

function destroyedItemKiller(object: GameObject, damageType: InventoryDamageType, count: number) {
    let killer;
    if (damageType === INVENTORY_DAMAGE.COLD) killer = 'shattered potion';
    else if (damageType === INVENTORY_DAMAGE.ELECTRIC) killer = 'exploding wand';
    else if (object.oclass === POTION_CLASS)
        killer = object.otyp === POT_OIL ? 'exploding potion' : 'boiling potion';
    else if (object.otyp === GLOB_OF_GREEN_SLIME) killer = 'exploding glob of slime';
    else killer = object.oclass === SPBOOK_CLASS ? 'burning book' : 'burning scroll';
    return count === 1 ? killer : makePlural(killer);
}

async function destroyChosenItem(object: GameObject, damageType: InventoryDamageType, {
    state, publish, random, rollOne, die,
}: ChosenItemDamageOptions): Promise<MagicDamageResult> {
    const unharmed = { damage: 0, heroDied: false };
    const protection = protectionChance(state, damageType);
    if (protection && random(100) < protection) return unharmed;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsBlind(state)) {
            observeObject(object, state);
            await publish(
                `The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`,
            );
        }
        return unharmed;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && object.oclass === RING_CLASS) {
        if (glovesBlockRingShock(object, state)) return unharmed;
        if (OBJECT_CHARGED[object.otyp] && random(3) !== 0)
            return rechargeRing(object, 0, state, { publish, random, rollOne, die });
    }

    const resistant = heroResists(state, damageType);
    const resistanceStopsDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
        ? object.oclass !== RING_CLASS
        : damageType === INVENTORY_DAMAGE.FIRE
            && object.oclass !== POTION_CLASS
            && object.otyp !== GLOB_OF_GREEN_SLIME;
    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = itemDamage(object, damageType, rollOne);
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0) destroyed++;
    }
    if (!destroyed) return unharmed;

    if (!heroIsBlind(state)) observeObject(object, state);
    await publish(destructionMessage(object, damageType, destroyed, quantity, state));
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.oclass === POTION_CLASS) {
        await applySupportedPotionVapor({ state, potion: object, publish });
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    const killer = destroyedItemKiller(object, damageType, destroyed);
    // Native Ring_gone precedes useup, even for a stack with an in-use unit.
    if (isWornRing(object, state)) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
    } else if (object.owornmask) await removeHeroEquipment(object, state);
    if (state._currentWand === object) state._currentWand = null;
    for (let count = 0; count < destroyed; count++) {
        await consumeInventoryItem(object, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
    }
    if (!damage) return unharmed;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return unharmed;
    }
    const heroDied = await loseHeroHp(damage, killer, {
        state, publish, die,
        deathCause: destroyed > 1 ? `killed by ${killer}` : null,
    });
    if (!heroDied) await exerciseAttribute(A_STR, false, state);
    return { damage, heroDied };
}

export async function destroyInventoryByElement(
    damageType: InventoryDamageType | null | undefined, sourceDamage: number,
    {
        state = game, publish = plineWithContinuation,
        random = rn2, rollOne = rnd, die = finishHeroDeath,
    }: InventoryDamageOptions = {},
): Promise<MagicDamageResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const result = { damage: 0, heroDied: false };
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return result;
    const chosen = chooseStacks(state.inventory, damageType, limit, random, state)
        .map(object => ({ object, deferred: deferHeroItemDestruction(object, state) }));
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(state.inventory, false, state);
        return result;
    }
    for (const deferred of [false, true]) {
        for (const entry of chosen) {
            if (entry.deferred !== deferred || !state.inventory.includes(entry.object)) continue;
            const hit = await destroyChosenItem(entry.object, damageType, {
                state, publish, random, rollOne, die,
            });
            result.damage += hit.damage;
            if (hit.heroDied) return { damage: result.damage, heroDied: true };
        }
    }
    bypassObjectList(state.inventory, false, state);
    return result;
}

function deferHeroItemDestruction(object: GameObject, state: GameState) {
    const property = OBJECT_PROPERTY[object.otyp];
    return (!!object.owornmask && (property === 'levitation' || property === 'flying'))
        || (object.otyp === POT_WATER && ismnum(state.u.ulycn)
            && !!(Upolyd(state.u) ? object.blessed : object.cursed));
}

function destructionLimit(sourceDamage: number, random: typeof rn2) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5)) limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}

function chooseStacks(objects: readonly GameObject[], damageType: InventoryDamageType | null | undefined, limit: number, random: typeof rn2, state: GameState): GameObject[] {
    const chosen: (GameObject | null)[] = Array.from({ length: limit }, () => null);
    let eligible = 0;
    // Even a non-elemental blast traverses inventory and activates bypasses.
    bypassObjectList(objects, false, state);
    let object;
    while ((object = nextUnbypassedObject(objects, state))) {
        if (!destroyable(object, damageType)) continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit) chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit)).filter((object): object is GameObject => object !== null);
}

async function removeMonsterQuantity(
    monster: Monster, object: GameObject, count: number, state: GameState, publish: MessagePublisher,
): Promise<void> {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        object.owt = objectWeight(object);
        return;
    }
    await destroyObjectFromMonsterInventory(monster, object, state, { publish });
}

export async function destroyMonsterInventoryByElement(
    monster: Monster,
    damageType: InventoryDamageType | null | undefined,
    sourceDamage: number,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        visible = false,
    }: MonsterInventoryDamageOptions = {},
): Promise<number> {
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(
        inventory, damageType, limit, random, state,
    );
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(inventory, false, state);
        return 0;
    }
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object)) continue;
        if (damageType === INVENTORY_DAMAGE.FIRE
            && object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                observeDistantObjectForNaming(object, state);
                await publish(
                    `The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`,
                );
            }
            continue;
        }
        // Native does not recharge a monster's charged ring, but that outcome
        // still spares the ring and skips its destruction roll.
        if (damageType === INVENTORY_DAMAGE.ELECTRIC
            && object.oclass === RING_CLASS
            && OBJECT_CHARGED[object.otyp] && random(3) !== 0) continue;
        const resistsItemDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
            ? object.oclass !== RING_CLASS && monsterHasShockResistance(monster)
            : damageType === INVENTORY_DAMAGE.FIRE
                && object.oclass !== POTION_CLASS
                && object.otyp !== GLOB_OF_GREEN_SLIME
                && monsterHasFireResistance(monster);
        const stackDamage = itemDamage(object, damageType, rollOne);
        const total = object.quan ?? object.quantity ?? 1;
        const quantity = Math.max(0, total - Number(!!object.in_use));
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        if (visible) {
            observeObjectForNaming(object, { state });
            await publish(destructionMessage(object, damageType, destroyed, quantity, state));
        }
        await removeMonsterQuantity(monster, object, destroyed, state, publish);
        if (!resistsItemDamage) damage += stackDamage;
    }
    bypassObjectList(monster.minvent ?? monster.inventory ?? [], false, state);
    return damage;
}

export function destroyColdMonsterInventory(
    monster: Monster, sourceDamage: number, options: MonsterInventoryDamageOptions = {},
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyFireMonsterInventory(
    monster: Monster, sourceDamage: number, options: MonsterInventoryDamageOptions = {},
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyFireInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyColdInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyElectricInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options,
    );
}
