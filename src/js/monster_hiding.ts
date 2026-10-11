// Shared hiding decisions. C refs: mon.c restrap(), hideunder(), hide_monst(),
// maybe_unhide_at(), and monmove.c can_hide_under_obj().

import {
    COULD_SEE, IN_SIGHT, MGIVENNAME, M_AP_TYPE, PLNMSG_HIDE_UNDER, ROOM, is_pit,
} from './const.js';
import { canSeeMonster, canSenseMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { setMimicAppearance } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SYMBOL } from './monster_data.js';
import { monsterHasMapPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { CORPSE } from './object_data.js';
import { simpleObjectNameWithArticle } from './objnam.js';
import { rn2 } from './rng.js';
import { heroResistsStoning, touchPetrifies } from './stoning.js';
import { isLavaAt, isPoolAt, levelHasCeiling, levelIsWaterLevel } from './terrain_properties.js';
import type { GameState } from './game_state.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

const COIN_CLASS = 12;
const M1_FLY = 0x1, M1_AMORPHOUS = 0x4, M1_CLING = 0x10;
const M1_CONCEAL = 0x80, M1_HIDE = 0x100, M1_NOLIMBS = 0x6000, M1_SLITHY = 0x80000;
const S_EYE = 5, S_MIMIC = 13, S_LIGHT = 25, S_EEL = 57;

export interface MonsterHideUnder {
    undetected: boolean;
    oldUndetected: boolean;
    message: string | null;
}

interface HidingActor {
    species: number;
    x: number;
    y: number;
    held: boolean;
    trapped: boolean;
    tame: boolean;
    stoneResistant: boolean;
}

interface HidingPlace { undetected: boolean; cover: GameObject | null; water: boolean }

// Restored hiders get their attempt before normal vision can expose their spot.
// Only that square's vision bits are hidden, and hideunder sees restored vision.
export async function hideMonsterOnRestore(monster: Monster, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const hiderUnder = !!(flags & M1_CONCEAL) || MONSTER_SYMBOL[monster.mnum] === S_EEL;
    if (!(flags & M1_HIDE) && !hiderUnder) return;
    if (monster.mundetected || M_AP_TYPE(monster)) return;
    const row = state.viz_array?.[monster.my];
    const savedVision = row?.[monster.mx];
    if (!row || savedVision === undefined)
        throw new Error('Restoring monster hiding requires an initialized vision square.');
    row[monster.mx] = savedVision & ~(IN_SIGHT | COULD_SEE);
    try {
        if (flags & M1_HIDE) await attemptMonsterRestrap(monster, state);
        if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC && !M_AP_TYPE(monster))
            await attemptMonsterRestrap(monster, state);
    } finally {
        row[monster.mx] = savedVision;
    }
    if (hiderUnder) await hideMonsterUnder(monster, state);
}

export async function attemptMonsterRestrap(
    monster: Monster, state: GameState = game,
    { random = rn2, calls }: { random?: RandomBelow; calls?: MonsterCallLog } = {},
): Promise<boolean> {
    requireLiveGame(state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (!(flags & M1_HIDE) || monster.mcan || M_AP_TYPE(monster)
        || ((state.viz_array?.[monster.my]?.[monster.mx] ?? 0) & IN_SIGHT)) return false;
    calls?.push(3);
    if (random(3) !== 0 || state.u.ustuck === monster) return false;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my);
    if (monster.mtrapped && trap && !is_pit(trap.ttyp)) return false;
    const mimic = MONSTER_SYMBOL[monster.mnum] === S_MIMIC;
    const ceilingHider = !!((flags & M1_CLING) && !mimic) || !!(flags & M1_FLY);
    if (ceilingHider && !levelHasCeiling(state)) return false;
    const adjacent = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) <= 1;
    if (canSenseMonster(monster) && adjacent) return false;
    if (mimic) {
        if (monster.msleeping || monster.mfrozen) return false;
        await setMimicAppearance(monster);
        return true;
    }
    if (level.at(monster.mx, monster.my)?.typ !== ROOM) return false;
    monster.mundetected = 1;
    return true;
}

// Capture names while the creature is visible, then change its hidden state.
// The caller publishes this message before repainting, so a pending More keeps
// the pre-concealment screen until the player acknowledges the earlier line.
export function beginMonsterHideUnder(monster: Monster, state: GameState = game): MonsterHideUnder {
    requireLiveGame(state);
    const seen = !state.in_mklev && canSeeMonster(monster);
    const place = hidingPlace(monsterHidingActor(monster, state), state);
    let message: string | null = null;
    if (seen) {
        const cover = place.water ? 'the water'
            : place.cover ? simpleObjectNameWithArticle(place.cover, state) : null;
        const subject = monsterName(monster, {
            state, article: monster.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
        });
        if (place.undetected && cover) {
            const verb = place.water ? 'dive' : hidingLocomotion(monster.mnum);
            message = `You see ${subject} ${verb} under ${cover}.`;
        }
    }
    const oldUndetected = !!monster.mundetected;
    monster.mundetected = place.undetected ? 1 : 0;
    return { undetected: place.undetected, oldUndetected, message };
}

