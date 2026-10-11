// C do.c:goto_level(): departure, destination creation or restoration, and arrival.

import { monsterHasMapPosition } from './monster_location.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { autopickupAtHero } from './pickup.js';
import { runDueTimers } from './timer_effects.js';
import { loseHeroHp } from './hero_damage.js';
import { finishLivingGame } from './end.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { promptKey } from './tty_prompts.js';
import {
    flushPendingTopline, flush_screen, pline, plineWithContinuation, docrt, bot,
} from './display.js';
import { vision_recalc, vision_reset, vision_reset_new_level } from './vision.js';
import { d, rnd, rn2 } from './rng.js';
import { deliverMigratingObjects, impactDrop } from './object_migration.js';
import {
    deliverMigratingMonsters, discardMigrations, updateMonsterLastMove,
    catchUpMonster, setShopResidency,
} from './monster_migration.js';
import { collectLevelFollowers } from './monster_followers.js';
import { hideMonsterUnder, hideMonsterOnRestore } from './monster_hiding.js';
import { restoreMonsterShape } from './monster_polymorph.js';
import { restoreMonsterWormHeads } from './monster_worm.js';
import { mklev, u_on_downstairs, u_on_upstairs } from './mklev.js';
import { dungeonBuildsUp, level_difficulty, specialPrototypeAt } from './dungeon.js';
import { collectNearbyCoords } from './u_init.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { killGenocidedMonsters } from './mon.js';
import { dismountHero, moveSteedWithHero } from './steed.js';
import { clearHeroTrap } from './hero_traps.js';
import { dungeonDepth } from './hacklib.js';
import { nearCapacity } from './weight.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import {
    dragBallDownStairs, fallWithIronBall, heroIsPunished, placeBallAndChain,
    unplaceBallAndChain,
} from './ball.js';
import { recordDungeonEntryAchievements } from './achievements.js';
import { heroHasOlfaction } from './polyself.js';
import { checkSpecialRoom } from './shk.js';
import { fixShopDamage } from './shop_damage.js';
import {
    displayPreparedQuestArrival, prepareQuestArrival, prepareMainQuestPortalCall,
    onQuestStart, okToQuest,
} from './quest.js';
import { fumaroles } from './monmove.js';
import { moveElementalBubbles } from './elemental.js';
import {
    COLNO, ROWNO, CORR, ROOM, DISMOUNT_FELL, IS_FURNITURE, IS_AIR, IS_POOL, IS_LAVA,
    MAGIC_PORTAL, In_endgame, Is_airlevel, Is_waterlevel,
    Is_rogue_level,
} from './const.js';
import { blocksMove } from './hack.js';
import { resurrectWizard } from './wizard.js';
import type { GameMap } from './game.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { ArrivalRegion, CachedLevelState, Position, Stairway } from './map_types.js';

export type LevelArrival = 'random' | 'stairs' | 'downstairs' | 'portal' | 'falling';

export interface LevelChangeOptions {
    arrival?: LevelArrival;
    ladder?: boolean;
    postMessage?: string;
    preArrivalPager?: string;
}

interface LevelArrivalOptions {
    arrival: LevelArrival;
    ladder: boolean;
    followers: Monster[];
    beforeGlow: () => Promise<void>;
}

