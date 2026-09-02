// Ray attacks, terrain changes, and elemental item damage.
// C ref: zap.c dobuzz(), zap_over_floor(), zhitm(), zhitu(), and
// destroy_items().

import { findArmorClass } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { findit } from './detect.js';
import {
    A_STR, A_WIS, COLNO, CORR, DB_FLOOR, DB_ICE, DB_LAVA, DB_UNDER, DOOR,
    DRAWBRIDGE_UP,
    D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, HWALL, ICE, ICED_MOAT,
    ICED_POOL, IRONBARS,
    IS_LAVA, IS_POOL, IS_WALL, IS_WATERWALL,
    Is_rogue_level, Is_waterlevel, LAVAWALL, MOAT, PIT, POOL,
    ROOM, ROWNO, SDOOR, STONE,
    SCORR, STRAT_WAITMASK, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, Upolyd,
    VWALL, WEB, WM_MASK, W_NONDIGGABLE, W_RING,
} from './const.js';
import {
    canProjectMonster, flush_screen, lastDirtyMapCursor, newsym,
    pline, plineWithContinuation, shieldeff, show_glyph_cell,
} from './display.js';
import { game } from './gstate.js';
import { putHeroToSleep } from './hero_sleep.js';
import { finishHeroDeath } from './end.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { meltIce } from './ice.js';
import { selectInventoryObject } from './invent.js';
import {
    damageGremlinHeroWithLight, igniteItems, lightRoom,
} from './light.js';
import { doEnlightenmentEffect } from './insight.js';
import { buryFloorObjectsAt, createCritters, maketrap } from './mklev.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { cancelMonster } from './monster_cancellation.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { triggerImmediateMonsterTrap } from './monmove.js';
import { makePlural } from './object_grammar.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE,
    MONSTER_NAME, MONSTER_RESISTS,
    monsterIsNonliving,
} from './monster_data.js';
import {
    DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_CHARGED, OBJECT_MATERIAL,
    OBJECT_NAMES, POT_OIL,
    RIN_PROTECTION, RIN_REGENERATION, RIN_SHOCK_RESISTANCE, SCR_FIRE,
    SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL,
    WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING,
    WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT,
    WAN_LIGHTNING, WAN_MAKE_INVISIBLE, WAN_POLYMORPH,
    WAN_SECRET_DOOR_DETECTION, WAN_SLEEP,
    WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS,
    WAN_STRIKING, WAN_UNDEAD_TURNING, WAN_WISHING,
} from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';
import { objectResistsDestruction } from './object_state.js';
import {
    LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, scheduleLevelTimer,
    stopAllObjectTimers, stopLevelTimer, stopObjectTimer,
} from './object_timers.js';
import { applySupportedPotionVapor } from './potion_hit.js';
import {
    heroHasNoHands, polyselfRandomOrdinary, rehumanizeHero,
} from './polyself.js';
import { createSteamCloud } from './regions.js';
import { d, rn2, rnd } from './rng.js';
import {
    CLR_BRIGHT_BLUE, CLR_ORANGE, CLR_WHITE, NO_COLOR,
} from './terminal.js';
import { burnArmorByFire, burnHeroArmorByFire } from './trap.js';
import { moreUntilDismissed, promptKey } from './tty_prompts.js';
import {
    cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset,
} from './vision.js';
import { objectWeight } from './weight.js';
import { makeWish } from './wish.js';
import { hasWornProperty } from './properties.js';
import {
    captureRayTraversalFrame, clearRayCells, closedRayDoor,
    discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay,
    monsterReflectionSource, monsterReflectsRay, paintRayCell,
    rayBounceDirection, rayHitsHero, rayHitsMonster, rayMonsterAt,
    rayPositionIsOpen, rayPositionIsValid, runRay,
} from './ray.js';
import { changeMonsterSpeedInDirection } from './monster_speed_magic.js';
import { forceBoltInDirection } from './force_bolt.js';
import { makeInvisibleInDirection } from './monster_invisibility_magic.js';
import { turnUndeadInDirection } from './undead_turning.js';
import { clearHeroSliming } from './slime.js';

const RING_CLASS = 4;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const MAX_ITEMS_DESTROYED = 20;
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_SLEEP = 0x04;
const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const PM_DEATH_RIDER = 311;
const M2_DEMON = 0x00000100;
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };
const RAY_FIRE = 'fire';
const RAY_COLD = 'cold';
const RAY_SLEEP = 'sleep';
const RAY_DEATH = 'death';
const RAY_DISINTEGRATION = 'disintegration';
const RAY_LIGHTNING = 'lightning';
const RAY_ACID = 'acid';

export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});

async function zapDig(direction) {
    exerciseAttribute(A_WIS, true);
    const dx = DIR_DX[direction] || 0;
    const dy = DIR_DY[direction] || 0;
    let x = game.u.ux + dx;
    let y = game.u.uy + dy;
    let depth = 8 + rn2(18);
    const traversedCells = [];
    let lastBeamCursor = null;

    while (--depth >= 0 && x >= 1 && x < COLNO && y >= 0 && y < ROWNO) {
        const location = game.level?.at(x, y);
        if (!location) break;
        traversedCells.push({ x, y });
        if (cansee(x, y))
            show_glyph_cell(x, y, '*', CLR_WHITE, false);
        const frameCursor = lastDirtyMapCursor();
        await flush_screen(1);
        if (frameCursor) lastBeamCursor = frameCursor;
        if (lastBeamCursor)
            game.nhDisplay?.setCursor(...lastBeamCursor);
        await game.animationFrame?.();
        if ((location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED)))
            || location.typ === SDOOR) {
            location.typ = DOOR;
            location.doormask = D_NODOOR;
            depth -= 2;
        } else if (IS_WALL(location.typ)) {
            location.typ = DOOR;
            location.doormask = D_NODOOR;
            location.flags = 0;
            depth -= 2;
        } else if (location.typ === STONE || location.typ === SCORR) {
            location.typ = CORR;
            location.flags = 0;
            depth -= 1;
        }
        x += dx;
        y += dy;
    }
    for (const cell of traversedCells) newsym(cell.x, cell.y);
    vision_reset();
    vision_recalc(1);
    exerciseAttribute(A_WIS, true);
}

