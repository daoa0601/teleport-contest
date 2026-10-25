import { setHeroGrip } from './hero_grip.js';
import { heroLocomotion } from './hero_locomotion.js';
import { seeTrap } from './trap.js';
import { deleteTrap } from './trap_lifecycle.js';
import { maybeResetPick } from './lock_context.js';
// C do.c:goto_level(): departure, destination creation or restoration, and arrival.

import { rewindEngravingsForSave, restoreEngravings } from './engrave.js';
import { monsterHasMapPosition } from './monster_location.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { autopickupAtHero } from './pickup.js';
import { runDueTimers } from './timer_effects.js';
import { loseHeroHp } from './hero_damage.js';
import { finishLivingGame } from './end.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import {
    flushPendingTopline, flush_screen, pline, plineWithContinuation, docrt, bot, newsym,
} from './display.js';
import { vision_recalc, vision_reset, vision_reset_new_level } from './vision.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import { gainGuardianAngel } from './guardian_angel.js';
import { createPlayerMonsters } from './mplayer.js';
import { monsterAlignmentType, setMonsterMalign } from './monster_alignment.js';
import { deliverMigratingObjects, impactDrop } from './object_migration.js';
import {
    deliverMigratingMonsters, discardMigrations, updateMonsterLastMove,
    catchUpMonster, setShopResidency, sendMonsterToLimbo,
} from './monster_migration.js';
import { collectLevelFollowers } from './monster_followers.js';
import { hideMonsterUnder, hideMonsterOnRestore } from './monster_hiding.js';
import { restoreMonsterShape } from './monster_polymorph.js';
import { restoreMonsterWormHeads } from './monster_worm.js';
import { restoreLevelRegions, updateHeroRegions } from './regions.js';
import { mklev, oinit, place_lregion, u_on_downstairs, u_on_sstairs, u_on_upstairs } from './mklev.js';
import { dungeonBuildsUp, level_difficulty, specialPrototypeAt,
    recordMappedOverviewState, recordOverviewBranch, markOverviewUnreachable,
    insideWizardTower, levelIsWizardTower, wizardTowerLevelAt } from './dungeon.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { moveMonsterNextToHero, randomMonsterRelocation, teleportHeroSafely, bringLeashedFollowers } from './teleport.js';
import { placeHeroOnLevel } from './hero_location.js';
import { switchHeroTerrain } from './terrain_movement.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { monsterDeathCount } from './monster_vitals.js';
import { killGenocidedMonsters } from './mon.js';
import { dismountHero } from './steed.js';
import { clearHeroTrap } from './hero_traps.js';
import { resetTrapSetting } from './trap_setting.js';
import { dungeonDepth } from './hacklib.js';
import { nearCapacity } from './weight.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import {
    dragBallDownStairs, fallWithIronBall, heroIsPunished, placeBallAndChain,
    unplaceBallAndChain,
} from './ball.js';
import { recordAchievement, recordDungeonEntryAchievements } from './achievements.js';
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
    CORR, ROOM, DISMOUNT_FELL, LR_UPTELE, LR_DOWNTELE, RLOC_NOMSG,
    MAGIC_PORTAL, In_endgame, Is_airlevel, Is_waterlevel, Is_astralevel, ACH_ENDG, ACH_ASTR,
    Is_rogue_level, Is_knox_level, UTOTYPE_DEFERRED, UTOTYPE_ATSTAIRS,
    UTOTYPE_FALLING, UTOTYPE_PORTAL, UTOTYPE_RMPORTAL, TT_BURIEDBALL,
} from './const.js';
import { buriedBallToPunishment } from './buried_object.js';
import { resurrectWizard } from './wizard.js';
import { forgetTempleEntry } from './priest.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import type { GameMap } from './game.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { ArrivalRegion, CachedLevelState, Position, Stairway } from './map_types.js';

export type LevelArrival = 'random' | 'stairs' | 'downstairs' | 'portal' | 'falling';

export interface LevelChangeOptions {
    arrival?: LevelArrival;
    ladder?: boolean;
    postMessage?: string;
}

