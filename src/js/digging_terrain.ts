// Downward digging: viability checks and the terrain a finished dig creates.
// C refs: dig.c dig_check(), digcheck_fail_message(), dighole(),
// digactualhole(), liquid_flow(), dig_up_grave(), and the shared furniture
// dispatch.  The digging effort loop itself lives in hero_digging.js.

import { monsterHasMapPosition } from './monster_location.js';
import { heroIsHallucinating } from './senses.js';
import { deleteTrap } from './trap_lifecycle.js';
import {
    AD_DGST, AD_STCK, AD_WRAP, AT_ENGL, AT_HUGS,
} from './monster_attack_types.js';
import { adjustHeroAlignment } from './alignment.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_LAWFUL, A_STR, A_WIS, ALTAR, AM_MASK, AM_SANCTUM, Amask2align,
    BEAR_TRAP, DBWALL, DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER,
    DIGCHECK_FAIL_AIRLEVEL, DIGCHECK_FAIL_ALTAR, DIGCHECK_FAIL_BOULDER,
    DIGCHECK_FAIL_CANTDIG, DIGCHECK_FAIL_ONLADDER, DIGCHECK_FAIL_ONSTAIRS,
    DIGCHECK_FAIL_OBJ_POOL_OR_TRAP, DIGCHECK_FAIL_THRONE,
    DIGCHECK_FAIL_TOOHARD, DIGCHECK_FAIL_UNDESTROYABLETRAP,
    DIGCHECK_FAIL_WATERLEVEL, DIGCHECK_FAILED, DIGCHECK_PASSED,
    DIGCHECK_PASSED_DESTROY_TRAP, DIGCHECK_PASSED_PITONLY,
    DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, FOUNTAIN, F_WARNED, GRAVE, HOLE, ICE,
    IS_ALTAR, IS_DOOR, IS_FURNITURE, IS_GRAVE, IS_OBSTRUCTED,
    IS_ROOM, IS_STWALL, IS_THRONE, Is_airlevel, Is_botlevel,
    Is_earthlevel, Is_waterlevel, LADDER, LANDMINE, LAVAPOOL, MAGIC_PORTAL,
    MIGR_RANDOM, M_SEEN_MAGR, MM_NOMSG, PIT, POOL, ROOM, SDOOR, SHOPBASE,
    SHOP_PIT_COST, SINK,
    STAIRS, TT_BURIEDBALL, TT_INFLOOR, TT_PIT, VIBRATING_SQUARE,
    W_NONDIGGABLE, is_hole, is_magical_trap, is_pit, isok,
} from './const.js';
import {
    addShopDamage, makeAngryShopkeeper, payForShopDamage, shopDig,
} from './shop_damage.js';
import {
    canSeeMonster, canSpotMonster, flush_screen, map_invisible, newsym,
    plineWithContinuation, show_glyph_cell, unmap_invisible,
} from './display.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { InitializedHero } from './hero_types.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position, Trap } from './map_types.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { hasShopkeeperData } from './shop_types.js';

export type DiggingActor = 'you' | 'object' | Monster | null;
export interface DigHoleOptions {
    pitOnly?: boolean;
    byMagic?: boolean;
    coordinate?: Position | null;
    state?: GameState;
}
interface DiggingOptions { state?: GameState }
interface BlastCell extends Position { mask: number; monster: Monster | null }

import { convertTrapToObject } from './trap_object.js';
import { heroLiquidEffects } from './hack.js';
import { clearHeroTrap } from './hero_traps.js';
import { bringLeashedFollowers } from './teleport.js';
import { liquidForHole } from './hole.js';
import { gotoLevel } from './level_change.js';
import { resolveMonsterLiquid } from './mon.js';
import { angerAttackedMonster } from './monster_anger.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { triggerImmediateMonsterTrap } from './monmove.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE,
} from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { publishMonsterYelp } from './monster_anger.js';
import {
    leashAttachedToMonster, releaseMonsterLeash,
} from './monster_leash.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { loseHeroHp } from './hero_damage.js';
import {
    canDigDown, createToptenObject, deleteFloorTrap, maketrap,
    makemonAt, mkclassAligned,
} from './mklev.js';
import {
    buriedBallToPunishment, unearthFloorObjectsAt,
} from './buried_object.js';
import { dryFountainAt, gushForthFromFountain } from './fountain.js';
import { breakSinkAt } from './sink_terrain.js';
import { destroyDrawbridge, findDrawbridgeAt } from './dbridge.js';
import { desecrateAltar } from './divine_wrath.js';
import { refreshMovementProperties } from './properties.js';
import { resetHeroTrap, switchHeroTerrain } from './terrain_movement.js';
import { impactDrop } from './object_migration.js';
import {
    BEARTRAP, BOULDER, CORPSE, LAND_MINE,
} from './object_data.js';
import {
    LEVEL_TIMER_KIND, stopAllObjectTimers, stopLevelTimer,
} from './object_timers.js';
import { autopickupAtHero } from './pickup.js';
import { roomsAt } from './room.js';
import { d, rn2 } from './rng.js';
import { surfaceName } from './terrain_name.js';
import { waterDamageChain } from './trap.js';
import { fireDamageChain } from './fire_damage.js';
import { cansee } from './vision.js';
import { CLR_BLUE } from './terminal.js';
import { isAxe } from './weapon_type.js';
import {
    updateIceObjectTimersAt,
} from './floor_object.js';
import { deleteEngravingAt } from './engrave.js';
import { isLavaAt, isPoolAt, monsterInAir } from './terrain_properties.js';

