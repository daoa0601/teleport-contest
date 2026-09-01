// Corpse revival timers.
// C refs: do.c revive_corpse()/revive_mon()/zombify_mon() and zap.c revive().

import {
    CORR, G_GENOD, GRAVE, IS_POOL,
    MM_FEMALE, MM_MALE, MM_NOCOUNTBIRTH, MM_NOTAIL,
    MM_NOMSG, MM_NOWAIT, NO_MINVENT, PIT, ROOM,
} from './const.js';
import { isReviver, isRider, zombieForm } from './corpse_species.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { makePetWary, tameMonster } from './dog.js';
import { game } from './gstate.js';
import {
    findMonsterNearPosition, makemonAt, makemonNear, maketrap,
    riderRevivalTime, set_corpsenm, shapechangeMonster,
} from './mklev.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME,
    MONSTER_SYMBOL,
    monsterTypeName,
} from './monster_data.js';
import { restoreMonsterTraits } from './monster_traits.js';
import {
    linkObjectToMonsterInventory, removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import { BAG_OF_HOLDING, OBJECT_NAMES, STATUE } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, objectsInTimerGraph,
    scheduleObjectTimer, stopAllObjectTimers,
} from './object_timers.js';
import { d, rn2 } from './rng.js';
import { randomMonsterRelocation } from './teleport.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';
import { markQuestLeaderAlive } from './quest.js';

const S_EEL = 57;
const S_ZOMBIE = 52;
const G_UNIQ = 0x1000;
const M2_SHAPESHIFTER = 0x00004000;
const PM_ANGEL = 123;
const PM_HUMAN_ZOMBIE = 244;
const PM_DOPPELGANGER = 270;
const PM_GUARD = 272;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_GHOST = 287;
const PM_LONG_WORM = 114;
const PM_LONG_WORM_TAIL = 330;

function parentContainer(object, state) {
    if (object?.container) return object.container;
    return objectsInTimerGraph(state).find(candidate =>
        candidate !== object && candidate.contents?.includes(object));
}

function carryingMonster(object, state) {
    if (object?.ocarry) return object.ocarry;
    return (state.level?.monsters || []).find(monster =>
        monster.m_id === object?.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object));
}

function containerLocation(corpse, state) {
    const directContainer = parentContainer(corpse, state);
    if (!directContainer) return null;
    let outer = corpse;
    let nesting = 0;
    const seen = new Set();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent) return null;
        outer = parent;
        nesting++;
    }
    const location = objectLocation(outer, state);
    return location ? { ...location, directContainer, nesting, outer } : null;
}

function objectLocation(object, state) {
    if (object?.where === 'inventory') {
        return { x: state.u?.ux, y: state.u?.uy, monsterCarrier: null };
    }
    if (object?.where === 'floor' || object?.where === 'buried') {
        return { x: object.ox, y: object.oy, monsterCarrier: null };
    }
    if (object?.where === 'minvent') {
        const monsterCarrier = carryingMonster(object, state);
        if (monsterCarrier?.mx) {
            return {
                x: monsterCarrier.mx, y: monsterCarrier.my,
                monsterCarrier,
            };
        }
    }
    return null;
}

function revivalLocation(corpse, state, buriedReviver) {
    if (corpse.where === 'contained') return containerLocation(corpse, state);
    if (corpse.where === 'buried' && !buriedReviver) return null;
    return objectLocation(corpse, state);
}

function zombieCanDig(x, y, state) {
    if (state.level?.traps?.some(trap => trap.tx === x && trap.ty === y))
        return false;
    return [ROOM, CORR, GRAVE].includes(state.level?.at?.(x, y)?.typ);
}

function monsterAt(x, y, state) {
    return (state.level?.monsters || []).find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y);
}