export interface ScheduledLevelChange {
    args: Parameters<typeof gotoLevel>;
    changeLevel: typeof gotoLevel;
    preMessage: string;
}

// C do.c:schedule_goto(). The current command or monster finishes using
// the departure level; utotype stops the next monster from moving.
export function scheduleLevelChange(
    args: Parameters<typeof gotoLevel>, changeLevel = gotoLevel, preMessage = '',
): void {
    requirePlayingGame(game);
    game._scheduledLevelChange = { args, changeLevel, preMessage };
    game.u.utolev = { ...game.u.uz, ...args[0] };
    const arrival = args[1]?.arrival;
    game.u.utotype = UTOTYPE_DEFERRED
        | (arrival === 'stairs' || arrival === 'downstairs' ? UTOTYPE_ATSTAIRS : 0)
        | (arrival === 'falling' ? UTOTYPE_FALLING : 0)
        | (arrival === 'portal' ? UTOTYPE_PORTAL : 0);
}

// C saves u.utolev/utotype, but neither callback pointers nor deferred
// messages. Rebuild the pending arrival so the normal turn loop completes it.
export function restoreScheduledLevelChange(): void {
    delete game._scheduledLevelChange;
    const destination = game.u.utolev;
    const type = game.u.utotype ?? 0;
    if (!(type & UTOTYPE_DEFERRED) || !destination) return;
    game._scheduledLevelChange = {
        args: [{ ...destination }, { arrival: restoredLevelArrival(type) }],
        changeLevel: gotoLevel,
        preMessage: '',
    };
}

export async function finishScheduledLevelChange(): Promise<void> {
    const travel = game._scheduledLevelChange;
    if (!travel) return;
    requirePlayingGame(game);
    const destination = game.u.utolev;
    if (!destination) throw new Error('Scheduled level travel has no destination');
    const removePortal = !!((game.u.utotype ?? 0) & UTOTYPE_RMPORTAL);
    delete game._scheduledLevelChange;
    // C do.c:deferred_goto() preserves the topline when travel stays here.
    if (game.u.uz.dnum !== destination.dnum
        || game.u.uz.dlevel !== destination.dlevel) {
        if (travel.preMessage) await plineWithContinuation(travel.preMessage);
        await travel.changeLevel(...travel.args);
        if (removePortal) {
            const portal = game.level.traps.find(trap =>
                trap.tx === game.u.ux && trap.ty === game.u.uy);
            if (portal) {
                deleteTrap(portal, game);
                newsym(game.u.ux, game.u.uy);
            }
        }
    }
    game.u.utotype = 0;
}

function restoredLevelArrival(type: number): LevelArrival {
    if (type & UTOTYPE_PORTAL) return 'portal';
    if (type & UTOTYPE_FALLING) return 'falling';
    return type & UTOTYPE_ATSTAIRS ? 'stairs' : 'random';
}

interface LevelArrivalOptions {
    arrival: LevelArrival;
    ladder: boolean;
    followers: Monster[];
    beforeGlow: () => Promise<void>;
    wasInsideWizardTower: boolean;
    // C goto_level() computes 'up' from the requested destination before the
    // Amulet's mysterious force can redirect the hero deeper; u_on_rndspot()
    // still sees the stale upward flag.
    rndspotUp: boolean;
}

