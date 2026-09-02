// Object light and burn timers.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.

import { game } from './gstate.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_WIS, CORR, G_GONE, Is_rogue_level, Is_waterlevel, MM_EDOG, MM_NOMSG,
    NO_MINVENT, Upolyd,
} from './const.js';
import {
    canSeeMonster, canSpotMonster, map_invisible, newsym,
    plineWithContinuation,
} from './display.js';
import { tameMonster } from './dog.js';
import { makemonNear } from './mklev.js';
import { wakeMonstersNear } from './mon.js';
import {
    MONSTER_SYMBOL, monsterDigests, monsterTypeName,
} from './monster_data.js';
import {
    BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, MAGIC_LAMP, OBJECT_NAMES,
    OIL_LAMP, POT_OIL, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, scheduleObjectTimer,
    stopObjectTimer,
} from './object_timers.js';
import { rehumanizeHero } from './polyself.js';
import { roomForRoomno } from './room.js';
import { rn2, rnd } from './rng.js';
import { makePlural } from './object_grammar.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { cansee, clearAreaCells, vision_recalc } from './vision.js';
import { objectWeight } from './weight.js';

const CANDLE_TYPES = new Set([
    CANDELABRUM_OF_INVOCATION, TALLOW_CANDLE, WAX_CANDLE,
]);
const TIMED_LIGHT_TYPES = new Set([
    BRASS_LANTERN, OIL_LAMP, POT_OIL, ...CANDLE_TYPES,
]);
const LIGHT_TYPES = new Set([...TIMED_LIGHT_TYPES, MAGIC_LAMP]);
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const PM_GREMLIN = 40;
const PM_YELLOW_LIGHT = 118;
const PM_BLACK_LIGHT = 119;
const PM_AIR_ELEMENTAL = 154;
const S_VORTEX = 22;

function heroIsBlind() {
    return !!(game.blind || (game.u?.blindTurns ?? 0) > 0);
}

function swallowedLightMessage() {
    const swallower = game.u?.ustuck;
    if (!swallower) return null;
    const name = swallower.name
        || monsterTypeName(swallower.mnum, !!swallower.female);
    const subject = `The ${name}`;
    if (monsterDigests(swallower)) return `${subject}'s stomach is lit.`;
    const whirly = MONSTER_SYMBOL[swallower.mnum] === S_VORTEX
        || swallower.mnum === PM_AIR_ELEMENTAL;
    return whirly
        ? `${subject} shines briefly.`
        : `${subject} glistens.`;
}

function roomEffectCells(radius, lit) {
    if (!Is_rogue_level(game.u?.uz))
        return clearAreaCells(game.u.ux, game.u.uy, radius);

    const roomno = game.level?.at?.(game.u.ux, game.u.uy)?.roomno;
    const room = roomForRoomno(game.level, roomno);
    if (!room) return [];
    const cells = [];
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++)
            cells.push({ x, y });
    }
    room.rlit = lit ? 1 : 0;
    return cells;
}

function snuffOrdinaryLight(object) {
    if (!object?.lamplit || !LIGHT_TYPES.has(object.otyp)) return false;
    return endObjectBurn(object, game, game.moves ?? 0);
}

function snuffLightsAt(x, y) {
    for (const object of game.level?.objects?.[x]?.[y] || [])
        snuffOrdinaryLight(object);
    const carrier = game.level?.monsters?.find(monster =>
        monster.mx === x && monster.my === y);
    if (!carrier) return;
    const inventories = new Set([carrier.minvent, carrier.inventory]);
    for (const inventory of inventories) {
        for (const object of inventory || []) snuffOrdinaryLight(object);
    }
}

function darkenCarriedLights() {
    let stillLit = 0;
    for (const object of game.inventory || []) {
        if (!object.lamplit) continue;
        if (!snuffOrdinaryLight(object)) stillLit++;
    }
    return stillLit;
}

async function lightHitsGremlin(
    monster, damage, finishMonsterKill,
) {
    const name = monster.name
        || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
    const dx = (monster.mx ?? 0) - (game.u?.ux ?? 0);
    const dy = (monster.my ?? 0) - (game.u?.uy ?? 0);
    if (!(game.deaf || game.u?.deaf) && dx * dx + dy * dy <= 90) {
        const reaction = damage > (monster.mhp ?? 1) / 2
            ? 'wails in agony' : 'cries out in pain';
        await plineWithContinuation(`${name} ${reaction}!`);
    } else if (canSeeMonster(monster, monster.mx, monster.my)) {
        await plineWithContinuation(`${name} recoils from the light!`);
    }
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    wakeMonstersNear(monster.mx, monster.my, 30);
    if (monster.mhp <= 0) {
        await finishMonsterKill(monster, monster.mx, monster.my, {
            weaponHit: false,
        });
    } else if (cansee(monster.mx, monster.my)
        && !canSpotMonster(monster, monster.mx, monster.my)) {
        map_invisible(monster.mx, monster.my);
    }
}