export async function finishMonsterHideUnder(
    monster: Monster, concealment: MonsterHideUnder, state: GameState = game,
): Promise<void> {
    if (concealment.message) {
        await plineWithContinuation(concealment.message);
        state._lastPlineKind = PLNMSG_HIDE_UNDER;
        state.last_hider = monster.m_id;
    }
    if (concealment.undetected !== concealment.oldUndetected) newsym(monster.mx, monster.my);
}

export async function hideMonsterUnder(monster: Monster, state: GameState = game): Promise<boolean> {
    const concealment = beginMonsterHideUnder(monster, state);
    await finishMonsterHideUnder(monster, concealment, state);
    return concealment.undetected;
}

export function canMonsterHideUnderObjectAt(state: GameState, x: number, y: number): boolean {
    const pile = state.level?.objects[x]?.[y] ?? [];
    if (pile[0]?.where !== 'floor') return false;
    const trap = state.level?.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp)) return false;
    let coins = 0;
    for (const object of pile) {
        if (object.oclass !== COIN_CLASS) return true;
        coins += object.quan;
        if (coins >= 10) return true;
    }
    return false;
}

export function maybeUnhideAt(x: number, y: number, state: GameState = game): void {
    const monster = state.level?.monsters.find(candidate => monsterHasMapPosition(candidate, state)
        && !candidate.dead && candidate.mx === x && candidate.my === y);
    const isHero = !monster && state.u.ux === x && state.u.uy === y;
    if (!monster && !isHero) return;
    if (!(monster ? monster.mundetected : state.u.uundetected)) return;
    const actor = monster ? monsterHidingActor(monster, state) : {
        species: heroSpecies(state), x, y, held: false, trapped: !!state.u.utrap,
        tame: false, stoneResistant: heroResistsStoning(state),
    };
    const hidesUnder = !!((MONSTER_FLAGS1[actor.species] ?? 0) & M1_CONCEAL);
    const eel = MONSTER_SYMBOL[actor.species] === S_EEL;
    const exposed = hidesUnder && (actor.trapped || !canMonsterHideUnderObjectAt(state, x, y))
        || eel && !isPoolAt(x, y, state);
    if (!exposed) return;
    const hidden = hidingPlace(actor, state).undetected;
    if (monster) monster.mundetected = hidden ? 1 : 0;
    else state.u.uundetected = hidden ? 1 : 0;
    if (!hidden) newsym(x, y);
}

function monsterHidingActor(monster: Monster, state: GameState): HidingActor {
    return {
        species: monster.mnum, x: monster.mx, y: monster.my,
        held: state.u.ustuck === monster, trapped: !!monster.mtrapped,
        tame: !!monster.mtame, stoneResistant: monsterHasStoneResistance(monster),
    };
}

function hidingPlace(actor: HidingActor, state: GameState): HidingPlace {
    const { x, y } = actor;
    const nowhere: HidingPlace = { undetected: false, cover: null, water: false };
    if (actor.held || actor.trapped) return nowhere;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp)) return nowhere;
    if (MONSTER_SYMBOL[actor.species] === S_EEL) {
        const heroUnderwater = !!(state.underwater || state.u.uinwater);
        const inLineOfSight = !!((state.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
        const hidden = isPoolAt(x, y, state) && !levelIsWaterLevel(state)
            && (!heroUnderwater || !inLineOfSight);
        return { undetected: hidden, cover: null, water: true };
    }
    if (!((MONSTER_FLAGS1[actor.species] ?? 0) & M1_CONCEAL)
        || !canMonsterHideUnderObjectAt(state, x, y)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state)) return nowhere;
    const pile = level.objects[x]?.[y] ?? [];
    if (actor.tame && pile.some(object => object.cursed)) return nowhere;
    const petrifyingOnly = !actor.stoneResistant
        && pile.every(object => object.otyp === CORPSE && touchPetrifies(object.corpsenm));
    return { undetected: !petrifyingOnly, cover: pile[0] ?? null, water: false };
}

function hidingLocomotion(species: number): string {
    const flags = MONSTER_FLAGS1[species] ?? 0;
    const symbol = MONSTER_SYMBOL[species];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (flags & M1_FLY) return 'fly';
    if (flags & M1_SLITHY) return 'slither';
    if (flags & M1_AMORPHOUS) return 'ooze';
    if (MONSTER_MOVE[species] === 0) return 'wiggle';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'crawl';
    return 'hide';
}