export async function gotoLevel(targetDepth: Partial<DungeonLocation>, {
    arrival = 'random',
    ladder = false,
    postMessage = '',
}: LevelChangeOptions = {}): Promise<boolean> {
    requirePlayingGame(game);
    const oldDepth = { ...game.u.uz };
    const wasInsideWizardTower = insideWizardTower(game.u.ux, game.u.uy);
    const destinationDepth = { ...oldDepth, ...targetDepth };
    // C do.c:1489: 'up' compares the requested destination before the
    // Amulet's mysterious force can redirect it deeper.
    const climbingUp = dungeonDepth(destinationDepth.dnum, destinationDepth.dlevel)
        < dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
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
        await docrt();
        await bot();
        return false;
    }
    // C do.c:1541-1573: with the Amulet, a Gehennom ascent can be pushed
    // back down by a mysterious force.  The chance drops as it kicks in
    // (context.mysteryforce), and the bias runs from chaotic (mildest) to
    // lawful (harshest).  A hero inside the Wizard's tower stays inside it.
    // The redirected arrival is a random spot, not stairs, and keeps the
    // original up-arrival flag for u_on_rndspot().
    const departingDungeon = game.dungeons[oldDepth.dnum];
    if (departingDungeon?.flags?.hellish
        && climbingUp && game.u.uhave?.amulet
        && destinationDepth.dnum === oldDepth.dnum
        && arrival !== 'portal'
        && oldDepth.dlevel < departingDungeon.num_dunlevs - 3
        && rn2(4 + (game.context.mysteryforce ?? 0)) === 0) {
        const odds = 3 + game.u.ualign.type; /* 2..4 */
        let diff = odds <= 1 ? 0 : rn2(odds);
        if (diff !== 0) {
            // C assign_rnd_level(): one level below plus rnd(diff), clamped
            // to the dungeon's bounds.
            destinationDepth.dlevel = Math.max(1,
                Math.min(departingDungeon.num_dunlevs, oldDepth.dlevel + rnd(diff)));
            diff = destinationDepth.dlevel - oldDepth.dlevel;
            if (wasInsideWizardTower
                && !wizardTowerLevelAt(destinationDepth.dnum, destinationDepth.dlevel))
                diff = 0;
        }
        if (diff === 0) destinationDepth.dlevel = oldDepth.dlevel;
        await pline('A mysterious force momentarily surrounds you...');
        game.context.mysteryforce = (game.context.mysteryforce ?? 0) + rn2(diff + 2);
        if (destinationDepth.dlevel === oldDepth.dlevel) {
            await teleportHeroSafely();
            await bringLeashedFollowers(game);
            return true;
        }
        arrival = 'random';
        ladder = false;
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
        await pline('A mysterious force prevents you from descending.');
        return false;
    }

    await currentLuaLifecycle().runCallbacks(game, 'level_leave');
    // C do.c:1594: a buried-ball tether converts back to ordinary
    // punishment before the departing level is saved and left behind.
    if (game.u.utrap && game.u.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(game);
    resetTrapSetting();
    maybeResetPick(null);

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
    if (heroIsPunished()) await unplaceBallAndChain(game);
    clearHeroTrap(game);
    setHeroGrip(null);
    game.u.uinwater = 0;
    game.u.uundetected = false;
    const followers = game.iflags.nofollowers ? [] : await collectLevelFollowers(game);
    if (game.program_state.gameover) return true;
    recordMappedOverviewState();

    // Losing sight of this level can use display randomness while the hero
    // hallucinates. Do it before generating the destination.
    vision_recalc(2);

    if (leavingTutorial || (oldDepth.dnum !== destinationDepth.dnum
        && In_endgame(destinationDepth))) discardMigrations(game);
    else updateMonsterLastMove(game);
    if (!game._levelCache) game._levelCache = new Map();
    rewindEngravingsForSave(oldLevel);
    for (const monster of oldLevel.monsters)
        if (monster.ispriest) forgetTempleEntry(monster);
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

    if (leavingTutorial) markOverviewUnreachable(oldDepth.dnum);
    else if (oldDepth.dnum !== destinationDepth.dnum && In_endgame(destinationDepth)) {
        for (let dnum = 0; dnum < game.dungeons.length; dnum++) markOverviewUnreachable(dnum);
    }
    if (arrival === 'stairs' || arrival === 'downstairs' || arrival === 'portal' || arrival === 'falling')
        recordOverviewBranch(oldDepth, destinationDepth);

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
            restoreEngravings(cached.level);
            game.stairs = cached.stairs;
            restoreCachedLevelMetadata(cached);
            await restoreCachedMonsterState(cached);
            restoreLevelRegions(game, game.moves - cached.savedAt);
        } finally {
            game.program_state.in_getlev = false;
        }
        if (game.program_state.gameover) return true;
        oinit();
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
    const died = await arriveOnLevel(oldDepth, { arrival, ladder, followers, beforeGlow, wasInsideWizardTower, rndspotUp: climbingUp });
    if (died) return true;
    const newDepth = { ...game.u.uz };

    // Each level saves the hero's trail. Bones loading already restores it;
    // otherwise use the cached trail or start an empty one.
    if (!game._restoredBones) restoreCachedHeroTrack(cached);
    game._tutorialActive = Number.isInteger(tutorialDnum)
        && destinationDepth.dnum === tutorialDnum;
    const oldDungeon = game.dungeons?.[oldDepth.dnum ?? 0];
    const newDungeon = game.dungeons?.[newDepth.dnum ?? 0];
    recordDungeonEntryAchievements(game, oldDepth, newDepth);
    const enteredValley = !oldDungeon?.flags?.hellish
        && !!newDungeon?.flags?.hellish
        && game.valley_level
        && newDepth.dnum === game.valley_level.dnum
        && newDepth.dlevel === game.valley_level.dlevel;
    // A bones level runs the same arrival block as any other level:
    // do.c:goto_level() delivers the special-level message and the
    // Valley lines (do.c:1856-1872) before familiar_level_msg()
    // (do.c:1875) and the remaining branch messages.  The special-level
    // message never applies here: gl.lev_message is transient, so C has
    // none on a level reloaded from bones.
    const bonesArrival = game._restoredBones;
    if (bonesArrival) {
        // maybe_lvltport_feedback() (do.c:1854) delivers only the
        // "You materialize" line this early, unless a glowing Sting
        // already did during docrt().  Any other deferred message waits
        // until goto_level() has returned (deferred_goto(),
        // do.c:2085-2096), after every arrival line below.
        await beforeGlow();
        if (enteredValley) {
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
        let familiarMessage = '';
        // bones_include_name() matches through the hero name's trailing hyphen.
        if (game.level.bonesNames?.some(name => name.startsWith(`${game.plname}-`))) {
            const perception = heroIsBlind(game) ? 'seems' : 'looks';
            const familiarMessages = heroIsHallucinating(game) ? [
                `Whoa!  Everything ${perception} different.`,
                'You are surrounded by twisty little passages, all alike.',
                `Gee, this ${perception} like uncle Conan's place...`,
                '',
            ] : [
                'You have a sense of deja vu.',
                "You feel like you've been here before.",
                `This place ${perception} familiar...`,
                '',
            ];
            familiarMessage = familiarMessages[rn2(4)] ?? '';
        }
        if (familiarMessage) await pline(familiarMessage);
        game._restoredBones = false;
    }
    // do.c:goto_level() runs familiar_level_msg() (whose deja-vu choice is
    // the first random call of the arrival) before onquest() and the quest
    // leader's summons, so their quest.lua loads stay behind it.  Quest
    // text preparation can run Lua, so finish it before a message pauses
    // for player input.
    const questArrival = await prepareQuestArrival({
        fromDepth: oldDepth,
    });
    // do.c suppresses the summons when the previous level was inside the
    // Quest (In_quest(&u.uz0)); the wizard forced-destination teleport
    // can leave the Quest without the portal.  Every other arrival
    // delivers it, cached level or not.
    const questPortalCall = await prepareMainQuestPortalCall({
        fromDepth: oldDepth,
    });
    if (questArrival?.page || questArrival?.line) {
        if (!bonesArrival && postMessage) {
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
        if (!bonesArrival && postMessage) await plineWithContinuation(postMessage);
        // do.c:goto_level() announces a newly generated Rogue floor after
        // level-teleport feedback.  tty continuation therefore suspends on
        // the materialization line and exposes the classic Rogue map before
        // installing this second line.
        if (!cached && Is_rogue_level(newDepth)) {
            await plineWithContinuation(
                'You enter what seems to be an older, more primitive world.',
            );
        }
        const specialMessages = bonesArrival
            ? []
            : game._activeSpecialLevel?.specialMessages || [];
        if (specialMessages.length) {
            for (const line of specialMessages)
                await plineWithContinuation(line);
        }
        if (!bonesArrival && enteredValley) {
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
        if (Is_knox_level(newDepth)
            && (!cached || !monsterDeathCount(MONSTER_NAME.indexOf('Croesus')))) {
            await plineWithContinuation('You have penetrated a high security area!');
            await plineWithContinuation('An alarm sounds!');
            for (const monster of game.level.monsters)
                if (!monster.dead && monster.mhp > 0) monster.msleeping = 0;
        }
        if (questPortalCall) {
            for (const line of questPortalCall)
                await plineWithContinuation(line);
        }
    }
    const enteredEndgame = oldDepth.dnum !== newDepth.dnum
        && In_endgame(newDepth);
    if (enteredEndgame) recordAchievement(game, ACH_ENDG);
    if (!cached && Is_astralevel(newDepth)) {
        await finishAstralArrival();
        recordAchievement(game, ACH_ASTR);
    } else if (enteredEndgame && game.u?.uhave?.amulet)
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
    if (game.flags.checkpoint ?? true) rewindEngravingsForSave(game.level);
    const levelAnnotation = game._levelAnnotations?.get?.(
        `${newDepth.dnum}:${newDepth.dlevel}`,
    );
    if (levelAnnotation) {
        await pline(`You remember this level as ${levelAnnotation}.`);
    }
    // The old-level exit cleared room membership before the map switch.
    await checkSpecialRoom();
    // C's late obj_delivery(TRUE) handles every object not traveling with
    // the hero (its !near_hero ^ MIGR_WITH_HERO test is inverted).
    await deliverMigratingObjects(game);
    updateHeroRegions(game);
    if (cached) await fixShopDamage(game);
    if (arrival === 'falling') {
        const distance = dungeonDepth(newDepth.dnum, newDepth.dlevel)
            - dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
        let damage = d(Math.max(distance, 1), 6);
        if (game.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
        if (await loseHeroHp(damage, 'falling down a mine shaft', {
            deathCause: 'killed by falling down a mine shaft',
        })) return true;
    }
    await autopickupAtHero();
    // deferred_goto() prints a deferred message that is not the
    // materialization line only after goto_level() has finished
    // (do.c:2096); bones arrivals hold it until here.
    if (bonesArrival && postMessage) {
        await plineWithContinuation(postMessage);
        postMessage = '';
    }
    if (game.program_state?.gameover) return true;
    game.u.uz0 = { ...game.u.uz };
    return true;
}

// C do.c:final_level() and priest.c:reset_hostility().
async function finishAstralArrival(): Promise<void> {
    requirePlayingGame(game);
    for (const monster of game.level.monsters.slice().reverse()) {
        if (!monster.isminion || !['Angel', 'aligned cleric'].includes(MONSTER_NAME[monster.mnum] ?? ''))
            continue;
        if (monsterAlignmentType(monster) !== game.u.ualign.type) {
            monster.mpeaceful = monster.mtame = 0;
            setMonsterMalign(monster);
        }
        newsym(monster.mx, monster.my);
    }
    await createPlayerMonsters(rn1(4, 3), true);
    await gainGuardianAngel(game);
}

async function arriveOnLevel(from: DungeonLocation, { arrival, ladder, followers, beforeGlow, wasInsideWizardTower, rndspotUp }: LevelArrivalOptions): Promise<boolean> {
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
                await placeHeroOnLevel(stairs.sx, stairs.sy);
                stairs.u_traversed = true;
            } else {
                // C do.c:goto_level(): without the return stairway, a
                // branch arrival goes straight to the special staircase
                // instead of any regular stairway in the travel direction.
                const newdungeon = game.u.uz.dnum !== from.dnum;
                if (up) {
                    if (newdungeon) await u_on_sstairs(1);
                    else await u_on_downstairs();
                } else {
                    if (newdungeon) await u_on_sstairs(0);
                    else await u_on_upstairs();
                }
            }
            if (await applyStairTravelEffects(up, ladder)) return true;
        } else if (arrival === 'portal' && !In_endgame(game.u.uz)) {
            const portal = game.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
            if (portal) {
                seeTrap(portal);
                await placeHeroOnLevel(portal.tx, portal.ty);
            } else await placeHeroAtRandomArrival(game.level.downTeleportRegion);
        } else {
            if (wasInsideWizardTower && levelIsWizardTower())
                await placeHeroAtRandomArrival(game._activeSpecialLevel?.downTeleportExclude);
            else await placeHeroAtRandomArrival(rndspotUp
                ? game.level.upTeleportRegion : game.level.downTeleportRegion, rndspotUp);
            if (arrival === 'falling') {
                if (heroIsPunished() && await fallWithIronBall()) return true;
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'Falling, you', publish: plineWithContinuation,
                });
                if (contact.died) return true;
            }
        }
        if (heroIsPunished()) await placeBallAndChain();
        // C's early obj_delivery(FALSE) lands trap-door objects that fell
        // with the hero before followers and migrating monsters arrive.
        await deliverMigratingObjects(game, { nearHero: true, publish: plineWithContinuation });
        await deliverMigratingMonsters(game, followers);
        if (game.program_state.gameover) return true;
        const removal = await killGenocidedMonsters();
        if (removal.heroDied) return true;
        await runDueTimers();
        if (game.program_state?.gameover) return true;
        await resolveHeroArrivalCollision();
        if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz)) await moveElementalBubbles();
        else if (game.level.flags.fumaroles) await fumaroles(game);
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
            + `${heroLocomotion('climb')} up${flying && ladder ? ' along' : ''} the ${noun}.`,
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
                const killer = ladder
                    ? 'falling off a ladder' : 'tumbling down a flight of stairs';
                if (await loseHeroHp(damage, killer, { deathCause: `killed by ${killer}` })) return true;
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
    purgeDeadMonsters(level);
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

