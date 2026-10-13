// Ordinary humanoid kicks against monsters.
// C refs: dokick.c:kick_monster() and kickdmg().

import { makeMonsterFlee } from './monster_flee.js';
import { updateMonsterRegions } from './regions.js';
import { game, requirePlayingGame } from './gstate.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';

interface KickOptions {
    clumsy?: boolean;
    martial?: boolean;
    state?: GameState;
    announce?: MessagePublisher;
    nameMonster?: (monster: Monster) => string;
}

export interface PreparedKickDamage {
    potentialDamage: number;
    specialDamage: number;
    passesThroughShade: boolean;
}

import { abusePet } from './dog.js';
import { A_CON, A_DEX, A_STR } from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { couldsee } from './vision.js';
import { newsym, unmap_invisible } from './display.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterHatesBlessings,
    monsterHatesSilver,
} from './monster_data.js';
import {
    KICKING_BOOTS, OBJECT_BIMANUAL, OBJECT_MATERIAL,
} from './object_data.js';
import { rnd, rn2 } from './rng.js';
import {
    findNearbyMonsterPosition, goodPosition, monsterTeleportRestricted,
} from './teleport_rules.js';
import { invWeight, weightCapacity } from './weight.js';
import {
    resumeDeferredMonsterTrap,
    triggerImmediateMonsterTrap,
} from './monmove.js';

const M1_FLY = 0x00000001;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M1_THICK_HIDE = 0x00200000;
const M1_TPORT = 0x02000000;
const M2_UNDEAD = 0x00000002;
const S_EYE = 5;
const S_LIGHT = 25;
const S_EEL = 57;
const PM_GRID_BUG = 116;
const PM_SHADE = 288;
const SILVER = 14;

function nextOpenSquareNearHero(monster: Monster, state: GameState) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const destination = findNearbyMonsterPosition(
            monster.mnum, state.u.ux, state.u.uy, { state },
        );
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

function evasionVerb(monster: Monster, state: GameState): string {
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

function specialBootDamage(monster: Monster, boots: GameObject | null | undefined): number {
    if (!boots) return 0;
    let damage = 0;
    if (boots.blessed && monsterHatesBlessings(monster)) damage += rnd(4);
    if (OBJECT_MATERIAL[boots.otyp] === SILVER
        && monsterHatesSilver(monster))
        damage += rnd(20);
    return damage;
}

export function kickConductViolation(monster: Monster, {
    helpless = false,
    fleeingFromBehind = false,
    state = game,
}: { helpless?: boolean; fleeingFromBehind?: boolean; state?: GameState } = {}): string | null {
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

export async function abuseKickedPet(monster: Monster, potentialDamage: number, {
    state = game,
}: { state?: GameState } = {}) {
    if (!await abusePet(monster, state)) return { heroDied: false };

    if (!monster.mtame) {
        monster.mflee = 0;
        return { heroDied: false };
    }

    const turns = potentialDamage > 0 ? rnd(potentialDamage) : 1;
    return makeMonsterFlee(monster, { state, turns, announce: false });
}

export async function prepareKick({
    martial = false,
    state = game,
    announce = async () => {},
}: KickOptions = {}) {
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

export async function levitatingKickMisses(monster: Monster, state: GameState = game): Promise<boolean> {
    const levitating = !!(state.u?.levitating || state.u?.levitation
        || state.levitating);
    if (!levitating || rn2(3) !== 0) return false;
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 1
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY)) return false;
    await exerciseAttribute(A_DEX, false, state);
    return true;
}

export async function tryKickEvasion(monster: Monster, {
    clumsy = false,
    martial = false,
    state = game,
    announce = async () => {},
    nameMonster = () => 'The monster',
}: KickOptions = {}) {
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

export function prepareKickDamage(monster: Monster, {
    clumsy = false,
    state = game,
}: KickOptions = {}) {
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

export async function rollKickDamage(prepared: PreparedKickDamage, {
    martial = false,
    state = game,
}: KickOptions = {}) {
    const boots = state.uarmf || state.u?.uarmf;
    let damage = prepared.potentialDamage;

    let trainSkill = false;
    if (damage > 0) {
        damage = rnd(damage);
        if (martial) {
            trainSkill = damage > 1;
            damage += rn2(Math.trunc(currentAttribute(A_DEX, state) / 2) + 1);
        }
        await exerciseAttribute(A_DEX, true, state);
    }
    damage += prepared.specialDamage + (boots?.spe ?? 0)
        + (state.u?.udaminc ?? state.udaminc ?? 0);
    return { damage: Math.max(0, damage), trainSkill };
}

export async function tryKickReel(monster: Monster, dx: number, dy: number, {
    martial = false,
    state = game,
    announce = async () => {},
    nameMonster = () => 'The monster',
}: KickOptions = {}) {
    requirePlayingGame(state);
    if ((monster.mhp ?? 1) <= 0 || !martial
        || (MONSTER_SIZE[monster.mnum] ?? 2) >= 3) return null;
    if (rn2(3) !== 0 || monster.mcanmove === 0
        || monster === state.u?.ustuck || monster.mtrapped) return null;

    const x = monster.mx + Math.sign(dx);
    const y = monster.my + Math.sign(dy);
    if (!goodPosition(x, y, { kind: 'monster', monster }, { state })) return null;

    await announce(`${nameMonster(monster)} reels from the blow.`);
    const oldx = monster.mx;
    const oldy = monster.my;
    updateMonsterRegions(monster, state, { x, y });
    monster.mx = x;
    monster.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
    const trap = await triggerImmediateMonsterTrap(monster, state);
    await resumeDeferredMonsterTrap(trap, state, {
        publish: announce, describeMonster: nameMonster,
    });
    return {
        oldx, oldy, x, y,
        trap: trap.event,
        dead: !!monster.dead || (monster.mhp ?? 1) <= 0,
        heroDied: !!trap.event && 'heroDied' in trap.event && !!trap.event.heroDied,
    };
}