export async function lightRoom(
    lit, { radius = 5, finishMonsterKill } = {},
) {
    const blind = heroIsBlind();
    const swallowed = !!game.u?.uswallow;
    const noEffect = swallowed || game.underwater || game.u?.uinwater
        || Is_waterlevel(game.u?.uz);

    if (!lit) {
        const stillLit = darkenCarriedLights();
        if (!blind) {
            const message = stillLit
                ? 'The ambient light seems dimmer.'
                : swallowed
                    ? 'It seems even darker in here than before.'
                    : 'You are surrounded by darkness!';
            await plineWithContinuation(message);
        }
    } else if (swallowed) {
        if (!blind) await plineWithContinuation(swallowedLightMessage());
    } else if (!blind && (!Is_rogue_level(game.u?.uz)
        || game.level?.at?.(game.u.ux, game.u.uy)?.typ !== CORR)) {
        await plineWithContinuation(
            `A lit field ${noEffect ? 'briefly ' : ''}surrounds you!`,
        );
    }
    if (noEffect) return false;

    const gremlins = [];
    for (const { x, y } of roomEffectCells(radius, lit)) {
        const location = game.level?.at?.(x, y);
        if (!location) continue;
        location.lit = !!lit;
        if (!lit) {
            snuffLightsAt(x, y);
            continue;
        }
        const monster = game.level?.monsters?.find(candidate =>
            candidate.mx === x && candidate.my === y
            && candidate.mnum === PM_GREMLIN
            && !candidate.dead && (candidate.mhp ?? 1) > 0);
        if (monster) gremlins.push(monster);
    }
    if (!blind) vision_recalc(2);
    game.vision_full_recalc = 1;
    if (lit && gremlins.length) {
        vision_recalc(0);
        for (const gremlin of gremlins.reverse()) {
            if (!finishMonsterKill)
                throw new TypeError('lightRoom needs a monster death handler');
            await lightHitsGremlin(
                gremlin, rnd(5), finishMonsterKill,
            );
        }
    }
    return true;
}

export async function damageGremlinHeroWithLight(
    source, { finishHeroDeath, ordinary = true } = {},
) {
    if (!Upolyd(game.u) || game.u?.umonnum !== PM_GREMLIN) return 0;
    let damage = rnd(5);
    const punctuation = damage > 2 || (game.u?.mh ?? 1) <= 5 ? '!' : '.';
    await plineWithContinuation(`Ow, that light hurts${punctuation}`);
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    game.u.mh = Math.max(0, (game.u.mh ?? 1) - damage);
    if (game.u.mh > 0) return damage;

    if (!(game.u?.unchanging || game.unchanging)) {
        const restored = rehumanizeHero(game);
        if (restored.changed)
            await plineWithContinuation(
                `You return to ${restored.race} form!`,
            );
        return damage;
    }
    if (!finishHeroDeath)
        throw new TypeError('light damage needs a hero death handler');
    const reflexive = game.flags?.female ? 'herself' : 'himself';
    const sourceName = source?.oclass === SCROLL_CLASS
        ? `scroll of ${source.name || 'light'}`
        : source?.oclass === SPBOOK_CLASS
            ? `spell of ${source.name || 'light'}`
            : `wand of ${source?.name || 'light'}`;
    await finishHeroDeath({
        killer: sourceName,
        deathCause: `${ordinary ? 'zapped' : 'blasted'} ${
            reflexive} with a ${sourceName}`,
    });
    return damage;
}

function consumeOneLightScroll(scroll) {
    const quantity = scroll.quan ?? scroll.quantity ?? 1;
    if (quantity > 1) {
        scroll.quan = quantity - 1;
        scroll.quantity = quantity - 1;
        return;
    }
    const index = game.inventory?.indexOf(scroll) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
}

