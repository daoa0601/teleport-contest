// Egg hatch timers.
// C refs: timeout.c attach_egg_hatch_timeout()/hatch_egg().

import {
    G_EXTINCT, G_GENOD, IS_POOL, MM_NOMSG, MV_KNOWS_EGG, NO_MINVENT,
} from './const.js';
import { canSeeMonster, newsym } from './display.js';
import { tameMonster } from './monster_taming.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { DueObjectTimer } from './object_timers.js';

type HatchLocation = {
    kind: 'floor' | 'inventory'; x: number; y: number; carrier: null;
} | { kind: 'minvent'; x: number; y: number; carrier: Monster };

interface UnhatchedEggBase {
    egg: GameObject;
    hatched: 0;
    finishPending: false;
    message?: never;
    followupMessage?: never;
}

interface SterileEgg extends UnhatchedEggBase { sterile: true }
interface MisplacedEgg extends UnhatchedEggBase {
    sterile: false;
    cannotHatchHere: true;
}
interface UnhatchedEgg extends UnhatchedEggBase {
    x: number; y: number; mnum: number;
    sterile: false;
    desired: number;
    unavailable?: true;
}
export interface HatchedEgg {
    egg: GameObject;
    x: number; y: number; mnum: number;
    monster: Monster;
    carrier: Monster | null;
    desired: number;
    hatched: number;
    message: string | null;
    followupMessage: string | null;
    learnPending: boolean;
    redraw: boolean;
    finishPending: boolean;
    finished?: true;
}
export type EggHatchEvent = SterileEgg | MisplacedEgg | UnhatchedEgg | HatchedEgg;

import { makemonNear } from './mklev.js';
import {
    MONSTER_FLAGS1, MONSTER_GENO, MONSTER_MOVE, MONSTER_SOUND,
    MONSTER_SYMBOL, monsterTypeName, monsterYoungerForm,
} from './monster_data.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { EGG } from './object_data.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from './object_timers.js';
import { rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

const G_UNIQ = 0x1000;
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const S_EYE = 5;
const S_DRAGON = 30;
const S_LIGHT = 25;
const S_EEL = 57;

function floorHatchMessage(mnum: number, count: number): string {
    const name = monsterTypeName(mnum);
    return count > 1
        ? `You see some ${makePlural(name)} hatch.`
        : `You see ${withIndefiniteArticle(name)} hatch.`;
}

function hatchLocomotion(mnum: number): string {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (flags & M1_FLY) return 'fly';
    if (flags & M1_SLITHY) return 'slither';
    if (flags & M1_AMORPHOUS) return 'ooze';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0) return 'wiggle';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'crawl';
    return 'drop';
}

function inventoryHatchMessage(mnum: number, count: number, visible: boolean): string {
    const motion = hatchLocomotion(mnum);
    if (!visible) return `You feel something ${motion} from your pack!`;
    const name = monsterTypeName(mnum);
    const newborn = count > 1
        ? `some ${makePlural(name)}`
        : withIndefiniteArticle(name);
    return `You see ${newborn} ${motion} out of your pack!`;
}

function possessive(noun: string): string {
    return /s$/i.test(noun) ? `${noun}'` : `${noun}'s`;
}

function monsterPackName(monster: Monster): string {
    if (monster.name) return `${possessive(monster.name)} pack`;
    const species = monsterTypeName(monster.mnum, !!monster.female);
    return `${possessive(withIndefiniteArticle(species))} pack`;
}

function eggCarrier(egg: GameObject, state: GameState): Monster | undefined {
    if (egg.ocarry) return egg.ocarry;
    return (state.level?.monsters || []).find(monster =>
        monster.m_id === egg.carrierMid
        || (monster.minvent || monster.inventory || []).includes(egg));
}

