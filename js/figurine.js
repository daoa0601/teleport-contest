// Cursed figurines which come to life on their own.
// C refs: apply.c:fig_transform() and dog.c:make_familiar()/initedog().

import {
    G_EXTINCT, MM_EDOG, MM_FEMALE, MM_IGNOREWATER, MM_MALE,
    MM_NOMSG, NEED_WEAPON, NO_MINVENT,
    IS_OBSTRUCTED, IS_POOL, W_NONPASSWALL, isok,
} from './const.js';
import { canSeeMonster, newsym } from './display.js';
import { tameMonster } from './dog.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import {
    findMonsterNearPosition, makemonAt, makemonNear,
} from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_MOVE, MONSTER_SYMBOL,
    monsterTypeName,
} from './monster_data.js';
import { BOULDER, FIGURINE, OBJECT_NAMES } from './object_data.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from './object_timers.js';
import { rn2, rnd } from './rng.js';
import { cansee } from './vision.js';

const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_CONCEAL = 0x00000080;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M2_ROCKTHROW = 0x08000000;
const S_EYE = 5;
const S_MIMIC = 13;
const S_LIGHT = 25;
const S_EEL = 57;

function articleFor(noun) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function figurineLocomotion(mnum, fallback = 'drop') {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (flags & M1_FLY) return 'fly';
    if (flags & M1_SLITHY) return 'slither';
    if (flags & M1_AMORPHOUS) return 'ooze';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0) return 'wiggle';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'crawl';
    return fallback;
}

function figurineMayTransformAt(figurine, x, y, state) {
    if (figurine.where === 'inventory' && state.u?.uswallow) return false;
    if (!isok(x, y)) return false;
    const location = state.level?.at?.(x, y);
    if (!location) return false;
    const flags1 = MONSTER_FLAGS1[figurine.corpsenm] ?? 0;
    const flags2 = MONSTER_FLAGS2[figurine.corpsenm] ?? 0;
    const passesWalls = !!(flags1 & M1_WALLWALK);
    const mayPassWall = passesWalls
        && !(location.wall_info & W_NONPASSWALL);
    if (IS_OBSTRUCTED(location.typ) && !mayPassWall) return false;
    const boulder = state.level?.objects?.[x]?.[y]?.some(
        object => object !== figurine && object.otyp === BOULDER,
    );
    if (boulder && !passesWalls && !(flags2 & M2_ROCKTHROW)) return false;
    return true;
}

function monsterCarryingFigurine(figurine, state) {
    return state.level?.monsters?.find(monster =>
        (monster.minvent || monster.inventory || []).includes(figurine)
    ) || null;
}

function figurineLocation(figurine, state) {
    if (figurine.where === 'inventory') {
        return {
            carrier: 'inventory', monsterCarrier: null,
            x: state.u?.ux, y: state.u?.uy,
        };
    }
    if (figurine.where === 'floor') {
        return {
            carrier: 'floor', monsterCarrier: null,
            x: figurine.ox, y: figurine.oy,
        };
    }
    if (figurine.where === 'minvent') {
        const monsterCarrier = monsterCarryingFigurine(figurine, state);
        if (!monsterCarrier?.mx) return null;
        return {
            carrier: 'minvent', monsterCarrier,
            x: monsterCarrier.mx, y: monsterCarrier.my,
        };
    }
    return null;
}

function scheduleFigurineRetry(figurine, carrier, currentTurn, state) {
    const retryDelay = rnd(5000);
    const retryTimer = scheduleObjectTimer(
        figurine, OBJECT_TIMER_KIND.FIG_TRANSFORM,
        currentTurn + retryDelay, state,
    );
    return {
        figurine, monster: null, transformed: false,
        retryScheduled: true, retryDelay,
        retryDeadline: retryTimer.deadline,
        finishPending: false, message: null,
        carrier,
    };
}

