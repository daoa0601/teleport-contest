// Monster terrain rules.
// C ref: mon.c m_in_air() and minliquid().

import { game } from './gstate.js';
import {
    FOUNTAIN, G_GENOD, In_endgame, Is_earthlevel, Is_waterlevel, IS_LAVA,
    IS_POOL, WATER,
} from './const.js';
import { dryFountainAt } from './fountain_terrain.js';
import {
    canSeeMonster, newsym,
} from './display.js';
import {
    lifeSaveMonster, preventMonsterDeath, wornMonsterLifeSaver,
} from './mondeath.js';
import { splitMonster } from './monster_clone.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_RESISTS,
    MONSTER_SYMBOL, monsterYoungerForm,
} from './monster_data.js';
import { place_object, stack_object } from './floor_object.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { EGG } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectsInTimerGraph, stopObjectTimer,
} from './object_timers.js';
import { d, rn2, rnd } from './rng.js';
import { randomMonsterRelocation } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { fireDamageChain } from './fire_damage.js';
import { waterDamageChain } from './trap.js';
import { cansee } from './vision.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_CLING = 0x00000010;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const M1_TPORT = 0x02000000;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const MR_FIRE = 0x01;
const S_EEL = 57;

function speciesWasGenocided(mnum, state) {
    return !!((state.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}

function eggSpeciesWasGenocided(egg, state) {
    const mnum = egg?.corpsenm;
    if (!Number.isInteger(mnum) || mnum < 0) return true;
    return speciesWasGenocided(mnum, state)
        || speciesWasGenocided(monsterYoungerForm(mnum), state);
}

function dropGenocidedMonsterInventory(monster, state) {
    const dropped = [];
    for (const object of monster.minvent || monster.inventory || []) {
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        object.alternate = false;
        object.ready = false;
        object.ocarry = null;
        delete object.carrierMid;
        place_object(object, monster.mx, monster.my);
        dropped.push(stack_object(object, state));
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    return dropped;
}

export async function killGenocidedMonster(monster, state) {
    const lifeSaver = wornMonsterLifeSaver(monster);
    if (lifeSaver) {
        await lifeSaveMonster(monster, lifeSaver, {
            visible: cansee(monster.mx, monster.my),
            spotted: canSeeMonster(monster, monster.mx, monster.my),
            genocided: true,
        });
    }

    const x = monster.mx, y = monster.my;
    const dropped = dropGenocidedMonsterInventory(monster, state);
    monster.mhp = 0;
    monster.dead = true;
    monster.mundetected = 0;
    if (state.u?.usteed === monster) state.u.usteed = null;
    if (state.u?.ustuck === monster) {
        state.u.ustuck = null;
        state.u.uswallow = false;
        state.u.uswldtim = 0;
    }
    state.level.monsters = (state.level.monsters || []).filter(
        candidate => candidate !== monster,
    );
    newsym(x, y);
    return { monster, dropped };
}

// C mon.c:kill_genocided_monsters().  Genocide is not a hero kill: it drops
// carried objects, creates no corpse or experience, and sterilizes eggs.
export async function killGenocidedMonsters(state = game) {
    if (state !== game)
        throw new Error('genocide removal requires the live game state');
    const killed = [];
    const reshaped = [];
    for (const monster of [...(state.level?.monsters || [])]) {
        if (monster.dead || (monster.mhp ?? 1) <= 0) continue;
        const baseWasGenocided = Number.isInteger(monster.cham)
            && monster.cham >= 0
            && speciesWasGenocided(monster.cham, state);
        if (!speciesWasGenocided(monster.mnum, state)
            && !baseWasGenocided) continue;
        if (Number.isInteger(monster.cham) && monster.cham >= 0
            && !baseWasGenocided) {
            if (changeMonsterForm(monster)) reshaped.push(monster);
            continue;
        }
        killed.push(await killGenocidedMonster(monster, state));
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

export function levelHasCeiling(state = game) {
    const flags = state.level?.flags || {};
    if (typeof flags.has_ceiling === 'boolean') return flags.has_ceiling;
    if (state !== game)
        return !(flags.is_endgame && !flags.is_earthlevel);
    return !(In_endgame(state.u?.uz) && !Is_earthlevel(state.u?.uz));
}

function monsterFliesOrFloats(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    return !!(flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT;
}

export function monsterInAir(monster, state = game) {
    if (!monster) return false;
    if (monsterFliesOrFloats(monster)) return true;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(flags & M1_CLING)
        && levelHasCeiling(state)
        && !!monster.mundetected;
}

export function monsterSurvivesPool(monster, { waterWall = false } = {}) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const safeFlags = M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS
        | (waterWall ? 0 : M1_CLING);
    return !!(flags & safeFlags);
}

function levelIsWaterLevel(state) {
    return !!state.level?.flags?.is_waterlevel
        || (state === game && Is_waterlevel(state.u?.uz));
}

function heroKeepsSteedAboveWater(monster, state, waterWall) {
    if (waterWall || state.u?.usteed !== monster) return false;
    return !!(state.u?.flying || state.u?.flight || state.flying
        || state.u?.levitating || state.u?.levitation || state.levitating);
}

export function rollMonsterPoolReaction(
    monster,
    state = game,
    { random = rn2, rollDice = d } = {},
) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    const waterWall = location?.typ === WATER;
    const waterLevel = levelIsWaterLevel(state);
    const safelyAirborne = !waterWall && !waterLevel
        && monsterFliesOrFloats(monster);
    if (heroKeepsSteedAboveWater(monster, state, waterWall)
        || safelyAirborne
        || monsterSurvivesPool(monster, { waterWall })) {
        return { kind: 'safe' };
    }

    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }

    return { kind: 'drown' };
}

function monsterLikesLava(monster) {
    return monster?.mnum === PM_FIRE_ELEMENTAL
        || monster?.mnum === PM_SALAMANDER;
}

export function monsterLavaReaction(monster, state = game) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    if (!location || !IS_LAVA(location.typ)) return null;

    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const likesLava = monsterLikesLava(monster);
    if (monsterInAir(monster, state) || (flags & M1_CLING) || likesLava)
        return { kind: 'safe' };
    const fireResistant = !!(
        (MONSTER_RESISTS[monster.mnum] ?? 0) & MR_FIRE
    );
    return { kind: fireResistant ? 'scorch' : 'burn' };
}

export function applyDryLandEel(monster, state = game, random = rn2) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const waterLevel = levelIsWaterLevel(state);
    if (!location || IS_POOL(location.typ) || waterLevel
        || MONSTER_SYMBOL[monster.mnum] !== S_EEL
        || (flags & M1_BREATHLESS)) return false;

    if ((monster.mhp ?? 0) > 1
        && random(monster.mhp) > random(8)) monster.mhp--;
    if (!monster.mflee || (monster.mfleetim ?? 0) > 0) {
        const fleeTime = 2 + (monster.mfleetim ?? 0);
        monster.mfleetim = Math.min(fleeTime === 1 ? 2 : fleeTime, 127);
    }
    monster.mflee = 1;
    monster.mtrack = [];
    return true;
}

function monsterLiquidName(monster) {
    return monster?.name || MONSTER_NAME[monster?.mnum] || 'monster';
}

async function recoverMonsterFromLiquid(
    monster, state, {
        announce, saveMonster, random, rollOne,
    },
) {
    monster.mhp = 0;
    return preventMonsterDeath(monster, {
        state,
        visible: cansee(monster.mx, monster.my),
        spotted: canSeeMonster(monster, monster.mx, monster.my),
        petSpotted: canSeeMonster(monster, monster.mx, monster.my),
        publish: announce,
        saveMonster,
        random,
        rollOne,
    });
}

export async function resolveMonsterLiquid(
    monster,
    state = game,
    {
        announce = async () => {},
        finishDeath,
        monsterMoving = true,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
        saveMonster = lifeSaveMonster,
    } = {},
) {
    const calls = [];
    const x = monster?.mx;
    const y = monster?.my;
    const location = state.level?.at?.(x, y);
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0 || !location)
        return null;
    if (typeof finishDeath !== 'function') {
        throw new TypeError('minliquid requires the monster death handler');
    }

    const waterLevel = levelIsWaterLevel(state);
    const waterWall = location.typ === WATER;
    const inPool = IS_POOL(location.typ)
        && (!monsterFliesOrFloats(monster) || waterLevel);
    const inFountain = location.typ === FOUNTAIN;
    if (monster.mnum === PM_GREMLIN && (inPool || inFountain)
        && random(3) !== 0) {
        const clone = splitMonster(monster, state, {
            monsterMoving,
            random,
        });
        let fountainDried = false;
        if (clone && inFountain) {
            const dryup = dryFountainAt(x, y, {
                causedByHero: false,
                random,
                state,
            });
            fountainDried = dryup.dried;
            if (fountainDried && state === game && cansee(x, y))
                await announce('The fountain dries up!');
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
            monster.mhp = (monster.mhp ?? 1) - reaction.damage;
            if (monster.mhpmax > reaction.damage)
                monster.mhpmax -= reaction.damage;
            if (state === game && cansee(x, y))
                await announce(`The ${monsterLiquidName(monster)} rusts.`);
            if (monster.mhp <= 0) {
                const recovery = await recoverMonsterFromLiquid(
                    monster, state, {
                        announce, saveMonster, random, rollOne,
                    },
                );
                if (!recovery.survived) {
                    await waterDamageChain(
                        monster.minvent || monster.inventory || [], [], state,
                    );
                    return finishDeath(monster, {
                        state, random, leaveCorpse: true, cause: 'rust',
                    });
                }
            }
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
        } else if (reaction.kind === 'drown') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                && !monsterTeleportRestricted(monster, state)) {
                const relocation = randomMonsterRelocation(
                    monster, state, calls, random,
                );
                if (relocation) return { survived: true, relocation };
            }
            if (state === game && cansee(x, y))
                await announce(monsterMoving
                    ? `The ${monsterLiquidName(monster)} drowns.`
                    : `You drown the ${monsterLiquidName(monster)}.`);
            monster.mhp = 0;
            const recovery = await recoverMonsterFromLiquid(
                monster, state, {
                    announce, saveMonster, random, rollOne,
                },
            );
            if (!recovery.survived) {
                await waterDamageChain(
                    monster.minvent || monster.inventory || [], [], state,
                );
                return finishDeath(monster, {
                    state, random, leaveCorpse: true, cause: 'drowning',
                });
            }
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
            const relocation = monsterInAir(monster, state) ? null
                : randomMonsterRelocation(monster, state, calls, random);
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
                && !monsterTeleportRestricted(monster, state)) {
                const relocation = randomMonsterRelocation(
                    monster, state, calls, random,
                );
                if (relocation) return { survived: true, relocation };
            }

            if (lava.kind === 'scorch') {
                monster.mhp = (monster.mhp ?? 1) - 1;
                if (state === game && cansee(x, y)) {
                    const verb = monster.mhp <= 0
                        ? 'surrenders to the fire' : 'burns slightly';
                    await announce(`The ${monsterLiquidName(monster)} ${verb}.`);
                }
            } else {
                monster.mhp = 0;
                if (state === game && cansee(x, y)) {
                    const name = monsterLiquidName(monster);
                    const verb = ['water elemental', 'fog cloud', 'steam vortex']
                        .includes(name) ? 'boils away'
                        : ['ice vortex', 'glass golem'].includes(name)
                            ? 'melts away' : 'burns to a crisp';
                    await announce(`The ${name} ${verb}.`);
                }
            }

            if (monster.mhp <= 0) {
                const recovery = await recoverMonsterFromLiquid(
                    monster, state, {
                        announce, saveMonster, random, rollOne,
                    },
                );
                if (!recovery.survived) {
                    return finishDeath(monster, {
                        state,
                        random,
                        leaveCorpse: false,
                        cause: lava.kind === 'scorch'
                            ? 'lava-scorch' : 'lava-burning',
                    });
                }
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
            const relocation = randomMonsterRelocation(
                monster, state, calls, random,
            );
            if (relocation && state === game) {
                newsym(x, y);
                newsym(monster.mx, monster.my);
            }
            return { survived: true, relocation };
        }
    }

    applyDryLandEel(monster, state, random);
    return null;
}
