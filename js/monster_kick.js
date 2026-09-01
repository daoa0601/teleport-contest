// Ordinary humanoid kicks against monsters.
// C refs: dokick.c:kick_monster() and kickdmg().

import { game } from './gstate.js';
import { A_CON, A_DEX, A_STR } from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { couldsee } from './vision.js';
import { newsym, unmap_invisible } from './display.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_SIZE,
    MONSTER_SOUND, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    KICKING_BOOTS, OBJECT_BIMANUAL, OBJECT_MATERIAL,
    RIN_AGGRAVATE_MONSTER, RIN_CONFLICT,
} from './object_data.js';
import { collectNearbyCoords } from './u_init.js';
import { rnd, rn2 } from './rng.js';
import {
    monsterGoodPosition, monsterTeleportRestricted,
} from './teleport_rules.js';
import { invWeight, weightCapacity } from './weight.js';
import { triggerImmediateMonsterTrap } from './monmove.js';

const M1_FLY = 0x00000001;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M1_THICK_HIDE = 0x00200000;
const M1_TPORT = 0x02000000;
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_DEMON = 0x00000100;
const S_IMP = 9;
const S_EYE = 5;
const S_LIGHT = 25;
const S_VAMPIRE = 48;
const S_EEL = 57;
const PM_TENGU = 55;
const PM_GRID_BUG = 116;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_VLAD_THE_IMPALER = 228;
const PM_SHADE = 288;
const SILVER = 14;

function nextOpenSquareNearHero(monster, state) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const destination = collectNearbyCoords(
            state.u.ux, state.u.uy, 3,
        ).find(({ x, y }) => monsterGoodPosition(
            monster.mnum, x, y, false, false, false, state,
        ));
        if (!destination) return null;
        const movesDiagonally = destination.x !== monster.mx
            && destination.y !== monster.my;
        if (!couldsee(destination.x, destination.y)
            || (monster.mnum === PM_GRID_BUG && movesDiagonally)) continue;

        const oldx = monster.mx;
        const oldy = monster.my;
        monster.mx = destination.x;
        monster.my = destination.y;
        monster.mtrack = [];
        unmap_invisible(oldx, oldy);
        newsym(oldx, oldy);
        newsym(monster.mx, monster.my);
        return { oldx, oldy, x: monster.mx, y: monster.my };
    }
    return null;
}

function evasionVerb(monster, state) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if ((flags & M1_TPORT) && !monsterTeleportRestricted(monster, state))
        return 'teleports';
    if (symbol === S_EYE || symbol === S_LIGHT) return 'floats';
    if (flags & M1_FLY) return 'swoops';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS || (flags & M1_SLITHY))
        return 'slides';
    return 'jumps';
}

function vampireShifter(monster) {
    return [PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_VLAD_THE_IMPALER]
        .includes(monster.cham);
}

function hatesBlessedObjects(monster) {
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return vampireShifter(monster) || !!(flags & (M2_UNDEAD | M2_DEMON));
}

function hatesSilver(monster) {
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return vampireShifter(monster) || !!(flags & (M2_WERE | M2_DEMON))
        || symbol === S_VAMPIRE || monster.mnum === PM_SHADE
        || (symbol === S_IMP && monster.mnum !== PM_TENGU);
}

function specialBootDamage(monster, boots) {
    if (!boots) return 0;
    let damage = 0;
    if (boots.blessed && hatesBlessedObjects(monster)) damage += rnd(4);
    if (OBJECT_MATERIAL[boots.otyp] === SILVER && hatesSilver(monster))
        damage += rnd(20);
    return damage;
}

function heroWearsRing(state, objectType) {
    const rings = [
        state.uleft, state.uright,
        state.u?.uleft, state.u?.uright,
    ];
    return rings.some(ring => ring?.otyp === objectType);
}

