// C do.c:goto_level(): departure, destination creation or restoration, and arrival.
import { rewindEngravingsForSave, restoreEngravingPointers } from './engrave.js';
import { monsterHasMapPosition } from './monster_location.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { autopickupAtHero } from './pickup.js';
import { runDueTimers } from './timer_effects.js';
import { loseHeroHp } from './hero_damage.js';
import { finishLivingGame } from './end.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { flushPendingTopline, flush_screen, pline, plineWithContinuation, docrt, bot, } from './display.js';
import { vision_recalc, vision_reset, vision_reset_new_level } from './vision.js';
import { d, rnd, rn2 } from './rng.js';
import { deliverMigratingObjects, impactDrop } from './object_migration.js';
import { deliverMigratingMonsters, discardMigrations, updateMonsterLastMove, catchUpMonster, setShopResidency, sendMonsterToLimbo, } from './monster_migration.js';
import { collectLevelFollowers } from './monster_followers.js';
import { hideMonsterUnder, hideMonsterOnRestore } from './monster_hiding.js';
import { restoreMonsterShape } from './monster_polymorph.js';
import { restoreMonsterWormHeads } from './monster_worm.js';
import { mklev, place_lregion, u_on_downstairs, u_on_upstairs } from './mklev.js';
import { dungeonBuildsUp, level_difficulty, specialPrototypeAt } from './dungeon.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { moveMonsterNextToHero, randomMonsterRelocation } from './teleport.js';
import { placeHeroOnLevel } from './hero_location.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { killGenocidedMonsters } from './mon.js';
import { dismountHero, moveSteedWithHero } from './steed.js';
import { clearHeroTrap } from './hero_traps.js';
import { resetTrapSetting } from './trap_setting.js';
import { dungeonDepth } from './hacklib.js';
import { nearCapacity } from './weight.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { dragBallDownStairs, fallWithIronBall, heroIsPunished, placeBallAndChain, unplaceBallAndChain, } from './ball.js';
import { recordDungeonEntryAchievements } from './achievements.js';
import { heroHasOlfaction } from './polyself.js';
import { checkSpecialRoom } from './shk.js';
import { fixShopDamage } from './shop_damage.js';
import { displayPreparedQuestArrival, prepareQuestArrival, prepareMainQuestPortalCall, onQuestStart, okToQuest, } from './quest.js';
import { fumaroles } from './monmove.js';
import { moveElementalBubbles } from './elemental.js';
import { CORR, ROOM, DISMOUNT_FELL, LR_UPTELE, LR_DOWNTELE, RLOC_NOMSG, MAGIC_PORTAL, In_endgame, Is_airlevel, Is_waterlevel, Is_rogue_level, UTOTYPE_DEFERRED, } from './const.js';
import { resurrectWizard } from './wizard.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
// C do.c:schedule_goto(). The current command or monster finishes using
// the departure level; utotype stops the next monster from moving.
export function scheduleLevelChange(args, changeLevel = gotoLevel, preMessage = '') {
    requirePlayingGame(game);
    game._scheduledLevelChange = { args, changeLevel, preMessage };
    game.u.utolev = { ...game.u.uz, ...args[0] };
    game.u.utotype = UTOTYPE_DEFERRED;
}
export async function finishScheduledLevelChange() {
    const travel = game._scheduledLevelChange;
    if (!travel)
        return;
    requirePlayingGame(game);
    const destination = game.u.utolev;
    if (!destination)
        throw new Error('Scheduled level travel has no destination');
    delete game._scheduledLevelChange;
    // C do.c:deferred_goto() preserves the topline when travel stays here.
    if (game.u.uz.dnum !== destination.dnum
        || game.u.uz.dlevel !== destination.dlevel) {
        if (travel.preMessage)
            await plineWithContinuation(travel.preMessage);
        await travel.changeLevel(...travel.args);
    }
    game.u.utotype = 0;
}
export async function gotoLevel(targetDepth, { arrival = 'random', ladder = false, postMessage = '', } = {}) {
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
        await pline('A mysterious force prevents you from descending.');
        return false;
    }
    await currentLuaLifecycle().runCallbacks(game, 'level_leave');
    resetTrapSetting();
    if (arrival === 'falling')
        await impactDrop(null, game.u.ux, game.u.uy, {
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
    if (heroIsPunished())
        unplaceBallAndChain(game);
    clearHeroTrap(game);
    game.u.ustuck = null;
    // goto_level() calls set_ustuck(NULL), which requests a status update.
    game.context.botl = true;
    game.u.uswallow = game.uswallow = 0;
    game.u.uswldtim = 0;
    game.u.uinwater = 0;
    game.u.uundetected = false;
    const followers = game.iflags.nofollowers ? [] : await collectLevelFollowers(game);
    if (game.program_state.gameover)
        return true;
    // Losing sight of this level can use display randomness while the hero
    // hallucinates. Do it before generating the destination.
    vision_recalc(2);
    if (leavingTutorial || (oldDepth.dnum !== destinationDepth.dnum
        && In_endgame(destinationDepth)))
        discardMigrations(game);
    else
        updateMonsterLastMove(game);
    if (!game._levelCache)
        game._levelCache = new Map();
    rewindEngravingsForSave(oldLevel);
    game._levelCache.set(levelCacheKey(oldDepth), cachedLevelState(oldLevel, oldStairs));
    if (leavingTutorial) {
        for (const key of game._levelCache.keys()) {
            if (Number(key.split(':')[0]) === tutorialDnum)
                game._levelCache.delete(key);
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
            restoreEngravingPointers(cached.level);
            game.stairs = cached.stairs;
            restoreCachedLevelMetadata(cached);
            await restoreCachedMonsterState(cached);
        }
        finally {
            game.program_state.in_getlev = false;
        }
        if (game.program_state.gameover)
            return true;
    }
    else {
        game._specialLevelPrototype = specialPrototypeAt(destinationDepth.dnum, destinationDepth.dlevel);
        await mklev();
    }
    const beforeGlow = async () => {
        if (postMessage.slice(0, 15).toLowerCase() !== 'you materialize')
            return;
        const message = postMessage;
        postMessage = '';
        await plineWithContinuation(message);
    };
    const died = await arriveOnLevel(oldDepth, { arrival, ladder, followers, beforeGlow });
    if (died)
        return true;
    const newDepth = { ...game.u.uz };
    // Each level saves the hero's trail. Bones loading already restores it;
    // otherwise use the cached trail or start an empty one.
    if (!game._restoredBones)
        restoreCachedHeroTrack(cached);
    game._tutorialActive = Number.isInteger(tutorialDnum)
        && destinationDepth.dnum === tutorialDnum;
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
        if (postMessage) {
            await plineWithContinuation(postMessage);
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
        if (postMessage)
            await flushPendingTopline();
        if (familiarMessage)
            await pline(familiarMessage);
        game._restoredBones = false;
    }
    else if (questArrival?.page || questArrival?.line) {
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
    }
    else {
        if (questArrival)
            await displayPreparedQuestArrival(questArrival);
        if (postMessage)
            await plineWithContinuation(postMessage);
        // do.c:goto_level() announces a newly generated Rogue floor after
        // level-teleport feedback.  tty continuation therefore suspends on
        // the materialization line and exposes the classic Rogue map before
        // installing this second line.
        if (!cached && Is_rogue_level(newDepth)) {
            await plineWithContinuation('You enter what seems to be an older, more primitive world.');
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
            await plineWithContinuation('You arrive at the Valley of the Dead...');
            await plineWithContinuation('The odor of burnt flesh and decay pervades the air.');
            await plineWithContinuation('You hear groans and moans everywhere.');
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
            await plineWithContinuation(`It is ${currentTemperature > 0 ? 'hot' : 'cold'} here.`);
            if (newDungeon?.flags?.hellish && currentTemperature > 0)
                await plineWithContinuation(`You ${heroHasOlfaction() ? 'smell' : 'sense'} smoke...`);
        }
        else if (previousTemperature > 0) {
            await plineWithContinuation(`The heat${oldDungeon?.flags?.hellish
                ? ' and smoke are' : ' is'} gone.`);
        }
        else if (previousTemperature < 0) {
            await plineWithContinuation('You are out of the cold.');
        }
    }
    if (!cached)
        await creditTouristNewLevel();
    if (game.flags.checkpoint ?? true)
        rewindEngravingsForSave(game.level);
    const levelAnnotation = game._levelAnnotations?.get?.(`${newDepth.dnum}:${newDepth.dlevel}`);
    if (levelAnnotation) {
        await pline(`You remember this level as ${levelAnnotation}.`);
    }
    // The old-level exit cleared room membership before the map switch.
    await checkSpecialRoom();
    await deliverMigratingObjects(game, { nearHero: true, publish: plineWithContinuation });
    if (cached)
        await fixShopDamage(game);
    if (arrival === 'falling') {
        const distance = dungeonDepth(newDepth.dnum, newDepth.dlevel)
            - dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
        let damage = d(Math.max(distance, 1), 6);
        if (game.u.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        if (await loseHeroHp(damage, 'falling down a mine shaft', {
            deathCause: 'killed by falling down a mine shaft',
        }))
            return true;
    }
    await autopickupAtHero();
    if (game.program_state?.gameover)
        return true;
    game.u.uz0 = { ...game.u.uz };
    return true;
}
async function arriveOnLevel(from, { arrival, ladder, followers, beforeGlow }) {
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
                || !!stairs.isladder !== ladder))
                stairs = stairs.next;
            if (stairs) {
                game.u.ux0 = game.u.ux;
                game.u.uy0 = game.u.uy;
                game.u.ux = stairs.sx;
                game.u.uy = stairs.sy;
                stairs.u_traversed = true;
                await moveSteedWithHero();
            }
            else if (up)
                await u_on_downstairs();
            else
                await u_on_upstairs();
            if (await applyStairTravelEffects(up, ladder))
                return true;
        }
        else if (arrival === 'portal' && !In_endgame(game.u.uz)) {
            const portal = game.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
            if (portal) {
                game.u.ux0 = game.u.ux;
                game.u.uy0 = game.u.uy;
                game.u.ux = portal.tx;
                game.u.uy = portal.ty;
                portal.tseen = true;
                await moveSteedWithHero();
            }
            else
                await placeHeroAtRandomArrival(game.level.upTeleportRegion, true);
        }
        else {
            await placeHeroAtRandomArrival(up
                ? game.level.upTeleportRegion : game.level.downTeleportRegion, up);
            if (arrival === 'falling') {
                if (heroIsPunished() && await fallWithIronBall())
                    return true;
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'Falling, you', publish: plineWithContinuation,
                });
                if (contact.died)
                    return true;
            }
        }
        if (heroIsPunished())
            await placeBallAndChain();
        await deliverMigratingObjects(game);
        await deliverMigratingMonsters(game, followers);
        if (game.program_state.gameover)
            return true;
        const removal = await killGenocidedMonsters();
        if (removal.heroDied)
            return true;
        await runDueTimers();
        if (game.program_state?.gameover)
            return true;
        await resolveHeroArrivalCollision();
        if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz))
            await moveElementalBubbles();
        else if (game.level.flags.fumaroles)
            fumaroles(game);
        vision_reset_new_level();
        await docrt({ beforeGlow });
        return false;
    }
    finally {
        if (game.program_state?.gameover)
            game._mapFlushPaused = false;
        else
            await flush_screen(-1);
    }
}
async function applyStairTravelEffects(up, ladder) {
    requirePlayingGame(game);
    const flying = game.u.flying || game.flying;
    const noun = ladder ? 'ladder' : 'stairs';
    const verbose = game.flags.verbose !== false;
    if (up) {
        const greatEffort = heroIsPunished() && !(game.u.levitating || game.levitating);
        if (verbose || greatEffort)
            await plineWithContinuation(`${greatEffort ? 'With great effort, you' : 'You'} `
                + `${flying ? 'fly' : 'climb'} up${flying && ladder ? ' along' : ''} the ${noun}.`);
    }
    else if (game.u.dz) {
        if (flying) {
            if (verbose)
                await plineWithContinuation(`You fly down ${ladder ? 'along the ladder' : 'the stairs'}.`);
        }
        else if (nearCapacity(game) > 0 || heroIsPunished()
            || game.u.fumbling || (game.u.fumblingTurns ?? 0) > 0) {
            await plineWithContinuation(`You fall down the ${noun}.`);
            if (heroIsPunished() && await dragBallDownStairs())
                return true;
            if (game.u.usteed) {
                if ((await dismountHero(DISMOUNT_FELL)).died)
                    return true;
            }
            else {
                let damage = rnd(3);
                if (game.u.halfPhysicalDamage)
                    damage = Math.trunc((damage + 1) / 2);
                const killer = ladder
                    ? 'falling off a ladder' : 'tumbling down a flight of stairs';
                if (await loseHeroHp(damage, killer, { deathCause: `killed by ${killer}` }))
                    return true;
            }
            const touch = await selfTouchPetrifyingWeapons({
                messageStart: 'Falling, you', publish: plineWithContinuation,
            });
            if (touch.died)
                return true;
        }
        else if (verbose) {
            await plineWithContinuation(ladder
                ? 'You climb down the ladder.' : 'You descend the stairs.');
        }
    }
    return false;
}
function levelCacheKey(depth) {
    return `${depth?.dnum ?? 0}:${depth?.dlevel ?? 1}`;
}
// C do.c:goto_level() awards this after arrival/temperature messages and
// before annotations and room entry. Cached levels do not earn it again.
async function creditTouristNewLevel() {
    if (game.urole?.key !== 'tourist')
        return;
    addExperience(level_difficulty(), 0);
    await checkExperienceLevel();
}
function cloneHeroTrack(track = game._heroTrack) {
    return (track || []).map(point => ({ x: point.x, y: point.y }));
}
function cachedLevelState(level, stairs) {
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
function restoreCachedHeroTrack(cached) {
    game._heroTrack = cloneHeroTrack(cached?.heroTrack || []);
}
const M1_CONCEAL = 0x00000080;
// C getlev() restores each resident before separately arriving monsters.
async function restoreCachedMonsterState(cached) {
    const elapsed = game.moves - cached.savedAt;
    restoreMonsterWormHeads(cached.level);
    // Births append in the port, whereas C prepends to fmon.
    for (const monster of cached.level.monsters.slice().reverse()) {
        setShopResidency(monster, false, game);
        if (monster !== game.u.usteed && monster.mundetected
            && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL)) {
            await hideMonsterUnder(monster, game);
        }
        if (elapsed > 0)
            catchUpMonster(monster, elapsed, game);
        await restoreMonsterShape(monster, game);
        if (game.program_state.gameover)
            return;
        if (elapsed > 0 && elapsed > rnd(10))
            await hideMonsterOnRestore(monster, game);
    }
}
function restoreCachedLevelMetadata(cached) {
    game._activeSpecialLevel = cached?.activeSpecialLevel || null;
}
// C dungeon.c:u_on_rndspot() delegates arrival to the shared lregion owner.
export async function placeHeroAtRandomArrival(region = null, up = false) {
    const area = region ?? { lx: 0, ly: 0, hx: 0, hy: 0 };
    const excluded = region?.exclude ?? { lx: -1, ly: -1, hx: -1, hy: -1 };
    await place_lregion(area.lx, area.ly, area.hx, area.hy, excluded.lx, excluded.ly, excluded.hx, excluded.hy, up ? LR_UPTELE : LR_DOWNTELE, null);
    return { x: game.u.ux, y: game.u.uy };
}
// C do.c:u_collide_m(). A level arrival may overlap a resident or follower.
// Move the hero to an adjacent legal square, or let the monster's own
// placement rules choose its destination, including flight over liquids.
async function resolveHeroArrivalCollision() {
    const level = requireGameLevel();
    const collision = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!collision)
        return;
    let movedHero = false;
    if (!rn2(2)) {
        const destination = findNearbyMonsterPosition(game.u.umonnum, game.u.ux, game.u.uy);
        if (destination && Math.abs(destination.x - game.u.ux) <= 1
            && Math.abs(destination.y - game.u.uy) <= 1) {
            await placeHeroOnLevel(destination.x, destination.y);
            movedHero = true;
        }
    }
    if (!movedHero)
        await moveMonsterNextToHero(collision, game, { flags: RLOC_NOMSG });
    const remaining = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!remaining)
        return;
    if (game.flags.debug)
        await plineWithContinuation("(monster in hero's way)");
    const relocated = await randomMonsterRelocation(remaining, { flags: RLOC_NOMSG });
    const obstruction = level.monsters.find(monster => monsterHasMapPosition(monster, game)
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!relocated)
        await sendMonsterToLimbo(remaining);
    else if (obstruction)
        await sendMonsterToLimbo(obstruction);
}
//# sourceMappingURL=level_change.js.map