export async function gotoLevel(targetDepth: Partial<DungeonLocation>, {
    arrival = 'random',
    ladder = false,
    postMessage = '',
    preArrivalPager = '',
}: LevelChangeOptions = {}): Promise<boolean> {
    requirePlayingGame(game);
    const oldDepth = { ...game.u.uz };
    const destinationDepth = { ...oldDepth, ...targetDepth };
    const tutorialDnum = game.specialLevels?.get('tut-1')?.dnum;
    const leavingTutorial = tutorialDnum !== undefined && Number.isInteger(tutorialDnum)
        && oldDepth.dnum === tutorialDnum && destinationDepth.dnum !== tutorialDnum;
    if (oldDepth.dnum !== destinationDepth.dnum) {
        if (leavingTutorial)
            await currentLuaLifecycle().changeTutorialMode(game, false);
        else if (destinationDepth.dnum === tutorialDnum)
            await currentLuaLifecycle().changeTutorialMode(game, true);
    }
    // C goto_level() escapes before saving the old level or changing u.uz.
    if (destinationDepth.dnum === 0 && destinationDepth.dlevel <= 0) {
        await finishLivingGame('escaped');
        return true;
    }
    // C do.c:goto_level() silently returns when a forced Wizard-menu
    // destination is the level already occupied.  The tty menu still closes
    // and exposes a fresh map, but no level cache, actor migration, arrival
    // coordinate, or materialization message is allowed to run.
    if (destinationDepth.dnum === oldDepth.dnum
        && destinationDepth.dlevel === oldDepth.dlevel) {
        game._pending_message = '';
        game._retained_message = '';
        game.context.move = 0;
        await docrt();
        await bot();
        return false;
    }
    // C do.c:goto_level() applies the quest-start admission gate after the
    // destination has been resolved but before savelev()/mklev().  Wizard
    // menu force_dest bypasses level_tele() validation, not this transition
    // guard.  A same-level menu choice has already returned above; an actual
    // same-dungeon transition without permission is rejected without
    // destination-generation RNG.
    if (onQuestStart(game)
        && destinationDepth.dnum === oldDepth.dnum
        && !okToQuest(game)) {
        game.context.move = 0;
        await pline('A mysterious force prevents you from descending.');
        return false;
    }

    if (preArrivalPager) await promptKey(preArrivalPager);

    await currentLuaLifecycle().runCallbacks(game, 'level_leave');

    if (arrival === 'falling') await impactDrop(null, game.u.ux, game.u.uy, {
        destinationLevel: destinationDepth.dlevel, publish: plineWithContinuation,
    });

    await checkSpecialRoom({ newLevel: true });

    // Travel coordinates belong to the level being left.
    game._travelTarget = null;
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const previousTemperature = oldLevel?.flags?.temperature || 0;
    // C do.c:goto_level() unplaces punishment before savelev(), retaining
    // object identity while removing both objects from the departing floor.
    // placebc() installs them on the destination after hero placement.
    if (heroIsPunished()) unplaceBallAndChain(game);
    clearHeroTrap(game);
    game.u.ustuck = null;
    game.u.uswallow = game.uswallow = 0;
    game.u.uswldtim = 0;
    game.u.uinwater = 0;
    game.u.uundetected = false;
    const followers = game.iflags.nofollowers ? [] : await collectLevelFollowers(game);
    if (game.program_state.gameover) return true;

    // Losing sight of this level can use display randomness while the hero
    // hallucinates. Do it before generating the destination.
    vision_recalc(2);

    if (leavingTutorial || (oldDepth.dnum !== destinationDepth.dnum
        && In_endgame(destinationDepth))) discardMigrations(game);
    else updateMonsterLastMove(game);
    if (!game._levelCache) game._levelCache = new Map();
    game._levelCache.set(
        levelCacheKey(oldDepth), cachedLevelState(oldLevel, oldStairs),
    );
    if (leavingTutorial) {
        for (const key of game._levelCache.keys()) {
            if (Number(key.split(':')[0]) === tutorialDnum) game._levelCache.delete(key);
        }
        const lifecycle = currentLuaLifecycle();
        const tutorialState = lifecycle.themed.get(tutorialDnum)?.state;
        lifecycle.themed.delete(tutorialDnum);
        await tutorialState?.destroy();
    }

    const cached = game._levelCache.get(levelCacheKey(destinationDepth));
    game.u.uz0 = oldDepth;
    game.u.uz = destinationDepth;
    game.u.utolev = { ...destinationDepth };
    game.u.utotype = 0;
    const dungeon = game.dungeons[destinationDepth.dnum];
    if (!dungeon)
        throw new Error(`Destination dungeon ${destinationDepth.dnum} is not in the dungeon graph`);
    const reached = dungeon.dunlev_ureached || 0;
    dungeon.dunlev_ureached = dungeonBuildsUp(destinationDepth) && reached
        ? Math.min(reached, destinationDepth.dlevel)
        : Math.max(reached, destinationDepth.dlevel);
    if (cached) {
        game.program_state.in_getlev = true;
        try {
            game.level = cached.level;
            game.stairs = cached.stairs;
            restoreCachedLevelMetadata(cached);
            await restoreCachedMonsterState(cached);
        } finally {
            game.program_state.in_getlev = false;
        }
        if (game.program_state.gameover) return true;
    } else {
        game._specialLevelPrototype = specialPrototypeAt(
            destinationDepth.dnum, destinationDepth.dlevel,
        );
        await mklev();
    }

    const beforeGlow = async () => {
        if (postMessage.slice(0, 15).toLowerCase() !== 'you materialize') return;
        const message = postMessage;
        postMessage = '';
        await plineWithContinuation(message);
    };
    const died = await arriveOnLevel(oldDepth, { arrival, ladder, followers, beforeGlow });
    if (died) return true;
    const newDepth = { ...game.u.uz };

    // Each level saves the hero's trail. Bones loading already restores it;
    // otherwise use the cached trail or start an empty one.
    if (!game._restoredBones) restoreCachedHeroTrack(cached);
    game._tutorialActive = Number.isInteger(tutorialDnum)
        && destinationDepth.dnum === tutorialDnum;
    game.context.move = 0;
    // Quest text preparation can run Lua, so finish it before a message
    // pauses for player input.
    const questArrival = prepareQuestArrival({
        fromDepth: oldDepth,
        firstVisit: !cached,
    });
    const questPortalCall = arrival === 'portal' ? null
        : prepareMainQuestPortalCall({ firstVisit: !cached });
    const oldDungeon = game.dungeons?.[oldDepth.dnum ?? 0];
    const newDungeon = game.dungeons?.[newDepth.dnum ?? 0];
    recordDungeonEntryAchievements(game, oldDepth, newDepth);
    const enteredValley = !oldDungeon?.flags?.hellish
        && !!newDungeon?.flags?.hellish
        && game.valley_level
        && newDepth.dnum === game.valley_level.dnum
        && newDepth.dlevel === game.valley_level.dlevel;
    if (game._restoredBones) {
        // do.c marks a loaded bones level as familiar.  tty can suspend the
        // deferred level-teleport message before familiar_level_msg() is
        // delivered, leaving the latter pending at the hero cursor for the
        // next input boundary.
        const familiarMessages = [
            'You have a sense of deja vu.',
            "You feel like you've been here before.",
            'This place looks familiar...',
            '',
        ];
        const familiarMessage = familiarMessages[rn2(4)];
        if (postMessage) {
            await plineWithContinuation(postMessage);
            await flushPendingTopline();
        }
        if (familiarMessage) await pline(familiarMessage);
        game._restoredBones = false;
    } else if (questArrival?.page || questArrival?.line) {
        if (postMessage) {
            await plineWithContinuation(postMessage);
            await flushPendingTopline();
        }
        await displayPreparedQuestArrival(questArrival);
        if (questArrival.page) {
            // A quest page replaces the earlier teleport message.
            game._pending_message = '';
            game._retained_message = '';
        }
    } else {
        if (questArrival) await displayPreparedQuestArrival(questArrival);
        if (postMessage) await plineWithContinuation(postMessage);
        // do.c:goto_level() announces a newly generated Rogue floor after
        // level-teleport feedback.  tty continuation therefore suspends on
        // the materialization line and exposes the classic Rogue map before
        // installing this second line.
        if (!cached && Is_rogue_level(newDepth)) {
            await plineWithContinuation(
                'You enter what seems to be an older, more primitive world.',
            );
        }
        const specialMessages = game._activeSpecialLevel?.specialMessages || [];
        if (specialMessages.length) {
            for (const line of specialMessages)
                await plineWithContinuation(line);
        }
        if (enteredValley) {
            // do.c:goto_level() announces the first crossing into Gehennom
            // after the destination redraw.  Ordinary topline continuation
            // owns the two acknowledgement boundaries between these lines.
            await plineWithContinuation(
                'You arrive at the Valley of the Dead...',
            );
            await plineWithContinuation(
                'The odor of burnt flesh and decay pervades the air.',
            );
            await plineWithContinuation(
                'You hear groans and moans everywhere.',
            );
        }
        if (questPortalCall) {
            for (const line of questPortalCall)
                await plineWithContinuation(line);
        }
    }
    const enteredEndgame = oldDepth.dnum !== newDepth.dnum
        && In_endgame(newDepth);
    if (enteredEndgame && game.u?.uhave?.amulet)
        await resurrectWizard();
    // Special levels can override their dungeon's temperature.
    const currentTemperature = game.level?.flags?.temperature || 0;
    if (currentTemperature !== previousTemperature) {
        if (currentTemperature) {
            await plineWithContinuation(
                `It is ${currentTemperature > 0 ? 'hot' : 'cold'} here.`,
            );
            if (newDungeon?.flags?.hellish && currentTemperature > 0)
                await plineWithContinuation(
                    `You ${heroHasOlfaction() ? 'smell' : 'sense'} smoke...`,
                );
        } else if (previousTemperature > 0) {
            await plineWithContinuation(
                `The heat${oldDungeon?.flags?.hellish
                    ? ' and smoke are' : ' is'} gone.`,
            );
        } else if (previousTemperature < 0) {
            await plineWithContinuation('You are out of the cold.');
        }
    }
    if (!cached) await creditTouristNewLevel();
    const levelAnnotation = game._levelAnnotations?.get?.(
        `${newDepth.dnum}:${newDepth.dlevel}`,
    );
    if (levelAnnotation) {
        await pline(`You remember this level as ${levelAnnotation}.`);
    }
    // The old-level exit cleared room membership before the map switch.
    await checkSpecialRoom();
    await deliverMigratingObjects(game, { nearHero: true, publish: plineWithContinuation });
    if (cached) await fixShopDamage(game);
    if (arrival === 'falling') {
        const distance = dungeonDepth(newDepth.dnum, newDepth.dlevel)
            - dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
        let damage = d(Math.max(distance, 1), 6);
        if (game.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
        if (await loseHeroHp(damage, 'falling down a mine shaft')) return true;
    }
    await autopickupAtHero();
    if (game.program_state?.gameover) return true;
    await bot();
    game.u.uz0 = { ...game.u.uz };
    return true;
}

async function arriveOnLevel(from: DungeonLocation, { arrival, ladder, followers, beforeGlow }: LevelArrivalOptions): Promise<boolean> {
    requirePlayingGame(game);
    const atStairs = arrival === 'stairs' || arrival === 'downstairs';
    const up = dungeonDepth(game.u.uz.dnum, game.u.uz.dlevel)
        < dungeonDepth(from.dnum, from.dlevel);
    vision_reset();
    game.vision_full_recalc = 0;
    await flush_screen(-1);
    try {
        if (atStairs && !In_endgame(game.u.uz)) {
            let stairs = game.stairs;
            while (stairs && (stairs.tolev?.dnum !== from.dnum
                || stairs.tolev?.dlevel !== from.dlevel
                || !!stairs.isladder !== ladder)) stairs = stairs.next;
            if (stairs) {
                game.u.ux0 = game.u.ux;
                game.u.uy0 = game.u.uy;
                game.u.ux = stairs.sx;
                game.u.uy = stairs.sy;
                stairs.u_traversed = true;
                await moveSteedWithHero();
            } else if (up) u_on_downstairs();
            else u_on_upstairs();
            if (await applyStairTravelEffects(up, ladder)) return true;
        } else if (arrival === 'portal' && !In_endgame(game.u.uz)) {
            const portal = game.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
            if (portal) {
                game.u.ux0 = game.u.ux;
                game.u.uy0 = game.u.uy;
                game.u.ux = portal.tx;
                game.u.uy = portal.ty;
                portal.tseen = true;
                await moveSteedWithHero();
            } else placeHeroAtRandomArrival(game.level.upTeleportRegion);
        } else {
            placeHeroAtRandomArrival(up
                ? game.level.upTeleportRegion : game.level.downTeleportRegion);
            if (arrival === 'falling') {
                if (heroIsPunished() && await fallWithIronBall()) return true;
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'Falling, you', publish: plineWithContinuation,
                });
                if (contact.died) return true;
            }
        }
        if (heroIsPunished()) await placeBallAndChain();
        await deliverMigratingObjects(game);
        await deliverMigratingMonsters(game, followers);
        if (game.program_state.gameover) return true;
        const removal = await killGenocidedMonsters();
        if (removal.heroDied) return true;
        await runDueTimers();
        if (game.program_state?.gameover) return true;
        resolveHeroArrivalCollision();
        if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz)) await moveElementalBubbles();
        else if (game.level.flags.fumaroles) fumaroles(game);
        vision_reset_new_level();
        await docrt({ beforeGlow });
        return false;
    } finally {
        if (game.program_state?.gameover) game._mapFlushPaused = false;
        else await flush_screen(-1);
    }
}

