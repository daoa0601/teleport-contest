// Earthquakes and the chasms they open.
// C ref: music.c do_earthquake() and do_pit().

import { publishHeardMessage } from './hero_speech.js';
import { monsterAtPosition } from './monster_location.js';
import { desecrateAltar } from './divine_wrath.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    A_DEX, ALTAR, AM_MASK, AM_SANCTUM, Amask2align, COLNO, CORR, MGIVENNAME,
    DOOR, D_NODOOR,
    FOUNTAIN, GRAVE, LAVAPOOL, PIT, ROOM, ROWNO,
    NO_KILLER_PREFIX, SCORR, SDOOR, SHOPBASE, SINK, THRONE, TT_BURIEDBALL, TT_PIT, is_pit,
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
import { remove_object, updateIceObjectTimersAt } from './floor_object.js';
import { unearthFloorObjectsAt } from './buried_object.js';
import { applyFloorEffects } from './floor_effects.js';
import { deleteFloorTrap, maketrap } from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import {
    MONSTER_FLAGS1, monsterIsHumanoid, monsterSpeciesHidesOnCeiling,
} from './monster_data.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { monsterSelfTouch } from './monster_stoning.js';
import { BOULDER } from './object_data.js';
import { heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { rnl, rnd, rn2 } from './rng.js';
import { waterDamageChain } from './trap.js';
import { fireDamageChain } from './fire_damage.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { refreshMovementProperties } from './properties.js';
import { resetHeroTrap } from './terrain_movement.js';
import { setHeroTrap } from './hero_traps.js';
import { wakeMonster } from './monster_anger.js';
import { monsterName } from './monster_name.js';
import { convertSecretDoor } from './detect.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';

const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const M1_SLITHY = 0x00080000;

function monsterAt(x: number, y: number) {
    return game.level ? monsterAtPosition(game.level, x, y) : null;
}

function trapAt(x: number, y: number) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y)
        || null;
}

function boulderAt(x: number, y: number) {
    return game.level?.objects?.[x]?.[y]?.find(
        object => object.otyp === BOULDER,
    ) || null;
}

async function fillChasmWithBoulder(x: number, y: number, boulder: GameObject, monster: Monster | null): Promise<void> {
    if (cansee(x, y)) {
        await plineWithContinuation(
            `KADOOM!  The boulder falls into a chasm${
                game.u?.ux === x && game.u?.uy === y ? ' below you' : ''
            }!`,
        );
    }
    if (monster) monster.mtrapped = 0;
    remove_object(boulder);
    await applyFloorEffects(boulder, x, y);
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
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    location.typ = liquid;
    location.flags = 0;
    if (liquid === LAVAPOOL) location.lit = true;
    await deleteFloorTrap(trap);
    updateIceObjectTimersAt(x, y, game);
    await unearthFloorObjectsAt(x, y, game);
    if (liquid === LAVAPOOL) {
        await fireDamageChain(
            game.level?.objects?.[x]?.[y] || [],
            {
                state: game, x, y, force: true,
                publish: plineWithContinuation,
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
    monster: Monster, options: MonsterLiquidDeathContext,
) {
    if (options.cause === 'drowning' || options.cause === 'lava-burning') {
        return finishHeroLiquidMonsterDeath(monster, options);
    }
    return finishMonsterLiquidDeath(monster, options);
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
    setHeroTrap(rn2(6) + 2, TT_PIT);
}

function physicalDamage(amount: number): number {
    const halfDamage = game.u.halfPhysicalDamage;
    return halfDamage ? Math.trunc((amount + 1) / 2) : amount;
}

async function dropHeroIntoChasm(hadPitBeforeEarthquake: boolean): Promise<void> {
    if (game.u?.utrap && game.u.utraptype === TT_BURIEDBALL) {
        await plineWithContinuation('Your chain breaks!');
        await resetHeroTrap(true);
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
            killerFormat: NO_KILLER_PREFIX,
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
        killerFormat: NO_KILLER_PREFIX,
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
    return monster.mtame
        ? monsterName(monster, { adjective: 'poor', suppressSaddle: !!MGIVENNAME(monster) })
        : monsterName(monster);
}

async function dropMonsterIntoChasm(monster: Monster, x: number, y: number): Promise<void> {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (flags & (M1_FLY | M1_CLING)) return;
    const wasTrapped = !!monster.mtrapped;
    monster.mtrapped = 1;
    if (!wasTrapped) {
        if (cansee(x, y)) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} falls into a chasm!`);
        } else if (monsterIsHumanoid(monster.mnum)) {
            await publishHeardMessage('a scream!', plineWithContinuation);
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
    const chasm = await maketrap(x, y, PIT);
    if (!chasm) return false;
    chasm.tseen = 1;

    const monster = monsterAt(x, y);
    const boulder = boulderAt(x, y);
    if (boulder) {
        await fillChasmWithBoulder(x, y, boulder, monster);
        return true;
    }

    const liquid = liquidForHole(x, y);
    if (liquid !== ROOM) {
        await flowLiquidIntoChasm(x, y, chasm, liquid, monster);
        return true;
    }

    if (monster)
        await dropMonsterIntoChasm(monster, x, y);
    else if (game.u?.ux === x && game.u?.uy === y)
        await dropHeroIntoChasm(hadPitBeforeEarthquake);
    else
        newsym(x, y);
    return true;
}

async function wakeMonsterForEarthquake(monster: Monster | null): Promise<boolean> {
    if (!monster) return false;
    if ((await wakeMonster(monster, { attacked: true })).heroDied) return true;
    if (monster.mundetected) {
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
        if (monsterSpeciesHidesOnCeiling(monster.mnum)) {
            if (cansee(monster.mx, monster.my)) {
                await plineWithContinuation(
                    `${monsterName(monster, { article: 'a', capitalized: true })} is shaken loose from the ceiling!`,
                );
            } else if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY)) {
                await publishHeardMessage('a thump.', plineWithContinuation);
            }
        }
    }
    return false;
}

function altarName(location: MapLocation): string {
    const alignment = Amask2align(location.flags & AM_MASK);
    return alignment > 0 ? 'lawful'
        : alignment < 0 ? 'chaotic' : alignment === 0 ? 'neutral' : 'unaligned';
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
        const mask = location.flags;
        if (mask & AM_SANCTUM) return false;
        if (cansee(x, y)) {
            await plineWithContinuation(
                `The ${altarName(location)} altar falls into a chasm.`,
            );
        }
        await desecrateAltar(false, Amask2align(mask & AM_MASK));
        if (game.program_state.gameover) return false;
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === GRAVE || location.typ === THRONE) {
        const feature = location.typ === GRAVE ? 'headstone' : 'throne';
        const action = location.typ === GRAVE ? 'topples' : 'falls';
        if (cansee(x, y))
            await plineWithContinuation(`The ${feature} ${action} into a chasm.`);
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
        convertSecretDoor(location);
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
    if (roomsAt(game.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0);
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
            if (await wakeMonsterForEarthquake(monsterAt(x, y)))
                return { changed, force, heroDied: true };
            if (rn2(14 - force) !== 0) continue;
            if (await shakeTerrain(x, y, hadPitBeforeEarthquake)) changed++;
            if (game.program_state?.gameover) return { changed, force, heroDied: true };
        }
    }
    return { changed, force, heroDied: false };
}
