// gold_throw.js — Direct hero-gold flight and ghitm() contact ownership.
// C refs: dothrow.c:throw_gold(), zap.c:bhit(), dokick.c:ghitm().

import {
    DOOR, D_CLOSED, D_LOCKED, IS_WATERWALL, LAVAWALL, LOST_THROWN,
    M_AP_OBJECT, SINK, WEB, ZAP_POS,
} from './const.js';
import { currentAttribute } from './attrib.js';
import { newsym, pline } from './display.js';
import { hiddenGold } from './gold.js';
import {
    detachHeroGold, heroGoldAmount, heroGoldObject,
} from './hero_gold.js';
import { place_object, stack_object } from './mklev.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory,
} from './monster_inventory.js';
import {
    MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import { OBJECT_COST } from './object_data.js';
import { visiblePriestName } from './priest.js';
import { rn2 } from './rng.js';
import { shopkeeperName } from './shk.js';
import { cansee } from './vision.js';

const M2_MERC = 0x00000200;
const M2_GREEDY = 0x10000000;
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;

const MERCENARY_BASE_BRIBE = new Map([
    [PM_SOLDIER, 100],
    [PM_SERGEANT, 250],
    [PM_LIEUTENANT, 500],
    [PM_CAPTAIN, 750],
]);

function sourceStrength(state) {
    const strength = currentAttribute(0, state);
    if (strength <= 18) return Math.max(strength, 3);
    if (strength <= 121) return 19 + Math.trunc(strength / 50);
    return Math.min(strength, 125) - 100;
}

function quantity(object) {
    return Math.max(0, Math.trunc(
        object?.quan ?? object?.quantity ?? 0,
    ));
}

function closedDoor(location) {
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}

function liveMonsterAt(state, x, y) {
    return (state.level?.monsters || []).find(monster =>
        monster && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function trapAt(state, x, y) {
    return (state.level?.traps || []).find(trap =>
        (trap.tx ?? trap.x) === x && (trap.ty ?? trap.y) === y) || null;
}

function visibleProjectileMonster(state, monster, x, y) {
    if (!monster) return null;
    // bhit() lets ordinary missiles pass through shades and through an
    // unrevealed mimic which still looks like an object.
    if (MONSTER_NAME[monster.mnum] === 'shade') return null;
    if (monster.m_ap_type === M_AP_OBJECT) {
        const remembered = state.level?.at?.(x, y)?.remembered_glyph;
        if (!['monster', 'warning', 'invisible'].includes(remembered?.kind))
            return null;
    }
    return monster;
}

function capitalize(value) {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function monsterSubject(monster, state) {
    if (monster.isshk) return capitalize(shopkeeperName(monster));
    if (monster.ispriest) return visiblePriestName(monster, state);
    if (monster.name) return capitalize(monster.name);
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function goldNoun(gold) {
    return quantity(gold) === 1 ? 'gold piece' : 'gold pieces';
}

async function missGold(monster, gold, state) {
    const target = state.flags?.verbose === false
        ? 'it' : (MONSTER_NAME[monster.mnum] || 'monster');
    await pline(`The ${goldNoun(gold)} miss the ${target}.`);
}

function finishMonsterMeal(monster) {
    monster.meating = 0;
    if (monster.m_ap_type && MONSTER_SYMBOL[monster.mnum] !== 13) {
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        newsym(monster.mx, monster.my);
    }
}

function makeShopkeeperHappy(monster, state, adjustAlignment) {
    const wasAngry = !monster.mpeaceful;
    monster.mpeaceful = 1;
    monster.eshk.following = 0;
    monster.eshk.robbed = 0;
    if (state.urole?.key !== 'rogue') {
        adjustAlignment?.(Math.sign(state.u?.ualign?.type ?? 0));
    }
    return wasAngry;
}

async function finishShopkeeperCatch(
    monster, gold, value, state, adjustAlignment,
) {
    monster.eshk ||= {};
    const robbedBefore = Math.max(0, Math.trunc(monster.eshk.robbed ?? 0));
    if (robbedBefore) {
        const robbedAfter = Math.max(0, robbedBefore - value);
        await pline(`The amount ${robbedAfter ? 'partially ' : ''}covers ${
            monster.female ? 'her' : 'his'} recent losses.`);
        monster.eshk.robbed = robbedAfter;
        if (!robbedAfter) {
            const calmed = makeShopkeeperHappy(
                monster, state, adjustAlignment,
            );
            if (calmed)
                await pline(`${capitalize(shopkeeperName(monster))} calms down.`);
        }
        return;
    }
    if (monster.mpeaceful) {
        monster.eshk.credit = Math.max(
            0, Math.trunc(monster.eshk.credit ?? 0),
        ) + value;
        await pline(`You have ${monster.eshk.credit} zorkmid${
            monster.eshk.credit === 1 ? '' : 's'} in credit.`);
    } else {
        await pline('"Thanks, scum!"');
    }
}

async function finishGuardCatch(monster, state) {
    const visible = heroGoldAmount(state);
    const hidden = hiddenGold(state, true);
    const speech = visible ? 'Drop the rest and follow me.'
        : hidden ? 'You still have hidden gold.  Drop it now.'
            : monster.mpeaceful
                ? "I'll take care of that; please move along."
                : "I'll take that; now get moving.";
    await pline(`"${speech}"`);
}

async function finishMercenaryCatch(monster, value, state) {
    const wasAngry = !monster.mpeaceful;
    let required = MERCENARY_BASE_BRIBE.get(monster.mnum) ?? 0;
    if (required && rn2(3) !== 0) {
        const charisma = Math.max(3, currentAttribute(5, state));
        required += Math.trunc((heroGoldAmount(state)
            + (state.u?.ulevel ?? 1) * rn2(5)) / charisma);
        if (value > required) monster.mpeaceful = 1;
    }

    if (!monster.mpeaceful) {
        await pline(required
            ? '"That\'s not enough, coward!"'
            : '"I don\'t take bribes from scum like you!"');
    } else if (wasAngry) {
        await pline('"That should do.  Now beat it!"');
    } else {
        await pline(`"Thanks for the tip, ${
            state.flags?.female ? 'lady' : 'buddy'}."`);
    }
}

export async function resolveGoldMonsterContact({
    state, monster, gold, wakeMonster, angerMonster, adjustAlignment,
}) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    const greedy = !!(flags & M2_GREEDY);
    const mercenary = !!(flags & M2_MERC);
    const eligible = greedy || monster?.isshk || monster?.ispriest
        || monster?.isgd || mercenary;

    if (!eligible) {
        await wakeMonster?.(monster);
        await missGold(monster, gold, state);
        return false;
    }
    if (monster.mcanmove === 0 || monster.mcanmove === false) {
        if (cansee(monster.mx, monster.my)) {
            await pline(`The ${goldNoun(gold)} harmlessly hit ${
                (MONSTER_NAME[monster.mnum] || 'monster')}.`);
        }
        await missGold(monster, gold, state);
        return false;
    }

    const wasSleeping = !!monster.msleeping;
    const value = quantity(gold) * (OBJECT_COST[gold.otyp] ?? 1);
    monster.msleeping = 0;
    finishMonsterMeal(monster);
    if (!monster.isgd && rn2(4) === 0)
        await angerMonster?.(monster);

    if (cansee(monster.mx, monster.my)) {
        await pline(`${monsterSubject(monster, state)} ${
            wasSleeping ? 'awakens and ' : ''}catches the gold.`);
    }
    addObjectToMonsterInventory(monster, gold, state);

    if (monster.isshk) {
        await finishShopkeeperCatch(
            monster, gold, value, state, adjustAlignment,
        );
    } else if (monster.ispriest) {
        await pline(monster.mpeaceful
            ? '"Thank you for your contribution."' : '"Thanks, scum!"');
    } else if (monster.isgd) {
        await finishGuardCatch(monster, state);
    } else if (mercenary) {
        await finishMercenaryCatch(monster, value, state);
    }
    return true;
}

function settleGoldOnFloor(state, gold, x, y) {
    place_object(gold, x, y);
    const survivor = stack_object(gold, state) || gold;
    newsym(x, y);
    return survivor;
}

export async function resolveDirectGoldThrow({
    state, gold, dx = 0, dy = 0, dz = 0,
    captureFlight = null, wakeMonster = null, angerMonster = null,
    adjustAlignment = null,
}) {
    if (!gold || gold !== heroGoldObject(state)) return false;
    gold = detachHeroGold(state);
    if (!gold) return false;
    gold.how_lost = LOST_THROWN;

    if (state.u?.uswallow && state.u?.ustuck) {
        await pline('The gold disappears into the engulfing monster.');
        linkObjectToMonsterInventory(state.u.ustuck, gold, { state });
        return true;
    }

    let x = state.u?.ux ?? 0;
    let y = state.u?.uy ?? 0;
    if (dz) {
        if (dz > 0) await pline('The gold hits the floor.');
        settleGoldOnFloor(state, gold, x, y);
        return true;
    }

    const first = state.level?.at?.(x + dx, y + dy);
    if (!first || !ZAP_POS(first.typ) || closedDoor(first)) {
        settleGoldOnFloor(state, gold, x, y);
        return true;
    }

    const range = Math.max(0,
        Math.trunc(sourceStrength(state) / 2)
        - Math.trunc((gold.owt ?? 1) / 40));
    const flightPath = [];
    let contact = null;
    for (let step = 0; step < range; step++) {
        const nx = x + dx;
        const ny = y + dy;
        const location = state.level?.at?.(nx, ny);
        if (!location) break;

        const previousX = x;
        const previousY = y;
        x = nx;
        y = ny;
        if (IS_WATERWALL(location.typ) || location.typ === LAVAWALL) break;

        contact = visibleProjectileMonster(
            state, liveMonsterAt(state, x, y), x, y,
        );
        const trap = !contact ? trapAt(state, x, y) : null;
        if (trap?.ttyp === WEB && rn2(3) === 0) {
            if (cansee(x, y)) {
                trap.tseen = true;
                await pline('The gold gets stuck in a web!');
                newsym(x, y);
            }
            flightPath.push({ x, y });
            break;
        }
        if (contact) break;

        if (!ZAP_POS(location.typ) || closedDoor(location)) {
            x = previousX;
            y = previousY;
            break;
        }
        flightPath.push({ x, y });
        if (location.typ === SINK) break;
    }

    if (captureFlight && flightPath.length)
        await captureFlight(gold, flightPath);
    if (contact) {
        const caught = await resolveGoldMonsterContact({
            state, monster: contact, gold,
            wakeMonster, angerMonster, adjustAlignment,
        });
        if (caught) return true;
    }
    settleGoldOnFloor(state, gold, x, y);
    return true;
}