function possessive(noun) {
    return /s$/i.test(noun) ? `${noun}'` : `${noun}'s`;
}

function monsterCarrierDescription(monster, state) {
    if (canSeeMonster(monster, monster.mx, monster.my)
        && (!monster.wormno || cansee(monster.mx, monster.my))) {
        const given = monster.name || monster.givenName;
        const name = given || monsterTypeName(monster.mnum, !!monster.female);
        const owner = given ? name : `${articleFor(name)} ${name}`;
        return `${possessive(owner)} pack`;
    }
    return IS_POOL(state.level?.at?.(monster.mx, monster.my)?.typ)
        ? 'empty water' : 'thin air';
}

function objectDescription(object) {
    const name = object?.oextra?.oname || object?.oname
        || OBJECT_NAMES[object?.otyp] || object?.name || 'object';
    return `${articleFor(name)} ${name}`;
}

function familiarDescription(monster) {
    if (monster.name) return monster.name;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    return `${articleFor(name)} ${name}`;
}

function figurineDescription(figurine) {
    const given = figurine.oextra?.oname || figurine.oname;
    return given ? `A figurine named ${given}` : 'A figurine';
}

function specialBirthLimitReached(figurine, state) {
    if (!((state.mvitals?.[figurine.corpsenm]?.mvflags ?? 0) & G_EXTINCT))
        return false;
    const name = MONSTER_NAME[figurine.corpsenm]?.toLowerCase();
    return name === 'nazgul' || name === 'erinys';
}

function addFamiliarName(monster, figurine) {
    const name = figurine.oextra?.oname || figurine.oname;
    if (!name) return;
    monster.name = name;
    monster.mgivenname = name;
    monster.mextra = { ...(monster.mextra || {}), mgivenname: name };
}

function familiarPresentation(monster, figurine, location, overdue, state) {
    const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
    const seesInvisible = !!(state.u?.seeInvisible
        || state.u?.see_invisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
    let suppressSight = (!!monster.minvis && !seesInvisible)
        || (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && !!monster.m_ap_type);
    let ending = '';
    if (monster.mundetected) {
        const shelter = state.level?.objects?.[monster.mx]?.[monster.my]?.[0];
        if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL
            && shelter) {
            ending = ` and ${figurineLocomotion(monster.mnum, 'crawl')} under ${
                objectDescription(shelter)
            }`;
        } else if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            || MONSTER_SYMBOL[monster.mnum] === S_EEL) {
            suppressSight = true;
        } else {
            ending = ' and vanish';
        }
    }

    const movement = figurineLocomotion(monster.mnum);
    const familiar = familiarDescription(monster);
    const visible = cansee(location.x, location.y);
    if (location.carrier === 'inventory') {
        return blind || suppressSight
            ? `You feel something ${movement} from your pack!`
            : `You see ${familiar} ${movement} out of your pack${ending}!`;
    }
    if (location.carrier === 'floor') {
        if (!visible || overdue) return null;
        return suppressSight
            ? `${figurineDescription(figurine)} suddenly vanishes!`
            : `You see a figurine transform into ${familiar}${ending}!`;
    }
    if (!visible || overdue || suppressSight) return null;
    return `You see ${familiar} ${movement} out of ${
        monsterCarrierDescription(location.monsterCarrier, state)
    }${ending}!`;
}

function deleteFigurine(figurine, state) {
    if (figurine.where === 'floor') remove_object(figurine);
    else if (figurine.where === 'minvent') {
        const carrier = monsterCarryingFigurine(figurine, state);
        if (carrier) removeObjectFromMonsterInventory(carrier, figurine);
    }
    else {
        const index = (state.inventory || []).indexOf(figurine);
        if (index >= 0) state.inventory.splice(index, 1);
    }
    figurine.where = 'gone';
    figurine.ox = figurine.oy = 0;
}