function wandChargeCount(wand) {
    return Number.isInteger(wand?.spe)
        ? wand.spe : wand?.charges?.current ?? -1;
}

function setWandChargeCount(wand, count) {
    wand.spe = count;
    if (wand.charges) wand.charges.current = count;
}

async function zappable(wand) {
    const charges = wandChargeCount(wand);
    if (charges < 0 || (charges === 0 && rn2(121) !== 0)) return false;
    if (charges === 0)
        await pline('You wrest one last charge from the worn-out wand.');
    setWandChargeCount(wand, charges - 1);
    return true;
}

function removeWand(wand) {
    removeDestroyedQuantity(
        game, wand, wand.quan ?? wand.quantity ?? 1,
    );
}

async function finishWandUse(wand) {
    if (!wand || wandChargeCount(wand) >= 0) return;
    await pline(`The ${className(wand)} turns to dust.`);
    removeWand(wand);
}

async function backfireWand(wand) {
    wand.in_use = true;
    await pline(`The ${className(wand)} suddenly explodes!`);
    let damage = d(Math.max(1, wandChargeCount(wand) + 2), 6);
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    removeWand(wand);
    damageHero(game, damage);

    const polymorphed = Upolyd(game.u);
    const remainingHitPoints = polymorphed ? game.u.mh : game.u.uhp;
    if (remainingHitPoints <= 0) {
        if (polymorphed) {
            const restored = rehumanizeHero(game);
            if (restored.changed)
                await pline(`You return to ${restored.race} form!`);
        } else {
            const died = await finishHeroDeath({ killer: 'exploding wand' });
            if (died) return;
        }
    }
    exerciseAttribute(A_STR, false);
}

function learnNoDirectionWand(wand) {
    if (!wand.dknown) return;
    if (!game._knownObjectTypes?.has(wand.otyp))
        game.u.urexp = (game.u.urexp || 0) + 10;
    recordObjectKnowledge(wand.otyp);
    recordObjectEncounter(wand.otyp);
    wand.typeKnown = true;
}

async function zapNoDirection(wand, { finishMonsterKill } = {}) {
    if (wand.otyp === WAN_LIGHT) {
        await lightRoom(true, { finishMonsterKill });
        await damageGremlinHeroWithLight(wand, { finishHeroDeath });
        if (!game.blind && !((game.u?.blindTurns ?? 0) > 0))
            learnNoDirectionWand(wand);
        return true;
    }
    if (wand.otyp === WAN_SECRET_DOOR_DETECTION) {
        await findit();
        learnNoDirectionWand(wand);
        return true;
    }
    if (wand.otyp === WAN_STASIS) {
        const until = (game.moves ?? 1) + rn2(21) + 10;
        const current = game.level.flags.stasis_until ?? 0;
        game.level.flags.stasis_until = Math.max(current, until);
        return true;
    }
    if (wand.otyp === WAN_CREATE_MONSTER) {
        const count = rn2(23) ? 1 : rn2(7) + 2;
        if (await createCritters(count)) learnNoDirectionWand(wand);
        return true;
    }
    if (wand.otyp === WAN_WISHING) {
        if ((game.u?.uluck ?? 0) + rn2(5) < 0) {
            await pline('Unfortunately, nothing happens.');
        } else {
            await makeWish({ announce: game.flags?.verbose !== false });
            learnNoDirectionWand(wand);
        }
        return true;
    }
    if (wand.otyp === WAN_ENLIGHTENMENT) {
        await doEnlightenmentEffect();
        learnNoDirectionWand(wand);
        return true;
    }
    return false;
}

