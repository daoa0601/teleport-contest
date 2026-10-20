// Monster body and terrain rules.
// C ref: mon.c.

import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import type { MonsterDeathResult, MonsterLiquidDeathResult } from './monster_death.js';
import type { MonsterRelocation } from './monster_action_types.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel, monsterFliesOrFloats, monsterInAir } from './terrain_properties.js';
import { makeMonsterFlee } from './monster_flee.js';
import { RLOC_MSG, RLOC_NOMSG, FOUNTAIN, G_GENOD, MSLOW, STRAT_WAITFORU, WATER } from './const.js';
import { dryFountainAt } from './fountain.js';
import {
    canSeeMonster, displayLiquidName, newsym, plineWithContinuation,
} from './display.js';
import { splitMonster } from './monster_clone.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME,
    MONSTER_SYMBOL, monsterYoungerForm,
} from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterName } from './monster_name.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterHasFireResistance } from './monster_resistance.js';
import { EGG } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectsInTimerGraph, stopObjectTimer,
} from './object_timers.js';
import { d, rn2, rnd } from './rng.js';
import { dealWithMonsterOvercrowding, randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { fireDamageChain } from './fire_damage.js';
import { waterDamageChain } from './trap.js';
import { cansee } from './vision.js';
import { AD_COLD, AD_ELEC, AD_FIRE, AT_NONE } from './monster_attack_types.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { monsterSentenceSubject } from './monster_sound.js';

const M1_SWIM = 0x00000002;
const M1_CLING = 0x00000010;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const M1_TPORT = 0x02000000;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const S_EEL = 57;

export interface MonsterLiquidDeathContext {
    state: GameState;
    random: (limit: number) => number;
    rollOne: (sides: number) => number;
    leaveCorpse: boolean;
    cause: 'rust' | 'drowning' | 'lava-scorch' | 'lava-burning';
    // mondead() and xkilled() announce grief on opposite sides of cleanup.
    sadFeeling: boolean;
    publish: MessagePublisher;
}

export interface MonsterLiquidOptions<DeathResult = MonsterLiquidDeathResult> {
    announce?: MessagePublisher;
    finishDeath?: (monster: Monster, options: MonsterLiquidDeathContext) => DeathResult | Promise<DeathResult>;
    monsterMoving?: boolean;
    random?: (limit: number) => number;
    rollDice?: (count: number, sides: number) => number;
    rollOne?: (sides: number) => number;
}

export type MonsterLiquidReaction =
    | {
        kind: 'split'; survived: true; clone: Monster | null; fountainDried: boolean;
        dead?: never; heroDied?: never; relocation?: never;
    }
    | {
        survived: true; relocation?: MonsterRelocation | null;
        dead?: never; heroDied?: never; kind?: never;
    }
    | { heroDied: true; dead?: never; survived?: never; kind?: never };

export type MonsterPoolReaction = { kind: 'safe' | 'drown' } | { kind: 'rust'; damage: number };
export type MonsterLavaReaction = { kind: 'safe' | 'scorch' | 'burn' };

interface GenocideRemovalResult {
    killed: MonsterDeathResult[];
    reshaped: Monster[];
    sterileEggs?: GameObject[];
    heroDied?: boolean;
}

// C mhitm.c:paralyze_monst(). Paralysis also interrupts eating and waiting.
export function paralyzeMonster(monster: Monster, turns: number): void {
    monster.mcanmove = 0;
    monster.mfrozen = Math.min(127, turns);
    monster.meating = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
}

// C healmon(). Overhealing can increase the monster's maximum health.
export function healMonster(monster: Monster, amount: number, overheal = 0): number {
    const before = monster.mhp;
    monster.mhp = Math.min(monster.mhp + amount, monster.mhpmax + overheal);
    monster.mhpmax = Math.max(monster.mhpmax, monster.mhp);
    return monster.mhp - before;
}

export async function applyMonsterGolemEffects(monster: Monster, damageType: number, damage: number, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<void> {
    const species = MONSTER_NAME[monster.mnum];
    let healing = 0;
    let slow = false;
    if (species === 'flesh golem') {
        if (damageType === AD_ELEC) healing = Math.trunc((damage + 5) / 6);
        else slow = damageType === AD_FIRE || damageType === AD_COLD;
    } else if (species === 'iron golem') {
        slow = damageType === AD_ELEC;
        if (damageType === AD_FIRE) healing = damage;
    } else return;

    if (slow && monster.mspeed !== MSLOW) {
        const change = adjustMonsterSpeed(monster, -1);
        if (!state.in_mklev && change.changed && change.canDescribe && canSeeMonster(monster)) {
            const message = monsterSpeedMessage(change, monsterSentenceSubject(monster), state);
            if (message) await publish(message);
        }
    }
    if (healing && healMonster(monster, healing) && cansee(monster.mx, monster.my))
        await publish(`${monsterSentenceSubject(monster)} seems healthier.`);
}

function speciesWasGenocided(mnum: number, state: GameState): boolean {
    return !!((state.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}

function eggSpeciesWasGenocided(egg: GameObject, state: GameState): boolean {
    const mnum = egg?.corpsenm;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0) return true;
    return speciesWasGenocided(mnum, state)
        || speciesWasGenocided(monsterYoungerForm(mnum), state);
}

export function killGenocidedMonster(monster: Monster, state: GameState): Promise<MonsterDeathResult> {
    return finishEnvironmentalMonsterDeath(monster, state, { noCorpse: true });
}

// C mon.c:kill_genocided_monsters().  Genocide is not a hero kill: it drops
// carried objects, creates no corpse or experience, and sterilizes eggs.
export async function killGenocidedMonsters(state: GameState = game): Promise<GenocideRemovalResult> {
    if (state !== game)
        throw new Error('genocide removal requires the live game state');
    const killed = [];
    const reshaped = [];
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (monster.dead || (monster.mhp ?? 1) <= 0) continue;
        const baseWasGenocided = monster.cham !== undefined && Number.isInteger(monster.cham)
            && monster.cham >= 0
            && speciesWasGenocided(monster.cham, state);
        if (!speciesWasGenocided(monster.mnum, state)
            && !baseWasGenocided) continue;
        if (monster.cham !== undefined && Number.isInteger(monster.cham) && monster.cham >= 0
            && !baseWasGenocided) {
            const change = await changeMonsterForm(monster, null, state, { showMessage: true });
            if (change?.heroDied) return { killed, reshaped, heroDied: true };
            if (change) reshaped.push(monster);
            continue;
        }
        const death = await killGenocidedMonster(monster, state);
        killed.push(death);
        if (death.heroDied) return { killed, reshaped, heroDied: true };
    }

    const sterileEggs = [];
    for (const object of objectsInTimerGraph(state)) {
        if (object.otyp !== EGG || !eggSpeciesWasGenocided(object, state))
            continue;
        stopObjectTimer(object, OBJECT_TIMER_KIND.HATCH_EGG);
        sterileEggs.push(object);
    }
    return { killed, reshaped, sterileEggs };
}

export function monsterSurvivesPool(monster: Monster, { waterWall = false } = {}): boolean {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const safeFlags = M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS
        | (waterWall ? 0 : M1_CLING);
    return !!(flags & safeFlags);
}

function heroKeepsSteedAboveLiquid(monster: Monster, state: GameState, waterWall: boolean): boolean {
    if (waterWall || state.u?.usteed !== monster) return false;
    return !!(state.u?.flying || state.flying
        || state.u?.levitating || state.u?.levitation || state.levitating);
}

export function rollMonsterPoolReaction(
    monster: Monster,
    state: GameState = game,
    { random = rn2, rollDice = d } = {},
): MonsterPoolReaction {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    const waterWall = location?.typ === WATER;
    const waterLevel = levelIsWaterLevel(state);
    const safelyAirborne = !waterWall && !waterLevel
        && monsterFliesOrFloats(monster);
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall)
        || safelyAirborne) {
        return { kind: 'safe' };
    }

    // Breathlessness prevents drowning, but does not protect an iron body
    // from rust. C checks this reaction before the drowning predicates.
    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }

    if (monsterSurvivesPool(monster, { waterWall })) return { kind: 'safe' };
    return { kind: 'drown' };
}