async function createConfusedLightPets(scroll) {
    const mnum = scroll.cursed ? PM_BLACK_LIGHT : PM_YELLOW_LIGHT;
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE) {
        await plineWithContinuation(
            'Tiny lights sparkle in the air momentarily.',
        );
        return false;
    }

    const count = rn2(2) + 3 + (scroll.blessed ? 2 : 0);
    let sawLight = false;
    for (let index = 0; index < count; index++) {
        const monster = await makemonNear(
            mnum, game.u.ux, game.u.uy,
            NO_MINVENT | MM_EDOG | MM_NOMSG,
        );
        if (!monster) continue;
        tameMonster(monster);
        monster.msleeping = 0;
        monster.mcan = 1;
        if (canSpotMonster(monster, monster.mx, monster.my)) sawLight = true;
        newsym(monster.mx, monster.my);
    }
    if (sawLight)
        await plineWithContinuation('Lights appear all around you!');
    return sawLight;
}

export async function readLightScroll(
    scroll, { finishHeroDeath, finishMonsterKill } = {},
) {
    exerciseAttribute(A_WIS, true);
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);
    let known = false;

    await plineWithContinuation('As you read the scroll, it disappears.');
    if ((game.u?.confusionTurns ?? 0) > 0) {
        known = await createConfusedLightPets(scroll);
    } else {
        known = !heroIsBlind();
        const lit = !scroll.cursed;
        await lightRoom(lit, {
            radius: scroll.blessed ? 9 : 5,
            finishMonsterKill,
        });
        if (lit) {
            const damage = await damageGremlinHeroWithLight(scroll, {
                finishHeroDeath,
                ordinary: false,
            });
            if (game.program_state?.gameover) return;
            if (damage) known = true;
        }
    }

    if (known && !alreadyKnown) {
        exerciseAttribute(A_WIS, true);
        recordObjectKnowledge(scroll.otyp);
        game.u.urexp = (game.u.urexp || 0) + 10;
    }
    consumeOneLightScroll(scroll);
    game.context.move = 1;
}

function lampBurnTurns(age) {
    if (age > 150) return age - 150;
    if (age > 100) return age - 100;
    if (age > 50) return age - 50;
    if (age > 25) return age - 25;
    return age;
}

function candleBurnTurns(age) {
    if (age > 75) return age - 75;
    if (age > 15) return age - 15;
    return age;
}

function objectBurnTurns(object) {
    if (object.otyp === POT_OIL) {
        const age = object.age ?? 0;
        return object.odiluted ? Math.trunc((3 * age + 2) / 4) : age;
    }
    if (CANDLE_TYPES.has(object.otyp))
        return candleBurnTurns(object.age ?? 0);
    return lampBurnTurns(object.age ?? 0);
}

// begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginObjectBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (!object || !LIGHT_TYPES.has(object.otyp)) return false;
    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe ?? 0) <= 0) return false;
        object.lamplit = true;
        state.vision_full_recalc = 1;
        return true;
    }
    if (object.otyp === CANDELABRUM_OF_INVOCATION
        && (object.spe ?? 0) <= 0) return false;
    if ((object.age ?? 0) <= 0) return false;
    const turns = objectBurnTurns(object);
    object.lamplit = true;
    object.age -= turns;
    scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state,
    );
    state.vision_full_recalc = 1;
    return true;
}

// apply.c:dorub() performs this type change before the released djinni can
// grant a fatal wish.  A lit magic lamp already has a light source but no
// timer; once it becomes an oil lamp, begin_burn(..., TRUE) attaches the
// ordinary fuel timer while preserving that light-source identity.
export function transformMagicLampToOilLamp(
    object, oilAge, state = game, currentTurn = state.moves ?? 0,
) {
    if (object?.otyp !== MAGIC_LAMP || !Number.isFinite(oilAge)
        || oilAge <= 0) return false;
    object.otyp = OIL_LAMP;
    object.name = 'oil lamp';
    object.plural = 'oil lamps';
    object.spe = 0;
    object.age = oilAge;
    if (object.lamplit) beginObjectBurn(object, state, currentTurn);
    return true;
}

// timeout.c:end_burn(..., TRUE) reaches cleanup_burn() through stop_timer().
// The object's stored age excludes the turns owned by its active timer, so a
// manual switch-off must restore the still-unspent portion before darkening
// the source.  Natural expiry has already claimed its timer and deliberately
// uses extinguishTimedLamp() below instead.
export function endObjectBurn(
    object, state = game, currentTurn = state.moves ?? 0,
) {
    if (!object || !LIGHT_TYPES.has(object.otyp) || !object.lamplit)
        return false;
    if (object.otyp === MAGIC_LAMP) {
        object.lamplit = false;
        state.vision_full_recalc = 1;
        return true;
    }
    const timer = stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    if (!timer || !Number.isFinite(timer.deadline)) return false;
    object.age = (object.age ?? 0)
        + Math.max(0, timer.deadline - currentTurn);
    object.lamplit = false;
    state.vision_full_recalc = 1;
    return true;
}

