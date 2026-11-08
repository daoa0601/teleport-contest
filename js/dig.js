// dig.c owner: hero and monster digging, terrain changes, burial, and
// wand digging.  Folded from hero_digging/digging_terrain/digging_magic/
// digging_watch/buried_object/hole (pure move, no behavior change).
import { stack_object } from './invent.js';
import { POTION_CLASS, COIN_CLASS } from './objclass.js';
import { OBJ_NAME } from './object_data.js';
import { wakeNearby, finishLiquidDeathForCurrentMover, } from './mon.js';
import { bringLeashedFollowers, leashAttachedToMonster, releaseMonsterLeash, releaseObjectLeash } from './apply.js';
import { publishMonsterYelp } from './sounds.js';
import { objectIsHardHelmet } from './do_wear.js';
import { adjustHeroAlignment, currentAttribute, exerciseAttribute } from './attrib.js';
import { A_CHA, A_CON, A_INT, A_LAWFUL, A_STR, A_DEX, A_WIS, ALTAR, AM_MASK, AM_SANCTUM, Amask2align, BEAR_TRAP, COLNO, CORR, COULD_SEE, DBWALL, DB_LAVA, DB_MOAT, DB_UNDER, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, DIGCHECK_FAIL_AIRLEVEL, DIGCHECK_FAIL_ALTAR, DIGCHECK_FAIL_BOULDER, DIGCHECK_FAIL_CANTDIG, DIGCHECK_FAIL_ONLADDER, DIGCHECK_FAIL_ONSTAIRS, DIGCHECK_FAIL_OBJ_POOL_OR_TRAP, DIGCHECK_FAIL_THRONE, DIGCHECK_FAIL_TOOHARD, DIGCHECK_FAIL_UNDESTROYABLETRAP, DIGCHECK_FAIL_WATERLEVEL, DIGCHECK_FAILED, DIGCHECK_PASSED, DIGCHECK_PASSED_DESTROY_TRAP, DIGCHECK_PASSED_PITONLY, DIGTYP_BOULDER, DIGTYP_DOOR, DIGTYP_ROCK, DIGTYP_STATUE, DIGTYP_TREE, DIGTYP_UNDIGGABLE, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, EXPL_MAGICAL, FOUNTAIN, F_WARNED, HOLE, IN_SIGHT, IRONBARS, IS_ALTAR, IS_DOOR, IS_FURNITURE, IS_GRAVE, IS_OBSTRUCTED, IS_ROOM, IS_STWALL, IS_THRONE, IS_TREE, IS_WALL, Is_airlevel, Is_earthlevel, Is_stronghold, Is_waterlevel, KILLED_BY, LANDMINE, LAVAPOOL, MAGIC_PORTAL, MIGR_RANDOM, MM_NOMSG, MON_OFFMAP, MOAT, OBJECT_TIMER_KIND, PIT, POOL, RLOC_NOMSG, ROOM, ROWNO, SCORR, SDOOR, SHOPBASE, SHOP_DOOR_COST, SHOP_PIT_COST, SHOP_WALL_COST, SINK, STONE, THRONE, TRAPDOOR, TRAP_EXPLODE, TT_BURIEDBALL, TT_INFLOOR, TT_PIT, Upolyd, VIBRATING_SQUARE, W_NONDIGGABLE, is_hole, is_magical_trap, is_pit, xdir, ydir, FOOT, HEAD, STOMACH } from './const.js';
import { isok } from './cmd.js';
import { currency } from './invent.js';
import { destroyDrawbridge, findDrawbridgeAt, isIceAt, isLavaAt, isMoatAt, isPoolAt, isPoolOrLavaAt } from './dbridge.js';
import { convertSecretDoor } from './detect.js';
import { impactDrop } from './dokick.js';
import { migrateMonsterOffLevel } from './dog.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { canSeeMonster, feel_location, feel_newsym, flush_screen, newsym, show_glyph_cell } from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { explode } from './explode.js';
import { fireDamageChain, pitDirection, pitsAreConjoined, convertTrapToObject, deleteTrap, feelTrap, seeTrap, trapAt, trapName, mintrap, waterDamageChain, setHeroTrap, dotrap, resetUtrap, maketrap, deleteFloorTrap, triggerBoobyTrap, } from './trap.js';
import { breakSinkAt, dryFountainAt, gushForthFromFountain } from './fountain.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { CmapSymbol, cmapToGlyph } from './glyph_numbers.js';
import { heroLiquidEffects, mayDig, spotChecks, loseHeroHp, finishDestinationSpotEffects, inTown, roomsAt, switchHeroTerrain } from './hack.js';
import { dist2, possessiveName, upstart } from './hacklib.js';
import { dropInventoryObjectAtHero, woundHeroLegs } from './do.js';
import { freeInventoryObject, objectAt } from './invent.js';
import { heroIsUnaware } from './senses.js';
import { delobj } from './invent.js';
import { gotoLevel } from './do.js';
import { makemonAt, mkclassAligned } from './makemon.js';
import { On_ladder, On_stairs, stairwayAt } from './stairs.js';
import { addBuriedObject, createToptenObject, mksobj, placeTreeFruit, unlinkObject, placeCreatedObject, placeObject, remove_object, updateIceObjectTimersAt, placeObjectSynchronously } from './mkobj.js';
import { angerWatchGuards, maybeUnhideAt, resolveMonsterLiquid, wakeMonstersNearWithMessages, monsterFliesOrFloats } from './mon.js';
import { closedDoor, triggerMonsterDoorTrap } from './monmove.js';
import { MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE } from './monster_data.js';
import { definiteName, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName, withIndefiniteArticle } from './objnam.js';
import { BEARTRAP, BOULDER, CORPSE, HEAVY_IRON_BALL, LAND_MINE, LEASH, POT_OIL, ROCK, STATUE } from './object_data.js';
import { greatestErosion, isAxe, isBimanualObject, isPick, objectIsOrganic } from './object_properties.js';
import { stopHeroOccupation } from './allmain.js';
import { formatFeltMessage, formatHeardMessage, pline, plineWithContinuation, impossible } from './pline.js';
import { heroIsFlying, body_part, mbodypart } from './polyself.js';
import { altarWrath, altarmaskAt, desecrateAltar } from './pray.js';
import { punishHero, unpunishHero } from './read.js';
import { autopickupAtHero } from './pickup.js';
import { angerTemplePriest } from './priest.js';
import { d, rn1, rn2, rnd, rnl } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { addShopDamage, costlySpot, deleteObject, makeAngryShopkeeper, payForShopDamage, shopDig, stolenValue } from './shk.js';
import { shopkeeperName } from './shknam.js';
import { hasShopkeeperData } from './shop_types.js';
import { monsterAt, monsterHasMapPosition } from './steed.js';
import { randomMonsterRelocation, teleportPetVictim } from './teleport.js';
import { Is_botlevel, ceilingName, depth, levelHasCeiling, levelAtDepth, surfaceName, canDigDown } from './dungeon.js';
import { CLR_WHITE } from './terminal.js';
import { scheduleObjectTimer, stopObjectTimer } from './timeout.js';
import { cansee, monsterHasLineOfSightToHero, unblock_point, vision_note_blocker_change } from './vision.js';
import { heroAttackBonus, heroStrengthDamageBonus, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { willWeld } from './wield.js';
import { objectResistsDestruction } from './zap.js';
import { breakStatue, fractureRock } from './zap.js';
import { captureRayTraversalFrame } from './zap.js';
import { endObjectBurn } from './timeout.js';
import { displayMessageWindow } from './topl.js';
import { fireDamageObject } from './trap.js';
import { nomul, roomForRoomno } from './hack.js';
import { artifactById } from './artifact.js';
import { makeMonsterFlee } from './monmove.js';
import { heroIsPunished } from './ball.js';
import { IS_WATERWALL, LAVAWALL, N_DIRS_Z, TT_WEB, WEB } from './const.js';
import { canSpotMonster } from './display.js';
import { wipeHeroEngraving } from './engrave.js';
import { heroCanReachFloor } from './engrave.js';
import { prepareAppliedWeaponAttack } from './uhitm.js';
import { MONSTER_MOVE } from './monster_data.js';
import { confusePromptDirection } from './cmd.js';
import { monsterDigests, monsterIsClinger, monsterIsFlyer, monsterIsWhirly, monsterPassesWalls } from './mondata.js';
import { expelHero } from './mhitu.js';
// ---------------------------------------------------------------------------
// Hero pick-axe/axe digging occupation (hero_digging)
// ---------------------------------------------------------------------------
const PM_EARTH_ELEMENTAL = MONSTER_NAME.indexOf('earth elemental');
const PM_XORN = MONSTER_NAME.indexOf('xorn');
// monflag.h: passes_walls(ptr)
// C dig.c d_action[] for "You start <action>." messages.
const DIG_ACTIONS = [
    'swinging', 'digging', 'chipping the statue', 'hitting the boulder',
    'chopping at the door', 'cutting the tree',
];
// C dig.c d_target[] for "You hit the <target>..." messages.
const DIG_TARGETS = ['', 'rock', 'statue', 'boulder', 'door', 'tree'];
// C rm.h:m_at() via steed.ts:monsterAt(): the head-only occupant of a
// square with the dig callers' MON_AT()/DEADMONSTER() checks folded in
// (steed.ts monsterAtPosition() additionally counts mounted actors and
// engulf overlap for occupancy).
// C dig.c:pick_can_reach()
// Whether a pick can reach a statue or boulder that sits in (or beside)
// a pit.
function pickCanReach(tool, x, y, state) {
    const trap = trapAt(state, x, y);
    const targetInPit = !!(trap && is_pit(trap.ttyp) && trap.tseen);
    if ((state.u.utrap ?? 0) > 0 && state.u.utraptype === TT_PIT) {
        if (targetInPit)
            return pitsAreConjoined(trap, trapAt(state, state.u.ux, state.u.uy));
        return isBimanualObject(tool);
    }
    if (isBimanualObject(tool) || heroIsFlying(state))
        return true;
    return !targetInPit;
}
// C dig.c:dig_typ()
// What is actually being dug at <x,y> with this tool.  Returns the numeric
// DIGTYP_* constants from const.js.
export function diggingTarget(tool, x, y, state = game) {
    if (!isok(x, y) || !tool || (!isPick(tool) && !isAxe(tool)))
        return DIGTYP_UNDIGGABLE;
    const level = state.level;
    if (!level)
        return DIGTYP_UNDIGGABLE;
    const location = level.at(x, y);
    if (!location)
        return DIGTYP_UNDIGGABLE;
    const typ = location.typ;
    if (isAxe(tool))
        return closedDoor(state, x, y) ? DIGTYP_DOOR
            : IS_TREE(typ) ? DIGTYP_TREE
                : DIGTYP_UNDIGGABLE;
    return objectAt(x, y, STATUE, state) && pickCanReach(tool, x, y, state)
        ? DIGTYP_STATUE
        : objectAt(x, y, BOULDER, state) && pickCanReach(tool, x, y, state)
            ? DIGTYP_BOULDER
            : closedDoor(state, x, y) ? DIGTYP_DOOR
                : IS_TREE(typ) ? DIGTYP_UNDIGGABLE
                    : IS_OBSTRUCTED(typ)
                        && (!level.flags?.arboreal || IS_WALL(typ))
                        ? DIGTYP_ROCK
                        : DIGTYP_UNDIGGABLE;
}
// C dig.c:is_digging()
// Whether the dig occupation is currently running.
export function isDigging(state = game) {
    return state._occupation?.key === 'dig';
}
// C dig.c:holetime(). Any active digging in a shop counts, not only downward digging.
export function diggingTimeToHole(state = game) {
    if (!isDigging(state) || !state.u.ushops?.length)
        return -1;
    const digging = state.context.digging;
    if (!digging)
        throw new Error('Active digging requires a digging context.');
    return Math.trunc((250 - digging.effort) / 20);
}
// Port only: ensures the svc.context.digging record exists.
export function ensureDiggingContext(state) {
    if (!state.context.digging)
        state.context.digging = {
            pos: { x: 0, y: 0 },
            level: { dnum: 0, dlevel: 0 },
            down: false, chew: false, warned: false,
            effort: 0, lastdigtime: 0, quiet: false,
        };
    return state.context.digging;
}
// Part of C dig.c:dig(), dig.c:use_pick_axe(): the on_level() digging-context
// test.
function onDiggingLevel(digging, state) {
    const uz = state.u.uz;
    return !!uz && digging.level.dnum === uz.dnum && digging.level.dlevel === uz.dlevel;
}
// Part of C dig.c:dig(): the memset of svc.context.digging.
// C memset(&svc.context.digging, 0, ...) after a completed or aborted dig.
export function clearDiggingContext(state) {
    const digging = state.context?.digging;
    if (!digging)
        return;
    digging.pos.x = 0;
    digging.pos.y = 0;
    digging.level.dnum = 0;
    digging.level.dlevel = 0;
    digging.down = false;
    digging.chew = false;
    digging.warned = false;
    digging.effort = 0;
    digging.lastdigtime = 0;
    digging.quiet = false;
}
// weapon.c's abon() lives in weapon.js (heroAttackBonus); dig.c's digmon()
// reads the same strength/dexterity ladder for digging effort.
// Part of C dig.c:dig(): the Maybe_Half_Phys() damage halving.
function maybeHalfPhysical(damage, state) {
    return state.u.halfPhysicalDamage
        ? Math.ceil(damage / 2) : damage;
}
// C dig.c:rm_waslit()
function rmWasLit(state) {
    const hero = state.u;
    const level = requireGameLevel(state);
    const own = level.at(hero.ux, hero.uy);
    if (own?.typ === ROOM && own.waslit)
        return true;
    for (let x = hero.ux - 2; x < hero.ux + 3; x++)
        for (let y = hero.uy - 1; y < hero.uy + 2; y++)
            if (isok(x, y) && level.at(x, y)?.waslit)
                return true;
    return false;
}
// C dig.c:mkcavepos()
async function mkcavepos(x, y, dist, waslit, rockit, state) {
    if (!isok(x, y))
        return;
    const location = requireGameLevel(state).at(x, y);
    if (!location)
        return;
    if (rockit) {
        if (IS_OBSTRUCTED(location.typ))
            return;
        if (trapAt(state, x, y))
            return;
        const monster = monsterAt(state, x, y);
        if (monster && !monsterPassesWalls(monster.mnum)) {
            // C rloc(mtmp, RLOC_NOMSG): relocate without a message.
            await randomMonsterRelocation(monster, { state, flags: RLOC_NOMSG });
        }
    }
    else if (location.typ === ROOM) {
        return;
    }
    unblock_point(x, y);
    location.seenv = 0;
    location.doormask = 0;
    if (dist < 3)
        location.lit = !rockit;
    if (waslit)
        location.waslit = !rockit;
    location.horizontal = false;
    const visibilityRow = state.viz_array?.[y];
    if (visibilityRow)
        visibilityRow[x] = dist < 3 ? (IN_SIGHT | COULD_SEE) : COULD_SEE;
    location.typ = rockit ? STONE : ROOM;
    await feel_newsym(x, y, state);
}
// C dig.c:mkcavearea()
// The Earth plane's collapsing/created cave.
async function mkcavearea(rockit, state) {
    const hero = state.u;
    const level = requireGameLevel(state);
    const heroLocation = level.at(hero.ux, hero.uy);
    if (!heroLocation)
        throw new Error('Cave digging requires the hero to occupy a map cell.');
    let xmin = hero.ux, xmax = hero.ux, ymin = hero.uy, ymax = hero.uy;
    const waslit = rmWasLit(state);
    if (rockit)
        await plineWithContinuation('Crash!  The ceiling collapses around you!');
    else
        await plineWithContinuation(`A mysterious force ${heroLocation.typ === CORR
            ? 'creates a' : 'extends the'} cave around you!`);
    // C mkcavearea(): display_nhwindow(WIN_MESSAGE, TRUE) acknowledges the
    // cave message before the ceiling visibly collapses.
    await displayMessageWindow();
    for (let dist = 1; dist <= 2; dist++) {
        xmin--;
        xmax++;
        if (dist < 2) {
            ymin--;
            ymax++;
            for (let i = xmin + 1; i < xmax; i++) {
                await mkcavepos(i, ymin, dist, waslit, rockit, state);
                await mkcavepos(i, ymax, dist, waslit, rockit, state);
            }
        }
        for (let i = ymin; i <= ymax; i++) {
            await mkcavepos(xmin, i, dist, waslit, rockit, state);
            await mkcavepos(xmax, i, dist, waslit, rockit, state);
        }
        await flush_screen(1);
    }
    if (!rockit && heroLocation.typ === CORR) {
        heroLocation.typ = ROOM;
        if (waslit)
            heroLocation.waslit = true;
        await newsym(hero.ux, hero.uy);
    }
    state.vision_full_recalc = 1;
}
// Part of C dig.c:use_pick_axe2(): the digging-target branches —
// fresh-versus-continue wording, context reset, and the dig occupation
// setup (the citation owner is applyPickAxeDirection() below).  The
// caller has already wielded the tool and resolved the target square.
export async function startHeroDigging(tool, x, y, { down = false, state = game } = {}) {
    const heroLevel = state.u.uz;
    if (!heroLevel)
        throw new Error('Digging requires a hero dungeon location.');
    const ispick = isPick(tool);
    const verbing = ispick ? 'digging' : 'chopping';
    const digging = ensureDiggingContext(state);
    const occupation = { key: 'dig', text: verbing, didDigMessage: false };
    state._occupation = occupation;
    const moves = state.moves ?? 0;
    if (!down) {
        const digTarget = diggingTarget(tool, x, y, state);
        digging.quiet = false;
        if (digging.pos.x !== x || digging.pos.y !== y
            || !onDiggingLevel(digging, state) || digging.down) {
            if (state.flags?.autodig && digTarget === DIGTYP_ROCK
                && !digging.down
                && state.u.ux === digging.pos.x
                && state.u.uy === digging.pos.y
                && moves <= digging.lastdigtime + 2
                && moves >= digging.lastdigtime) {
                // Repeated autodigging stays silent for two moves.
                occupation.didDigMessage = true;
                digging.quiet = true;
            }
            digging.down = false;
            digging.chew = false;
            digging.warned = false;
            digging.pos.x = x;
            digging.pos.y = y;
            digging.level.dnum = heroLevel.dnum;
            digging.level.dlevel = heroLevel.dlevel;
            digging.effort = 0;
            if (!digging.quiet)
                await pline(`You start ${DIG_ACTIONS[digTarget]}.`);
        }
        else {
            await pline(`You ${digging.chew ? 'begin' : 'continue'} ${DIG_ACTIONS[digTarget]}.`);
            digging.chew = false;
        }
    }
    else {
        if (digging.pos.x !== state.u.ux || digging.pos.y !== state.u.uy
            || !onDiggingLevel(digging, state) || !digging.down) {
            digging.chew = false;
            digging.down = true;
            digging.warned = false;
            digging.pos.x = state.u.ux;
            digging.pos.y = state.u.uy;
            digging.level.dnum = heroLevel.dnum;
            digging.level.dlevel = heroLevel.dlevel;
            digging.effort = 0;
            await pline(`You start ${verbing} downward.`);
            if (state.u.ushops?.length) {
                await shopDig(0, state);
                addShopDamage(state.u.ux, state.u.uy, SHOP_PIT_COST, state);
            }
        }
        else {
            await pline(`You continue ${verbing} downward.`);
        }
    }
    return { spentTime: true };
}
// C dig.c:dig()
// One dig occupation tick.  Returns true to keep digging.
export async function continueHeroDigging(state = game) {
    const digging = state.context?.digging;
    if (!digging)
        return false;
    const dpx = digging.pos.x;
    const dpy = digging.pos.y;
    const hero = state.u;
    const uwep = state.uwep || state.u?.uwep || null;
    const ispick = !!uwep && isPick(uwep);
    const verb = !uwep || ispick ? 'dig into' : 'chop through';
    const level = state.level;
    const location = level?.at(dpx, dpy);
    if (!level || !location)
        return false;
    // A nymph may have stolen the pick-axe, or the hero teleported away.
    if (hero.uswallow || !uwep || (!ispick && !isAxe(uwep))
        || !onDiggingLevel(digging, state)
        || (digging.down ? (dpx !== hero.ux || dpy !== hero.uy)
            : dist2(dpx, dpy, hero.ux, hero.uy) > 2))
        return false;
    let dcresult = DIGCHECK_PASSED;
    if (digging.down) {
        dcresult = await digCheck('you', hero.ux, hero.uy, state);
        if (dcresult >= DIGCHECK_FAILED) {
            await digCheckFailMessage(dcresult, 'you', hero.ux, hero.uy, { state });
            return false;
        }
    }
    else {
        if (IS_TREE(location.typ) && !mayDig(dpx, dpy, state)
            && diggingTarget(uwep, dpx, dpy, state) === DIGTYP_TREE) {
            await pline('This tree seems to be petrified.');
            return false;
        }
        if (IS_OBSTRUCTED(location.typ) && !mayDig(dpx, dpy, state)
            && diggingTarget(uwep, dpx, dpy, state) === DIGTYP_ROCK) {
            await pline(`This ${location.typ === DBWALL ? 'drawbridge' : 'wall'} is too hard to ${verb}.`);
            return false;
        }
    }
    if (hero.fumbling && !rn2(3)) {
        switch (rn2(3)) {
            case 0:
                if (!willWeld(uwep)) {
                    await pline(`You fumble and drop ${ownedObjectName(uwep, state, { capitalized: false })}.`);
                    await dropInventoryObjectAtHero(uwep, { state });
                }
                else {
                    // welded() identifies a curse when the hero cannot let go.
                    uwep.bknown = true;
                    const plural = (uwep.quan ?? uwep.quantity ?? 1) > 1;
                    const bounced = ownedObjectAction(uwep, 'bounce', state);
                    if (hero.usteed) {
                        const steed = hero.usteed;
                        const steedName = monsterName(steed, { state });
                        await pline(`${bounced} and ${plural ? 'hit' : 'hits'} ${steedName}!`);
                    }
                    else {
                        await pline(`Ouch!  ${bounced} and ${plural ? 'hit' : 'hits'} you!`);
                    }
                    await woundHeroLegs('right', 5 + rnd(5), state);
                }
                break;
            case 1:
                await pline(`Bang!  You hit with the broad side of ${definiteName(objectName(uwep, state), state)}!`);
                await wakeMonstersNearWithMessages(hero.ux, hero.uy, (hero.ulevel ?? 1) * 20, state);
                break;
            default:
                await pline('Your swing misses its mark.');
                break;
        }
        return false;
    }
    digging.effort += 10 + rn2(5) + heroAttackBonus(state) + (uwep.spe ?? 0)
        - greatestErosion(uwep) + (hero.udaminc ?? 0);
    if (state.urace?.name === 'dwarf')
        digging.effort *= 2;
    if (digging.down) {
        const trap = trapAt(state, dpx, dpy);
        if (digging.effort > 250 || trap?.ttyp === HOLE) {
            await digHole({ state });
            clearDiggingContext(state);
            return false;
        }
        if (digging.effort <= 50
            || (trap && (trap.ttyp === TRAPDOOR || is_pit(trap.ttyp)))) {
            return true;
        }
        else if (trap && (trap.ttyp === LANDMINE
            || (trap.ttyp === BEAR_TRAP && !((hero.utrap ?? 0) > 0)))) {
            // Digging onto a set object trap triggers it; #untrap first.
            const result = await dotrap(trap, { forceTrap: true });
            if (result.died)
                return false;
            clearDiggingContext(state);
            return false;
        }
        else if (trap && trap.ttyp === BEAR_TRAP && (hero.utrap ?? 0) > 0) {
            if (rnl(7) > (hero.fumbling ? 1 : 4)) {
                let damage = rollPhysicalWeaponDamageAgainstHero(uwep, state, { rollOne: rnd }) + heroStrengthDamageBonus(state);
                if (damage < 1)
                    damage = 1;
                else if (state.uarmf || state.u?.uarmf)
                    damage = Math.trunc((damage + 1) / 2);
                await pline(`You hit yourself in the ${body_part(FOOT, state)}.`);
                await loseHeroHp(maybeHalfPhysical(damage, state), `chopping off ${state.flags.female ? 'her' : 'his'} own ${body_part(FOOT, state)}`, { state, killerFormat: KILLED_BY });
            }
            else {
                await pline(`You destroy the bear trap with ${ownedObjectName(uwep, state, { capitalized: false, includeQuantity: true })}.`);
                deleteTrap(trap, state);
                // C reset_utrap(TRUE): falling out of the trap may settle
                // flight/levitation state before the dig resumes.
                await resetUtrap(true, state);
            }
            digging.effort = 0;
            return false;
        }
        else if (trap && dcresult === DIGCHECK_PASSED_DESTROY_TRAP) {
            const name = trapName(trap.ttyp, { state });
            if (ispick) {
                await pline(`You destroy ${trap.tseen ? `the ${name}` : withIndefiniteArticle(name)} with ${ownedObjectName(uwep, state, { capitalized: false, includeQuantity: true })}.`);
            }
            deleteTrap(trap, state);
            digging.effort = 0;
            return false;
        }
        if (IS_ALTAR(location.typ)) {
            await altarWrath(dpx, dpy, state);
            await angerTemplePriest(state);
        }
        // Make a pit at the hero's own square.
        if (await digHole({ pitOnly: true, state })) {
            digging.level.dnum = 0;
            digging.level.dlevel = -1;
        }
        return false;
    }
    if (digging.effort > 100) {
        let digtxt = null;
        let dmgtxt = null;
        const shopedge = roomsAt(level, dpx, dpy, SHOPBASE).length > 0;
        const digtyp = diggingTarget(uwep, dpx, dpy, state);
        let cleanedUp = false;
        const statue = objectAt(dpx, dpy, STATUE, state);
        const boulder = objectAt(dpx, dpy, BOULDER, state);
        if (digtyp === DIGTYP_STATUE && statue) {
            const shattered = await breakStatue(statue, dpx, dpy, { state });
            digtxt = shattered ? 'The statue shatters.' : null;
        }
        else if (digtyp === DIGTYP_BOULDER && boulder) {
            await fractureRock(boulder, dpx, dpy, { state });
            const other = objectAt(dpx, dpy, BOULDER, state);
            if (other) {
                // Another boulder here: restack it to the top.
                remove_object(other, state);
                await placeObject(other, dpx, dpy, state);
            }
            digtxt = 'The boulder falls apart.';
        }
        else if (location.typ === STONE || location.typ === SCORR
            || IS_TREE(location.typ)) {
            if (Is_earthlevel(state.u?.uz)) {
                if (uwep.blessed && !rn2(3)) {
                    await mkcavearea(false, state);
                    cleanedUp = true;
                }
                else if ((uwep.cursed && !rn2(4))
                    || (!uwep.blessed && !rn2(6))) {
                    await mkcavearea(true, state);
                    cleanedUp = true;
                }
            }
            if (!cleanedUp) {
                if (digtyp === DIGTYP_TREE) {
                    digtxt = 'You cut down the tree.';
                    location.typ = ROOM;
                    location.flags = 0;
                    if (!rn2(5))
                        await placeTreeFruit(dpx, dpy, state);
                    if (state.urace?.name === 'elf'
                        || state.urole?.key === 'ranger')
                        adjustHeroAlignment(-1, state);
                }
                else {
                    digtxt = 'You succeed in cutting away some rock.';
                    location.typ = CORR;
                    location.flags = 0;
                }
            }
        }
        else if (IS_WALL(location.typ)) {
            if (shopedge) {
                await addShopDamage(dpx, dpy, 10 * currentAttribute(A_STR, state), state);
                dmgtxt = 'damage';
            }
            if (level.flags?.is_maze_lev) {
                location.typ = ROOM;
                location.flags = 0;
            }
            else if (level.flags?.is_cavernous_lev
                && !inTown(level, dpx, dpy)) {
                location.typ = CORR;
                location.flags = 0;
            }
            else {
                location.typ = DOOR;
                location.doormask = D_NODOOR;
            }
            digtxt = 'You make an opening in the wall.';
        }
        else if (location.typ === SDOOR) {
            convertSecretDoor(location, state);
            digtxt = 'You break through a secret door!';
            if (!((location.doormask ?? 0) & D_TRAPPED))
                location.doormask = D_BROKEN;
        }
        else if (closedDoor(state, dpx, dpy)) {
            digtxt = `You break through the door with your ${simpleObjectName(uwep, state)}.`;
            if (shopedge) {
                await addShopDamage(dpx, dpy, SHOP_DOOR_COST, state);
                dmgtxt = 'break';
            }
            if (!((location.doormask ?? 0) & D_TRAPPED))
                location.doormask = D_BROKEN;
        }
        else {
            // The statue or boulder got taken in the meantime.
            return false;
        }
        if (!cleanedUp) {
            vision_note_blocker_change(dpx, dpy);
            await feel_newsym(dpx, dpy, state);
            if (digtxt && !digging.quiet)
                await pline(digtxt);
            if (dmgtxt)
                await payForShopDamage(dmgtxt, { state });
            if (Is_earthlevel(state.u?.uz) && !rn2(3)) {
                const mndx = rn2(2) ? PM_EARTH_ELEMENTAL : PM_XORN;
                if (await makemonAt(mndx, dpx, dpy, MM_NOMSG))
                    await pline('The debris from your digging comes to life!');
            }
            if (IS_DOOR(location.typ)
                && ((location.doormask ?? 0) & D_TRAPPED)) {
                location.doormask = D_NODOOR;
                if (await triggerBoobyTrap('door', { state }))
                    return false;
                vision_note_blocker_change(dpx, dpy);
                await newsym(dpx, dpy);
            }
        }
        digging.lastdigtime = state.moves ?? 0;
        digging.quiet = false;
        digging.level.dnum = 0;
        digging.level.dlevel = -1;
        return false;
    }
    // Not enough effort has been spent yet.
    const digTarget = diggingTarget(uwep, dpx, dpy, state);
    if (IS_WALL(location.typ) || digTarget === DIGTYP_DOOR) {
        if (roomsAt(level, dpx, dpy, SHOPBASE).length) {
            await pline(`This ${IS_DOOR(location.typ) ? 'door' : 'wall'} seems too hard to ${verb}.`);
            return false;
        }
    }
    else if (digTarget === DIGTYP_UNDIGGABLE
        || (digTarget === DIGTYP_ROCK && !IS_OBSTRUCTED(location.typ))) {
        // The statue or boulder got taken.
        return false;
    }
    const occupation = state._occupation?.key === 'dig' ? state._occupation : null;
    if (!occupation?.didDigMessage) {
        await pline(`You hit the ${DIG_TARGETS[digTarget]} with all your might.`);
        await wakeMonstersNearWithMessages(hero.ux, hero.uy, (hero.ulevel ?? 1) * 20, state);
        if (state._occupation?.key === 'dig')
            state._occupation.didDigMessage = true;
    }
    return true;
}
// ---------------------------------------------------------------------------
const S_ZOMBIE = 52;
const S_MUMMY = 39;
const MZ_HUGE = 4;
// Part of C dig.c:dig_check(), dig.c:dighole(): the sobj_at(BOULDER) lookup.
function boulderAt(x, y, state) {
    return (state.level?.objects?.[x]?.[y] || []).find(object => object.otyp === BOULDER) || null;
}
// Part of C dig.c:digactualhole(): the level.objects[x][y] pile accesses.
function pileAt(x, y, state) {
    return state.level?.objects?.[x]?.[y] || [];
}
// Part of C dig.c:digactualhole(): the Levitation || Flying test.
function heroIsAirborne(state) {
    return !!(state.u?.levitating || state.u?.levitation
        || state.u?.flying);
}
// Part of C dig.c:digactualhole(): the flags.verbose gate.
function verbose(state) {
    return state.flags?.verbose !== false;
}
// Part of C dig.c:digactualhole(): align_str() word for the altar message.
function alignmentWord(alignment) {
    if (alignment > 0)
        return 'lawful';
    if (alignment < 0)
        return 'chaotic';
    return 'neutral';
}
// Part of C do_name.c:hliquid(): dig.c names flowing or refusing liquids
// through it, so hallucinating heroes see a randomly displayed substitute
// (hliquid()'s citation owner is displayLiquidName() in do_name.ts).
function liquidName(typ, state = game) {
    return displayLiquidName(typ === LAVAPOOL ? 'lava' : 'water', state);
}
// C dig.c:dig_check().  Pure classification; no messages, no randomness.
export function digCheck(madeBy, x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return DIGCHECK_FAIL_TOOHARD;
    const trap = trapAt(state, x, y);
    // C tests On_stairs(x, y), i.e. the stairway structure, not levl.typ:
    // a debug terrain wish can overwrite the displayed terrain while the
    // stairway itself remains, and digging must still refuse there.
    const stair = stairwayAt(state, x, y);
    if (stair) {
        return stair.isladder ? DIGCHECK_FAIL_ONLADDER : DIGCHECK_FAIL_ONSTAIRS;
    }
    else if (IS_THRONE(location.typ) && madeBy !== 'object') {
        return DIGCHECK_FAIL_THRONE;
    }
    else if (IS_ALTAR(location.typ)
        && (madeBy !== 'object'
            || (altarmaskAt(x, y, state) & AM_SANCTUM) !== 0)) {
        return DIGCHECK_FAIL_ALTAR;
    }
    else if (Is_airlevel(state.u?.uz)) {
        return DIGCHECK_FAIL_AIRLEVEL;
    }
    else if (Is_waterlevel(state.u?.uz)) {
        return DIGCHECK_FAIL_WATERLEVEL;
    }
    else if (IS_OBSTRUCTED(location.typ) && location.typ !== SDOOR
        && ((location.wall_info ?? 0) & W_NONDIGGABLE) !== 0) {
        return DIGCHECK_FAIL_TOOHARD;
    }
    else if (trap && (trap.ttyp === MAGIC_PORTAL
        || trap.ttyp === VIBRATING_SQUARE)) {
        return DIGCHECK_FAIL_UNDESTROYABLETRAP;
    }
    else if (!canDigDown(state.u?.uz) && !location.candig) {
        if (trap) {
            return is_hole(trap.ttyp) || is_pit(trap.ttyp)
                ? DIGCHECK_FAIL_CANTDIG
                : DIGCHECK_PASSED_DESTROY_TRAP;
        }
        return DIGCHECK_PASSED_PITONLY;
    }
    else if (boulderAt(x, y, state)) {
        return DIGCHECK_FAIL_BOULDER;
    }
    else if (madeBy === 'object' && (trap || isPoolOrLavaAt(x, y, state))) {
        return DIGCHECK_FAIL_OBJ_POOL_OR_TRAP;
    }
    return DIGCHECK_PASSED;
}
// C dig.c:digcheck_fail_message().
export async function digCheckFailMessage(result, madeBy, x, y, { state = game } = {}) {
    if (result < DIGCHECK_FAILED)
        return;
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
            await plineWithContinuation(`There isn't enough room to ${verb} here.`);
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
            await plineWithContinuation(`The ${surface} here is too hard to ${verb}.`);
            break;
        case DIGCHECK_FAIL_WATERLEVEL:
            await plineWithContinuation(`The ${liquidName(POOL, state)} splashes and subsides.`);
            break;
        default:
            break;
    }
}
// C dig.c:furniture_handled().  Returns true when digging hit furniture whose
// own owner replaced the terrain, so no pit or hole is created.
async function furnitureHandled(x, y, madeByYou, state) {
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
    if (location.typ === DRAWBRIDGE_UP)
        return false;
    const bridge = findDrawbridgeAt(x, y, state);
    if (location.typ === DRAWBRIDGE_DOWN || bridge) {
        // If under the portcullis, the bridge is adjacent.
        if (!bridge)
            throw new Error('Drawbridge terrain has no drawbridge');
        await destroyDrawbridge(bridge.x, bridge.y, state);
        return true;
    }
    return false;
}
// C dig.c:dighole().  Returns true when the digging changed the terrain.
export async function digHole({ pitOnly = false, byMagic = false, coordinate = null, state = game, } = {}) {
    requirePlayingGame(state);
    let digX;
    let digY;
    if (!coordinate) {
        digX = state.u.ux;
        digY = state.u.uy;
    }
    else {
        digX = coordinate.x;
        digY = coordinate.y;
        if (!isok(digX, digY))
            return false;
    }
    const trap = trapAt(state, digX, digY);
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
    const tooHardMessage = () => plineWithContinuation(`The ${surfaceName(digX, digY, state)} `
        + `${adjacent ? 't' : ''}here is too hard to dig in.`);
    if ((trap && ((trap.ttyp === MAGIC_PORTAL
        || trap.ttyp === VIBRATING_SQUARE) || nohole))
        || (IS_OBSTRUCTED(oldTyp) && oldTyp !== SDOOR
            && ((location.wall_info ?? 0) & W_NONDIGGABLE) !== 0)) {
        await tooHardMessage();
    }
    else if (trap && is_magical_trap(trap.ttyp)) {
        await explode(digX, digY, 0, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL, { state });
        deleteTrap(trap, state);
        await newsym(digX, digY);
    }
    else if (isPoolOrLavaAt(digX, digY, state)) {
        await plineWithContinuation(`The ${liquidName(isLavaAt(digX, digY, state) ? LAVAPOOL : POOL, state)} sloshes furiously for a moment, then subsides.`);
        await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state);
    }
    else if (oldTyp === DRAWBRIDGE_DOWN || bridge) {
        if (pitOnly) {
            await plineWithContinuation('The drawbridge seems too hard to dig through.');
        }
        else {
            if (!bridge)
                throw new Error('Drawbridge terrain has no drawbridge');
            await destroyDrawbridge(bridge.x, bridge.y, state);
            retval = true;
        }
    }
    else if (boulderAt(digX, digY, state)) {
        const boulder = boulderAt(digX, digY, state);
        if (!boulder)
            throw new Error('The boulder disappeared before digging');
        if (trap && is_pit(trap.ttyp) && rn2(2)) {
            await plineWithContinuation(`The boulder settles into the `
                + `${adjacent ? 'adjacent ' : ''}pit.`);
            trap.ttyp = PIT; /* crush spikes */
        }
        else {
            await plineWithContinuation('KADOOM!  The boulder falls in!');
            await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state);
            await deleteFloorTrap(trap, state);
        }
        await delobj(boulder, state);
    }
    else if (IS_GRAVE(oldTyp)) {
        await digActualHole(digX, digY, 'you', PIT, { state });
        await digUpGrave(coordinate, { state });
        retval = true;
    }
    else if (oldTyp === DRAWBRIDGE_UP) {
        const liquid = liquidForHole(digX, digY, state, { fillIfAny: false });
        if (liquid === ROOM) {
            await tooHardMessage();
        }
        else {
            location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER)
                | (liquid === LAVAPOOL ? DB_LAVA : DB_MOAT);
            await liquidFlow(digX, digY, liquid, trap ?? null, 'As you dig, the hole fills with %s!', { state });
            retval = true;
        }
    }
    else if (IS_THRONE(oldTyp)) {
        await plineWithContinuation('The throne is too hard to break apart.');
    }
    else if (IS_ALTAR(oldTyp)) {
        await plineWithContinuation('The altar is too hard to break apart.');
    }
    else {
        const liquid = liquidForHole(digX, digY, state, { fillIfAny: false });
        location.flags = 0;
        if (liquid !== ROOM) {
            if (!await furnitureHandled(digX, digY, true, state)) {
                location.typ = liquid;
                await liquidFlow(digX, digY, liquid, trap ?? null, 'As you dig, the hole fills with %s!', { state });
            }
            retval = true;
        }
        else {
            // magical digging disarms settable traps
            if (byMagic && trap
                && (trap.ttyp === LANDMINE || trap.ttyp === BEAR_TRAP)) {
                await convertTrapToObject(trap, trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP, 1, state, { bury: true });
            }
            if (nohole || pitOnly
                || digCheckResult === DIGCHECK_PASSED_DESTROY_TRAP
                || digCheckResult === DIGCHECK_PASSED_PITONLY) {
                await digActualHole(digX, digY, 'you', PIT, { state });
            }
            else {
                await digActualHole(digX, digY, 'you', HOLE, { state });
            }
            retval = true;
        }
    }
    spotChecks(digX, digY, oldTyp, state);
    return retval;
}
// C dig.c:digactualhole().
export async function digActualHole(x, y, madeBy, ttyp, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    const atYou = hero.ux === x && hero.uy === y;
    const madeByYou = madeBy === 'you';
    const madeByObject = madeBy === 'object';
    // BY_OBJECT means the hero broke a wand, so blame her for it.
    const herosFault = madeByYou || madeByObject;
    let wontFall = heroIsAirborne(state);
    const victim = monsterAt(state, x, y);
    if (atYou && hero.utrap) {
        if (hero.utraptype === TT_BURIEDBALL) {
            await buriedBallToPunishment(state);
        }
        else if (hero.utraptype === TT_INFLOOR) {
            await resetUtrap(false, state);
        }
    }
    if (await furnitureHandled(x, y, madeByYou, state))
        return;
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
    }
    else {
        surfaceType = surfaceName(x, y, state);
    }
    const shopdoor = IS_DOOR(oldTyp)
        && roomsAt(state.level, x, y, SHOPBASE).length > 0;
    const oldTopObject = pileAt(x, y, state)[0] ?? null;
    const trap = await maketrap(x, y, ttyp);
    if (!trap)
        return;
    const newObjects = pileAt(x, y, state);
    trap.madeby_u = herosFault;
    trap.tseen = 0;
    if (cansee(x, y))
        await seeTrap(trap, state);
    else if (madeByYou)
        await feelTrap(trap, state);
    const trapWord = trapName(ttyp, { ignoreHallucination: true, state });
    const through = ttyp === HOLE ? 'through' : 'in';
    if (madeByYou) {
        if (!atYou) {
            await plineWithContinuation(`You dig an adjacent ${trapWord}.`);
        }
        else {
            await plineWithContinuation(`You dig ${withIndefiniteArticle(trapWord)} ${through} the ${surfaceType}.`);
        }
    }
    else if (madeBy && typeof madeBy === 'object'
        && canSeeMonster(madeBy)) {
        await plineWithContinuation(`${monsterName(madeBy, { capitalized: true })} digs ${withIndefiniteArticle(trapWord)} `
            + `${through} the ${surfaceType}.`);
    }
    else if (cansee(x, y) && verbose(state)) {
        if (IS_STWALL(oldTyp)) {
            await plineWithContinuation(`The ${surfaceType} crumbles into ${withIndefiniteArticle(trapWord)}.`);
        }
        else {
            await plineWithContinuation(`${upstart(withIndefiniteArticle(trapWord))} appears `
                + `in the ${surfaceType}.`);
        }
    }
    if (IS_FURNITURE(oldTyp) && cansee(x, y)) {
        await plineWithContinuation(`The ${furniture} falls into the ${trapWord}!`);
    }
    // wrath should immediately follow altar destruction message
    if (herosFault && oldTyp === ALTAR) {
        await desecrateAltar(false, oldAltarAlignment, state);
    }
    const objectsAppeared = (newObjects[0] ?? null) !== oldTopObject;
    if (ttyp === PIT) {
        if (shopdoor && herosFault) {
            await payForShopDamage('ruin', { state });
        }
        else {
            addShopDamage(x, y, herosFault ? SHOP_PIT_COST : 0, state);
        }
        if (madeByYou) {
            await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state);
        }
        await switchHeroTerrain(state);
        wontFall = heroIsAirborne(state);
        if (atYou) {
            if (!wontFall) {
                setHeroTrap(2 + rn2(4), TT_PIT, state); /* rn1(4, 2) */
                state.vision_full_recalc = 1; /* vision limits change */
            }
            else {
                // C reset_utrap(TRUE): a newly airborne hero floats back up.
                await resetUtrap(true, state);
            }
            if (objectsAppeared)
                await autopickupAtHero();
        }
        else if (victim) {
            if (monsterFliesOrFloats(victim)) {
                if (canSeeMonster(victim)) {
                    // C is_flyer() vs is_floater(): floaters also carry
                    // M1_FLY in the pinned data, so they report "flies".
                    const flying = monsterIsFlyer(victim.mnum);
                    await plineWithContinuation(`${monsterName(victim, { capitalized: true })} `
                        + `${flying ? 'flies' : 'floats'} over the pit.`);
                }
            }
            else if (victim !== madeBy) {
                await mintrap(victim, state, {
                    describeMonster: monster => monsterName(monster, { state, capitalized: true }),
                });
            }
        }
    }
    else { /* was TRAPDOOR, now a HOLE */
        if (atYou) {
            await switchHeroTerrain(state);
            wontFall = heroIsAirborne(state);
            // check for leashed pet that can't fall right now
            if (!hero.ustuck && !wontFall
                && !await bringLeashedFollowers(state)) {
                await plineWithContinuation('You are jerked back by your pet!');
                wontFall = true;
            }
            if (hero.ustuck || wontFall) {
                if (newObjects.length) {
                    await impactDrop(null, x, y, { state, publish: plineWithContinuation });
                }
                if (objectsAppeared)
                    await autopickupAtHero();
                if (state.program_state?.gameover)
                    return;
                if (shopdoor && herosFault) {
                    await payForShopDamage('ruin', { state });
                }
            }
            else {
                const inShop = state.u.ushops.length > 0;
                if (inShop && herosFault) {
                    await shopDig(1, state); /* shk might snatch pack */
                }
                else {
                    await payForShopDamage('dig into', { cantMollify: true, state });
                }
                await plineWithContinuation('You fall through...');
                await gotoLevel({ dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 }, { arrival: 'falling' });
                if (state.program_state.gameover)
                    return;
                // digactualhole() follows goto_level() with spoteffects(FALSE),
                // so a trap at the landing square fires at once.
                const { ux, uy } = state.u;
                await finishDestinationSpotEffects({
                    oldx: ux, oldy: uy, newx: ux, newy: uy, pick: false,
                });
            }
        }
        else {
            if (shopdoor && herosFault) {
                await payForShopDamage('ruin', { state });
            }
            if (newObjects.length) {
                await impactDrop(null, x, y, { state, publish: plineWithContinuation });
            }
            if (victim) {
                const clingsToCeiling = monsterIsClinger(victim.mnum)
                    && levelHasCeiling(state);
                if (monsterFliesOrFloats(victim)
                    || clingsToCeiling
                    || (victim.wormSegments?.length ?? 0) > 5
                    || (MONSTER_SIZE[victim.mnum] ?? 2) >= MZ_HUGE) {
                    return;
                }
                if (victim === state.u.ustuck)
                    return; /* vortex kludge */
                if (!await teleportPetVictim(victim, state))
                    return;
                const stronghold = Is_stronghold(state.u.uz);
                if (!stronghold && Is_botlevel(state.u.uz)) {
                    if (canSeeMonster(victim)) {
                        await plineWithContinuation(`${monsterName(victim, { capitalized: true })} avoids the trap.`);
                    }
                    return;
                }
                if (victim.isshk) {
                    if (!hasShopkeeperData(victim))
                        throw new Error('A falling shopkeeper requires its shop records');
                    await makeAngryShopkeeper(victim, state);
                }
                const destination = stronghold ? state.valley_level
                    : levelAtDepth(depth(state.u.uz, state.dungeons) + 1, { state });
                if (!destination)
                    throw new Error('A hole in the Castle requires the Valley destination.');
                await migrateMonsterOffLevel(victim, state, { dst: destination }, {
                    kind: 'level-fall-migration',
                    mode: MIGR_RANDOM,
                });
            }
        }
    }
}
// C dig.c:liquid_flow().  The caller has already changed the terrain type.
export async function liquidFlow(x, y, typ, trap, fillMessage, { state = game } = {}) {
    if (!isPoolOrLavaAt(x, y, state))
        return;
    requirePlayingGame(state);
    if (trap)
        await deleteFloorTrap(trap, state);
    updateIceObjectTimersAt(x, y, state);
    const unearthed = await unearthFloorObjectsAt(x, y, state);
    if (fillMessage) {
        await plineWithContinuation(fillMessage.replace('%s', liquidName(typ, state)));
    }
    // handle object damage before hero damage; affects potential bones
    const pile = pileAt(x, y, state);
    if (pile.length) {
        if (typ === LAVAPOOL) {
            await fireDamageChain(pile, {
                state, x, y, force: true,
                publish: plineWithContinuation,
            });
        }
        else {
            const messages = [];
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
        await heroLiquidEffects({
            state,
            applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y, newx: to.x, newy: to.y, pick,
            }),
        });
    }
    else {
        const monster = monsterAt(state, x, y);
        if (monster) {
            await resolveMonsterLiquid(monster, state, {
                announce: plineWithContinuation,
                finishDeath: finishLiquidDeathForCurrentMover,
                monsterMoving: !!state.context.mon_moving,
            });
        }
    }
    return { unearthed };
}
// C dig.c:dig_up_grave().
export async function digUpGrave(coordinate = null, { state = game } = {}) {
    requirePlayingGame(state);
    let digX;
    let digY;
    if (!coordinate) {
        digX = state.u.ux;
        digY = state.u.uy;
    }
    else {
        digX = coordinate.x;
        digY = coordinate.y;
        if (!isok(digX, digY))
            return;
    }
    const location = requireGameLevel(state).requireAt(digX, digY);
    await exerciseAttribute(A_WIS, false, state);
    if (state.urole?.key === 'archeologist') {
        adjustHeroAlignment(-Math.sign(state.u.ualign.type) * 3, state);
        await plineWithContinuation(formatFeltMessage('like a despicable grave-robber!', state));
    }
    else if (state.urole?.key === 'samurai') {
        adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
        await plineWithContinuation('You disturb the honorable dead!');
    }
    else if (state.u.ualign.type === A_LAWFUL) {
        if (state.u.ualign.record > -10)
            adjustHeroAlignment(-1, state);
        await plineWithContinuation('You have violated the sanctity of this grave!');
    }
    const blind = heroIsBlind(state);
    const hallucinating = heroIsHallucinating(state);
    const whatHappens = location.emptygrave ? -1 : rn2(5);
    if (whatHappens === 0 || whatHappens === 1) {
        await plineWithContinuation('You unearth a corpse.');
        const corpse = await createToptenObject(CORPSE, digX, digY);
        corpse.age -= 51; /* TAINT_AGE + 1: this is an *OLD* corpse */
    }
    else if (whatHappens === 2) {
        if (!blind) {
            await plineWithContinuation(hallucinating
                ? 'Dude!  The living dead!'
                : "The grave's owner is very upset!");
        }
        const species = mkclassAligned(S_ZOMBIE, 0);
        if (species !== null) {
            await makemonAt(species, digX, digY, MM_NOMSG);
        }
    }
    else if (whatHappens === 3) {
        if (!blind) {
            await plineWithContinuation(hallucinating
                ? 'I want my mummy!'
                : "You've disturbed a tomb!");
        }
        const species = mkclassAligned(S_MUMMY, 0);
        if (species !== null) {
            await makemonAt(species, digX, digY, MM_NOMSG);
        }
    }
    else {
        await plineWithContinuation('The grave is unoccupied.  Strange...');
    }
    location.typ = ROOM;
    location.emptygrave = 0;
    location.disturbed = 0;
    deleteEngravingAt(digX, digY, state.level);
    await newsym(digX, digY);
}
// ---------------------------------------------------------------------------
// Liquid which can flow into a newly opened hole (hole)
// ---------------------------------------------------------------------------
// Part of C dig.c:fillholetyp(): the is_moat/is_pool/is_lava classification.
function nearbyTerrain(x, y, state) {
    if (isMoatAt(x, y, state))
        return 'moat';
    if (isPoolAt(x, y, state))
        return 'pool';
    if (isLavaAt(x, y, state))
        return 'lava';
    return null;
}
// C dig.c:fillholetyp().
export function liquidForHole(x, y, state = game, { fillIfAny = false, random = rn2 } = {}) {
    let pools = 0;
    let moats = 0;
    let lava = 0;
    for (let nearX = Math.max(1, x - 1); nearX <= Math.min(COLNO - 1, x + 1); nearX++) {
        for (let nearY = Math.max(0, y - 1); nearY <= Math.min(ROWNO - 1, y + 1); nearY++) {
            const terrain = nearbyTerrain(nearX, nearY, state);
            if (terrain === 'moat')
                moats++;
            else if (terrain === 'pool')
                pools++;
            else if (terrain === 'lava')
                lava++;
        }
    }
    if (!fillIfAny)
        pools = Math.trunc(pools / 3);
    if ((lava > moats + pools && random(lava + 1)) || (lava && fillIfAny))
        return LAVAPOOL;
    if ((moats > 0 && random(moats + 1)) || (moats && fillIfAny))
        return MOAT;
    if ((pools > 0 && random(pools + 1)) || (pools && fillIfAny))
        return POOL;
    return ROOM;
}
// ---------------------------------------------------------------------------
// Watched digging in town (digging_watch)
// ---------------------------------------------------------------------------
const WATCH = new Set(['watchman', 'watch captain']);
// C dig.c:watch_dig().
// C dig.c:watchman_canseeu().
export async function watchDigging(x, y, { state = game, monster = null, magic = true, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    const closedDoor = location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
    if (!location || !inTown(level, x, y)
        || !(closedDoor || location.typ === SDOOR || IS_WALL(location.typ)
            || location.typ === FOUNTAIN || IS_TREE(location.typ)))
        return false;
    // A supplied witness has passed watch_on_duty's own admission checks.
    const witness = monster || [...level.monsters].reverse().find(candidate => candidate.mhp > 0 && !((candidate.mstate ?? 0) & MON_OFFMAP)
        && WATCH.has(MONSTER_NAME[candidate.mnum] ?? '') && candidate.mcansee
        && candidate.mpeaceful && monsterHasLineOfSightToHero(candidate, state));
    if (!witness)
        return false;
    const digging = ensureDiggingContext(state);
    if (magic || digging.warned) {
        await publish('"Halt, vandal!  You\'re under arrest!"');
        await angerWatchGuards(heroIsDeaf(state), { publish });
    }
    else {
        const target = IS_DOOR(location.typ) ? 'door' : IS_TREE(location.typ) ? 'tree'
            : IS_OBSTRUCTED(location.typ) ? 'wall' : 'fountain';
        await publish(`"Hey, stop damaging that ${target}!"`);
        digging.warned = true;
    }
    if (isDigging(state))
        await stopHeroOccupation(state, publish);
    return true;
}
// C dig.c:draft_message(). Callers decide when the hero feels the draft.
export function formatDraftMessage(unexpected, state, random = rn2) {
    requirePlayingGame(state);
    if (!heroIsHallucinating(state))
        return formatFeltMessage(unexpected ? 'an unexpected draft.' : 'a draft.', state);
    if (unexpected) {
        const unfit = [A_STR, A_DEX, A_CON, A_CHA, A_INT, A_WIS]
            .some(attribute => currentAttribute(attribute, state) < 6);
        return formatFeltMessage(`like you are ${unfit ? '4-F' : '1-A'}.`, state);
    }
    const alignment = Math.sign(state.u.ualign.type);
    let reaction = random(2) + 1 - alignment;
    if (state.u.ualign.record < 4)
        reaction += random(3) + alignment - 1;
    const description = ['enlisting', 'marching', 'protesting', 'fleeing'][reaction];
    if (!description)
        throw new RangeError(`Invalid hallucinated draft reaction ${reaction}`);
    return formatFeltMessage(`like ${description}.`, state);
}
// ---------------------------------------------------------------------------
// Wand and spell digging (digging_magic)
// ---------------------------------------------------------------------------
const G_UNIQ = 0x1000;
// C dig.c:zap_dig(). Digging via wand zap or spell cast.
export async function zapDigWithObject(_object, { state = game } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const level = requireGameLevel(state);
    if (hero.uswallow) {
        if (!hero.ustuck)
            throw new Error('Swallowed digging requires an engulfing monster.');
        await pierceEngulfer(hero.ustuck, state);
        return;
    }
    if (hero.dz) {
        await digVertically(state, hero.dz);
        return;
    }
    const dx = hero.dx, dy = hero.dy;
    if (dx === undefined || dy === undefined)
        throw new Error('Digging requires a selected direction.');
    const maze = level.flags.is_maze_lev && !Is_earthlevel(hero.uz);
    const ownPit = hero.utrap && hero.utraptype === TT_PIT
        ? trapAt(state, hero.ux, hero.uy) : null;
    const direction = xdir.findIndex((offsetX, index) => index < 8
        && offsetX === dx && ydir[index] === dy);
    let x = hero.ux + dx, y = hero.uy + dy;
    let depth = rn2(18) + 8;
    let shopDoor = false, shopWall = false;
    let flowingPit = null;
    const visibleCells = [];
    await flush_screen(0);
    try {
        while (--depth >= 0 && isok(x, y)) {
            const location = level.requireAt(x, y);
            if (cansee(x, y)) {
                visibleCells.push({ x, y });
                await show_glyph_cell(x, y, '*', CLR_WHITE, false, 0, { kind: 'effect', glyph: cmapToGlyph(CmapSymbol.digbeam) });
            }
            await captureRayTraversalFrame(state);
            // trap.c conjoined_pits() gate before digging a linked pit.
            if (ownPit) {
                let adjacentPit = trapAt(state, x, y);
                if (direction >= 0 && !pitsAreConjoined(adjacentPit, ownPit)) {
                    if (!adjacentPit || !is_pit(adjacentPit.ttyp)) {
                        const rejection = adjacentPitRejection(x, y, state);
                        if (rejection === null) {
                            await digHole({ pitOnly: true, byMagic: true,
                                coordinate: { x, y }, state });
                            if (state.program_state.gameover)
                                return;
                            adjacentPit = trapAt(state, x, y);
                        }
                        else if (rejection) {
                            await plineWithContinuation(rejection);
                        }
                    }
                    if (adjacentPit && is_pit(adjacentPit.ttyp)) {
                        connectPits(ownPit, adjacentPit);
                        flowingPit = { x, y };
                    }
                    if (isPoolAt(x, y, state) || isLavaAt(x, y, state))
                        flowingPit = { x: x - dx, y: y - dy };
                    break;
                }
            }
            else if (closedDoor(state, x, y) || location.typ === SDOOR) {
                if (roomsAt(level, x, y, SHOPBASE).length) {
                    addShopDamage(x, y, SHOP_DOOR_COST, state);
                    shopDoor = true;
                }
                if (location.typ === SDOOR)
                    location.typ = DOOR;
                else if (cansee(x, y))
                    await plineWithContinuation('The door is razed!');
                await watchDigging(x, y, { state });
                clearTerrainFlags(location);
                location.doormask = D_NODOOR;
                vision_note_blocker_change(x, y);
                depth -= 2;
                if (maze)
                    break;
            }
            else if (maze) {
                const wall = IS_WALL(location.typ);
                const tree = IS_TREE(location.typ);
                if (wall || tree || location.typ === STONE || location.typ === SCORR) {
                    if (!(location.wall_info & W_NONDIGGABLE)) {
                        if (wall && roomsAt(level, x, y, SHOPBASE).length) {
                            addShopDamage(x, y, SHOP_WALL_COST, state);
                            shopWall = true;
                        }
                        location.typ = wall || tree ? ROOM : CORR;
                        clearTerrainFlags(location);
                        vision_note_blocker_change(x, y);
                    }
                    else if (!heroIsBlind(state)) {
                        await plineWithContinuation(tree
                            ? 'The tree shudders but is unharmed.'
                            : `The ${wall ? 'wall' : 'rock'} glows then fades.`);
                    }
                    break;
                }
            }
            else if (IS_OBSTRUCTED(location.typ)) {
                if (!mayDig(x, y, state))
                    break;
                if (IS_WALL(location.typ) || location.typ === SDOOR) {
                    if (roomsAt(level, x, y, SHOPBASE).length) {
                        addShopDamage(x, y, SHOP_WALL_COST, state);
                        shopWall = true;
                    }
                    await watchDigging(x, y, { state });
                    location.typ = level.flags.is_cavernous_lev
                        && !inTown(level, x, y) ? CORR : DOOR;
                    depth -= 2;
                }
                else if (IS_TREE(location.typ)) {
                    location.typ = ROOM;
                    depth -= 2;
                }
                else {
                    location.typ = CORR;
                    depth--;
                }
                clearTerrainFlags(location);
                vision_note_blocker_change(x, y);
            }
            x += dx;
            y += dy;
        }
    }
    finally {
        if (!state.program_state.gameover)
            for (const cell of visibleCells)
                await newsym(cell.x, cell.y);
    }
    if (flowingPit && isok(flowingPit.x, flowingPit.y)) {
        const trap = trapAt(state, flowingPit.x, flowingPit.y);
        if (trap && is_pit(trap.ttyp)) {
            const liquid = liquidForHole(trap.tx, trap.ty, state, { fillIfAny: true });
            if (liquid !== ROOM)
                await floodConnectedPits(trap, liquid, state);
        }
    }
    if (state.program_state.gameover)
        return;
    if (shopDoor || shopWall)
        await payForShopDamage(shopDoor ? 'destroy' : 'dig into', { state });
}
// Part of C dig.c:zap_dig(): piercing an engulfer.
async function pierceEngulfer(monster, state) {
    if (monsterIsWhirly(monster))
        return;
    const digesting = monsterDigests(monster);
    if (digesting) {
        const owner = possessiveName(monsterName(monster, { state }));
        await plineWithContinuation(`You pierce ${owner} ${mbodypart(monster.mnum, STOMACH)} wall!`);
    }
    const generation = MONSTER_GENO[monster.mnum];
    if (generation === undefined)
        throw new Error(`Missing monster generation flags for ${monster.mnum}`);
    monster.mhp = generation & G_UNIQ
        ? Math.trunc((monster.mhp + 1) / 2) : 1;
    await expelHero(monster, { state, message: !digesting });
}
// Part of C dig.c:zap_dig(): the vertical beam branch (falling rock, hole).
async function digVertically(state, direction) {
    const hero = state.u;
    if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)
        || state.underwater || hero.uinwater)
        return;
    const stairs = stairwayAt(state, hero.ux, hero.uy);
    if (direction > 0 && !stairs) {
        await watchDigging(hero.ux, hero.uy, { state });
        await digHole({ byMagic: true, state });
        return;
    }
    if (stairs) {
        await plineWithContinuation(`The beam bounces off the ${stairs.isladder ? 'ladder' : 'stairs'} and hits the ${ceilingName(hero.ux, hero.uy, state)}.`);
    }
    await plineWithContinuation(`You loosen a rock from the ${ceilingName(hero.ux, hero.uy, state)}.`);
    await plineWithContinuation(`It falls on your ${body_part(HEAD, state)}!`);
    const helmet = state.uarmh || hero.uarmh;
    const damage = rnd(objectIsHardHelmet(helmet) ? 2 : 6);
    const halfPhysical = hero.halfPhysicalDamage;
    if (await loseHeroHp(halfPhysical ? Math.ceil(damage / 2) : damage, 'falling rock', { state }))
        return;
    const rock = await mksobj(ROCK, false, false);
    placeCreatedObject(rock, hero.ux, hero.uy, state);
    observeObjectForNaming(rock, { state });
    await stack_object(rock, state);
    await newsym(hero.ux, hero.uy);
}
// C dig.c:adj_pit_checks(). Returns null to permit digging, an empty string
// to reject silently, or the rejection message.
function adjacentPitRejection(x, y, state) {
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ;
    // adj_pit_checks clears the native rm.flags union before checking it.
    // This also clears door locks, ice underlay, and nondiggable rock flags.
    clearTerrainFlags(location);
    if (isPoolAt(x, y, state) || isLavaAt(x, y, state))
        return '';
    if (closedDoor(state, x, y) || type === SDOOR || IS_WALL(type))
        return 'The foundation is too hard to dig through from this angle.';
    if (IS_TREE(type))
        return "The tree's roots glow then fade.";
    if (type === IRONBARS)
        return 'The bars go much deeper than your pit.';
    if (type === SINK)
        return 'A tangled mass of plumbing remains below the sink.';
    if (On_ladder(state, x, y))
        return 'The ladder is unaffected.';
    const support = type === FOUNTAIN ? 'fountain' : type === THRONE ? 'throne'
        : type === ALTAR ? 'altar' : On_stairs(state, x, y) ? 'stairs'
            : type === DRAWBRIDGE_DOWN || type === DBWALL ? 'drawbridge' : null;
    return support ? `The ${possessiveName(support)} supporting structures remain intact.` : null;
}
// C dig.c:pit_flow(). Floods a linked pit and its neighbors with the liquid.
async function floodConnectedPits(trap, liquid, state) {
    if (!trap || !is_pit(trap.ttyp))
        return;
    // Deleting a flooded pit clears its neighbors' links; retain its old exits.
    const { tx: x, ty: y, conjoined = 0 } = trap;
    const location = requireGameLevel(state).requireAt(x, y);
    location.typ = liquid;
    clearTerrainFlags(location);
    const message = state.u.ux === x && state.u.uy === y
        ? 'Suddenly %s flows in from the adjacent pit!' : null;
    await liquidFlow(x, y, liquid, trap, message, { state });
    if (state.program_state.gameover)
        return;
    for (let direction = 0; direction < 8; direction++) {
        if (conjoined & (1 << direction)) {
            const dx = xdir[direction], dy = ydir[direction];
            if (dx === undefined || dy === undefined)
                throw new RangeError(`Invalid connected pit direction ${direction}`);
            await floodConnectedPits(trapAt(state, x + dx, y + dy), liquid, state);
            if (state.program_state.gameover)
                return;
        }
    }
}
// Part of C dig.c:adj_pit_checks(), dig.c:pit_flow(): clears the rm.flags
// union before reuse.
function clearTerrainFlags(location) {
    location.flags = 0;
    location.doormask = 0;
    location.wall_info = 0;
    location.altarmask = 0;
    location.ladder = 0;
    location.drawbridgemask = 0;
    location.looted = 0;
    location.icedpool = 0;
    location.emptygrave = 0;
}
// ---------------------------------------------------------------------------
// C dig.c:bury_objs().
export async function buryFloorObjectsAt(x, y, state = game, { publish = plineWithContinuation, } = {}) {
    const level = requireGameLevel(state);
    const shop = costlySpot(x, y, state);
    const buried = [];
    let loss = 0;
    let object = level.objects[x]?.[y]?.[0] ?? null;
    while (object) {
        if (shop && !state.context.mon_moving) {
            loss += await stolenValue(object, x, y, !!shop.resident.mpeaceful, {
                silent: true, state, publish,
            });
            if (object.oclass !== COIN_CLASS)
                object.no_charge = true;
        }
        const result = await buryObject(object, state, { publish });
        if (result.outcome === 'buried')
            buried.push(object);
        object = result.next;
    }
    deleteEngravingAt(x, y, requireGameLevel(state));
    await newsym(x, y);
    await maybeUnhideAt(x, y, state);
    if (shop && loss) {
        await publish(`You owe ${shopkeeperName(shop.resident, { state })} ${loss} ${currency(loss, { state })} for burying merchandise.`);
    }
    return buried;
}
// C dig.c:bury_an_obj().
export async function buryObject(object, state = game, { publish = plineWithContinuation, } = {}) {
    const level = requireGameLevel(state);
    if (object === state.uball) {
        await unpunishHero(state);
        setHeroTrap(rn1(50, 20), TT_BURIEDBALL, state);
        await publish('The iron ball gets buried!');
    }
    // Unpunishing can delete the next object (the chain) from this pile.
    const pile = level.objects[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    const next = pile && index >= 0 ? pile[index + 1] ?? null : null;
    if (object === state.uchain || objectResistsDestruction(object, 0, 0))
        return { outcome: 'skipped', next };
    if (object.otyp === LEASH && object.leashmon)
        releaseObjectLeash(object, state);
    if (object.lamplit && object.otyp !== POT_OIL)
        endObjectBurn(object, state);
    if (object.where === 'inventory') {
        await freeInventoryObject(object, state);
        if (state.program_state.gameover)
            return { outcome: 'interrupted', next };
    }
    else {
        unlinkObject(object, state);
    }
    const x = object.ox;
    const y = object.oy;
    const underIce = isIceAt(x, y, state);
    if ((object.otyp === ROCK && !underIce) || object.otyp === BOULDER) {
        await deleteObject(object, state);
        return { outcome: 'absorbed', next };
    }
    scheduleBuriedRot(object, underIce, state);
    addBuriedObject(object, x, y, state);
    return { outcome: 'buried', next };
}
// Part of C dig.c:bury_an_obj(): the ROT_ORGANIC start_timer.
function scheduleBuriedRot(object, underIce, state) {
    const canRot = underIce
        ? object.oclass === POTION_CLASS
        : objectIsOrganic(object, state);
    if (object.otyp === CORPSE || !canRot
        || objectResistsDestruction(object, 5, 95)) {
        return;
    }
    scheduleObjectTimer(object, OBJECT_TIMER_KIND.ROT_ORGANIC, (underIce ? 0 : 250) + rnd(250) + (state.moves ?? 0), state);
}
// C dig.c:unearth_objs().  Buried objects return to the floor; an unearthed
// punishment ball drags the hero's chain back into punishment.  Callers
// converting ice terrain should run obj_ice_effects() first.
export async function unearthFloorObjectsAt(x, y, state = game) {
    const unearthed = [];
    const level = requireGameLevel(state);
    const ball = buriedBallNear(x, y, state);
    for (const object of [...(level.buriedObjects || [])]) {
        if (object.ox !== x || object.oy !== y)
            continue;
        if (ball && object === ball
            && state.u?.utrap && state.u.utraptype === TT_BURIEDBALL) {
            await buriedBallToPunishment(state);
            continue;
        }
        const index = level.buriedObjects?.indexOf(object) ?? -1;
        if (index >= 0)
            level.buriedObjects?.splice(index, 1);
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_ORGANIC);
        object.where = 'free';
        object.buried = false;
        await placeObject(object, x, y, state);
        await stack_object(object, state);
        unearthed.push(object);
    }
    deleteEngravingAt(x, y, requireGameLevel(state));
    await newsym(x, y);
    return unearthed;
}
// C dig.c:buried_ball(): the buried iron ball at the spot, or the nearest one
// within the +/-2 chain vicinity.
export function buriedBallNear(x, y, state) {
    if (state.u?.utrap && state.u.utraptype !== TT_BURIEDBALL)
        return null;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const object of state.level?.buriedObjects || []) {
        if (object.otyp !== HEAVY_IRON_BALL)
            continue;
        if (object.ox === x && object.oy === y)
            return object;
        const distance = (object.ox - x) ** 2 + (object.oy - y) ** 2;
        if (distance <= 8 && distance < nearestDistance) {
            nearest = object;
            nearestDistance = distance;
        }
    }
    return nearest;
}
// C dig.c:buried_ball_to_punishment().  The ball leaves the ground and the
// chain snaps back to the hero, ending the buried-ball trap.
export async function buriedBallToPunishment(state = game) {
    const hero = state.u;
    const ball = buriedBallNear(hero.ux, hero.uy, state);
    if (!ball)
        return false;
    const { ox: x, oy: y } = ball;
    unlinkObject(ball, state);
    await punishHero(ball, state);
    await resetUtrap(false, state);
    deleteEngravingAt(x, y, requireGameLevel(state));
    await newsym(x, y);
    return true;
}
// C dig.c:mdig_tunnel().
export async function digMonsterTunnel(monster, state, { random = rn2, rollOne = rnd, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const pile = rollOne(12);
    const { mx: x, my: y } = monster;
    const level = state.level;
    const location = level.requireAt(x, y);
    if (location.typ === SDOOR)
        convertSecretDoor(location, state);
    if (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))) {
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
        const sawMonster = canSeeMonster(monster);
        const trapped = !!(location.doormask & D_TRAPPED);
        location.doormask = trapped ? D_NODOOR : D_BROKEN;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (trapped) {
            const trap = await triggerMonsterDoorTrap(monster, sawMonster || canSeeMonster(monster), {
                state, random, rollOne, publish,
            });
            if (trap.killed)
                await newsym(x, y);
            return { died: trap.killed, heroDied: trap.heroDied };
        }
        if (state.flags.verbose && !heroIsUnaware(state) && random(3) === 0)
            await publish(formatDraftMessage(true, state, random));
        return { died: false, heroDied: false };
    }
    if (location.typ === SCORR) {
        location.typ = CORR;
        location.flags = location.wall_info = 0;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        await publish(formatDraftMessage(false, state, random));
        return { died: false, heroDied: false };
    }
    if (!IS_OBSTRUCTED(location.typ) && !IS_TREE(location.typ))
        return { died: false, heroDied: false };
    if (location.wall_info & W_NONDIGGABLE) {
        const terrain = IS_WALL(location.typ) ? 'wall' : IS_TREE(location.typ) ? 'tree' : 'stone';
        await impossible(`mdig_tunnel:  ${terrain} at (${x},${y}) is undiggable`, { state });
        return { died: false, heroDied: false };
    }
    const wall = IS_WALL(location.typ);
    const tree = IS_TREE(location.typ);
    if (wall) {
        if (state.flags.verbose && random(5) === 0) {
            const message = formatHeardMessage('crashing rock.', state);
            if (message)
                await publish(message);
        }
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
        location.typ = level.flags.is_maze_lev ? ROOM
            : level.flags.is_cavernous_lev && !inTown(level, x, y) ? CORR : DOOR;
    }
    else {
        location.typ = tree ? ROOM : CORR;
    }
    location.flags = location.wall_info = location.doormask = 0;
    if (!wall && pile > 0 && pile < 5) {
        if (tree)
            await placeTreeFruit(x, y, state, random);
        else
            placeCreatedObject(await mksobj(pile === 1 ? BOULDER : ROCK, true, false), x, y, state);
    }
    await newsym(x, y);
    if (!level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        vision_note_blocker_change(x, y);
    return { died: false, heroDied: false };
}
// C dig.c:wiz_debug_cmd_bury(). Counts floor objects, including rocks which
// disappear into the ground rather than joining the buried-object list.
export async function wizBury() {
    requirePlayingGame(game);
    const level = game.level;
    let before = 0, after = 0;
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (!isok(x, y))
                continue;
            before += level.objects[x]?.[y]?.length ?? 0;
            await buryFloorObjectsAt(x, y);
            after += level.objects[x]?.[y]?.length ?? 0;
        }
    }
    const buried = before - after;
    await plineWithContinuation(before === 0 ? 'No objects here or adjacent to bury.'
        : buried === 0 ? 'No objects buried.'
            : `${buried} object${buried === 1 ? '' : 's'} buried.`);
    game.context.move = 0;
}
// ── moved from src/js/trap.ts ──
// C dig.c:buried_ball_to_freedom(). The ball stays where it was buried,
// which may be beside the hero rather than directly underneath them.
export async function freeHeroFromBuriedBall(state = game) {
    if (state.u.utrap && state.u.utraptype !== TT_BURIEDBALL)
        return false;
    const ball = buriedBallNear(state.u.ux, state.u.uy, state);
    if (!ball)
        return false;
    const { ox: x, oy: y } = ball;
    unlinkObject(ball, state);
    placeObjectSynchronously(ball, x, y, state);
    await stack_object(ball, state);
    await resetUtrap(true, state);
    const level = requireGameLevel(state);
    level.engravings = (level.engravings || []).filter(engraving => engraving.x !== x || engraving.y !== y);
    await newsym(x, y);
    return true;
}
const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const LONG_WORM = MONSTER_NAME.indexOf('long worm');
// Port only: asserts a chosen direction for use_pick_axe().
function requirePickAxeDirection(hero) {
    if (hero.dx === undefined || hero.dy === undefined || hero.dz === undefined)
        throw new Error('Using a pick-axe requires a chosen direction.');
}
// Port only: bounds-checked levl[x][y] access for digging targets.
function diggingLocation(x, y, state) {
    const location = requireGameLevel(state).at(x, y);
    if (!location)
        throw new Error(`Digging target (${x}, ${y}) is outside the map.`);
    return location;
}
// Part of C uhitm.c:do_attack(): the confused/stunned/hallucinating gate.
function impaired(state) {
    const hero = state.u;
    return (hero.confused ||
        (hero.confusionTurns ?? 0) > 0 ||
        hero.stunned ||
        (hero.stunnedTurns ?? 0) > 0 ||
        heroIsHallucinating(state));
}
// Part of C dig.c:use_pick_axe()/use_pick_axe2(): the direction hint
// list; also inlines C cmd.c:dxdy_moveok() — a grid bug's diagonal is
// filtered from the direction hints.
function prepareDiggingDirections(tool, state) {
    const hero = state.u;
    const downOK = heroCanReachFloor(state);
    const keys = [];
    for (let direction = 0; direction < N_DIRS_Z; direction++) {
        const key = state.commandBindings.keyForDirection(direction);
        if (!hero.uswallow) {
            // Native movecmd() changes the hero's direction for each hint,
            // even when getdir() will subsequently be cancelled.
            const movement = state.commandBindings.movementForKey(key, 0);
            hero.dz = movement?.dz ?? 0;
            if (movement) {
                hero.dx = movement.dx;
                hero.dy = movement.dy;
            }
            if (movement && !movement.dz) {
                if (hero.umonnum === GRID_BUG && movement.dx && movement.dy) {
                    hero.dx = hero.dy = 0;
                    continue;
                }
                const x = hero.ux + movement.dx, y = hero.uy + movement.dy;
                if (!isok(x, y) || diggingTarget(tool, x, y, state) === DIGTYP_UNDIGGABLE)
                    continue;
            }
            else if ((hero.dz > 0) !== downOK)
                continue;
        }
        keys.push(String.fromCharCode(key));
    }
    return keys.join('').split('\0')[0] ?? '';
}
// Part of C shk.c:tended_shop(): the in_rooms(SHOPBASE) resident test
// reached from do_attack().
function tendedShopAt(monster, state) {
    const level = requireGameLevel(state);
    return roomsAt(level, monster.mx, monster.my, SHOPBASE).some((roomno) => {
        const room = roomForRoomno(level, roomno);
        const keeper = room?.resident;
        return keeper && !keeper.dead && (keeper.mhp ?? 1) > 0;
    });
}
// Part of C uhitm.c:do_attack(): the pick-axe attack path; the shared port
// lives in uhitm.ts.
async function attackWithTool(tool, monster, attackMonster, payShopkeeper, state, struckAt) {
    const hero = state.u;
    const safe = state.flags?.safe_dog !== false &&
        monster.mpeaceful &&
        canSpotMonster(monster) &&
        !impaired(state);
    if (safe &&
        !state.context.forcefight &&
        artifactById(tool.oartifact, state)?.name !== 'Stormbringer') {
        const blocked = heroIsPunished(state) ||
            rn2(7) === 0 ||
            (monster.mnum === LONG_WORM && monster.wormno) ||
            (IS_OBSTRUCTED(diggingLocation(hero.ux, hero.uy, state).typ) &&
                !monsterPassesWalls(monster.mnum));
        if (blocked || tendedShopAt(monster, state)) {
            if (monster.isshk &&
                canSpotMonster(monster) &&
                !state._runState &&
                !state.context.travel) {
                await payShopkeeper();
                return true;
            }
            if (monster.mtame || monster.pet) {
                const flight = await makeMonsterFlee(monster, {
                    state,
                    turns: rnd(6),
                    announce: false,
                });
                if (flight.heroDied)
                    return true;
            }
            await plineWithContinuation(`You stop.  ${monsterName(monster, { state, capitalized: true, article: 'your' })} is in the way!`);
            return true;
        }
        if (monster.mfrozen ||
            monster.msleeping ||
            monster.mcanmove === 0 ||
            (MONSTER_MOVE[monster.mnum] === 0 && rn2(6))) {
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true, article: 'your' })} doesn't seem to move!`);
            return true;
        }
        // do_attack() leaves a safe monster alone. Applying is not movement,
        // so the caller continues against the terrain rather than swapping.
        return false;
    }
    const verdict = await prepareAppliedWeaponAttack(monster, tool, { state, struckAt });
    if (verdict.proceed)
        await attackMonster(monster, struckAt, verdict);
    return true;
}
// Part of C dig.c:use_pick_axe(): the losehp(Maybe_Half_Phys()) wrapper.
async function hurtHero(amount, killer, state) {
    if (state.u.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    await loseHeroHp(amount, killer, { state, killerFormat: KILLED_BY });
}
// Part of C dig.c:use_pick_axe(): striking an undiggable target (web, bars).
async function strikeUndiggable(tool, x, y, state) {
    const hero = state.u;
    const location = diggingLocation(x, y, state);
    const trap = trapAt(state, x, y);
    const pile = requireGameLevel(state).objects[x]?.[y] || [];
    const boulder = pile.find((object) => object.otyp === BOULDER);
    const statue = pile.find((object) => object.otyp === STATUE);
    if (trap?.ttyp === WEB) {
        if (!trap.tseen) {
            await seeTrap(trap, state);
            await plineWithContinuation('There is a spider web there!');
        }
        await plineWithContinuation(`${ownedObjectAction(tool, 'become', state)} entangled in the web.`);
        const turns = d(2, 2);
        nomul(-turns, state);
        state._helplessReason = 'stuck in a spider web';
        state._helplessDoneMessage = 'You pull free.';
    }
    else if (location.typ === IRONBARS) {
        await plineWithContinuation('Clang!');
        await wakeNearby(state);
    }
    else if (IS_WATERWALL(location.typ) || location.typ === LAVAWALL) {
        await plineWithContinuation('Splash!');
        if (location.typ === LAVAWALL)
            await fireDamageObject(tool, { state, x, y, publish: plineWithContinuation });
    }
    else if (IS_TREE(location.typ)) {
        await plineWithContinuation('You need an axe to cut down a tree.');
    }
    else if (IS_OBSTRUCTED(location.typ)) {
        await plineWithContinuation('You need a pick to dig rock.');
    }
    else if (boulder || statue) {
        const target = boulder ? 'boulder' : 'statue';
        if (isPick(tool)) {
            await plineWithContinuation(`You can't reach the ${target}.`);
        }
        else {
            const vibrates = rn2(3) === 0;
            await plineWithContinuation(`Sparks fly as you whack the ${target}.${vibrates ? '  The axe-handle vibrates violently!' : ''}`);
            if (vibrates)
                await hurtHero(2, 'axing a hard object', state);
            await wakeNearby(state);
        }
    }
    else {
        const here = trapAt(state, hero.ux, hero.uy);
        if (hero.utrap && hero.utraptype === TT_PIT && here) {
            if (trap && is_pit(trap.ttyp) && connectPits(here, trap)) {
                await plineWithContinuation('You clear some debris from between the pits.');
            }
            else {
                await plineWithContinuation(`You swing ${ownedObjectName(tool, state, { capitalized: false })}, but the rubble has no place to go.`);
            }
        }
        else {
            await plineWithContinuation(`You swing ${ownedObjectName(tool, state, { capitalized: false })} through thin air.`);
        }
    }
}
// Part of C dig.c:use_pick_axe() and dig.c:digactualhole(): the reciprocal
// conjoined-bit connection between adjacent pits (dig.c:1264-1265 and
// dig.c:1656-1657); C trap.c:join_adjacent_pits() is #if 0 dead code.
export function connectPits(first, second) {
    const direction = pitDirection(first, second);
    if (direction < 0)
        return false;
    const opposite = (direction + 4) % 8;
    const changed = !((first.conjoined ?? 0) & (1 << direction))
        || !((second.conjoined ?? 0) & (1 << opposite));
    first.conjoined = (first.conjoined || 0) | (1 << direction);
    second.conjoined = (second.conjoined || 0) | (1 << opposite);
    return changed;
}
// C dig.c:use_pick_axe().
export async function usePickAxe(tool, { state = game, ensureWielded, readDirection, attackMonster, payShopkeeper }) {
    if (tool !== (state.uwep || state.u.uwep)) {
        const wielded = await ensureWielded();
        return { spentTime: !!wielded.ready, resume: !!wielded.ready };
    }
    const verb = isPick(tool) ? 'dig' : 'chop';
    if (state.u.utrap && state.u.utraptype === TT_WEB) {
        await plineWithContinuation(`Unfortunately, you can't ${verb} while entangled in a web.`);
        return { spentTime: false };
    }
    const direction = await readDirection(`In what direction do you want to ${verb}? [${prepareDiggingDirections(tool, state)}]`);
    if (!direction)
        return { spentTime: false, cancelled: true };
    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    return applyPickAxeDirection(tool, { state, attackMonster, payShopkeeper });
}
// C dig.c:use_pick_axe2().
export async function applyPickAxeDirection(tool, { state = game, attackMonster, payShopkeeper }) {
    const hero = state.u;
    requirePickAxeDirection(hero);
    const verbing = isPick(tool) ? 'digging' : 'chopping';
    if (hero.uswallow &&
        hero.ustuck &&
        await attackWithTool(tool, hero.ustuck, attackMonster, payShopkeeper, state, { x: hero.ux + hero.dx, y: hero.uy + hero.dy })) {
        return { spentTime: true };
    }
    if (state.underwater || hero.uinwater) {
        await plineWithContinuation(`Turbulence torpedoes your ${verbing} attempts.`);
    }
    else if (hero.dz < 0) {
        const levitating = hero.levitating || hero.levitation || state.levitating;
        await plineWithContinuation(levitating
            ? "You don't have enough leverage."
            : `You can't reach the ${ceilingName(hero.ux, hero.uy, state)}.`);
    }
    else if (!hero.dx && !hero.dy && !hero.dz) {
        const damage = Math.max(1, rnd(2) + heroStrengthDamageBonus(state) + (tool.spe ?? 0));
        await plineWithContinuation(`You hit yourself with ${ownedObjectName(tool, state, { capitalized: false })}.`);
        await hurtHero(damage, `${state.flags.female ? 'her' : 'his'} own ${OBJ_NAME(tool.otyp)}`, state);
    }
    else if (!hero.dz) {
        confusePromptDirection(hero);
        const x = hero.ux + hero.dx, y = hero.uy + hero.dy;
        if (!isok(x, y)) {
            await plineWithContinuation('Clash!');
            return { spentTime: true };
        }
        const monster = requireGameLevel(state).monsters.find((mon) => monsterHasMapPosition(mon, state) &&
            !mon.dead &&
            (mon.mhp ?? 1) > 0 &&
            mon.mx === x &&
            mon.my === y);
        if (monster && await attackWithTool(tool, monster, attackMonster, payShopkeeper, state, { x, y }))
            return { spentTime: true };
        if (diggingTarget(tool, x, y, state) === DIGTYP_UNDIGGABLE)
            await strikeUndiggable(tool, x, y, state);
        else
            await startHeroDigging(tool, x, y, { state });
    }
    else if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        await plineWithContinuation(`You swing ${ownedObjectName(tool, state, { capitalized: false })} through thin air.`);
    }
    else if (!heroCanReachFloor(state)) {
        await plineWithContinuation(`You can't reach the ${surfaceName(hero.ux, hero.uy, state)}.`);
    }
    else if (isPoolAt(hero.ux, hero.uy, state) || isLavaAt(hero.ux, hero.uy, state)) {
        await plineWithContinuation(`You cannot stay under${isPoolAt(hero.ux, hero.uy, state) ? 'water' : ' the lava'} long enough.`);
    }
    else {
        const trap = trapAt(state, hero.ux, hero.uy);
        const seenTrap = trap?.tseen ? trap : null;
        const pitEdge = seenTrap && is_pit(seenTrap.ttyp) && !(hero.utrap && hero.utraptype === TT_PIT);
        if (seenTrap && (pitEdge || is_hole(seenTrap.ttyp))) {
            const result = await dotrap(seenTrap, { forceBungle: true, gotoLevel });
            if (result.died)
                return { spentTime: false, died: true };
            if (!hero.utrap)
                await plineWithContinuation("You can't reach the bottom of the pit.");
        }
        else if (!isPick(tool) && trap?.ttyp !== LANDMINE && trap?.ttyp !== BEAR_TRAP) {
            await plineWithContinuation(`${ownedObjectAction(tool, 'merely scratch', state)} the ${surfaceName(hero.ux, hero.uy, state)}.`);
            wipeHeroEngraving(3, state);
        }
        else {
            await startHeroDigging(tool, hero.ux, hero.uy, { down: true, state });
        }
    }
    return { spentTime: true };
}
//# sourceMappingURL=dig.js.map