export function kickConductViolation(monster, {
    helpless = false,
    fleeingFromBehind = false,
    state = game,
} = {}) {
    if ((state.u?.ualign?.record ?? 0) <= -10) return null;
    const role = state.urole?.key;
    const lawful = (state.u?.ualign?.type ?? 0) > 0;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    if (role === 'knight' && lawful && !undead
        && (helpless || fleeingFromBehind)) return 'You caitiff!';
    if (role === 'samurai' && monster.mpeaceful)
        return 'You dishonorably attack the innocent!';
    return null;
}

export async function abuseKickedPet(monster, potentialDamage, {
    state = game,
    yelp = async () => {},
    growl = async () => {},
} = {}) {
    if (!(monster.mtame > 0)) return false;
    const aggravates = !!(state.u?.aggravateMonster
        || state.u?.aggravate_monster || state.aggravateMonster
        || state.aggravate_monster
        || heroWearsRing(state, RIN_AGGRAVATE_MONSTER)
        || heroWearsRing(state, RIN_CONFLICT));
    monster.mtame = aggravates
        ? Math.trunc(monster.mtame / 2) : monster.mtame - 1;
    monster.pet = monster.mtame > 0;
    if (monster.mtame > 0 && !monster.isminion) {
        if (!monster.edog) monster.edog = {};
        monster.edog.abuse = (monster.edog.abuse ?? 0) + 1;
    }
    if (!monster.mtame && monster.mleashed) monster.mleashed = false;

    if (monster.mx !== 0) {
        const yelps = monster.mtame > 0 && rn2(monster.mtame) !== 0;
        if (yelps) await yelp(monster, MONSTER_SOUND[monster.mnum] ?? 0);
        else await growl(monster);
    }

    if (!monster.mtame) {
        monster.mflee = 0;
        return true;
    }

    let fleeTime = potentialDamage > 0 ? rnd(potentialDamage) : 1;
    if (monster === state.u?.ustuck) state.u.ustuck = null;
    if (!monster.mflee || monster.mfleetim) {
        fleeTime += monster.mfleetim ?? 0;
        if (fleeTime === 1) fleeTime = 2;
        monster.mfleetim = Math.min(fleeTime, 127);
    }
    monster.mflee = 1;
    monster.mtrack = [];
    return true;
}

export async function prepareKick({
    martial = false,
    state = game,
    announce = async () => {},
} = {}) {
    let clumsy = false;
    const capacity = weightCapacity(state);
    const unusedCapacity = -invWeight(state);

    if (unusedCapacity < (capacity * 3) / 10) {
        const noDamageRange = unusedCapacity < capacity / 10 ? 2
            : unusedCapacity < capacity / 5 ? 3 : 4;
        if (rn2(noDamageRange) === 0) {
            if (martial) return { stopped: false, clumsy: false };
            await announce('Your clumsy kick does no damage.');
            return { stopped: true, clumsy: false };
        }
        if (unusedCapacity < capacity / 10) {
            clumsy = true;
        } else if (rn2(unusedCapacity < capacity / 5 ? 2 : 3) === 0) {
            clumsy = true;
        }
    }

    const fumbling = !!(state.u?.fumbling
        || (state.u?.fumblingTurns ?? 0) > 0);
    if (fumbling) {
        clumsy = true;
    } else {
        const armor = state.uarm || state.u?.uarm;
        const bulky = armor && OBJECT_BIMANUAL[armor.otyp];
        if (bulky && currentAttribute(A_DEX, state) < rnd(25)) clumsy = true;
    }
    return { stopped: false, clumsy };
}

export function levitatingKickMisses(monster, state = game) {
    const levitating = !!(state.u?.levitating || state.u?.levitation
        || state.levitating);
    if (!levitating || rn2(3) !== 0) return false;
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 1
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY)) return false;
    exerciseAttribute(A_DEX, false, state);
    return true;
}