const S_ZOMBIE = 52;
const S_MUMMY = 39;
const EXPL_ROWS = [['/', '-', '\\'], ['|', ' ', '|'], ['\\', '-', '/']];
const SHIELD_ROWS = ['0', '#', '@', '#', '0', '#', '*'];
const MZ_HUGE = 4;
const M1_FLY = 0x00000001;

function trapAt(x: number, y: number, state: GameState): Trap | null {
    return (state.level?.traps || []).find(
        trap => trap.tx === x && trap.ty === y) || null;
}

function monsterAt(x: number, y: number, state: GameState): Monster | null {
    return (state.level?.monsters || []).find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y)
        || null;
}

function boulderAt(x: number, y: number, state: GameState): GameObject | null {
    return (state.level?.objects?.[x]?.[y] || []).find(
        object => object.otyp === BOULDER) || null;
}

function pileAt(x: number, y: number, state: GameState): GameObject[] {
    return state.level?.objects?.[x]?.[y] || [];
}

function isPoolOrLava(x: number, y: number, state: GameState): boolean {
    return isPoolAt(x, y, state) || isLavaAt(x, y, state);
}

function heroIsAirborne(state: GameState): boolean {
    return !!(state.u?.levitating || state.u?.levitation
        || state.u?.flying);
}

function verbose(state: GameState): boolean {
    return state.flags?.verbose !== false;
}

