// Earthquakes and the chasms they open.
// C ref: music.c do_earthquake() and do_pit().

import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import { adjustHeroAlignment } from './alignment.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    A_DEX, ALTAR, AM_MASK, AM_SANCTUM, Amask2align, COLNO, CORR,
    DOOR, D_NODOOR,
    FOUNTAIN, GRAVE, LAVAPOOL, MOAT, PIT, POOL, ROOM, ROWNO,
    SCORR, SDOOR, SINK, THRONE, TT_BURIEDBALL, TT_PIT, is_pit,
    M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, STRAT_WAITMASK,
} from './const.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { loseHeroHp } from './hero_damage.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import type { MapLocation, Trap } from './map_types.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MonsterLiquidDeathContext } from './mon.js';
import type { HeroLiquidMonsterDeathOutcome, HeroMonsterKillOptions } from './hero_monster_death.js';
import type { MonsterLiquidDeathResult } from './monster_death.js';
import { heroLiquidEffects } from './hack.js';
import {
    finishHeroLiquidMonsterDeath, finishHeroMonsterKill,
} from './hero_monster_death.js';
import { liquidForHole } from './hole.js';
import { remove_object } from './floor_object.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { maketrap } from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, monsterIsHumanoid,
} from './monster_data.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { monsterSelfTouch } from './monster_stoning.js';
import { BOULDER } from './object_data.js';
import { stopAllObjectTimers } from './object_timers.js';
import { heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { rnl, rnd, rn2 } from './rng.js';
import {
    destroyLavaFloorObjects, waterDamageChain,
} from './trap.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { monsterInAir } from './terrain_properties.js';

const M1_CLING = 0x00000010;
const M1_SLITHY = 0x00080000;

function monsterAt(x: number, y: number) {
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function trapAt(x: number, y: number) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y)
        || null;
}

function terrainAfterPit(originalType: number): number {
    return originalType === CORR || originalType === SCORR ? CORR : ROOM;
}

function boulderAt(x: number, y: number) {
    return game.level?.objects?.[x]?.[y]?.find(
        object => object.otyp === BOULDER,
    ) || null;
}

async function fillChasmWithBoulder(x: number, y: number, trap: Trap, boulder: GameObject, monster: Monster | null): Promise<void> {
    if (cansee(x, y)) {
        await plineWithContinuation(
            `KADOOM!  The boulder falls into a chasm${
                game.u?.ux === x && game.u?.uy === y ? ' below you' : ''
            }!`,
        );
    }
    if (monster) monster.mtrapped = 0;
    remove_object(boulder);
    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.ox = 0;
    boulder.oy = 0;
    deleteTrap(trap);
    await buryFloorObjectsAt(x, y, game);
    newsym(x, y);
}

async function damageFloorObjectsWithWater(x: number, y: number) {
    const pile = game.level?.objects?.[x]?.[y] || [];
    const messages: string[] = [];
    await waterDamageChain(pile, messages, game);
    if (cansee(x, y)) {
        for (const message of messages)
            await plineWithContinuation(message);
    }
}

async function flowLiquidIntoChasm(x: number, y: number, trap: Trap, liquid: number, monster: Monster | null): Promise<void> {
    deleteTrap(trap);
    if (monster) monster.mtrapped = 0;
    if (game.u?.ux === x && game.u?.uy === y) {
        game.u.utrap = 0;
        game.u.utraptype = 0;
    }
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    location.typ = liquid;
    location.flags = 0;
    if (liquid === LAVAPOOL) {
        await destroyLavaFloorObjects(
            game.level?.objects?.[x]?.[y] || [],
            {
                publish: plineWithContinuation,
                visible: cansee(x, y),
            },
        );
    } else {
        await damageFloorObjectsWithWater(x, y);
    }

    if (game.u?.ux === x && game.u?.uy === y) {
        const liquidEffect = await heroLiquidEffects();
        if (liquidEffect?.died) return;
    } else if (monster) {
        await resolveMonsterLiquid<HeroLiquidMonsterDeathOutcome | MonsterLiquidDeathResult>(monster, game, {
            announce: plineWithContinuation,
            finishDeath: finishEarthquakeLiquidDeath,
            monsterMoving: false,
        });
    }
    newsym(x, y);
}

function finishEarthquakeLiquidDeath(
    monster: Monster, { state, random, leaveCorpse, cause }: MonsterLiquidDeathContext,
) {
    if (cause === 'drowning' || cause === 'lava-burning') {
        return finishHeroLiquidMonsterDeath(monster, { leaveCorpse });
    }
    return finishMonsterLiquidDeath(monster, {
        state, random, leaveCorpse,
    });
}