async function applyStairTravelEffects(up: boolean, ladder: boolean): Promise<boolean> {
    requirePlayingGame(game);
    const flying = game.u.flying || game.flying;
    const noun = ladder ? 'ladder' : 'stairs';
    const verbose = game.flags.verbose !== false;
    if (up) {
        const greatEffort = heroIsPunished() && !(game.u.levitating || game.levitating);
        if (verbose || greatEffort) await plineWithContinuation(
            `${greatEffort ? 'With great effort, you' : 'You'} `
            + `${flying ? 'fly' : 'climb'} up${flying && ladder ? ' along' : ''} the ${noun}.`,
        );
    } else if (game.u.dz) {
        if (flying) {
            if (verbose) await plineWithContinuation(
                `You fly down ${ladder ? 'along the ladder' : 'the stairs'}.`,
            );
        } else if (nearCapacity(game) > 0 || heroIsPunished()
            || game.u.fumbling || (game.u.fumblingTurns ?? 0) > 0) {
            await plineWithContinuation(`You fall down the ${noun}.`);
            if (heroIsPunished() && await dragBallDownStairs()) return true;
            if (game.u.usteed) {
                if ((await dismountHero(DISMOUNT_FELL)).died) return true;
            } else {
                let damage = rnd(3);
                if (game.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
                if (await loseHeroHp(damage, ladder
                    ? 'falling off a ladder' : 'tumbling down a flight of stairs')) return true;
            }
            const touch = await selfTouchPetrifyingWeapons({
                messageStart: 'Falling, you', publish: plineWithContinuation,
            });
            if (touch.died) return true;
        } else if (verbose) {
            await plineWithContinuation(ladder
                ? 'You climb down the ladder.' : 'You descend the stairs.');
        }
    }
    return false;
}

function levelCacheKey(depth: DungeonLocation): string {
    return `${depth?.dnum ?? 0}:${depth?.dlevel ?? 1}`;
}

// C do.c:goto_level() awards this after arrival/temperature messages and
// before annotations and room entry. Cached levels do not earn it again.
async function creditTouristNewLevel(): Promise<void> {
    if (game.urole?.key !== 'tourist') return;
    addExperience(level_difficulty(), 0);
    await checkExperienceLevel();
}

function cloneHeroTrack(track: readonly Position[] | undefined = game._heroTrack): Position[] {
    return (track || []).map(point => ({ x: point.x, y: point.y }));
}

function cachedLevelState(level: GameMap, stairs: Stairway | null): CachedLevelState {
    return {
        level,
        stairs,
        heroTrack: cloneHeroTrack(),
        savedAt: game.moves ?? 0,
        // Is_special() is level data in C. JS keeps the parsed Lua identity
        // beside the map, so it must travel with the cached level rather than
        // remain whichever descriptor was generated most recently.
        activeSpecialLevel: game._activeSpecialLevel || null,
    };
}

function restoreCachedHeroTrack(cached: CachedLevelState | undefined): void {
    game._heroTrack = cloneHeroTrack(cached?.heroTrack || []);
}

const M1_CONCEAL = 0x00000080;

// C getlev() restores each resident before separately arriving monsters.
async function restoreCachedMonsterState(cached: CachedLevelState): Promise<void> {
    const elapsed = game.moves - cached.savedAt;
    restoreMonsterWormHeads(cached.level);
    // Births append in the port, whereas C prepends to fmon.
    for (const monster of cached.level.monsters.slice().reverse()) {
        setShopResidency(monster, false, game);
        if (monster !== game.u.usteed && monster.mundetected
            && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL)) {
            await hideMonsterUnder(monster, game);
        }
        if (elapsed > 0) catchUpMonster(monster, elapsed, game);
        await restoreMonsterShape(monster, game);
        if (game.program_state.gameover) return;
        if (elapsed > 0 && elapsed > rnd(10))
            await hideMonsterOnRestore(monster, game);
    }
}