function hatchLocation(egg: GameObject, state: GameState): HatchLocation | null {
    if (egg.where === 'floor')
        return { kind: 'floor', x: egg.ox, y: egg.oy, carrier: null };
    if (egg.where === 'inventory') {
        return {
            kind: 'inventory',
            x: state.u?.ux,
            y: state.u?.uy,
            carrier: null,
        };
    }
    if (egg.where === 'minvent') {
        const carrier = eggCarrier(egg, state);
        if (carrier) {
            return {
                kind: 'minvent',
                x: carrier.mx,
                y: carrier.my,
                carrier,
            };
        }
    }
    return null;
}

function monsterInventoryHatchMessage(
    mnum: number, count: number, carrier: Monster, x: number, y: number, state: GameState,
) {
    const name = monsterTypeName(mnum);
    const newborn = count > 1
        ? `some ${makePlural(name)}`
        : withIndefiniteArticle(name);
    const carrierIsVisible = canSeeMonster(carrier)
        && (!carrier.wormno || cansee(carrier.mx, carrier.my));
    let source: string;
    const terrain = state.level?.at(x, y)?.typ;
    if (carrierIsVisible) {
        source = monsterPackName(carrier);
    } else if (terrain !== undefined && IS_POOL(terrain)) {
        source = 'empty water';
    } else {
        source = 'thin air';
    }
    return {
        message: `You see ${newborn} ${hatchLocomotion(mnum)} out of ${source}!`,
        knowsEgg: carrierIsVisible,
    };
}

function hatchlingCry(mnum: number): string {
    const sound = MONSTER_SOUND[mnum] ?? 0;
    if (sound === 9) return 'hiss';
    if (sound === 3 || sound === 5) return 'growl';
    if (sound === 8) return 'chirp';
    if (sound === 10) return 'buzz';
    if (sound === 7) return 'screech';
    if (sound === 11) return 'grunt';
    if (sound === 21) return 'mumble';
    return MONSTER_SYMBOL[mnum] === S_EEL ? 'gurgle' : 'chitter';
}

function ingForm(verb: string): string {
    return verb.endsWith('e')
        ? `${verb.slice(0, -1)}ing`
        : `${verb}ing`;
}

function heroIsDeaf(state: GameState): boolean {
    return !!(state.deaf || state.u?.deaf
        || (state.u?.deafTurns ?? 0) > 0);
}

function parentHatchMessage(mnum: number, count: number, egg: GameObject, state: GameState): string {
    const subject = count > 1 ? 'Their' : 'Its';
    const description = (MONSTER_SOUND[mnum] ?? 0) === 0
        || heroIsDeaf(state)
        ? 'seems' : 'sounds';
    const parent = state.flags?.female ? 'mommy' : 'daddy';
    const punctuation = egg.spe ? '.' : '?';
    return `${subject} ${ingForm(hatchlingCry(mnum))} ${
        description} like "${parent}${punctuation}"`;
}