function article(word: string): string {
    return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function capitalized(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function alignmentWord(alignment: number): string {
    if (alignment > 0) return 'lawful';
    if (alignment < 0) return 'chaotic';
    return 'neutral';
}

function liquidName(typ: number): string {
    return typ === LAVAPOOL ? 'lava' : 'water';
}

function monsterSubject(monster: Monster): string {
    if (monster.name) return monster.name;
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

// C dig.c:dig_check().  Pure classification; no messages, no randomness.
export function digCheck(madeBy: DiggingActor, x: number, y: number, state: GameState = game) {
    const location = state.level?.at?.(x, y);
    if (!location) return DIGCHECK_FAIL_TOOHARD;
    const trap = trapAt(x, y, state);

    if (location.typ === LADDER) {
        return DIGCHECK_FAIL_ONLADDER;
    } else if (location.typ === STAIRS) {
        return DIGCHECK_FAIL_ONSTAIRS;
    } else if (IS_THRONE(location.typ) && madeBy !== 'object') {
        return DIGCHECK_FAIL_THRONE;
    } else if (IS_ALTAR(location.typ)
        && (madeBy !== 'object'
            || ((location.flags ?? 0) & AM_SANCTUM) !== 0)) {
        return DIGCHECK_FAIL_ALTAR;
    } else if (Is_airlevel(state.u?.uz)) {
        return DIGCHECK_FAIL_AIRLEVEL;
    } else if (Is_waterlevel(state.u?.uz)) {
        return DIGCHECK_FAIL_WATERLEVEL;
    } else if (IS_OBSTRUCTED(location.typ) && location.typ !== SDOOR
        && ((location.wall_info ?? 0) & W_NONDIGGABLE) !== 0) {
        return DIGCHECK_FAIL_TOOHARD;
    } else if (trap && (trap.ttyp === MAGIC_PORTAL
        || trap.ttyp === VIBRATING_SQUARE)) {
        return DIGCHECK_FAIL_UNDESTROYABLETRAP;
    } else if (!canDigDown(state.u?.uz) && !location.candig) {
        if (trap) {
            return is_hole(trap.ttyp) || is_pit(trap.ttyp)
                ? DIGCHECK_FAIL_CANTDIG
                : DIGCHECK_PASSED_DESTROY_TRAP;
        }
        return DIGCHECK_PASSED_PITONLY;
    } else if (boulderAt(x, y, state)) {
        return DIGCHECK_FAIL_BOULDER;
    } else if (madeBy === 'object' && (trap || isPoolOrLava(x, y, state))) {
        return DIGCHECK_FAIL_OBJ_POOL_OR_TRAP;
    }
    return DIGCHECK_PASSED;
}

// C dig.c:digcheck_fail_message().
export async function digCheckFailMessage(
    result: number, madeBy: DiggingActor, x: number, y: number,
    { state = game }: DiggingOptions = {},
) {
    if (result < DIGCHECK_FAILED) return;
    const heroWieldsAxe = madeBy === 'you' && isAxe(state.uwep);
    const verb = heroWieldsAxe ? 'chop' : 'dig in';
    const surface = surfaceName(x, y, state);

    switch (result) {
    case DIGCHECK_FAIL_AIRLEVEL:
        await plineWithContinuation(`You cannot ${verb} thin air.`);
        break;
    case DIGCHECK_FAIL_ALTAR:
        await plineWithContinuation('The altar is too hard to break apart.');
        break;
    case DIGCHECK_FAIL_BOULDER:
        await plineWithContinuation(
            `There isn't enough room to ${verb} here.`);
        break;
    case DIGCHECK_FAIL_ONLADDER:
        await plineWithContinuation('The ladder resists your effort.');
        break;
    case DIGCHECK_FAIL_ONSTAIRS:
        await plineWithContinuation(`The stairs are too hard to ${verb}.`);
        break;
    case DIGCHECK_FAIL_THRONE:
        await plineWithContinuation('The throne is too hard to break apart.');
        break;
    case DIGCHECK_FAIL_CANTDIG:
    case DIGCHECK_FAIL_TOOHARD:
    case DIGCHECK_FAIL_UNDESTROYABLETRAP:
        await plineWithContinuation(
            `The ${surface} here is too hard to ${verb}.`);
        break;
    case DIGCHECK_FAIL_WATERLEVEL:
        await plineWithContinuation(
            `The ${liquidName(POOL)} splashes and subsides.`);
        break;
    default:
        break;
    }
}

// C dig.c:furniture_handled().  Returns true when digging hit furniture whose
// own owner replaced the terrain, so no pit or hole is created.
async function furnitureHandled(x: number, y: number, madeByYou: boolean, state: GameState): Promise<boolean> {
    const location = requireGameLevel(state).requireAt(x, y);

    if (location.typ === FOUNTAIN) {
        await gushForthFromFountain({ drinking: false, state });
        // SET_FOUNTAIN_WARNED(): force the next dryup() to dry the fountain.
        location.looted = (location.looted ?? 0) | F_WARNED;
        await dryFountainAt(x, y, { causedByHero: madeByYou, state });
        return true;
    }
    if (location.typ === SINK) {
        await breakSinkAt(x, y, state);
        return true;
    }
    const bridge = findDrawbridgeAt(x, y, state);
    if (location.typ === DRAWBRIDGE_DOWN || bridge) {
        // If under the portcullis, the bridge is adjacent.
        if (!bridge) throw new Error('Drawbridge terrain has no drawbridge');
        await destroyDrawbridge(bridge.x, bridge.y, state);
        return true;
    }
    return false;
}

function deleteBoulder(boulder: GameObject, state: GameState): void {
    const pile = requireGameLevel(state).objects[boulder.ox]?.[boulder.oy];
    const index = pile?.indexOf(boulder) ?? -1;
    if (pile && index >= 0) pile.splice(index, 1);
    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.buried = false;
    boulder.ox = 0;
    boulder.oy = 0;
}

// C dig.c:dighole().  Returns true when the digging changed the terrain.
export async function digHole({
    pitOnly = false,
    byMagic = false,
    coordinate = null,
    state = game,
}: DigHoleOptions = {}): Promise<boolean> {
    requirePlayingGame(state);
    let digX: number;
    let digY: number;
    if (!coordinate) {
        digX = state.u.ux;
        digY = state.u.uy;
    } else {
        digX = coordinate.x;
        digY = coordinate.y;
        if (!isok(digX, digY)) return false;
    }

    const trap = trapAt(digX, digY, state);
    const location = requireGameLevel(state).requireAt(digX, digY);
    const digCheckResult = digCheck('you', digX, digY, state);
    const nohole = digCheckResult === DIGCHECK_FAIL_CANTDIG
        || digCheckResult === DIGCHECK_FAIL_TOOHARD;
    const oldTyp = location.typ;
    const adjacent = digX !== state.u.ux || digY !== state.u.uy;
    const bridge = oldTyp === DRAWBRIDGE_DOWN || IS_DOOR(oldTyp)
        || oldTyp === DBWALL
        ? findDrawbridgeAt(digX, digY, state) : null;
    let retval = false;

    const tooHardMessage = () => plineWithContinuation(
        `The ${surfaceName(digX, digY, state)} `
        + `${adjacent ? 't' : ''}here is too hard to dig in.`);

    if ((trap && ((trap.ttyp === MAGIC_PORTAL
        || trap.ttyp === VIBRATING_SQUARE) || nohole))
        || (IS_OBSTRUCTED(oldTyp) && oldTyp !== SDOOR
            && ((location.wall_info ?? 0) & W_NONDIGGABLE) !== 0)) {
        await tooHardMessage();
    } else if (trap && is_magical_trap(trap.ttyp)) {
        await explodeMagicalTrapAt(digX, digY, state);
        deleteTrap(trap, state);
        newsym(digX, digY);
    } else if (isPoolOrLava(digX, digY, state)) {
        const liquid = isLavaAt(digX, digY, state) ? 'lava' : 'water';
        await plineWithContinuation(`The ${liquid} `
            + 'sloshes furiously for a moment, then subsides.');
        await wakeMonstersNearWithMessages(
            state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state,
        );
    } else if (oldTyp === DRAWBRIDGE_DOWN || bridge) {
        if (pitOnly) {
            await plineWithContinuation(
                'The drawbridge seems too hard to dig through.');
        } else {
            if (!bridge) throw new Error('Drawbridge terrain has no drawbridge');
            await destroyDrawbridge(bridge.x, bridge.y, state);
            retval = true;
        }
    } else if (boulderAt(digX, digY, state)) {
        const boulder = boulderAt(digX, digY, state);
        if (!boulder) throw new Error('The boulder disappeared before digging');
        if (trap && is_pit(trap.ttyp) && rn2(2)) {
            await plineWithContinuation(`The boulder settles into the `
                + `${adjacent ? 'adjacent ' : ''}pit.`);
            trap.ttyp = PIT; /* crush spikes */
        } else {
            await plineWithContinuation('KADOOM!  The boulder falls in!');
            await wakeMonstersNearWithMessages(
                state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state,
            );
            await deleteFloorTrap(trap, state);
        }
        deleteBoulder(boulder, state);
    } else if (IS_GRAVE(oldTyp)) {
        await digActualHole(digX, digY, 'you', PIT, { state });
        await digUpGrave(coordinate, { state });
        retval = true;
    } else if (oldTyp === DRAWBRIDGE_UP) {
        const liquid = liquidForHole(digX, digY, state, { fillIfAny: false });
        if (liquid === ROOM) {
            await tooHardMessage();
        } else {
            location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER)
                | (liquid === LAVAPOOL ? DB_LAVA : DB_MOAT);
            await liquidFlow(digX, digY, liquid, trap,
                'As you dig, the hole fills with %s!', { state });
            retval = true;
        }
    } else if (IS_THRONE(oldTyp)) {
        await plineWithContinuation('The throne is too hard to break apart.');
    } else if (IS_ALTAR(oldTyp)) {
        await plineWithContinuation('The altar is too hard to break apart.');
    } else {
        const liquid = liquidForHole(digX, digY, state, { fillIfAny: false });
        location.flags = 0;
        if (liquid !== ROOM) {
            if (!await furnitureHandled(digX, digY, true, state)) {
                location.typ = liquid;
                await liquidFlow(digX, digY, liquid, trap,
                    'As you dig, the hole fills with %s!', { state });
            }
            retval = true;
        } else {
            // magical digging disarms settable traps
            if (byMagic && trap
                && (trap.ttyp === LANDMINE || trap.ttyp === BEAR_TRAP)) {
                await convertTrapToObject(trap,
                    trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP, 1, state, { bury: true });
            }
            if (nohole || pitOnly
                || digCheckResult === DIGCHECK_PASSED_DESTROY_TRAP
                || digCheckResult === DIGCHECK_PASSED_PITONLY) {
                await digActualHole(digX, digY, 'you', PIT, { state });
            } else {
                await digActualHole(digX, digY, 'you', HOLE, { state });
            }
            retval = true;
        }
    }
    spotChecks(digX, digY, oldTyp, state);
    return retval;
}

// C dig.c:digactualhole().
export async function digActualHole(
    x: number, y: number, madeBy: DiggingActor, ttyp: number,
    { state = game }: DiggingOptions = {},
): Promise<void> {
    requirePlayingGame(state);
    const hero = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    const atYou = hero.ux === x && hero.uy === y;
    const madeByYou = madeBy === 'you';
    const madeByObject = madeBy === 'object';
    // BY_OBJECT means the hero broke a wand, so blame her for it.
    const herosFault = madeByYou || madeByObject;
    let wontFall = heroIsAirborne(state);
    const victim = monsterAt(x, y, state);

    if (atYou && hero.utrap) {
        if (hero.utraptype === TT_BURIEDBALL) {
            await buriedBallToPunishment(state);
        } else if (hero.utraptype === TT_INFLOOR) {
            clearHeroTrap(state);
        }
    }

    if (await furnitureHandled(x, y, madeByYou, state)) return;

    if (ttyp !== PIT && !canDigDown(state.u.uz) && !location.candig) {
        // C digactualhole() impossible(): a hole was requested where only a
        // pit can exist.  Degrade to a pit like the source does.
        ttyp = PIT;
    }

    const oldTyp = location.typ;
    const oldAltarAlignment = Amask2align((location.flags ?? 0) & AM_MASK);
    let surfaceType;
    let furniture = '';
    if (IS_FURNITURE(oldTyp)) {
        // should mirror the word used by surface() for normal floor
        surfaceType = (IS_ROOM(oldTyp) && !Is_earthlevel(state.u.uz))
            ? 'floor' : 'ground';
        if (oldTyp === ALTAR) {
            furniture = `${alignmentWord(oldAltarAlignment)} `;
        }
        furniture += surfaceName(x, y, state);
    } else {
        surfaceType = surfaceName(x, y, state);
    }
    const shopdoor = IS_DOOR(oldTyp)
        && roomsAt(state.level, x, y, SHOPBASE).length > 0;
    const oldObjects = [...pileAt(x, y, state)];

    const trap = await maketrap(x, y, ttyp);
    if (!trap) return;
    const newObjects = pileAt(x, y, state);
    trap.madeby_u = herosFault;
    trap.tseen = 0;
    if (cansee(x, y) || madeByYou) trap.tseen = 1;
    newsym(x, y);

    const trapWord = ttyp === HOLE ? 'hole' : 'pit';
    const through = ttyp === HOLE ? 'through' : 'in';
    if (madeByYou) {
        if (!atYou) {
            await plineWithContinuation(`You dig an adjacent ${trapWord}.`);
        } else {
            await plineWithContinuation(
                `You dig ${article(trapWord)} ${through} the ${surfaceType}.`);
        }
    } else if (madeBy && typeof madeBy === 'object'
        && canSeeMonster(madeBy)) {
        await plineWithContinuation(
            `${monsterSubject(madeBy)} digs ${article(trapWord)} `
            + `${through} the ${surfaceType}.`);
    } else if (cansee(x, y) && verbose(state)) {
        if (IS_STWALL(oldTyp)) {
            await plineWithContinuation(
                `The ${surfaceType} crumbles into ${article(trapWord)}.`);
        } else {
            await plineWithContinuation(
                `${capitalized(article(trapWord))} appears `
                + `in the ${surfaceType}.`);
        }
    }
    if (IS_FURNITURE(oldTyp) && cansee(x, y)) {
        await plineWithContinuation(
            `The ${furniture} falls into the ${trapWord}!`);
    }
    // wrath should immediately follow altar destruction message
    if (herosFault && oldTyp === ALTAR) {
        await desecrateAltar(false, oldAltarAlignment, state);
    }

    const objectsAppeared = newObjects.length !== oldObjects.length
        || newObjects.some((object, index) => object !== oldObjects[index]);

    if (ttyp === PIT) {
        if (shopdoor && herosFault) {
            await payForShopDamage('ruin', { state });
        } else {
            addShopDamage(x, y, herosFault ? SHOP_PIT_COST : 0, state);
        }
        if (madeByYou) {
            await wakeMonstersNearWithMessages(
                state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state,
            );
        }
        await switchHeroTerrain(state);
        wontFall = heroIsAirborne(state);

        if (atYou) {
            if (!wontFall) {
                hero.utrap = 2 + rn2(4); /* rn1(4, 2) */
                hero.utraptype = TT_PIT;
                refreshMovementProperties(state);
                state.context.botl = true;
                state.vision_full_recalc = 1; /* vision limits change */
            } else {
                // C reset_utrap(TRUE): a newly airborne hero floats back up.
                await resetHeroTrap(true, state);
            }
            if (objectsAppeared) await autopickupAtHero();
        } else if (victim) {
            if (monsterInAir(victim, state)) {
                if (canSeeMonster(victim)) {
                    // C is_flyer() vs is_floater(): floaters also carry
                    // M1_FLY in the pinned data, so they report "flies".
                    const flying = !!((MONSTER_FLAGS1[victim.mnum] ?? 0)
                        & M1_FLY);
                    await plineWithContinuation(
                        `${monsterSubject(victim)} `
                        + `${flying ? 'flies' : 'floats'} over the pit.`);
                }
            } else if (victim !== madeBy) {
                await triggerImmediateMonsterTrap(victim, state);
            }
        }
    } else { /* was TRAPDOOR, now a HOLE */
        if (atYou) {
            await switchHeroTerrain(state);
            wontFall = heroIsAirborne(state);

            // check for leashed pet that can't fall right now
            if (!hero.ustuck && !wontFall
                && !await bringLeashedFollowers(state)) {
                await plineWithContinuation(
                    'You are jerked back by your pet!');
                wontFall = true;
            }

            if (hero.ustuck || wontFall) {
                if (newObjects.length) {
                    await impactDrop(null, x, y,
                        { state, publish: plineWithContinuation });
                }
                if (objectsAppeared) await autopickupAtHero();
                if (state.program_state?.gameover) return;
                if (shopdoor && herosFault) {
                    await payForShopDamage('ruin', { state });
                }
            } else {
                const inShop = state.u.ushops.length > 0;
                if (inShop && herosFault) {
                    await shopDig(1, state); /* shk might snatch pack */
                } else {
                    await payForShopDamage('dig into',
                        { cantMollify: true, state });
                }
                await plineWithContinuation('You fall through...');
                await gotoLevel(
                    { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 },
                    { arrival: 'falling' });
            }
        } else {
            if (shopdoor && herosFault) {
                await payForShopDamage('ruin', { state });
            }
            if (newObjects.length) {
                await impactDrop(null, x, y,
                    { state, publish: plineWithContinuation });
            }
            if (victim) {
                if (monsterInAir(victim, state)
                    || (victim.wormSegments?.length ?? 0) > 5
                    || (MONSTER_SIZE[victim.mnum] ?? 2) >= MZ_HUGE) {
                    return;
                }
                if (victim === state.u.ustuck) return; /* vortex kludge */
                if (!await teleportPetVictim(victim, state)) return;

                if (Is_botlevel(state.u.uz)) {
                    if (canSeeMonster(victim)) {
                        await plineWithContinuation(
                            `${monsterSubject(victim)} avoids the trap.`);
                    }
                    return;
                }
                if (victim.isshk) {
                    if (!hasShopkeeperData(victim))
                        throw new Error('A falling shopkeeper requires its shop records');
                    await makeAngryShopkeeper(victim, state);
                }
                await migrateMonsterOffLevel(victim, state, trap, {
                    kind: 'level-fall-migration',
                    mode: MIGR_RANDOM,
                });
            }
        }
    }
}

// C teleport.c:teleport_pet(mtmp, FALSE).  A steed never follows; a cursed
// leash yelps and holds the pet; any other leash goes slack and releases it.
async function teleportPetVictim(monster: Monster, state: GameState): Promise<boolean> {
    if (monster === state.u?.usteed) return false;
    if (!monster.mleashed) return true;
    const leash = leashAttachedToMonster(monster, state);
    if (!leash) {
        releaseMonsterLeash(monster, state);
        return true;
    }
    if (leash.cursed) {
        await publishMonsterYelp(monster);
        return false;
    }
    await plineWithContinuation('Your leash goes slack.');
    releaseMonsterLeash(monster, state);
    return true;
}

// C dig.c:liquid_flow().  The caller has already changed the terrain type.
export async function liquidFlow(
    x: number, y: number, typ: number, trap: Trap | null, fillMessage: string | null,
    { state = game }: DiggingOptions = {},
) {
    if (!isPoolOrLava(x, y, state)) return;
    requirePlayingGame(state);

    if (trap) await deleteFloorTrap(trap, state);
    updateIceObjectTimersAt(x, y, state);
    const unearthed = await unearthFloorObjectsAt(x, y, state);

    if (fillMessage) {
        await plineWithContinuation(
            fillMessage.replace('%s', liquidName(typ)));
    }
    // handle object damage before hero damage; affects potential bones
    const pile = pileAt(x, y, state);
    if (pile.length) {
        if (typ === LAVAPOOL) {
            await fireDamageChain(pile, {
                state, x, y, force: true,
                publish: plineWithContinuation,
            });
        } else {
            const messages: string[] = [];
            await waterDamageChain(pile, messages, state);
            if (cansee(x, y)) {
                for (const message of messages) {
                    await plineWithContinuation(message);
                }
            }
        }
    }
    // damage to the hero
    if (state.u?.ux === x && state.u?.uy === y) {
        await heroLiquidEffects({ state });
    } else {
        const monster = monsterAt(x, y, state);
        if (monster) {
            await resolveMonsterLiquid(monster, state, {
                announce: plineWithContinuation,
                finishDeath: finishMonsterLiquidDeath,
                monsterMoving: false,
            });
        }
    }
    return { unearthed };
}

// C dig.c:dig_up_grave().
export async function digUpGrave(
    coordinate: Position | null = null, { state = game }: DiggingOptions = {},
): Promise<void> {
    requirePlayingGame(state);
    let digX: number;
    let digY: number;
    if (!coordinate) {
        digX = state.u.ux;
        digY = state.u.uy;
    } else {
        digX = coordinate.x;
        digY = coordinate.y;
        if (!isok(digX, digY)) return;
    }
    const location = requireGameLevel(state).requireAt(digX, digY);

    await exerciseAttribute(A_WIS, false, state);
    if (state.urole?.key === 'archeologist') {
        adjustHeroAlignment(-Math.sign(state.u.ualign.type) * 3, state);
        await plineWithContinuation(
            'You feel like a despicable grave-robber!');
    } else if (state.urole?.key === 'samurai') {
        adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
        await plineWithContinuation('You disturb the honorable dead!');
    } else if (state.u.ualign.type === A_LAWFUL) {
        if (state.u.ualign.record > -10) adjustHeroAlignment(-1, state);
        await plineWithContinuation(
            'You have violated the sanctity of this grave!');
    }

    const blind = state.blind || (state.u?.blindTurns ?? 0) > 0;
    const hallucinating = heroIsHallucinating(state);
    const whatHappens = location.emptygrave ? -1 : rn2(5);
    if (whatHappens === 0 || whatHappens === 1) {
        await plineWithContinuation('You unearth a corpse.');
        const corpse = await createToptenObject(CORPSE, digX, digY);
        corpse.age -= 51; /* TAINT_AGE + 1: this is an *OLD* corpse */
    } else if (whatHappens === 2) {
        if (!blind) {
            await plineWithContinuation(hallucinating
                ? 'Dude!  The living dead!'
                : "The grave's owner is very upset!");
        }
        const species = mkclassAligned(S_ZOMBIE, 0);
        if (species !== null) {
            await makemonAt(species, digX, digY, MM_NOMSG);
        }
    } else if (whatHappens === 3) {
        if (!blind) {
            await plineWithContinuation(hallucinating
                ? 'I want my mummy'
                : "You've disturbed a tomb");
        }
        const species = mkclassAligned(S_MUMMY, 0);
        if (species !== null) {
            await makemonAt(species, digX, digY, MM_NOMSG);
        }
    } else {
        await plineWithContinuation('The grave is unoccupied.  Strange...');
    }
    location.typ = ROOM;
    location.emptygrave = 0;
    location.disturbed = 0;
    deleteEngravingAt(digX, digY, state.level);
    newsym(digX, digY);
}

// C hack.c:spot_checks().  Stale ice timers and ice-held object state must go
// when terrain stopped being ice.
export function spotChecks(x: number, y: number, oldTyp: number, state: GameState = game): void {
    const location = state.level?.at?.(x, y);
    if (!location) return;
    const newTyp = location.typ;
    const dbIceBefore = oldTyp === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_ICE;
    const changed = newTyp !== oldTyp
        || (oldTyp === DRAWBRIDGE_UP && !dbIceBefore);
    if (!((oldTyp === ICE) || dbIceBefore) || !changed) return;

    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    updateIceObjectTimersAt(x, y, state);
}

// C explode.c explode() restricted to dighole()'s call:
// explode(x, y, 0, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL).
// Source no-ops for this invocation, kept out deliberately: do_hallu naming
// (only set for MON_EXPLODE), destroy_items() item damage (cold/fire/electric
// only), zap_over_floor() floor effects (zap type 0), golemeffects()
// (flesh/iron golems react to fire/cold/electric only), and the wand-role
// damage reduction (WAND_CLASS only).
async function explodeMagicalTrapAt(x: number, y: number, state: PlayingGameState): Promise<void> {
    const hero = state.u;
    const damage = 20 + d(3, 6);
    const deaf = state.deaf || hero?.deaf;
    const insideEngulfer = !!hero?.uswallow;
    // held but not engulfed: the holder reaches into the second spot
    let grabbing = false;
    let grabbed = false;
    let grabxy: Position | null = null;
    if (hero?.ustuck && !hero.uswallow) {
        grabbing = formSticks(hero);
        grabbed = !grabbing;
        grabxy = { x: hero.ustuck.mx, y: hero.ustuck.my };
    }

    const cells: BlastCell[] = [];
    let visible = false;
    let anyShield = false;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const xx = x + i - 1;
            const yy = y + j - 1;
            if (!isok(xx, yy)) continue;
            let mask = 0;
            let monster = monsterAt(xx, yy, state);
            if (!monster && hero?.ux === xx && hero?.uy === yy) {
                monster = hero.usteed || null;
            }
            if (hero?.ux === xx && hero?.uy === yy
                && heroAntimagic(state)) {
                mask |= 1; /* EXPL_HERO */
            }
            if (monster && monsterHasMagicResistance(monster)) mask |= 2;
            if (monster && cansee(xx, yy) && !canSpotMonster(monster)) {
                map_invisible(xx, yy);
            } else if (!monster) {
                unmap_invisible(xx, yy);
            }
            if (cansee(xx, yy)) visible = true;
            if (mask) anyShield = true;
            cells.push({ x: xx, y: yy, mask, monster });
        }
    }

    if (visible) {
        // Start the explosion with the C 3x3 glyph pattern.
        for (const [i, row] of EXPL_ROWS.entries()) {
            for (const [j, glyph] of row.entries()) {
                show_glyph_cell(x + i - 1, y + j - 1, glyph, CLR_BLUE, false);
            }
        }
        await flush_screen(1);
        if (anyShield && state.flags?.sparkle !== false) {
            // simulate the shield effect (decl.c shield_static rows)
            for (let k = 0; k < 3 * 7; k++) {
                const glyph = SHIELD_ROWS[k % 7];
                if (glyph === undefined) throw new Error('Missing magic shield glyph');
                for (const cell of cells) {
                    if (!cell.mask) continue;
                    show_glyph_cell(cell.x, cell.y,
                        glyph, CLR_BLUE, false);
                }
                await flush_screen(1);
                await state.animationFrame?.();
            }
            // Cover the last shield glyph with the blast symbol.
            for (const [i, row] of EXPL_ROWS.entries()) {
                for (const [j, glyph] of row.entries()) {
                    show_glyph_cell(x + i - 1, y + j - 1, glyph, CLR_BLUE, false);
                }
            }
        } else {
            await state.animationFrame?.();
            await state.animationFrame?.();
        }
        // tmp_at(DISP_END): clear the explosion
        for (const cell of cells) newsym(cell.x, cell.y);
    } else if (!deaf) {
        await plineWithContinuation('You hear a blast.');
    }
    if (visible && !deaf) {
        await plineWithContinuation('Boom!');
    }

    // apply effects to monsters first, in case hero damage is fatal
    let heroHurt = 0;
    if (damage) {
        for (const cell of cells) {
            if (hero?.ux === cell.x && hero?.uy === cell.y) {
                heroHurt = (cell.mask & 1) ? 1 : 2;
            } else if (insideEngulfer) {
                // for inside_engulfer, only <u.ux,u.uy> is affected
                continue;
            }

            const monster = cell.monster;
            if (!monster) continue;

            if (hero?.uswallow && hero.ustuck === monster) {
                // the blast hits the creature the hero is inside
                await engulferExplosionMessage(monster);
            } else if (cansee(cell.x, cell.y)) {
                if (monster.m_ap_type) {
                    revealMonsterAppearance(monster);
                }
                await plineWithContinuation(
                    `${monsterSubject(monster)} is caught in the `
                    + 'magical blast!');
            }

            let monsterDamage;
            if (cell.mask & 2) {
                // shielded: only item damage applies, zero for AD_MAGM
                monsterDamage = 0;
            } else {
                monsterDamage = damage;
                // resist(mtmp, TRAP_EXPLODE, 0, FALSE): hero-level attack
                if (monsterResistsEffect(
                    monster, hero?.ulevel ?? 1, rn2)) {
                    if (cansee(cell.x, cell.y)) {
                        await plineWithContinuation(
                            `${monsterSubject(monster)} resists the `
                            + 'magical blast!');
                    }
                    monsterDamage = Math.trunc((damage + 1) / 2);
                }
                // a grabber reaching into the blast takes double damage
                if (grabbed && monster === hero?.ustuck
                    && Math.max(Math.abs(monster.mx - x),
                        Math.abs(monster.my - y)) <= 1) {
                    monsterDamage *= 2;
                }
            }
            monster.mhp = (monster.mhp ?? 1) - monsterDamage;
            if (monster.mhp <= 0) {
                await finishHeroMonsterKill(monster, monster.mx, monster.my, {
                    showKillMessage: true,
                });
            } else {
                await angerAttackedMonster(monster);
            }
        }
    }

    // Do your injury last
    if (heroHurt) {
        let blastDamage = damage;
        if (verbose(state)) {
            await plineWithContinuation(
                'You are caught in the magical blast!');
        }
        if (hero.invulnerable || hero.uinvulnerable) {
            blastDamage = 0;
            await plineWithContinuation('You are unharmed!');
        }
        if (heroHurt === 2) {
            // a poly'd hero reaching into the blast takes double damage
            if (grabbing && grabxy
                && (grabxy.x - x) ** 2 + (grabxy.y - y) ** 2 <= 2) {
                blastDamage *= 2;
            }
            const wouldDie = (hero.uhp ?? 1) - blastDamage <= 0;
            if (wouldDie && blastDamage > 0) {
                if (game._last_message
                    === 'You are caught in the magical blast!') {
                    await plineWithContinuation('It is fatal.');
                } else {
                    await plineWithContinuation(
                        'The magical blast is fatal.');
                }
            }
            const died = await loseHeroHp(blastDamage,
                'caught yourself in a magical blast', { state });
            if (!died) await exerciseAttribute(A_STR, false, state);
        }
        // monsters learn whether the hero resisted the blast
        if (heroHurt === 1) {
            monstersObserveHeroResistance(M_SEEN_MAGR, state);
        } else {
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        }
    }

    // explosions are noisy
    let noise = Math.max(damage * damage, 50);
    if (insideEngulfer) noise = Math.trunc((noise + 3) / 4);
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, noise, state);
}

function heroAntimagic(state: GameState): boolean {
    return !!(state.u?.antimagic || state.u?.magicProtection
        || state.u?.magicResistance);
}

// C mondata.c sticks(): the poly'd hero holds what she hits.
function formSticks(hero: InitializedHero): boolean {
    const attacks = MONSTER_ATTACKS[hero?.umonnum] || [];
    const hasAttack = (aatyp: number | null, adtyp: number | null) => attacks.some(([type, type2]) =>
        (aatyp === null || type === aatyp)
        && (adtyp === null || type2 === adtyp));
    return hasAttack(null, AD_STCK)
        || (hasAttack(null, AD_WRAP) && !hasAttack(AT_ENGL, null))
        || hasAttack(AT_HUGS, null);
}

// C explode.c engulfer_explosion_msg() for AD_MAGM.
async function engulferExplosionMessage(monster: Monster): Promise<void> {
    const digests = (MONSTER_ATTACKS[monster.mnum] || [])
        .some(([, adtyp]) => adtyp === AD_DGST);
    if (digests) {
        await plineWithContinuation(
            `${monsterSubject(monster)} gets fried!`);
    } else {
        await plineWithContinuation(
            `${monsterSubject(monster)} gets slightly fried!`);
    }
}