function restoreCachedLevelMetadata(cached: CachedLevelState): void {
    game._activeSpecialLevel = cached?.activeSpecialLevel || null;
}

function randomArrivalCellOk(x: number, y: number): boolean {
    const level = requireGameLevel();
    const loc = level?.at?.(x, y);
    if (!loc) return false;
    const openTerrain = loc.typ === ROOM || IS_AIR(loc.typ)
        || (loc.typ === CORR && level.flags?.is_maze_lev);
    if (!openTerrain || IS_FURNITURE(loc.typ)
        || IS_POOL(loc.typ) || IS_LAVA(loc.typ)) return false;
    if (level.traps?.some(trap => trap.tx === x && trap.ty === y)) return false;
    return !level.monsters?.some(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === x && monster.my === y);
}

// C refs: dungeon.c u_on_rndspot(), mkmaze.c place_lregion().  Ordinary
// numeric level teleport uses the whole map; a special level can replace it
// with the direction-specific updest/dndest saved by fixup_special().
export function placeHeroAtRandomArrival(region: ArrivalRegion | null | undefined = null): Position | null {
    const lx = Math.max(1, region?.lx ?? 1);
    const hx = Math.min(COLNO - 1, region?.hx ?? COLNO - 1);
    const ly = Math.max(0, region?.ly ?? 0);
    const hy = Math.min(ROWNO - 1, region?.hy ?? ROWNO - 1);
    const excluded = (x: number, y: number) => region?.exclude
        && x >= region.exclude.lx && x <= region.exclude.hx
        && y >= region.exclude.ly && y <= region.exclude.hy;
    let x = lx, y = ly;
    for (let attempt = 0; attempt < 200; attempt++) {
        x = rn2(hx - lx + 1) + lx;
        y = rn2(hy - ly + 1) + ly;
        if (excluded(x, y) || !randomArrivalCellOk(x, y)) continue;
        game.u.ux = game.u.ux0 = x;
        game.u.uy = game.u.uy0 = y;
        return { x, y };
    }
    for (x = lx; x <= hx; x++) {
        for (y = ly; y <= hy; y++) {
            if (excluded(x, y) || !randomArrivalCellOk(x, y)) continue;
            game.u.ux = game.u.ux0 = x;
            game.u.uy = game.u.uy0 = y;
            return { x, y };
        }
    }
    return null;
}