// C refs: zap.c dozap(), weffects(), and zapyourself().
export async function dozap({
    finishMonsterKill, wakeMonster, gotoLevel,
} = {}) {
    if (heroHasNoHands(game)) {
        await pline("You aren't able to zap anything in your current form.");
        game.context.move = 0;
        return;
    }

    const wands = (game.inventory || []).filter(
        item => item.oclass === WAND_CLASS,
    );
    const letters = wands.map(item => item.invlet).join('');
    let key = await promptKey(
        `What do you want to zap? [${letters} or ?*] `,
    );
    if (key === 63 || key === 42) {
        key = await selectInventoryObject({
            items: wands, includeGold: false, loopUntilValid: true,
        });
    }
    if (key === 27) {
        game.context.move = 0;
        return;
    }
    const wand = wands.find(item =>
        item.invlet === String.fromCharCode(key));
    if (!wand) {
        game.context.move = 0;
        return;
    }
    game._pending_message = '';

    if (!await zappable(wand)) {
        await pline('Nothing happens.');
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    if (wand.cursed && rn2(100) === 0) {
        await backfireWand(wand);
        if (!game.program_state?.gameover) game.context.move = 1;
        return;
    }

    if (await zapNoDirection(wand, { finishMonsterKill })) {
        if (game.program_state?.gameover) return;
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    const direction = await promptKey('In what direction? ');
    game._pending_message = '';
    if (direction === 27) {
        if (!game.blind && !(game.u?.blindTurns > 0))
            await pline(`The ${className(wand)} glows and fades.`);
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    const directionChar = String.fromCharCode(direction);
    if (wand.otyp === WAN_STRIKING) {
        exerciseAttribute(A_WIS, true);
        const identified = await forceBoltInDirection(directionChar, {
            source: 'wand', finishMonsterKill, gotoLevel,
        });
        if (identified && wand.dknown) {
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    if (wand.otyp === WAN_SLOW_MONSTER
        || wand.otyp === WAN_SPEED_MONSTER) {
        exerciseAttribute(A_WIS, true);
        const observed = await changeMonsterSpeedInDirection(directionChar, {
            kind: wand.otyp === WAN_SPEED_MONSTER ? 'speed' : 'slow',
            source: 'wand',
        });
        if (observed && wand.dknown) {
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    if (wand.otyp === WAN_MAKE_INVISIBLE) {
        exerciseAttribute(A_WIS, true);
        const identified = await makeInvisibleInDirection(directionChar);
        if (identified && wand.dknown) {
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    if (wand.otyp === WAN_UNDEAD_TURNING) {
        exerciseAttribute(A_WIS, true);
        await turnUndeadInDirection(directionChar, {
            source: 'wand', finishMonsterKill, wakeMonster,
        });
        if (directionChar === '.') {
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }
    if (wand.otyp === WAN_DIGGING && DIR_DX[directionChar] !== undefined) {
        await zapDig(directionChar);
        wand.known = true;
        wand.typeKnown = true;
        recordObjectKnowledge(wand.otyp);
        recordObjectEncounter(wand.otyp);
        wand.chargesKnown = false;
        game._pending_message = '';
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_DEATH && directionChar === '.') {
        if ((game.u?.confusionTurns || 0) > 0) rn2(5);
        await promptKey('You irradiate yourself with pure energy!--More--');
        await promptKey('You die.--More--');
        game.u.uhp = 0;
        const reflexive = game.flags?.female ? 'herself' : 'himself';
        await finishHeroDeath({
            killer: 'death ray',
            deathCause: `shot ${reflexive} with a death ray`,
            deathLineShown: true,
        });
        if (!game.program_state?.gameover) await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_DEATH && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        const wasUnknown = !game._knownObjectTypes?.has(wand.otyp);
        const deathRay = await zapDeathRay(directionChar, {
            dismissMessage: moreUntilDismissed,
            finishHeroHit: () => finishHeroDeath({ killer: 'death ray' }),
            finishMonsterKill,
        });
        if (deathRay.gameEnded) return;
        if (wand.dknown) {
            if (wasUnknown) exerciseAttribute(A_WIS, true);
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_POLYMORPH && directionChar === '.') {
        const alreadyKnown = game._knownObjectTypes?.has(wand.otyp);
        const result = await polyselfRandomOrdinary();
        if (result.learnEffect && wand.dknown && !alreadyKnown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
            exerciseAttribute(A_WIS, true);
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_SLEEP && directionChar === '.') {
        exerciseAttribute(A_WIS, true);
        if (game.u?.sleepResistance) {
            await shieldeff(game.u.ux, game.u.uy);
            await pline("You don't feel sleepy!");
        } else {
            await pline('The sleep ray hits you!');
            putHeroToSleep(rnd(50));
        }
        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        game._knownObjectTypes.add(wand.otyp);
        wand.typeKnown = true;
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_SLEEP && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        await zapSleepRay(directionChar);
        if (wand.dknown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_COLD && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        const wasUnknown = !game._knownObjectTypes?.has(wand.otyp);
        const coldRay = await zapColdRay(directionChar, {
            finishMonsterKill,
        });
        if (coldRay.heroDied
            && await finishHeroDeath({ killer: 'bolt of cold' })) return;
        if (wand.dknown) {
            if (wasUnknown) exerciseAttribute(A_WIS, true);
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        if (wasUnknown)
            game.u.urexp = (game.u.urexp || 0) + 10;
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_FIRE && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        const fireRay = await zapFireRay(directionChar, {
            finishMonsterKill,
            wakeMonsters: wakeMonstersNearWithMessages,
        });
        if (fireRay.heroDied
            && await finishHeroDeath({ killer: 'bolt of fire' })) return;
        if (wand.dknown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    if (wand.otyp === WAN_CANCELLATION
        && DIR_DX[directionChar] !== undefined && directionChar !== '.') {
        await zapCancellationRay(directionChar, { wakeMonster });
        wand.chargesKnown = false;
        game.context.move = 1;
        await finishWandUse(wand);
        return;
    }

    game.context.move = 1;
    await finishWandUse(wand);
}

function removeWebAt(x, y, state = game) {
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
        const monster = state.level?.monsters?.find(candidate =>
            candidate.mx === x && candidate.my === y,
        );
        if (monster) monster.mtrapped = 0;
    }
    state.level.traps.splice(state.level.traps.indexOf(trap), 1);
    return true;
}

function revealSecretDoor(location, state = game) {
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

function floorObjectBurns(object) {
    return object?.otyp === GLOB_OF_GREEN_SLIME
        || object?.oclass === SCROLL_CLASS
        || object?.oclass === SPBOOK_CLASS;
}

function removeBurnedFloorQuantity(pile, object, count) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        object.owt = objectWeight(object);
        return;
    }
    const index = pile.indexOf(object);
    if (index >= 0) pile.splice(index, 1);
    stopAllObjectTimers(object);
    object.where = 'gone';
    object.ox = 0;
    object.oy = 0;
}

function floorBurnMessage(object, destroyed) {
    const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
    if (destroyed === 1) return `A ${name} burns.`;
    return `${destroyed} ${makePlural(name)} burn.`;
}

export async function burnFloorObjectsAt(
    x,
    y,
    {
        state = game,
        giveFeedback = false,
    } = {},
) {
    const pile = state.level?.objects?.[x]?.[y] || [];
    let burned = 0;
    for (const object of [...pile]) {
        if (!floorObjectBurns(object)
            || object.otyp === SCR_FIRE
            || object.otyp === SPE_FIREBALL
            || objectResistsDestruction(object, 2, 100)) continue;
        const quantity = object.quan ?? object.quantity ?? 1;
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (rn2(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        removeBurnedFloorQuantity(pile, object, destroyed);
        burned += destroyed;
        if (giveFeedback)
            await plineWithContinuation(floorBurnMessage(object, destroyed));
    }

    await igniteItems(pile, {
        state,
        publish: plineWithContinuation,
        visible: cansee(x, y),
    });
    if (burned && couldsee(x, y)) newsym(x, y);
    return burned;
}

export function startMeltIceTimer(
    x, y, minimumTime = 0, state = game, random = rn2,
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

function firmExistingIce(x, y, state = game) {
    const timer = state.level?.levelTimers?.find(candidate =>
        candidate.x === x && candidate.y === y
        && candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY,
    );
    if (!timer) return;
    const remaining = Math.max(0, timer.deadline - (state.moves ?? 0));
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    startMeltIceTimer(x, y, remaining, state);
}

function liquidMonsterAt(x, y, state = game) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function revealStrandedSwimmer(x, y, state = game) {
    const monster = liquidMonsterAt(x, y, state);
    if (!monster || !monster.mundetected
        || !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000002)) return;
    monster.mundetected = 0;
    newsym(x, y);
}

async function freezeLiquidAt(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location) return 0;
    if (location.typ === ICE) {
        firmExistingIce(x, y, state);
        return 0;
    }

    const lavaWall = location.typ === LAVAWALL;
    const drawbridgeLava = location.typ === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_LAVA;
    const lava = IS_LAVA(location.typ) || drawbridgeLava;
    if (!IS_POOL(location.typ) && !lava) return 0;

    const visible = cansee(x, y);
    const deaf = !!(state.u?.deaf || state.deaf);
    const temperature = state.level?.flags?.temperature || 0;
    const briefFreeze = IS_WATERWALL(location.typ)
        || (lavaWall && rn2(Math.max(2, 5 + temperature * 10)) !== 0);
    if (briefFreeze) {
        if (visible) {
            await plineWithContinuation(
                `The ${lavaWall ? 'lava' : 'water'} freezes for a moment.`,
            );
        } else if (!deaf) {
            await plineWithContinuation('You hear a soft crackling.');
        }
        return -1000;
    }

    const wasMoat = location.typ === MOAT;
    if (location.typ === DRAWBRIDGE_UP) {
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_UNDER;
        location.drawbridgemask |= lava ? DB_FLOOR : DB_ICE;
    } else {
        location.icedpool = lava ? 0
            : location.typ === POOL ? ICED_POOL : ICED_MOAT;
        if (lavaWall) {
            const north = state.level?.at(x, y - 1);
            const south = state.level?.at(x, y + 1);
            location.typ = IS_WALL(north?.typ) || IS_WALL(south?.typ)
                ? VWALL : HWALL;
        } else {
            location.typ = lava ? ROOM : ICE;
        }
    }

    buryFloorObjectsAt(x, y, state);
    if (visible) {
        const message = lava
            ? 'The lava cools and solidifies.'
            : wasMoat ? 'The moat is bridged with ice!'
                : 'The water freezes.';
        await plineWithContinuation(message);
        newsym(x, y);
    } else if (!lava && !deaf) {
        await plineWithContinuation('You hear a crackling sound.');
    }

    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.uinwater) {
            state.u.uinwater = 0;
            state.u.uundetected = 0;
            state.vision_full_recalc = 1;
        } else if (state.u.utrap && state.u.utraptype === TT_LAVA) {
            if (state.u.passesWalls || state.u.passes_walls) {
                state.u.utrap = 0;
                state.u.utraptype = 0;
                await plineWithContinuation(
                    'You pass through the now-solid rock.',
                );
            } else {
                state.u.utrap = rnd(50) + 19;
                state.u.utraptype = TT_INFLOOR;
                await plineWithContinuation(
                    'You are firmly stuck in the cooling rock.',
                );
            }
        }
    } else {
        revealStrandedSwimmer(x, y, state);
    }

    if (!lava) startMeltIceTimer(x, y, 0, state);
    vision_note_blocker_change(x, y);
    return -3;
}

async function evaporatePoolAt(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location || !IS_POOL(location.typ)) return 0;
    const visible = cansee(x, y);
    const deaf = !!(state.u?.deaf || state.deaf);
    const waterLevel = Is_waterlevel(state.u?.uz);
    if (!waterLevel) createSteamCloud(state, x, y, rnd(5));

    let message = !deaf ? 'You hear hissing gas.'
        : 'That seemed remarkably uneventful.';
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
    if (message) await plineWithContinuation(message);

    if (location.typ === ROOM) {
        revealStrandedSwimmer(x, y, state);
        newsym(x, y);
        const monster = liquidMonsterAt(x, y, state);
        if (pit && monster)
            triggerImmediateMonsterTrap(monster, state);
    }
    return rangeChange;
}

export async function applyRayFloorFeatures(
    kind, x, y, state = game,
    { wakeMonsters, rayNoun = 'bolt', random = rn2 } = {},
) {
    const location = state.level?.at(x, y);
    if (!location) return { absorbed: false, rangeChange: 0 };
    const visible = cansee(x, y);
    let rangeChange = 0;

    if (kind === RAY_FIRE && removeWebAt(x, y, state)) {
        if (visible)
            await plineWithContinuation('A web bursts into flames!');
        newsym(x, y);
    }

    if (kind === RAY_FIRE && location.typ === ICE) {
        await meltIce(x, y, { wake: wakeMonsters });
    } else if (kind === RAY_FIRE) {
        rangeChange += await evaporatePoolAt(x, y, state);
    }

    const damagesBars = kind === RAY_ACID
        || (kind === RAY_LIGHTNING && random(10) === 0);
    if (damagesBars && location.typ === IRONBARS) {
        const action = kind === RAY_ACID ? 'corrode' : 'melt';
        if ((location.wall_info ?? 0) & W_NONDIGGABLE) {
            if (visible) {
                await plineWithContinuation(
                    `The iron bars ${action} somewhat but remain intact.`,
                );
            }
        } else {
            rangeChange -= 3;
            location.typ = ROOM;
            location.flags = 0;
            location.wall_info = 0;
            vision_note_blocker_change(x, y);
            if (visible) {
                await plineWithContinuation(
                    `The iron bars ${action}${
                        kind === RAY_ACID ? ' away' : ''}.`,
                );
                newsym(x, y);
            }
        }
    }

    if (location.typ === SDOOR) {
        revealSecretDoor(location, state);
        vision_note_blocker_change(x, y);
        newsym(x, y);
        if (visible) {
            await plineWithContinuation(
                `Your ${rayNoun} reveals a secret door.`,
            );
        }
    }

    let absorbed = false;

    if (closedRayDoor(location)) {
        absorbed = true;
        if (kind === RAY_FIRE || kind === RAY_COLD
            || kind === RAY_DISINTEGRATION || kind === RAY_LIGHTNING) {
            location.doormask = kind === RAY_LIGHTNING
                ? D_BROKEN : D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible) {
                await plineWithContinuation(destroyedDoorMessage(kind));
                newsym(x, y);
            } else if (kind === RAY_FIRE) {
                await plineWithContinuation('You smell smoke.');
            } else if (!(state.u?.deaf || state.deaf)
                && kind === RAY_COLD) {
                await plineWithContinuation(
                    'You hear a deep cracking sound.',
                );
            } else if (!(state.u?.deaf || state.deaf)) {
                await plineWithContinuation(kind === RAY_DISINTEGRATION
                    ? 'You hear crashing wood.'
                    : 'You hear crackling.');
            }
        } else if (visible) {
            await plineWithContinuation(
                `The door absorbs your ${rayNoun}!`,
            );
        } else {
            await plineWithContinuation('You feel vibrations.');
        }
    }
    if (absorbed) rangeChange = -1000;
    if (kind === RAY_COLD)
        rangeChange += await freezeLiquidAt(x, y, state);
    if (kind === RAY_FIRE) {
        const burned = await burnFloorObjectsAt(x, y, { state });
        if (burned && couldsee(x, y)) {
            const blind = !!state.blind
                || (state.u?.blindTurns ?? 0) > 0;
            await plineWithContinuation(blind
                ? 'You smell a whiff of smoke.'
                : 'You see a puff of smoke.');
        }
    }
    return { absorbed, rangeChange };
}

function destroyedDoorMessage(kind) {
    if (kind === RAY_FIRE) return 'The door is consumed in flames!';
    if (kind === RAY_COLD) return 'The door freezes and shatters!';
    if (kind === RAY_DISINTEGRATION) return 'The door disintegrates!';
    return 'The door splinters!';
}

export function applyFireToFloorAt(x, y, state = game) {
    return applyRayFloorFeatures(RAY_FIRE, x, y, state);
}

export function monsterHasElementalResistance(monster, mask, explicit) {
    return !!((MONSTER_RESISTS[monster?.mnum] || 0) & mask)
        || !!monster?.[explicit];
}

export function monsterResistsRayDamage(monster, random, rollOne) {
    const attackLevel = 12;
    const defenseLevel = Math.max(1, Math.min(
        50, monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 1,
    ));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return random(100 + attackLevel - defenseLevel) < magicResistance;
}

function monsterIgnoresDeathRay(monster) {
    return monster?.mnum === PM_DEATH_RIDER
        || monsterIsNonliving(monster?.mnum)
        || !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_DEMON)
        || !!monster?.vampshifter
        || !!monster?.resistsMagic;
}

export function sleepMonsterFromRay(
    monster,
    {
        dice = 6,
        random = rn2,
        rollDice = d,
    } = {},
) {
    const duration = rollDice(dice, 25);
    const inherentlyResistant = !!((MONSTER_RESISTS[monster.mnum] || 0)
        & MR_SLEEP);
    let resisted = inherentlyResistant || !!monster.defendedSleep;
    if (!resisted) {
        const attackLevel = 12;
        const defenseLevel = Math.max(1, Math.min(
            50, monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 1,
        ));
        const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
        resisted = random(100 + attackLevel - defenseLevel) < magicResistance;
    }
    if (resisted || monster.mcanmove === 0) return false;

    monster.mcanmove = 0;
    monster.mfrozen = Math.min(duration + (monster.mfrozen || 0), 127);
    monster.meating = 0;
    return true;
}

export async function coldRayDamageMonster(
    monster,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
        dice = 6,
    } = {},
) {
    if (monsterHasElementalResistance(
        monster, MR_COLD, 'defendedCold',
    )) {
        await shieldeff(monster.mx, monster.my, state);
        return { damage: 0, resisted: true };
    }

    let damage = rollDice(dice, 6);
    const sourceDamage = damage;
    if (monsterHasElementalResistance(monster, MR_FIRE, 'defendedFire'))
        damage += rollDice(dice, 3);
    if (random(3) === 0) {
        damage += await destroyColdMonsterInventory(monster, sourceDamage, {
            carrierName: MONSTER_NAME[monster.mnum] || 'monster',
            publish,
            random,
            rollOne,
            visible: canProjectMonster(monster, monster.mx, monster.my),
        });
    }
    if (damage > 0 && monsterResistsRayDamage(
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
        dice = 6,
    } = {},
) {
    if (monsterHasElementalResistance(
        monster, MR_FIRE, 'defendedFire',
    )) {
        await shieldeff(monster.mx, monster.my, state);
        return { damage: 0, resisted: true };
    }

    let damage = rollDice(dice, 6);
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
        await igniteItems(monster.minvent || monster.inventory, {
            carrierName,
            state,
            publish,
            random,
            visible: canProjectMonster(monster, monster.mx, monster.my),
        });
    }
    if (damage > 0 && monsterResistsRayDamage(
        monster, random, rollOne,
    )) damage = Math.trunc(damage / 2);
    monster.mhp = (monster.mhp ?? 1) - damage;
    return { damage, resisted: false };
}

export async function zapColdRay(
    direction,
    { finishMonsterKill, exerciseWisdom = true } = {},
) {
    return zapElementalRay(direction, {
        kind: RAY_COLD,
        color: CLR_WHITE,
        finishMonsterKill,
        exerciseWisdom,
    });
}

export async function zapFireRay(
    direction,
    { finishMonsterKill, wakeMonsters, exerciseWisdom = true } = {},
) {
    return zapElementalRay(direction, {
        kind: RAY_FIRE,
        color: CLR_ORANGE,
        finishMonsterKill,
        wakeMonsters,
        exerciseWisdom,
    });
}

async function zapElementalRay(direction, {
    kind,
    color,
    finishMonsterKill,
    wakeMonsters,
    exerciseWisdom,
}) {
    if (exerciseWisdom) exerciseAttribute(A_WIS, true);
    const label = `bolt of ${kind}`;
    const context = { kind, label, finishMonsterKill, wakeMonsters };
    const stopped = await runRay({
        direction,
        range: 7 + rn2(7),
        color,
        onCell: cell => hitElementalRayCell(cell, context),
        onBounce: () => plineWithContinuation(
            `The ${label} bounces!`,
        ),
        onVanish: () => plineWithContinuation(
            `The ${label} vanishes into the aether!`,
        ),
    });
    return stopped || { heroDied: false };
}

async function hitElementalRayCell(
    { x, y, remainingRange }, context,
) {
    const floor = await applyRayFloorFeatures(
        context.kind, x, y, game, { wakeMonsters: context.wakeMonsters },
    );
    let reflected = false;
    let rangeChange = floor.rangeChange;
    const monster = floor.absorbed ? null : rayMonsterAt(x, y);

    if (monster) {
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        if (rayHitsMonster(monster)) {
            rangeChange -= 2;
            if (monsterReflectsRay(monster)) {
                await showReflectedMonsterRay(monster, context.label);
                reflected = true;
            } else {
                await hitMonsterWithElementalRay(monster, x, y, context);
            }
        } else if (canProjectMonster(monster, x, y)) {
            const name = MONSTER_NAME[monster.mnum] || 'monster';
            await plineWithContinuation(
                `The ${context.label} misses the ${name}.`,
            );
        }
    } else if (!floor.absorbed
        && x === game.u.ux && y === game.u.uy && remainingRange >= 0) {
        const hero = await hitHeroWithElementalRay(context);
        rangeChange -= hero.hit ? 2 : 0;
        reflected = hero.reflected;
        if (hero.heroDied) {
            return {
                stop: true,
                result: { heroDied: true },
            };
        }
    }

    return { absorbed: floor.absorbed, rangeChange, reflected };
}

async function hitMonsterWithElementalRay(monster, x, y, context) {
    const result = context.kind === RAY_FIRE
        ? await fireRayDamageMonster(monster)
        : await coldRayDamageMonster(monster);
    if ((monster.mhp ?? 0) <= 0) {
        await context.finishMonsterKill?.(monster, x, y, {
            weaponHit: false,
            noCorpse: context.kind === RAY_FIRE
                && [PM_STRAW_GOLEM, PM_PAPER_GOLEM].includes(monster.mnum),
        });
        return;
    }
    if (canProjectMonster(monster, x, y)) {
        const name = MONSTER_NAME[monster.mnum] || 'monster';
        await plineWithContinuation(
            `The ${context.label} hits the ${name}${
                result.damage <= 4 ? '.' : '!'
            }`,
        );
    }
    monster.msleeping = 0;
}

async function showReflectedMonsterRay(monster, label) {
    if (!canProjectMonster(monster, monster.mx, monster.my)) return;
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    const source = monsterReflectionSource(monster);
    await plineWithContinuation(`The ${label} hits the ${name}.`);
    await shieldeff(monster.mx, monster.my);
    await plineWithContinuation(
        `But it reflects from the ${name}'s ${source?.noun || 'body'}!`,
    );
}

async function hitHeroWithElementalRay(context) {
    if (!rayHitsHero()) {
        await plineWithContinuation(
            `The ${context.label} whizzes by you!`,
        );
        return { hit: false, reflected: false, heroDied: false };
    }

    await plineWithContinuation(`The ${context.label} hits you!`);
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
        return { hit: true, reflected: true, heroDied: false };
    }

    const heroDied = context.kind === RAY_FIRE
        ? await burnHeroWithRay()
        : await freezeHeroWithRay();
    return { hit: true, reflected: false, heroDied };
}

async function freezeHeroWithRay() {
    const damage = d(6, 6);
    const resistant = !!(game.u?.coldResistance
        || game.u?.cold_resistance);
    if (resistant) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation("You don't feel cold.");
    }
    if (rn2(3) === 0) await destroyColdInventory(damage);
    applyElementalRayDamage(resistant ? 0 : damage);
    return game.u.uhp <= 0;
}

async function burnHeroWithRay() {
    const damage = d(6, 6);
    const resistant = !!(game.u?.fireResistance
        || game.u?.fire_resistance);
    if (resistant) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation("You don't feel hot!");
    }
    if (clearHeroSliming(game)) {
        await plineWithContinuation(
            'The slime that covers you is burned away!',
        );
    }
    const bodyHit = await burnHeroArmorByFire(
        game, plineWithContinuation, [], rn2,
    );
    if (bodyHit && rn2(3) === 0)
        await destroyFireInventory(damage);
    if (bodyHit && rn2(3) === 0) {
        await igniteItems(game.inventory, {
            state: game,
            publish: plineWithContinuation,
        });
    }
    applyElementalRayDamage(resistant ? 0 : damage);
    return game.u.uhp <= 0;
}

function applyElementalRayDamage(damage) {
    let appliedDamage = damage;
    if (appliedDamage
        && (game.u?.halfSpellDamage || game.u?.half_spell_damage)) {
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    }
    game.u.uhp = Math.max(0, (game.u.uhp || 0) - appliedDamage);
}

export async function zapSleepRay(direction) {
    exerciseAttribute(A_WIS, true);
    const output = { showedMessage: false };
    await runRay({
        direction,
        range: 7 + rn2(7),
        color: CLR_BRIGHT_BLUE,
        onCell: cell => hitSleepRayCell(cell, output),
        onBounce: async () => {
            await plineWithContinuation('The sleep ray bounces!');
            output.showedMessage = true;
        },
        onVanish: async () => {
            await plineWithContinuation(
                'The sleep ray vanishes into the aether!',
            );
            output.showedMessage = true;
        },
    });
    if (!output.showedMessage) game._pending_message = '';
}

async function hitSleepRayCell({ x, y, remainingRange }, output) {
    const floor = await applyRayFloorFeatures(RAY_SLEEP, x, y);
    let reflected = false;
    let rangeChange = floor.rangeChange;
    const monster = floor.absorbed ? null : rayMonsterAt(x, y);

    if (monster) {
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        if (rayHitsMonster(monster)) {
            rangeChange -= 2;
            if (monsterReflectsRay(monster)) {
                await showReflectedMonsterRay(monster, 'sleep ray');
                reflected = true;
            } else {
                sleepMonsterFromRay(monster);
                const name = MONSTER_NAME[monster.mnum] || 'monster';
                await plineWithContinuation(
                    `The sleep ray hits the ${name}.`,
                );
            }
            output.showedMessage = true;
        } else if (canProjectMonster(monster, x, y)) {
            const name = MONSTER_NAME[monster.mnum] || 'monster';
            await plineWithContinuation(
                `The sleep ray misses the ${name}.`,
            );
            output.showedMessage = true;
        }
    } else if (!floor.absorbed
        && x === game.u.ux && y === game.u.uy && remainingRange >= 0) {
        const hero = await hitHeroWithSleepRay();
        rangeChange -= hero.hit ? 2 : 0;
        reflected = hero.reflected;
        output.showedMessage = true;
    }

    return { absorbed: floor.absorbed, rangeChange, reflected };
}

async function hitHeroWithSleepRay() {
    if (!rayHitsHero()) {
        await plineWithContinuation('The sleep ray whizzes by you!');
        return { hit: false, reflected: false };
    }

    await plineWithContinuation('The sleep ray hits you!');
    const source = heroReflectionSource();
    if (heroReflectsRay()) {
        await plineWithContinuation(
            `But it reflects from your ${source?.noun || 'shield'}!`,
        );
        await shieldeff(game.u.ux, game.u.uy);
        if (source) discoverHeroReflectionSource(source);
        return { hit: true, reflected: true };
    }
    if (game.u?.sleepResistance) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation("You don't feel sleepy.");
    } else {
        putHeroToSleep(d(6, 25));
    }
    return { hit: true, reflected: false };
}

function strengthenDeath(monster) {
    const oldMaximum = monster.mhpmax ?? 1;
    const healing = Math.trunc(oldMaximum * 3 / 2);
    const extraMaximum = Math.trunc(oldMaximum / 2);
    if ((monster.mhp ?? 1) + healing > oldMaximum + extraMaximum) {
        monster.mhpmax = oldMaximum + extraMaximum;
        monster.mhp = monster.mhpmax;
    } else {
        monster.mhp = (monster.mhp ?? 1) + healing;
        monster.mhpmax = Math.max(oldMaximum, monster.mhp);
    }
    if (monster.mhpmax >= 1000) monster.mhpmax = 999;
}

export async function zapDeathRay(
    direction,
    {
        dismissMessage,
        finishHeroHit,
        finishMonsterKill,
    } = {},
) {
    exerciseAttribute(A_WIS, true);
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    const beamCells = new Map();
    let pendingMapCursor = null;

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;
        let absorbedByClosedDoor = false;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                const beamGlyph = dy === 0 ? 'q' : dx === 0 ? 'x'
                    : dx === dy ? '\\' : '/';
                const straight = dx === 0 || dy === 0;
                const beamLocation = game.level?.at(x, y);
                const beamChanged = beamLocation?.disp_ch !== beamGlyph
                    || beamLocation?.disp_color !== NO_COLOR
                    || !!beamLocation?.disp_decgfx !== straight;
                paintRayCell(beamCells, x, y, dx, dy, NO_COLOR);
                await flush_screen(1);
                let animationCursor = [x, y + 1];
                if (beamChanged && pendingMapCursor
                    && (pendingMapCursor[1] > animationCursor[1]
                        || (pendingMapCursor[1] === animationCursor[1]
                            && pendingMapCursor[0]
                                > animationCursor[0]))) {
                    animationCursor = pendingMapCursor;
                } else if (!beamChanged && pendingMapCursor) {
                    animationCursor = pendingMapCursor;
                }
                game.nhDisplay?.setCursor(...animationCursor);
                await game.animationFrame?.();
                pendingMapCursor = null;
            }

            const floor = await applyRayFloorFeatures(RAY_DEATH, x, y);
            absorbedByClosedDoor = floor.absorbed;
            range += floor.rangeChange;

            const monster = absorbedByClosedDoor
                ? null : rayMonsterAt(x, y);
            if (monster) {
                monster.mstrategy = (monster.mstrategy || 0)
                    & ~STRAT_WAITMASK;
                if (rayHitsMonster(monster)) {
                    if (monsterReflectsRay(monster)) {
                        if (canProjectMonster(monster, x, y)) {
                            const name = MONSTER_NAME[monster.mnum]
                                || 'monster';
                            await plineWithContinuation(
                                `The death ray hits the ${name}.`,
                            );
                            await shieldeff(x, y);
                            await plineWithContinuation('But it reflects!');
                        }
                        dx = -dx;
                        dy = -dy;
                    } else if (monster.mnum === PM_DEATH_RIDER) {
                        strengthenDeath(monster);
                        if (canProjectMonster(monster, x, y)) {
                            await plineWithContinuation(
                                'The death ray hits Death.',
                            );
                            await plineWithContinuation(
                                'Death absorbs the deadly ray!',
                            );
                            await plineWithContinuation(
                                'It seems even stronger than before.',
                            );
                        }
                        range = 0;
                    } else if (monsterIgnoresDeathRay(monster)) {
                        if (canProjectMonster(monster, x, y)) {
                            const name = MONSTER_NAME[monster.mnum]
                                || 'monster';
                            await plineWithContinuation(
                                `The death ray hits the ${name}.`,
                            );
                            await shieldeff(x, y);
                        }
                    } else {
                        const deathCursor = [monster.mx, monster.my + 1];
                        monster.mhp = 0;
                        await finishMonsterKill(monster, x, y, {
                            showKillMessage: true,
                            weaponHit: false,
                        });
                        pendingMapCursor = deathCursor;
                    }
                    range -= 2;
                } else if (cansee(x, y)) {
                    const name = MONSTER_NAME[monster.mnum] || 'monster';
                    await plineWithContinuation(
                        `The death ray misses the ${name}.`,
                    );
                }
            } else if (!absorbedByClosedDoor
                && x === game.u.ux && y === game.u.uy && range >= 0) {
                if (rayHitsHero()) {
                    range -= 2;
                    await plineWithContinuation('The death ray hits you!');
                    const reflectionSource = heroReflectionSource();
                    if (heroReflectsRay()) {
                        const pending = game._pending_message;
                        if (pending) {
                            await dismissMessage(`${pending}--More--`);
                        }
                        await pline(`But it reflects from your ${
                            reflectionSource?.noun || 'shield'
                        }!`);
                        await shieldeff(game.u.ux, game.u.uy);
                        if (reflectionSource)
                            discoverHeroReflectionSource(reflectionSource);
                        dx = -dx;
                        dy = -dy;
                    } else if (await finishHeroHit()) {
                        return { gameEnded: true };
                    }
                } else {
                    await plineWithContinuation(
                        'The death ray whizzes by you!',
                    );
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            if (absorbedByClosedDoor) break;
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The death ray bounces!');
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }

    clearRayCells(beamCells);
    return { gameEnded: false };
}

export async function zapCancellationRay(
    direction,
    {
        wakeMonster = async () => {},
        finishMonsterKill = finishHeroMonsterKill,
        random = rn2,
    } = {},
) {
    exerciseAttribute(A_WIS, true);
    const dx = DIR_DX[direction] || 0;
    const dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 6 + random(8);

    while (range-- > 0) {
        x += dx;
        y += dy;
        if (!rayPositionIsValid(x, y) || !rayPositionIsOpen(x, y)) break;
        const monster = rayMonsterAt(x, y);
        if (!monster) continue;

        revealMonsterAppearance(monster);
        const result = await cancelMonster(monster, {
            attackLevel: 12,
            finishMonsterKill,
            random,
        });
        if (!result.killed) await wakeMonster(monster);
        break;
    }
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
    if (hasWornProperty(property, state)) return 99;
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
    exerciseAttribute(A_STR, false, state);
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
    if (![INVENTORY_DAMAGE.COLD, INVENTORY_DAMAGE.FIRE,
        INVENTORY_DAMAGE.ELECTRIC]
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

export async function zapHeroWithFire() {
    const damage = d(12, 6);
    const resistant = !!(game.u?.fireResistance
        || game.u?.fire_resistance);
    if (resistant) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation('You feel rather warm.');
    } else {
        await plineWithContinuation("You've set yourself afire!");
    }

    if (clearHeroSliming(game)) {
        await plineWithContinuation(
            'The slime that covers you is burned away!',
        );
    }
    await burnHeroArmorByFire(game, plineWithContinuation, [], rn2);
    await destroyFireInventory(damage);
    await igniteItems(game.inventory, {
        state: game,
        publish: plineWithContinuation,
    });
    if (!resistant)
        game.u.uhp = Math.max(0, (game.u.uhp || 0) - damage);
    return { damage: resistant ? 0 : damage, heroDied: game.u.uhp <= 0 };
}

export async function zapHeroWithCold() {
    const damage = d(12, 6);
    const resistant = !!(game.u?.coldResistance
        || game.u?.cold_resistance);
    if (resistant) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation('You feel a little chill.');
    } else {
        await plineWithContinuation('You imitate a popsicle!');
    }
    await destroyColdInventory(damage);
    if (!resistant)
        game.u.uhp = Math.max(0, (game.u.uhp || 0) - damage);
    return { damage: resistant ? 0 : damage, heroDied: game.u.uhp <= 0 };
}

export function destroyElectricInventory(sourceDamage, options) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options,
    );
}