// C dungeon.c:u_on_rndspot() delegates arrival to the shared lregion owner.
export async function placeHeroAtRandomArrival(
    region: ArrivalRegion | null | undefined = null, up = false,
): Promise<Position> {
    const area = region ?? { lx: 0, ly: 0, hx: 0, hy: 0 };
    const excluded = region?.exclude ?? { lx: -1, ly: -1, hx: -1, hy: -1 };
    await place_lregion(area.lx, area.ly, area.hx, area.hy,
        excluded.lx, excluded.ly, excluded.hx, excluded.hy,
        up ? LR_UPTELE : LR_DOWNTELE, null);
    await switchHeroTerrain();
    return { x: game.u.ux, y: game.u.uy };
}

// C do.c:u_collide_m(). A level arrival may overlap a resident or follower.
// Move the hero to an adjacent legal square, or let the monster's own
// placement rules choose its destination, including flight over liquids.
export async function resolveHeroArrivalCollision(): Promise<void> {
    const level = requireGameLevel();
    const collision = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!collision) return;

    let movedHero = false;
    if (!rn2(2)) {
        const destination = findNearbyMonsterPosition(game.u.umonnum, game.u.ux, game.u.uy);
        if (destination && Math.abs(destination.x - game.u.ux) <= 1
            && Math.abs(destination.y - game.u.uy) <= 1) {
            await placeHeroOnLevel(destination.x, destination.y);
            movedHero = true;
        }
    }
    if (!movedHero) await moveMonsterNextToHero(collision, game, { flags: RLOC_NOMSG });

    const remaining = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!remaining) return;
    if (game.flags.debug) await plineWithContinuation("(monster in hero's way)");
    const relocated = await randomMonsterRelocation(remaining, { flags: RLOC_NOMSG });
    const obstruction = level.monsters.find(monster => monsterHasMapPosition(monster, game)
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!relocated) await sendMonsterToLimbo(remaining);
    else if (obstruction) await sendMonsterToLimbo(obstruction);
}