function monsterLikesLava(monster: Monster): boolean {
    return monster?.mnum === PM_FIRE_ELEMENTAL
        || monster?.mnum === PM_SALAMANDER;
}

export function monsterLavaReaction(monster: Monster, state: GameState = game): MonsterLavaReaction | null {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    if (!location || !isLavaAt(monster.mx, monster.my, state)) return null;

    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const likesLava = monsterLikesLava(monster);
    if (monsterInAir(monster, state) || (flags & M1_CLING) || likesLava)
        return { kind: 'safe' };
    const fireResistant = monsterHasFireResistance(monster);
    return { kind: fireResistant ? 'scorch' : 'burn' };
}

export async function resolveMonsterLiquid<DeathResult = MonsterLiquidDeathResult>(
    monster: Monster | null | undefined,
    state: GameState = game,
    {
        announce = async () => {},
        finishDeath,
        monsterMoving = true,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
    }: MonsterLiquidOptions<DeathResult> = {},
): Promise<DeathResult | MonsterLiquidReaction | null> {
    if (!monster) return null;
    const calls: string[] = [];
    const x = monster.mx;
    const y = monster.my;
    const location = state.level?.at?.(x, y);
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0 || !location)
        return null;
    if (typeof finishDeath !== 'function') {
        throw new TypeError('minliquid requires the monster death handler');
    }
    const sadFeeling = !!monster.mtame && !canSeeMonster(monster);
    const finishFatalLiquid = async (cause: MonsterLiquidDeathContext['cause'], leaveCorpse: boolean) => {
        // mondead()/xkilled() own recovery. In particular, xkilled records
        // conduct and pet responsibility before an amulet can save the victim.
        return finishDeath(monster, { state, random, rollOne, leaveCorpse, cause, sadFeeling, publish: announce });
    };

    const waterLevel = levelIsWaterLevel(state);
    const waterWall = location.typ === WATER;
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall))
        return { survived: true };
    const inPool = isPoolAt(x, y, state)
        && (!monsterFliesOrFloats(monster) || waterLevel);
    const inLava = isLavaAt(x, y, state) && !monsterFliesOrFloats(monster);
    const inFountain = location.typ === FOUNTAIN;
    if (monster.mnum === PM_GREMLIN && (inPool || inFountain)
        && random(3) !== 0) {
        const clone = await splitMonster(monster, state, {
            monsterMoving,
            random,
            publish: announce,
        });
        let fountainDried = false;
        if (clone && inFountain) {
            fountainDried = await dryFountainAt(x, y, {
                causedByHero: false, random, state, publish: announce,
            });
        }
        if (inPool) {
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
        }
        return { kind: 'split', survived: true, clone, fountainDried };
    }

    if (inPool || waterWall) {
        const reaction = rollMonsterPoolReaction(monster, state, {
            random, rollDice,
        });
        if (reaction.kind === 'rust') {
            if (state === game && cansee(x, y))
                await announce(`${monsterName(monster, { state, capitalized: true })} rusts.`);
            monster.mhp = (monster.mhp ?? 1) - reaction.damage;
            if (monster.mhpmax > reaction.damage)
                monster.mhpmax -= reaction.damage;
            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid('rust', true);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0) return death;
            }
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
        } else if (reaction.kind === 'drown') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation) return { survived: true, relocation };
            }
            if (state === game && cansee(x, y))
                await announce(monsterMoving
                    ? `${monsterName(monster, { state, capitalized: true })} drowns.`
                    : `You drown ${monsterName(monster, { state })}.`);
            if (state.u.uswallow && state.u.ustuck === monster) {
                const name = monsterName(monster, { state, capitalized: true });
                await announce(`${name} sinks as ${displayLiquidName('water', state)} rushes in and flushes you out.`);
            }
            monster.mhp = 0;
            const death = await finishFatalLiquid('drowning', true);
            if (state.program_state.gameover || monster.dead || monster.mhp <= 0) return death;
            if (monsterInAir(monster, state)) return { survived: true };
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_NOMSG,
            });
            if (!relocation) await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover) return { heroDied: true };
            if (relocation && state === game) {
                newsym(x, y);
                newsym(monster.mx, monster.my);
            }
            return { survived: true, relocation };
        }
    } else {
        const lava = monsterLavaReaction(monster, state);
        if (lava && lava.kind !== 'safe') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation) return { survived: true, relocation };
            }

            if (lava.kind === 'scorch') {
                monster.mhp = (monster.mhp ?? 1) - 1;
                if (state === game && cansee(x, y)) {
                    const verb = monster.mhp <= 0
                        ? 'surrenders to the fire' : 'burns slightly';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            } else {
                monster.mhp = 0;
                if (state === game && cansee(x, y)) {
                    const heat = monsterFireDescription(monster, AT_NONE);
                    const verb = heat === 'boiling' ? 'boils away'
                        : heat === 'melting' ? 'melts away' : 'burns to a crisp';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            }

            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid(lava.kind === 'scorch'
                    ? 'lava-scorch' : 'lava-burning', false);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0) return death;
            }
            if (monsterInAir(monster, state) || monsterLikesLava(monster))
                return { survived: true };
            await fireDamageChain(
                monster.minvent || monster.inventory || [],
                {
                    carrier: monster,
                    publish: announce,
                    random,
                    state,
                },
            );
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_MSG,
            });
            if (!relocation) await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover) return { heroDied: true };
            if (relocation && state === game) {
                newsym(x, y);
                newsym(monster.mx, monster.my);
            }
            return { survived: true, relocation };
        }
    }

    if (!inPool && !inLava && MONSTER_SYMBOL[monster.mnum] === S_EEL && !waterLevel
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS)) {
        if (monster.mhp > 1 && random(monster.mhp) > random(8)) monster.mhp--;
        const flight = await makeMonsterFlee(monster, {
            state, turns: 2, announce: false, publish: announce, random, rollOne,
        });
        if (flight.heroDied) return { heroDied: true };
    }
    return null;
}