function heroClingsToCeiling() {
    if (!heroIsPolymorphed(game)) return false;
    return !!((MONSTER_FLAGS1[game.u.umonnum ?? -1] || 0) & M1_CLING);
}

function heroIsAirborne() {
    const hero = game.u;
    return !!(hero.levitating || hero.levitation || game.levitating
        || hero.flying || game.flying
        || heroClingsToCeiling());
}

function trapHeroInChasm() {
    game.u.utrap = rn2(6) + 2;
    game.u.utraptype = TT_PIT;
}

function physicalDamage(amount: number): number {
    const halfDamage = game.u.halfPhysicalDamage;
    return halfDamage ? Math.trunc((amount + 1) / 2) : amount;
}

async function dropHeroIntoChasm(hadPitBeforeEarthquake: boolean): Promise<void> {
    if (game.u?.utrap && game.u.utraptype === TT_BURIEDBALL) {
        await plineWithContinuation('Your chain breaks!');
        game.u.utrap = 0;
        game.u.utraptype = 0;
    }
    if (heroIsAirborne()) {
        if (!hadPitBeforeEarthquake) {
            await plineWithContinuation('A chasm opens up under you!');
            await plineWithContinuation("You don't fall in!");
        }
        return;
    }

    if (!hadPitBeforeEarthquake
        || !game.u?.utrap || game.u.utraptype !== TT_PIT) {
        await plineWithContinuation('You fall into a chasm!');
        trapHeroInChasm();
        if (await loseHeroHp(physicalDamage(rnd(6)), 'fell into a chasm', {
            deathCause: 'fell into a chasm',
        })) return;
        await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
        return;
    }

    const fumbling = !!(game.u?.fumbling
        || (game.u?.fumblingTurns ?? 0) > 0);
    const roleRange = game.urole?.key === 'archeologist' ? 3 : 9;
    const keepsFooting = !(fumbling && rn2(5))
        && (rnl(roleRange) === 0
            || (currentAttribute(A_DEX) > 7 && rn2(5) !== 0));
    await plineWithContinuation('You are jostled around violently!');
    trapHeroInChasm();
    if (await loseHeroHp(physicalDamage(rnd(keepsFooting ? 2 : 4)), 'hurt in a chasm', {
        deathCause: 'hurt in a chasm',
    })) return;
    if (keepsFooting) await exerciseAttribute(A_DEX, true);
    else {
        const slithering = heroIsPolymorphed(game)
            && !!((MONSTER_FLAGS1[game.u.umonnum ?? -1] ?? 0) & M1_SLITHY);
        await selfTouchPetrifyingWeapons({
            messageStart: slithering || heroHasNoLimbs(game)
                ? 'Shaken, you' : 'Falling down, you',
        });
    }
}

function finishEarthquakeStoning(monster: Monster, options: HeroMonsterKillOptions = {}) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        ...options,
        showKillMessage: false,
        recordConduct: false,
    });
}