// C creates the monsters and reduces the egg stack before it prints the hatch
// message. The caller prints that message before finishEggHatchTimer() updates
// knowledge, schedules the remaining eggs, or removes the empty stack.
export async function runClaimedEggHatchTimer(
    claimed: DueObjectTimer | null | undefined,
    state: GameState = game, currentTurn = state.moves,
): Promise<EggHatchEvent | null> {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.HATCH_EGG)
        return null;
    const egg = claimed.object;
    if (!egg || egg.otyp !== EGG) return null;
    const species = egg.corpsenm ?? -1;
    if (species < 0) {
        return { egg, sterile: true, hatched: 0, finishPending: false };
    }

    const inInventory = egg.where === 'inventory';
    const yours = !!egg.spe
        || (!state.flags?.female && inInventory && rn2(2) === 0);
    const silent = claimed.timer.deadline !== currentTurn;
    const location = hatchLocation(egg, state);
    if (!location) {
        return {
            egg, sterile: false, cannotHatchHere: true,
            hatched: 0, finishPending: false,
        };
    }
    const { x, y } = location;
    const quantity = egg.quan ?? egg.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1)
        throw new Error('HATCH_EGG requires a positive egg quantity');
    const mnum = monsterYoungerForm(species);
    const visible = !silent && cansee(x, y);
    const desired = rnd(quantity);
    const unavailable = !!((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)
        || !!((state.mvitals?.[mnum]?.mvflags ?? 0)
            & (G_GENOD | G_EXTINCT));
    if (unavailable) {
        return {
            egg, x, y, mnum, sterile: false, unavailable: true,
            desired, hatched: 0, finishPending: false,
        };
    }

    let lastMonster: Monster | null = null;
    let hatched = 0;
    for (let index = 0; index < desired; index++) {
        const monster = await makemonNear(
            mnum, x, y, NO_MINVENT | MM_NOMSG, false,
        );
        if (!monster) break;
        const inventoryDragon = inInventory
            && MONSTER_SYMBOL[mnum] === S_DRAGON;
        if ((yours && !silent) || inventoryDragon) {
            if (await tameMonster(monster)
                && inInventory && !inventoryDragon) monster.mtame = 20;
        }
        lastMonster = monster;
        hatched++;
        if ((state.mvitals?.[mnum]?.mvflags ?? 0) & G_EXTINCT) break;
    }
    if (!lastMonster) {
        return {
            egg, x, y, mnum, sterile: false, desired, hatched: 0,
            finishPending: false,
        };
    }

    egg.quan = quantity - hatched;
    egg.quantity = egg.quan;
    let message: string | null = null;
    let knowsEgg = false;
    if (location.kind === 'floor' && visible) {
        message = floorHatchMessage(mnum, hatched);
        knowsEgg = true;
    } else if (location.kind === 'inventory') {
        message = inventoryHatchMessage(mnum, hatched, visible);
        knowsEgg = true;
    } else if (location.kind === 'minvent' && visible) {
        const presentation = monsterInventoryHatchMessage(
            mnum, hatched, location.carrier, x, y, state,
        );
        message = presentation.message;
        knowsEgg = presentation.knowsEgg;
    }

    let followupMessage: string | null = null;
    if (location.kind === 'inventory') {
        if (yours) {
            followupMessage = parentHatchMessage(mnum, hatched, egg, state);
        } else if (MONSTER_SYMBOL[mnum] === S_DRAGON
            && !heroIsDeaf(state)) {
            followupMessage = 'Gleep!';
        }
    }
    return {
        egg, x, y, mnum, monster: lastMonster, carrier: location.carrier,
        desired, hatched, message, followupMessage,
        learnPending: visible && knowsEgg,
        redraw: location.kind === 'floor' && visible,
        finishPending: true,
    };
}

export function finishEggHatchTimer(
    event: EggHatchEvent | null | undefined,
    state: GameState = game, currentTurn = state.moves,
): EggHatchEvent | null | undefined {
    if (!event?.finishPending || !event.egg) return event;
    const egg = event.egg;
    if (event.learnPending) {
        if (!Array.isArray(state.mvitals)) state.mvitals = [];
        const adult = egg.corpsenm;
        if (adult === undefined) throw new Error('Hatched egg has no adult species');
        const vital = state.mvitals[adult]
            || (state.mvitals[adult] = { mvflags: 0, born: 0, died: 0 });
        vital.mvflags = (vital.mvflags ?? 0) | MV_KNOWS_EGG;
    }

    if ((egg.quan ?? 0) > 0) {
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            currentTurn + rnd(12), state,
        );
        egg.owt = objectWeight(egg);
    } else {
        if (egg.where === 'floor') {
            remove_object(egg);
        } else if (egg.where === 'inventory') {
            const index = (state.inventory || []).indexOf(egg);
            if (index >= 0) state.inventory.splice(index, 1);
        } else if (egg.where === 'minvent') {
            const carrier = event.carrier || eggCarrier(egg, state);
            if (carrier) unlinkMonsterObject(carrier, egg);
        }
        egg.where = 'gone';
        egg.ocarry = null;
        delete egg.carrierMid;
        egg.ox = egg.oy = 0;
    }
    if (event.redraw) newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}