export async function runClaimedFigurineTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.FIG_TRANSFORM)
        return null;
    const figurine = claimed.object;
    if (!figurine || figurine.otyp !== FIGURINE) return null;
    const location = figurineLocation(figurine, state);
    if (!location)
        return scheduleFigurineRetry(
            figurine, figurine.where, currentTurn, state,
        );
    const { carrier } = location;
    const onFloor = carrier === 'floor';

    const gender = (figurine.spe ?? 0) & 0x03; // CORPSTAT_GENDER
    let flags = MM_EDOG | MM_IGNOREWATER | NO_MINVENT | MM_NOMSG;
    if (gender === 1) flags |= MM_FEMALE;
    else if (gender === 2) flags |= MM_MALE;
    const position = onFloor ? { x: location.x, y: location.y }
        : findMonsterNearPosition(
            figurine.corpsenm, location.x, location.y,
        );
    if (!position || !figurineMayTransformAt(
        figurine, position.x, position.y, state,
    )) {
        return scheduleFigurineRetry(
            figurine, carrier, currentTurn, state,
        );
    }
    if (specialBirthLimitReached(figurine, state)) {
        deleteFigurine(figurine, state);
        return {
            figurine, monster: null, transformed: false,
            finishPending: false, message: null, carrier,
        };
    }

    // A floor figurine on the hero's square lets makemon() choose the
    // adjacent square. Carried figurines have already done that search.
    const byHero = onFloor
        && position.x === state.u.ux && position.y === state.u.uy;
    const monster = byHero
        ? await makemonNear(
            figurine.corpsenm, position.x, position.y, flags, true,
        )
        : await makemonAt(
            figurine.corpsenm, position.x, position.y, flags,
        );
    if (!monster) {
        deleteFigurine(figurine, state);
        return {
            figurine, monster: null, transformed: false,
            finishPending: false, message: null,
            carrier,
        };
    }

    if (monster.isminion) {
        monster.isminion = 0;
        delete monster.emin;
        if (monster.mextra) delete monster.mextra.emin;
    }
    const waterMessages = [];
    if (IS_POOL(state.level?.at?.(monster.mx, monster.my)?.typ)) {
        const liquid = await resolveMonsterLiquid(monster, state, {
            announce: async message => waterMessages.push(message),
            finishDeath: finishMonsterLiquidDeath,
            monsterMoving: false,
        });
        if (liquid?.dead) {
            deleteFigurine(figurine, state);
            return {
                figurine, monster: null, transformed: false,
                finishPending: false, message: null,
                waterMessages, carrier,
            };
        }
    }
    const dog = { parentmid: monster.m_id };
    monster.edog = dog;
    monster.mextra = { ...(monster.mextra || {}), edog: dog };
    monster.mtame = 0;
    monster.pet = false;
    const chance = rn2(10);
    const disposition = chance <= 2 ? chance
        : figurine.blessed ? 0 : !figurine.cursed ? 1 : 2;
    if (disposition === 0) {
        tameMonster(monster, state);
        if (MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum))
            monster.weaponCheck = NEED_WEAPON;
    } else if (disposition === 2) {
        monster.mpeaceful = 0;
    }
    addFamiliarName(monster, figurine);
    monster.msleeping = 0;
    newsym(monster.mx, monster.my);

    const overdue = claimed.timer.deadline !== currentTurn;
    const message = familiarPresentation(
        monster, figurine, { ...location, x: position.x, y: position.y },
        overdue, state,
    );
    const floorVisible = onFloor && cansee(position.x, position.y);
    return {
        figurine, monster, chance, disposition,
        transformed: true, finishPending: true, message,
        waterMessages,
        overdue,
        carrier,
        x: onFloor ? location.x : monster.mx,
        y: onFloor ? location.y : monster.my,
        redraw: floorVisible && !overdue,
    };
}

export function finishFigurineTimer(event, state = game) {
    if (!event?.finishPending || !event.figurine) return event;
    deleteFigurine(event.figurine, state);
    if (event.redraw) newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}