function earthquakeMonsterName(monster: Monster): string {
    const pity = monster.mtame ? 'poor ' : '';
    if (monster.name) return `${pity}${monster.name}`;
    return `the ${pity}${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

async function dropMonsterIntoChasm(monster: Monster | null, x: number, y: number): Promise<void> {
    const flags = MONSTER_FLAGS1[monster?.mnum ?? -1] || 0;
    if (!monster || monsterInAir(monster, game) || (flags & M1_CLING)) return;
    const wasTrapped = !!monster.mtrapped;
    monster.mtrapped = 1;
    if (!wasTrapped) {
        if (cansee(x, y)) {
            const name = MONSTER_NAME[monster.mnum] || 'monster';
            await plineWithContinuation(`The ${name} falls into a chasm!`);
        } else if (monsterIsHumanoid(monster.mnum)
            && !game.deaf && !game.u?.deaf) {
            await plineWithContinuation('You hear a scream!');
        }
    }

    const selfTouch = await monsterSelfTouch(monster, {
        prefix: 'Falling, ',
        creditHero: true,
        finishDeath: finishEarthquakeStoning,
    });
    if (!selfTouch.survived) return;

    monster.mhp = (monster.mhp ?? 1) - rnd(wasTrapped ? 4 : 6);
    if (monster.mhp > 0) return;
    await plineWithContinuation(cansee(x, y)
        ? `You destroy ${earthquakeMonsterName(monster)}!`
        : 'It is destroyed!');
    await finishHeroMonsterKill(monster, x, y, {
        showKillMessage: false,
    });
}

async function openChasm(
    x: number,
    y: number,
    hadPitBeforeEarthquake: boolean,
): Promise<boolean> {
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    const originalType = location.typ;
    const chasm = await maketrap(x, y, PIT);
    if (!chasm) return false;
    chasm.tseen = 1;
    location.typ = terrainAfterPit(originalType);
    location.flags = 0;

    const monster = monsterAt(x, y);
    const boulder = boulderAt(x, y);
    if (boulder) {
        await fillChasmWithBoulder(x, y, chasm, boulder, monster);
        return true;
    }

    const liquid = liquidForHole(x, y);
    if (liquid !== ROOM) {
        await flowLiquidIntoChasm(x, y, chasm, liquid, monster);
        return true;
    }

    await dropMonsterIntoChasm(monster, x, y);
    if (game.u?.ux === x && game.u?.uy === y)
        await dropHeroIntoChasm(hadPitBeforeEarthquake);
    else
        newsym(x, y);
    return true;
}

async function wakeMonsterForEarthquake(monster: Monster | null): Promise<void> {
    if (!monster || (monster.mhp ?? 1) <= 0) return;
    const flags = MONSTER_FLAGS1[monster.mnum] || 0;
    monster.msleeping = 0;
    monster.mfrozen = 0;
    monster.mcanmove = 1;
    monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
    if (!monster.mtame) monster.mpeaceful = 0;
    if (monster.mundetected) {
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
        if ((flags & M1_CLING) && cansee(monster.mx, monster.my)) {
            const name = MONSTER_NAME[monster.mnum] || 'monster';
            await plineWithContinuation(
                `The ${name} is shaken loose from the ceiling!`,
            );
        }
    }
    const appearance = M_AP_TYPE(monster);
    if (appearance !== M_AP_NOTHING && appearance !== M_AP_MONSTER) {
        monster.m_ap_type = M_AP_NOTHING;
        monster.mappearance = 0;
        newsym(monster.mx, monster.my);
    }
}

function altarName(location: MapLocation): string {
    const alignment = Amask2align((location.flags || 0) & AM_MASK);
    return alignment > 0 ? 'lawful'
        : alignment < 0 ? 'chaotic' : alignment === 0 ? 'neutral' : 'unaligned';
}

function punishAltarDestruction(location: MapLocation): void {
    const altarAlignment = Amask2align((location.flags || 0) & AM_MASK);
    if (altarAlignment !== game.u?.ualign?.type) return;
    adjustHeroAlignment(-20, game);
    game.u.ugangr = (game.u.ugangr || 0) + 5;
}

async function shakeTerrain(x: number, y: number, hadPitBeforeEarthquake: boolean): Promise<boolean> {
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    if (location.typ === FOUNTAIN) {
        if (cansee(x, y))
            await plineWithContinuation('The fountain falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SINK) {
        if (cansee(x, y))
            await plineWithContinuation('The kitchen sink falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === ALTAR) {
        if ((location.flags || 0) & AM_SANCTUM) return false;
        if (cansee(x, y)) {
            await plineWithContinuation(
                `The ${altarName(location)} altar falls into a chasm.`,
            );
        }
        punishAltarDestruction(location);
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === GRAVE || location.typ === THRONE) {
        const feature = location.typ === GRAVE ? 'headstone' : 'throne';
        if (cansee(x, y))
            await plineWithContinuation(`The ${feature} falls into a chasm.`);
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        if (cansee(x, y))
            await plineWithContinuation('A secret corridor is revealed.');
    }
    if (location.typ === CORR || location.typ === ROOM) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SDOOR) {
        location.typ = DOOR;
        if (cansee(x, y))
            await plineWithContinuation('A secret door is revealed.');
    }
    if (location.typ !== DOOR) return false;
    if ((location.doormask || 0) === D_NODOOR) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    location.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    newsym(x, y);
    if (cansee(x, y))
        await plineWithContinuation('The door collapses.');
    return true;
}

export async function createEarthquake(requestedForce: number) {
    requirePlayingGame(game);
    const force = Math.max(1, Math.min(13, requestedForce));
    const hadPitBeforeEarthquake = is_pit(
        trapAt(game.u.ux, game.u.uy)?.ttyp ?? 0,
    );
    let changed = 0;
    const startX = Math.max(1, (game.u?.ux || 1) - force * 2);
    const endX = Math.min(COLNO - 1, (game.u?.ux || 1) + force * 2);
    const startY = Math.max(0, (game.u?.uy || 0) - force * 2);
    const endY = Math.min(ROWNO - 1, (game.u?.uy || 0) + force * 2);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            await wakeMonsterForEarthquake(monsterAt(x, y));
            if (rn2(14 - force) !== 0) continue;
            if (await shakeTerrain(x, y, hadPitBeforeEarthquake)) changed++;
            if (game.program_state?.gameover) return { changed, force, heroDied: true };
        }
    }
    return { changed, force, heroDied: false };
}