function shuffledArrivalCoords(cx: number, cy: number, maxRadius = 3): Position[] {
    const output: Position[] = [];
    for (let radius = 1; radius <= maxRadius; radius++) {
        const ring: Position[] = [];
        const lowX = cx - radius, highX = cx + radius;
        const lowY = cy - radius, highY = cy + radius;
        for (let y = Math.max(lowY, 0); y <= highY && y < ROWNO; y++) {
            for (let x = Math.max(lowX, 1); x <= highX && x < COLNO; x++) {
                if (x !== lowX && x !== highX && y !== lowY && y !== highY)
                    continue;
                ring.push({ x, y });
            }
        }
        for (let i = 0, remaining = ring.length; remaining > 1;
            i++, remaining--) {
            const offset = rn2(remaining);
            if (offset) {
                const current = ring[i];
                const selected = ring[i + offset];
                if (!current || !selected)
                    throw new Error('Arrival coordinate shuffle selected a missing position');
                ring[i] = selected;
                ring[i + offset] = current;
            }
        }
        output.push(...ring);
    }
    return output;
}

function followerArrivalCellOk(follower: Monster, x: number, y: number): boolean {
    const level = requireGameLevel();
    const loc = level.at(x, y);
    if (!loc || blocksMove(x, y) || IS_POOL(loc.typ) || IS_LAVA(loc.typ))
        return false;
    return !level.monsters.some(monster => monsterHasMapPosition(monster, game) && monster !== follower
        && !monster.dead && monster.mx === x && monster.my === y);
}