function extinguishTimedLight(object, state) {
    object.lamplit = false;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}

function removeBurnedObject(object, state) {
    const remove = list => {
        const index = list?.indexOf(object) ?? -1;
        if (index >= 0) list.splice(index, 1);
        return index >= 0;
    };
    remove(state.inventory);
    for (const monster of state.level?.monsters || []) {
        const inventory = monster.minvent || monster.inventory;
        if (!remove(inventory)) continue;
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        if (monster.mw === object) monster.mw = null;
    }
    for (const column of state.level?.objects || []) {
        for (const pile of column || []) remove(pile);
    }
    if (state.uwep === object) state.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
}

function finishBurnedObject(object, state) {
    extinguishTimedLight(object, state);
    if (object.otyp === CANDELABRUM_OF_INVOCATION) {
        object.spe = 0;
        object.owt = objectWeight(object);
        return false;
    }
    if (object.otyp === POT_OIL
        || object.otyp === TALLOW_CANDLE
        || object.otyp === WAX_CANDLE) {
        removeBurnedObject(object, state);
        return true;
    }
    return false;
}

// C run_timers() removes the timer before burn_object() runs.
export function runClaimedObjectBurnTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || !TIMED_LIGHT_TYPES.has(object.otyp) || !object.lamplit
        || !Number.isFinite(timeout)) return null;
    if (timeout !== currentTurn) {
        const elapsed = currentTurn - timeout;
        if (elapsed >= (object.age ?? 0)) {
            object.age = 0;
            const destroyed = finishBurnedObject(object, state);
            return { object, threshold: 0, overdue: true, destroyed };
        } else {
            object.age -= elapsed;
            beginObjectBurn(object, state, currentTurn);
            return { object, threshold: object.age, overdue: true };
        }
    }
    const threshold = object.age ?? 0;
    let destroyed = false;
    if (threshold === 0) destroyed = finishBurnedObject(object, state);
    else beginObjectBurn(object, state, currentTurn);
    return { object, threshold, overdue: false, destroyed };
}

function catchesFire(object, random) {
    if (!object || object.lamplit || object.in_use
        || !LIGHT_TYPES.has(object.otyp)
        || object.otyp === BRASS_LANTERN) return false;
    if ((object.otyp === MAGIC_LAMP
            || object.otyp === CANDELABRUM_OF_INVOCATION)
        && (object.spe ?? 0) <= 0) return false;
    if (TIMED_LIGHT_TYPES.has(object.otyp) && (object.age ?? 0) <= 0)
        return false;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.cursed)
        return false;
    return !([OIL_LAMP, MAGIC_LAMP].includes(object.otyp)
        && object.cursed && random(2) === 0);
}

function lightSourceName(object) {
    const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const qualified = object.oclass === 8 ? `potion of ${name}` : name;
    const quantity = object.quan ?? object.quantity ?? 1;
    return quantity > 1 ? makePlural(qualified) : qualified;
}

export async function igniteItems(
    objects,
    {
        carrierName = null,
        state = game,
        publish = async () => {},
        random = rn2,
        visible = true,
    } = {},
) {
    const ignited = [];
    for (const object of objects || []) {
        if (!catchesFire(object, random)) continue;
        const name = lightSourceName(object);
        const plural = (object.quan ?? object.quantity ?? 1) > 1;
        const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
        const prefix = object.where === 'floor'
            ? 'The' : carrierName ? `The ${carrierName}'s` : 'Your';
        if (visible) {
            await publish(blind
                ? `${prefix} ${name} ${plural ? 'feel' : 'feels'} warm.`
                : `${prefix} ${name} ${
                    plural ? 'catch' : 'catches'
                } light!`);
        }
        if (object.otyp === POT_OIL
            && !state._knownObjectTypes?.has(POT_OIL)) {
            recordObjectKnowledge(POT_OIL, state);
        }
        if (beginObjectBurn(object, state, state.moves ?? 0))
            ignited.push(object);
    }
    return ignited;
}

export function runObjectBurnTimers(state = game, currentTurn = state.moves ?? 0) {
    const events = [];
    const kinds = new Set([OBJECT_TIMER_KIND.BURN_OBJECT]);
    let claimed;
    while ((claimed = claimNextDueObjectTimer(state, currentTurn, kinds))) {
        const event = runClaimedObjectBurnTimer(
            claimed, state, currentTurn,
        );
        if (event) events.push(event);
    }
    return events;
}