export async function tryKickEvasion(monster, {
    clumsy = false,
    martial = false,
    state = game,
    announce = async () => {},
    nameMonster = () => 'The monster',
} = {}) {
    if (rn2(clumsy ? 3 : 4) !== 0) return false;

    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const canEvade = (clumsy || (MONSTER_SIZE[monster.mnum] ?? 2) < 3)
        && monster.mcansee !== 0 && !monster.mtrapped
        && !(flags & M1_THICK_HIDE)
        && MONSTER_SYMBOL[monster.mnum] !== S_EEL
        && !(flags & M1_NOEYES)
        && monster.mcanmove !== 0 && !monster.mstun && !monster.mconf
        && !monster.msleeping && (MONSTER_MOVE[monster.mnum] ?? 0) >= 12;
    if (!canEvade) return false;

    if (!(flags & M1_NOHANDS) && rn2(martial ? 5 : 3) === 0) {
        await announce(
            `${nameMonster(monster)} blocks your ${clumsy ? 'clumsy ' : ''}kick.`,
        );
        return true;
    }

    const relocation = nextOpenSquareNearHero(monster, state);
    if (!relocation) return false;
    await announce(
        `${nameMonster(monster)} ${evasionVerb(monster, state)}, ${
            clumsy ? 'easily' : 'nimbly'
        } evading your ${clumsy ? 'clumsy ' : ''}kick.`,
    );
    return true;
}

export function prepareKickDamage(monster, {
    clumsy = false,
    state = game,
} = {}) {
    const boots = state.uarmf || state.u?.uarmf;
    let damage = Math.trunc(
        (currentAttribute(A_STR, state) + currentAttribute(A_DEX, state)
            + currentAttribute(A_CON, state)) / 15,
    );
    if (boots?.otyp === KICKING_BOOTS) damage += 5;
    if (clumsy) damage = Math.trunc(damage / 2);

    const thickSkinned = !!((MONSTER_FLAGS1[monster.mnum] ?? 0)
        & M1_THICK_HIDE);
    if (thickSkinned || monster.mnum === PM_SHADE) damage = 0;
    const specialDamage = specialBootDamage(monster, boots);
    if (monster.mnum === PM_SHADE && specialDamage === 0) {
        return {
            potentialDamage: 0,
            specialDamage: 0,
            passesThroughShade: true,
        };
    }

    return { potentialDamage: damage, specialDamage, passesThroughShade: false };
}

export function rollKickDamage(prepared, {
    martial = false,
    state = game,
} = {}) {
    const boots = state.uarmf || state.u?.uarmf;
    let damage = prepared.potentialDamage;

    let trainSkill = false;
    if (damage > 0) {
        damage = rnd(damage);
        if (martial) {
            trainSkill = damage > 1;
            damage += rn2(Math.trunc(currentAttribute(A_DEX, state) / 2) + 1);
        }
        exerciseAttribute(A_DEX, true, state);
    }
    damage += prepared.specialDamage + (boots?.spe ?? 0)
        + (state.u?.udaminc ?? state.udaminc ?? 0);
    return { damage: Math.max(0, damage), trainSkill };
}

export async function tryKickReel(monster, dx, dy, {
    martial = false,
    state = game,
    announce = async () => {},
    nameMonster = () => 'The monster',
} = {}) {
    if ((monster.mhp ?? 1) <= 0 || !martial
        || (MONSTER_SIZE[monster.mnum] ?? 2) >= 3) return null;
    if (rn2(3) !== 0 || monster.mcanmove === 0
        || monster === state.u?.ustuck || monster.mtrapped) return null;

    const x = monster.mx + Math.sign(dx);
    const y = monster.my + Math.sign(dy);
    if (!monsterGoodPosition(
        monster.mnum, x, y, false, false, false, state,
    )) return null;

    await announce(`${nameMonster(monster)} reels from the blow.`);
    const oldx = monster.mx;
    const oldy = monster.my;
    monster.mx = x;
    monster.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
    const trap = triggerImmediateMonsterTrap(monster, state);
    return {
        oldx, oldy, x, y,
        trap: trap.event,
        dead: (monster.mhp ?? 1) <= 0,
    };
}