function heroArrivalCellOk(x: number, y: number): boolean {
    const level = requireGameLevel();
    const loc = level.at(x, y);
    if (!loc || blocksMove(x, y) || IS_POOL(loc.typ) || IS_LAVA(loc.typ))
        return false;
    return !level.monsters.some(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === x && monster.my === y);
}

// C ref: do.c u_collide_m().  mon_arrive(With_you) can deliberately place a
// follower on the hero's intended stair.  goto_level() resolves that overlap
// only after all followers and delivered objects are live.  enexto() collects
// and shuffles all three rings before next2u() accepts an adjacent hero spot.
function resolveHeroArrivalCollision(): void {
    const collision = game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u?.ux && monster.my === game.u?.uy);
    if (!collision) return;

    if (!rn2(2)) {
        const destination = collectNearbyCoords(game.u.ux, game.u.uy, 3)
            .find(({ x, y }) => heroArrivalCellOk(x, y));
        if (destination
            && Math.abs(destination.x - game.u.ux) <= 1
            && Math.abs(destination.y - game.u.uy) <= 1) {
            game.u.ux0 = game.u.ux;
            game.u.uy0 = game.u.uy;
            game.u.ux = destination.x;
            game.u.uy = destination.y;
            return;
        }
    }

    const destination = shuffledArrivalCoords(game.u.ux, game.u.uy)
        .find(({ x, y }) => followerArrivalCellOk(collision, x, y));
    if (destination) {
        collision.mx = destination.x;
        collision.my = destination.y;
    }
}
