// Monster terrain rules.
// C ref: mon.c m_in_air() and minliquid().

import { game } from './gstate.js';
import {
    G_GENOD, In_endgame, Is_earthlevel, Is_waterlevel, IS_LAVA, IS_POOL,
    STRAT_WAITMASK,
} from './const.js';
import {
    canSeeMonster, newsym, plineWithContinuation,
} from './display.js';
import {
    lifeSaveMonster, wornMonsterLifeSaver,
} from './mondeath.js';
import { splitMonster } from './monster_clone.js';
import {
    MONSTER_FLAGS1, MONSTER_GENO, MONSTER_NAME, MONSTER_RESISTS,
    MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { d, rn2 } from './rng.js';
import { randomMonsterRelocation } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
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
const G_UNIQ = 0x1000;

export function levelHasCeiling(state = game) {
    const flags = state.level?.flags || {};
    if (typeof flags.has_ceiling === 'boolean') return flags.has_ceiling;
    if (state !== game)
        return !(flags.is_endgame && !flags.is_earthlevel);
    return !(In_endgame(state.u?.uz) && !Is_earthlevel(state.u?.uz));
}

export function monsterInAir(monster, state = game) {
    if (!monster) return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if ((flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT)
        return true;
    return !!(flags & M1_CLING)
        && levelHasCeiling(state)
        && !!monster.mundetected;
}

export function monsterSurvivesPool(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    return !!(flags & (
        M1_SWIM | M1_CLING | M1_AMPHIBIOUS | M1_BREATHLESS
    ));
}

export function rollMonsterPoolReaction(
    monster,
    state = game,
    { random = rn2, rollDice = d } = {},
) {
    if (monsterInAir(monster, state) || monsterSurvivesPool(monster))
        return { kind: 'safe' };

    if (monster.mnum === PM_GREMLIN && random(3) !== 0)
        return { kind: 'split' };

    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }

    return { kind: 'drown' };
}

export function monsterLavaReaction(monster, state = game) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    if (!location || !IS_LAVA(location.typ)) return null;

    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const likesLava = monster.mnum === PM_FIRE_ELEMENTAL
        || monster.mnum === PM_SALAMANDER;
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
    const waterLevel = state === game
        ? Is_waterlevel(state.u?.uz)
        : !!state.level?.flags?.is_waterlevel;
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

export function wakeMonstersNear(x, y, distance, state = game) {
    for (const monster of state.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        if (distance && dx * dx + dy * dy >= distance) continue;
        monster.msleeping = 0;
        if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
}

// wake_nearto_core() reports each visible sleeper before waking it.
export async function wakeMonstersNearWithMessages(
    x, y, distance, state = game,
) {
    for (const monster of state.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        if (distance && dx * dx + dy * dy >= distance) continue;
        if (monster.msleeping
            && canSeeMonster(monster, monster.mx, monster.my)) {
            const name = monster.name
                || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
            await plineWithContinuation(`${name} wakes up.`);
        }
        monster.msleeping = 0;
        if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
}

function monsterLiquidName(monster) {
    return monster?.name || MONSTER_NAME[monster?.mnum] || 'monster';
}

async function tryMonsterLifeSaving(
    monster, state, saveMonster = lifeSaveMonster,
) {
    const amulet = wornMonsterLifeSaver(monster);
    if (!amulet || state !== game) return null;
    monster.mhp = 0;
    return saveMonster(monster, amulet, {
        visible: cansee(monster.mx, monster.my),
        spotted: canSeeMonster(monster, monster.mx, monster.my),
        genocided: !!((state.mvitals?.[monster.mnum]?.mvflags ?? 0)
            & G_GENOD),
        petSpotted: canSeeMonster(monster, monster.mx, monster.my),
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

    if (IS_POOL(location.typ)) {
        const reaction = rollMonsterPoolReaction(monster, state, {
            random, rollDice,
        });
        if (reaction.kind === 'split') {
            reaction.clone = splitMonster(
                monster, state, { monsterMoving: true, random },
            );
        } else if (reaction.kind === 'rust') {
            monster.mhp = (monster.mhp ?? 1) - reaction.damage;
            if (monster.mhpmax > reaction.damage)
                monster.mhpmax -= reaction.damage;
            if (state === game && cansee(x, y))
                await announce(`The ${monsterLiquidName(monster)} rusts.`);
            if (monster.mhp <= 0) {
                const saved = await tryMonsterLifeSaving(
                    monster, state, saveMonster,
                );
                if (!saved?.survived) {
                    await waterDamageChain(
                        monster.minvent || monster.inventory || [], [], state,
                    );
                    return finishDeath(monster, state, random, calls, true);
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
            const saved = await tryMonsterLifeSaving(
                monster, state, saveMonster,
            );
            if (!saved?.survived) {
                await waterDamageChain(
                    monster.minvent || monster.inventory || [], [], state,
                );
                return finishDeath(monster, state, random, calls, true);
            }
            await waterDamageChain(
                monster.minvent || monster.inventory || [], [], state,
            );
            const relocation = randomMonsterRelocation(
                monster, state, calls, random,
            );
            if (relocation && state === game) {
                newsym(x, y);
                newsym(monster.mx, monster.my);
            }
            return { survived: true, lifeSaving: saved, relocation };
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
                const saved = await tryMonsterLifeSaving(
                    monster, state, saveMonster,
                );
                if (!saved?.survived)
                    return finishDeath(monster, state, random, calls, false);
            }
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