function revivalReplacement(mnum, corpse) {
    if ([PM_GUARD, PM_HIGH_CLERIC, PM_ALIGNED_CLERIC, PM_ANGEL]
        .includes(mnum)) return PM_HUMAN_ZOMBIE;
    if (mnum === PM_LONG_WORM_TAIL) return PM_LONG_WORM;
    if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ
        && !corpse.oextra?.omonst) return PM_DOPPELGANGER;
    return null;
}

function genderFlags(corpse) {
    const gender = (corpse.spe ?? 0) & 0x03;
    if (gender === 1 || corpse.female === true) return MM_FEMALE;
    if (gender === 2 || corpse.female === false) return MM_MALE;
    return 0;
}

function corpseName(corpse) {
    const species = MONSTER_NAME[corpse.corpsenm] || 'monster';
    const given = corpse.oextra?.oname || corpse.oname;
    const chewed = corpse.oeaten ? 'bite-covered ' : '';
    return `${chewed}${species} corpse${given ? ` named ${given}` : ''}`;
}

function corpseWithArticle(corpse) {
    const name = corpseName(corpse);
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function monsterDescription(monster) {
    if (monster.name) return monster.name;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    const article = /^[aeiou]/i.test(name) ? 'An' : 'A';
    return `${article} ${name}`;
}

function carrierDescription(monster) {
    if (monster?.name) return monster.name;
    return `the ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function containerDescription(container) {
    const name = container?.oextra?.oname || container?.oname
        || OBJECT_NAMES[container?.otyp] || container?.name || 'container';
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `${article} ${name}`;
}

function revivalMessage(corpse, monster, location, originalWhere, state) {
    if (originalWhere === 'inventory') {
        return state.uwep === corpse
            ? `The ${corpseName(corpse)} writhes out of your grasp!`
            : 'You feel squirming in your backpack!';
    }
    if (originalWhere === 'floor') {
        if (!cansee(location.x, location.y)
            && !canSeeMonster(monster, monster.mx, monster.my)) return null;
        if (!canSeeMonster(monster, monster.mx, monster.my))
            return `The ${corpseName(corpse)} disappears!`;
        const effects = new Map([
            [311, ' in a whirl of spectral skulls'],
            [312, ' in a churning pillar of flies'],
            [313, ' in a ring of withered crops'],
        ]);
        const subject = monster.name
            || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
        return `${subject} rises from the dead${effects.get(monster.mnum) || ''}!`;
    }
    if (originalWhere === 'minvent') {
        if (!cansee(monster.mx, monster.my)) return null;
        const carrier = location.monsterCarrier;
        if (carrier && canSeeMonster(carrier, carrier.mx, carrier.my)) {
            const result = canSpotMonster(monster) ? 'revives' : 'disappears';
            return `Startled, ${carrierDescription(carrier)} drops ${
                corpseWithArticle(corpse)
            } as it ${result}!`;
        }
        return canSpotMonster(monster)
            ? `${monsterDescription(monster)} suddenly appears!` : null;
    }
    if (originalWhere === 'contained') {
        const container = location.directContainer;
        const outer = location.outer;
        const description = containerDescription(container);
        const revived = canSpotMonster(monster)
            ? monsterDescription(monster) : 'Something';
        if (location.monsterCarrier
            && canSeeMonster(
                location.monsterCarrier,
                location.monsterCarrier.mx,
                location.monsterCarrier.my,
            )) return `${revived} writhes out of ${description}!`;
        if (outer.where === 'inventory')
            return `${revived} writhes out of ${description} in your pack!`;
        if (outer.where === 'floor' && cansee(location.x, location.y))
            return `${revived} escapes from ${description}!`;
    }
    return null;
}

function clearHeroEquipment(corpse, state) {
    for (const slot of [
        'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmh',
        'uarms', 'uarmg', 'uarmf', 'uarmu', 'uleft', 'uright',
        'uamul', 'ublindf',
    ]) {
        if (state[slot] === corpse) state[slot] = null;
    }
    corpse.owornmask = 0;
    corpse.worn = false;
    corpse.wielded = false;
}

function updateContainerWeights(container, state) {
    const seen = new Set();
    let current = container;
    while (current && !seen.has(current)) {
        seen.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained'
            ? parentContainer(current, state) : null;
    }
}

function removeCorpse(corpse, location, state, entireStack = false) {
    const quantity = corpse.quan ?? corpse.quantity ?? 1;
    if (quantity > 1 && !entireStack) {
        corpse.quan = quantity - 1;
        corpse.quantity = quantity - 1;
        corpse.owt = objectWeight(corpse);
        return;
    }

    if (corpse.where === 'floor') {
        const pile = state.level?.objects?.[corpse.ox]?.[corpse.oy];
        const index = pile?.indexOf(corpse) ?? -1;
        if (index >= 0) pile.splice(index, 1);
    } else if (corpse.where === 'buried') {
        const index = state.level?.buriedObjects?.indexOf(corpse) ?? -1;
        if (index >= 0) state.level.buriedObjects.splice(index, 1);
    } else if (corpse.where === 'inventory') {
        clearHeroEquipment(corpse, state);
        const index = state.inventory?.indexOf(corpse) ?? -1;
        if (index >= 0) state.inventory.splice(index, 1);
    } else if (corpse.where === 'minvent') {
        const carrier = location.monsterCarrier || carryingMonster(corpse, state);
        if (carrier) removeObjectFromMonsterInventory(carrier, corpse);
    } else if (corpse.where === 'contained') {
        const container = location.directContainer || parentContainer(corpse, state);
        const index = container?.contents?.indexOf(corpse) ?? -1;
        if (index >= 0) container.contents.splice(index, 1);
        updateContainerWeights(container, state);
    }
    stopAllObjectTimers(corpse);
    corpse.where = 'gone';
    corpse.buried = false;
    corpse.ox = corpse.oy = 0;
    delete corpse.container;
    delete corpse.ocontainer;
}

function restoreCorpseNameAndHealth(monster, corpse) {
    const name = corpse.oextra?.oname || corpse.oname;
    if (name && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)) {
        monster.name = name;
        monster.mgivenname = name;
        monster.mextra = { ...(monster.mextra || {}), mgivenname: name };
    }
    if ((corpse.oeaten ?? 0) > 0) {
        const nutrition = MONSTER_BODY_META[corpse.corpsenm]?.[1] ?? 0;
        const remaining = Math.min(corpse.oeaten, nutrition);
        monster.mhp = Math.max(
            1,
            nutrition ? Math.trunc(monster.mhp * remaining / nutrition) : 1,
        );
    }
}

function restoreShapechangerState(monster, state) {
    const naturalForm = Number.isInteger(monster.cham)
        && monster.cham >= 0 ? monster.cham : null;
    const protectedFromShapechangers = !!(
        state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers
    );
    if (protectedFromShapechangers || monster.mcan) {
        if (naturalForm != null) {
            const cancelled = monster.mcan;
            shapechangeMonster(monster, naturalForm);
            monster.cham = -1;
            if (cancelled) monster.mcan = 1;
        }
        return;
    }
    if (naturalForm == null
        && ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_SHAPESHIFTER)) {
        monster.cham = monster.mnum;
    }
}

function mergeGhostIntoBody(monster, corpse, state) {
    const ghostId = corpse.oextra?.omid ?? corpse.omid;
    if (!ghostId) return;
    const ghost = (state.level?.monsters || []).find(candidate =>
        candidate.m_id === ghostId && candidate.mnum === PM_GHOST);
    if (ghost) {
        while ((ghost.minvent || ghost.inventory || []).length) {
            const object = (ghost.minvent || ghost.inventory).shift();
            linkObjectToMonsterInventory(monster, object, { state });
        }
        if (ghost.mtame && !monster.mtame) {
            tameMonster(monster, state);
            monster.mtame = ghost.mtame;
        }
        monster.mconf = 1;
        ghost.dead = true;
        ghost.mhp = 0;
        state.level.monsters = state.level.monsters.filter(
            candidate => candidate !== ghost,
        );
    }
    if (corpse.oextra) delete corpse.oextra.omid;
    delete corpse.omid;
}

async function createRevivedMonster(corpse, location, state) {
    const originalMnum = corpse.corpsenm;
    const savedTraits = corpse.oextra?.omonst;
    let x = location.x, y = location.y;
    const occupant = monsterAt(x, y, state);
    if (occupant) {
        const nearby = findMonsterNearPosition(originalMnum, x, y);
        if (nearby) ({ x, y } = nearby);
    }

    const targetLocation = state.level?.at?.(x, y);
    if (corpse.norevive
        || (MONSTER_SYMBOL[originalMnum] === S_EEL
            && !IS_POOL(targetLocation?.typ))) {
        return {
            monster: null,
            twitchMessage: cansee(x, y)
                ? `The ${corpseName(corpse)} twitches feebly.` : null,
        };
    }

    const replacement = revivalReplacement(originalMnum, corpse);
    const targetMnum = replacement ?? savedTraits?.mnum ?? originalMnum;
    let flags = NO_MINVENT | MM_NOWAIT | MM_NOMSG | genderFlags(corpse);
    if (replacement == null) flags |= MM_NOCOUNTBIRTH;
    if (savedTraits) flags |= MM_NOTAIL;
    const heroAt = state.u?.ux === x && state.u?.uy === y;
    const monster = heroAt
        ? await makemonNear(targetMnum, x, y, flags, true)
        : await makemonAt(targetMnum, x, y, flags);
    if (!monster) return { monster: null, twitchMessage: null };

    if (savedTraits && replacement == null) {
        restoreMonsterTraits(monster, savedTraits);
        restoreShapechangerState(monster, state);
        markQuestLeaderAlive(monster, state);
        if (monster.mtame && !monster.isminion)
            makePetWary(monster, { wasDead: true, state });
    } else if (replacement === PM_DOPPELGANGER)
        shapechangeMonster(monster, originalMnum);
    else if (replacement === PM_HUMAN_ZOMBIE) {
        monster.mhp = monster.mhpmax = 100;
        monster.mspeed = 2;
    }
    monster.mundetected = 0;
    monster.m_ap_type = 0;
    return { monster, twitchMessage: null };
}

function retryRevival(corpse, state, currentTurn, messages) {
    let kind;
    let delay;
    if (isRider(corpse.corpsenm) && rn2(99)) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(corpse, true);
    } else {
        kind = OBJECT_TIMER_KIND.ROT_CORPSE;
        if (isRider(corpse.corpsenm)
            && !objectTimers(corpse).some(timer => timer.kind === kind)) {
            messages.push('You feel much less hassled.');
        }
        delay = Math.max(
            1,
            d(5, 50) - (currentTurn - (corpse.age ?? currentTurn)),
        );
    }
    if (!objectTimers(corpse).some(timer => timer.kind === kind)) {
        scheduleObjectTimer(corpse, kind, currentTurn + delay, state);
    }
    return { kind, delay };
}

function riderObstacleMessages(corpse, state, currentTurn) {
    if (!isRider(corpse.corpsenm) || corpse.where !== 'floor'
        || (state.level?.flags?.stasis_until ?? 0) >= currentTurn) return [];
    const occupant = monsterAt(corpse.ox, corpse.oy, state);
    if (!occupant) return [];
    const wasVisible = canSeeMonster(occupant, occupant.mx, occupant.my);
    const name = occupant.name
        || `The ${monsterTypeName(occupant.mnum, !!occupant.female)}`;
    const calls = [];
    if (!randomMonsterRelocation(occupant, state, calls, rn2)) return [];
    const nowVisible = canSeeMonster(occupant, occupant.mx, occupant.my);
    if (wasVisible && !nowVisible) return [`${name} vanishes.`];
    if (!wasVisible && nowVisible) {
        const currentName = occupant.name
            || `The ${monsterTypeName(occupant.mnum, !!occupant.female)}`;
        return [`${currentName} appears.`];
    }
    const dx = occupant.mx - corpse.ox;
    const dy = occupant.my - corpse.oy;
    return wasVisible && dx * dx + dy * dy > 2
        ? [`${name} teleports.`] : [];
}

function containerBlocksRevival(location) {
    const container = location.directContainer;
    if (container.olocked || location.nesting > 2
        || container.otyp === STATUE) return true;
    return container.otyp === BAG_OF_HOLDING && rn2(40) !== 0;
}

function stopCorpseMeal(corpse, state) {
    const occupation = state._occupation;
    if (occupation?.key !== 'eat-corpse' || occupation.object !== corpse)
        return;
    if (!corpse.oeaten) corpse.oeaten = 1;
    state._occupation = null;
}

async function reviveCorpse(corpse, state, currentTurn) {
    const originalWhere = corpse.where;
    stopCorpseMeal(corpse, state);
    const digsOut = originalWhere === 'buried'
        && (isReviver(corpse.corpsenm)
            || MONSTER_SYMBOL[corpse.corpsenm] === S_ZOMBIE);
    const location = revivalLocation(corpse, state, digsOut);
    const messages = riderObstacleMessages(corpse, state, currentTurn);
    if (!location?.x
        || (originalWhere === 'contained' && containerBlocksRevival(location))
        || (digsOut && !zombieCanDig(location.x, location.y, state))) {
        return { monster: null, messages, originalWhere, location };
    }

    corpse.ox = location.x;
    corpse.oy = location.y;
    const creation = await createRevivedMonster(corpse, location, state);
    if (!creation.monster) {
        if (creation.twitchMessage) messages.push(creation.twitchMessage);
        return { monster: null, messages, originalWhere, location };
    }

    const monster = creation.monster;
    mergeGhostIntoBody(monster, corpse, state);
    restoreCorpseNameAndHealth(monster, corpse);
    monster.mrevived = 1;
    const message = revivalMessage(
        corpse, monster, location, originalWhere, state,
    );
    if (message) messages.push(message);
    removeCorpse(corpse, location, state);
    newsym(monster.mx, monster.my);

    let trap = null;
    if (digsOut) trap = await maketrap(monster.mx, monster.my, PIT);
    return {
        kind: 'revived', corpse, monster, trap,
        buried: digsOut, originalWhere, location, messages,
    };
}

function rotCorpseNow(corpse, state) {
    const originalWhere = corpse.where;
    const location = revivalLocation(corpse, state, corpse.where === 'buried');
    removeCorpse(corpse, location || {}, state, true);
    return {
        kind: 'rotted', corpse, monster: null,
        messages: originalWhere === 'inventory'
            ? ['Your corpse rots away.'] : [],
    };
}

export async function runClaimedCorpseRevivalTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    const corpse = claimed?.object;
    const timerKind = claimed?.timer?.kind;
    if (!corpse || ![
        OBJECT_TIMER_KIND.REVIVE_MON,
        OBJECT_TIMER_KIND.ZOMBIFY_MON,
    ].includes(timerKind)) return null;

    if (timerKind === OBJECT_TIMER_KIND.ZOMBIFY_MON) {
        const target = zombieForm(corpse.corpsenm);
        if (target == null
            || ((state.mvitals?.[target]?.mvflags ?? 0) & G_GENOD)) {
            return rotCorpseNow(corpse, state);
        }
        if (corpse.oextra) {
            delete corpse.oextra.omid;
            delete corpse.oextra.omonst;
        }
        set_corpsenm(corpse, target);
    }

    const event = await reviveCorpse(corpse, state, currentTurn);
    if (event.kind === 'revived') return event;
    const retry = retryRevival(corpse, state, currentTurn, event.messages);
    return { kind: 'failed', corpse, ...event, retry };
}
