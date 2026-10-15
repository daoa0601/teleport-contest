// Shared missile contact with iron bars. C mthrowu.c:hits_bars()/hit_bars().

import { publishHeardMessage } from './hero_speech.js';
import { currentStrength } from './attrib.js';
import {
    CORR, DOOR, P_BOW, P_CROSSBOW, P_DART, P_KNIFE, P_SHURIKEN, P_SPEAR,
    ROOM, W_NONDIGGABLE, WT_IRON_BALL_INCR,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { specialLevelAt } from './dungeon.js';
import { game, requireGameLevel } from './gstate.js';
import type { GameState } from './game_state.js';
import { MONSTER_SIZE, requireMonsterData } from './monster_data.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { breakFloorObject } from './object_breakage.js';
import {
    BOULDER, CORPSE, CREDIT_CARD,
    ENORMOUS_MEATBALL, HEAVY_IRON_BALL,
    LENSES, LOCK_PICK, MAGIC_WHISTLE, MEAT_STICK, OBJECT_NAMES, OBJECT_SUBTYPE,
    POT_ACID, SKELETON_KEY,
    STATUE, TALLOW_CANDLE, TIN_WHISTLE,
    WAR_HAMMER, WAX_CANDLE, requireObjectData,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import { harmlessMissile } from './projectile.js';
import type { GameObject } from './object_types.js';
import { roomsAt } from './room.js';
import { rn2 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { switchHeroTerrain } from './terrain_movement.js';
import { cansee } from './vision.js';

interface ProjectileBarsOptions {
    x: number;
    y: number;
    barsX: number;
    barsY: number;
    forceHit?: boolean;
    heroCaused?: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
}

interface ProjectileBarsResult {
    blocked: boolean;
    destroyed: boolean;
    heroDied: boolean;
}

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const ARM_GLOVES = 3;
const LEATHER = 7;
const SILVER = 14;
const GOLD = 15;
const MZ_TINY = 0;
const RUBBER_HOSE = OBJECT_NAMES.indexOf('rubber hose');

const SMALL_WEAPON_SKILLS = new Set([-P_BOW, -P_CROSSBOW, -P_DART, -P_SHURIKEN, P_SPEAR, P_KNIFE]);
const SMALL_TOOLS = new Set([
    SKELETON_KEY, LOCK_PICK, CREDIT_CARD, TALLOW_CANDLE, WAX_CANDLE,
    LENSES, TIN_WHISTLE, MAGIC_WHISTLE,
]);

export async function projectileHitsIronBars(object: GameObject, {
    x, y, barsX, barsY, forceHit = false, heroCaused = false, state = game,
    publish = plineWithContinuation, random = rn2,
}: ProjectileBarsOptions): Promise<ProjectileBarsResult> {
    if (!forceHit && !objectHitsBars(object))
        return { blocked: false, destroyed: false, heroDied: false };
    const level = requireGameLevel(state);
    const bars = level.requireAt(barsX, barsY);
    const nondiggable = (bars.wall_info & W_NONDIGGABLE) !== 0;
    const broken = await breakFloorObject(object, {
        x, y, state, publish, random, heroCaused,
    });
    if (broken.heroDied || state.program_state.gameover)
        return { blocked: true, destroyed: broken.destroyed, heroDied: true };
    if (broken.destroyed) {
        if (object.otyp === POT_ACID) {
            if (cansee(barsX, barsY) && !nondiggable)
                await publish('The iron bars are dissolved!');
            else
                await publishHeardMessage(heroIsHallucinating(state) ? 'angry snakes!' : 'a hissing noise.', publish, state);
            if (!nondiggable) await dissolveBars(barsX, barsY, state);
        }
        return { blocked: true, destroyed: true, heroDied: !!state.program_state.gameover };
    }

    const harmless = harmlessMissile(object, state);
    const material = objectMaterial(object, state);
    const flimsy = material <= LEATHER || object.otyp === RUBBER_HOSE;
    if (!heroIsDeaf(state)) {
        const sound = object.otyp === BOULDER || object.otyp === HEAVY_IRON_BALL ? 'Whang'
            : harmless ? 'Whap'
                : flimsy ? 'Flapp'
                    : object.oclass === COIN_CLASS || material === GOLD || material === SILVER
                        ? 'Clink' : 'Clonk';
        await publish(`${sound}!`);
    }
    let noise = harmless || flimsy ? 0 : 16;
    if (heroCaused && (object.otyp === WAR_HAMMER || object.otyp === HEAVY_IRON_BALL)) {
        const strength = currentStrength(state);
        const enchantment = object.otyp === HEAVY_IRON_BALL
            ? Math.trunc(object.owt / WT_IRON_BALL_INCR) : object.spe;
        if (random(Math.max(2, 60 - strength - enchantment)) === 0) {
            await publish('You break the bars apart!');
            await dissolveBars(barsX, barsY, state);
            noise *= 2;
        }
    }
    if (noise) await wakeMonstersNearWithMessages(barsX, barsY, noise, state, publish);
    return { blocked: true, destroyed: false, heroDied: !!state.program_state.gameover };
}

function objectHitsBars(object: GameObject): boolean {
    switch (object.oclass) {
    case WEAPON_CLASS:
        return !SMALL_WEAPON_SKILLS.has(requireObjectData(OBJECT_SUBTYPE, object.otyp));
    case ARMOR_CLASS:
        return requireObjectData(OBJECT_SUBTYPE, object.otyp) !== ARM_GLOVES;
    case TOOL_CLASS:
        return !SMALL_TOOLS.has(object.otyp);
    case ROCK_CLASS:
        return object.otyp !== STATUE || corpseSize(object) > MZ_TINY;
    case FOOD_CLASS:
        return (object.otyp === CORPSE && corpseSize(object) > MZ_TINY)
            || object.otyp === MEAT_STICK || object.otyp === ENORMOUS_MEATBALL;
    case SPBOOK_CLASS:
    case WAND_CLASS:
    case BALL_CLASS:
    case CHAIN_CLASS:
        return true;
    default:
        return false;
    }
}

function corpseSize(object: GameObject): number {
    if (object.corpsenm === undefined)
        throw new Error('A corpse or statue hitting iron bars needs its species.');
    return requireMonsterData(MONSTER_SIZE, object.corpsenm);
}

// C monmove.c:dissolve_bars(). Bars already transmit light; callers which
// also remove opaque terrain or objects own any blocker recalculation.
export async function dissolveBars(x: number, y: number, state: GameState = game): Promise<void> {
    const level = requireGameLevel(state);
    const location = level.requireAt(x, y);
    location.typ = location.edge === true || location.edge === 1 ? DOOR
        : specialLevelAt(state.u.uz, state) || roomsAt(level, x, y).length ? ROOM : CORR;
    location.flags = location.doormask = location.wall_info = 0;
    newsym(x, y);
    if (state.u.ux === x && state.u.uy === y) await switchHeroTerrain(state);
}
