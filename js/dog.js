// Tame monster state.
// C refs: dog.c tamedog(), newedog(), initedog(), and abuse_dog().
import { currentAttribute } from './attrib.js';
import { A_CHA, DISMOUNT_THROWN, W_ARMS, COLNO, In_endgame, LARGEST_INT, MAGIC_PORTAL, MAX_NUM_WORMS, MIGR_APPROX_XY, MIGR_EXACT_XY, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_LEFTOVERS, MIGR_PORTAL, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, MIGR_WITH_HERO, MON_ARRIVE_AFTER_YOU, MON_ARRIVE_BEFORE_YOU, MON_ARRIVE_WITH_YOU, MON_FLOOR, MON_LIMBO, MON_MIGRATING, MON_STILL_ARRIVING, NEED_HTH_WEAPON, RLOC_NOMSG, ROWNO, STRAT_ARRIVE, STRAT_WAITFORU, } from './const.js';
import { heroEyeName, heroHasEyes } from './body_parts.js';
import { canSpotMonster, newsym, canSeeMonster } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { withIndefiniteArticle } from './objnam.js';
import { heroHasConflict } from './hero_conflict.js';
import { publishMonsterYelp, publishMonsterGrowl, sessionIsNight } from './ambient_sounds.js';
import { releaseMonsterLeashWithFeedback, releaseMonsterLeash } from './leash_apply.js';
import { finishMonsterEating } from './dogmove.js';
import { monsterName } from './do_name.js';
import { dismountHero, monsterHasMapPosition, placeMonsterOnMap } from './steed.js';
import { cansee, monsterEmitsLight, vision_recalc } from './vision.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterHasNoHands, monsterIsHuman, monsterIsHumanoid, monsterIsVerySmall, monsterTypeName, } from './monster_data.js';
import { CORPSE, CREDIT_CARD, DWARVISH_MATTOCK, LOCK_PICK, PICK_AXE, RIN_AGGRAVATE_MONSTER, SKELETON_KEY, UNICORN_HORN, } from './object_data.js';
import { rn1, rn2, rnd } from './rng.js';
import { initializeUnplacedMonsterWormBody, redrawMonsterWorm, removeMonsterWormBody } from './worm.js';
import { makeMonsterFlee } from './monmove.js';
import { setMonsterMalign } from './makemon.js';
import { levelFollower } from './mondata.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { questMonsterFlags3 } from './role_monsters.js';
import { expelHero, releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { AT_WEAP } from './monster_attack_types.js';
import { wieldMonsterWeapon } from './weapon.js';
import { corpseName, objectName, observeObjectForNaming, pluralizeObjectNoun } from './objnam.js';
import { beginPetEating, finishPetEating } from './pet_eating.js';
import { ACCFOOD, DOGFOOD, MANFOOD, dogFood } from './pet_food.js';
import { heroIsHallucinating } from './senses.js';
import { hasShopkeeperData } from './shop_types.js';
import { detachMonsterFromLevel, healMonster, restoreMonsterShape, sendMonsterToLimbo } from './mon.js';
import { depth, possessiveName } from './hacklib.js';
import { dropSpecialMonsterObjects } from './steal.js';
import { randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
import { somexy } from './mkroom.js';
import { roomForRoomno, roomsAt } from './room.js';
import { deliverOrcRaidLoot } from './orc_raid.js';
import { tryMonsterTrapEscape } from './trap.js';
import { monsterCarriesAmulet } from './wizard.js';
import { setShopResidency, makeShopkeeperHappy, makeShoppersHappy } from './shk.js';
import { placeObject } from './floor_object.js';
import { insideWizardTower } from './dungeon.js';
const M2_DOMESTIC = 0x00400000;
const M1_ANIMAL = 0x00040000;
const M1_MINDLESS = 0x00010000;
const M1_TUNNEL = 0x20;
const M1_NEEDPICK = 0x40;
// C dogmove.c:droppables(). Pets keep equipment and usable tools.
export function petDroppableObject(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const animalOrMindless = !!(flags & (M1_ANIMAL | M1_MINDLESS));
    const canDig = (flags & (M1_TUNNEL | M1_NEEDPICK)) === (M1_TUNNEL | M1_NEEDPICK);
    const canUnlock = !monsterHasNoHands(monster.mnum) && !monsterIsVerySmall(monster.mnum);
    const weapon = monster.mw;
    // Undefined means this body cannot use the tool; null means no tool has
    // been selected yet. C represents the first case with a dummy artifact.
    let pick = animalOrMindless || !canDig ? undefined : null;
    let horn = animalOrMindless ? undefined : null;
    let key = animalOrMindless || !canUnlock ? undefined : null;
    if (weapon) {
        if ([PICK_AXE, DWARVISH_MATTOCK].includes(weapon.otyp))
            pick = weapon;
        if (weapon.otyp === UNICORN_HORN)
            horn = weapon;
    }
    for (const object of monster.minvent || []) {
        switch (object.otyp) {
            case DWARVISH_MATTOCK:
            case PICK_AXE:
                if (object.otyp === DWARVISH_MATTOCK && ((monster.misc_worn_check ?? 0) & W_ARMS))
                    break;
                if (object.otyp === DWARVISH_MATTOCK && pick?.otyp === PICK_AXE && pick !== weapon
                    && (!pick.oartifact || object.oartifact))
                    return pick;
                if (pick === null || (pick !== undefined && object.oartifact && !pick.oartifact)) {
                    if (pick)
                        return pick;
                    pick = object;
                    continue;
                }
                break;
            case UNICORN_HORN:
                if (object.cursed)
                    break;
                if (horn === null || (horn !== undefined && object.oartifact && !horn.oartifact)) {
                    if (horn)
                        return horn;
                    horn = object;
                    continue;
                }
                break;
            case SKELETON_KEY:
            case LOCK_PICK:
            case CREDIT_CARD:
                if (key && object.otyp < key.otyp
                    && (!key.oartifact || object.oartifact))
                    return key;
                if (key === null || (key !== undefined && object.oartifact && !key.oartifact)) {
                    if (key)
                        return key;
                    key = object;
                    continue;
                }
                break;
        }
        if (!object.owornmask && object !== weapon)
            return object;
    }
    return null;
}
function heroAggravatesMonsters(state) {
    const rings = [
        state.uleft, state.uright, state.u?.uleft, state.u?.uright,
    ];
    return !!(state.u?.aggravateMonster || state.aggravateMonster
        || rings.some(ring => ring?.otyp === RIN_AGGRAVATE_MONSTER)
        || heroHasConflict(state));
}
export async function abusePet(monster, state = game) {
    requireLiveGame(state);
    if (monster.mtame === undefined || monster.mtame <= 0)
        return false;
    monster.mtame = heroAggravatesMonsters(state)
        ? Math.trunc(monster.mtame / 2) : monster.mtame - 1;
    monster.pet = monster.mtame > 0;
    if (monster.mtame > 0 && !monster.isminion) {
        const pet = monster.edog || monster.mextra?.edog;
        if (!pet)
            throw new Error('tame monster lacks its pet history');
        pet.abuse++;
    }
    if (!monster.mtame && monster.mleashed)
        await releaseMonsterLeashWithFeedback(monster, { state });
    if (monster.mx !== 0) {
        if (monster.mtame > 0 && rn2(monster.mtame) !== 0) {
            await publishMonsterYelp(monster);
        }
        else {
            await publishMonsterGrowl(monster);
        }
        if (!monster.mtame) {
            await newsym(monster.mx, monster.my);
            if (monster.wormno)
                await redrawMonsterWorm(monster, state);
        }
    }
    return true;
}
export async function abusePetAfterHeroHit(monster, damage, state = game) {
    if (damage <= 0 || !await abusePet(monster, state))
        return { heroDied: false };
    if ((monster.mtame ?? 0) > 0 && monster.mhp > 0) {
        const turns = 10 * rnd(damage);
        return makeMonsterFlee(monster, { state, turns, announce: false });
    }
    return { heroDied: false };
}
// C dog.c:initedog(). Existing pet history survives renewed taming.
export function initializePet(monster, { state = game, everything = true } = {}) {
    if (!monster)
        return false;
    const minimumTameness = ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DOMESTIC) ? 10 : 5;
    monster.mtame = Math.max(minimumTameness, monster.mtame || 0);
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.pet = true;
    setMonsterMalign(monster, state);
    const dog = monster.edog || monster.mextra?.edog || newPetData(monster);
    if (everything) {
        monster.mleashed = 0;
        monster.meating = 0;
        const apport = currentAttribute(A_CHA, state);
        dog.parentmid = monster.m_id;
        dog.droptime = 0;
        dog.dropdist = 10000;
        dog.apport = apport;
        dog.whistletime = 0;
        dog.ogoal = { x: -1, y: -1 };
        dog.abuse = 0;
        dog.revivals = 0;
        dog.mhpmax_penalty = 0;
        dog.killed_by_u = 0;
    }
    else if (!(dog.apport > 0)) {
        dog.apport = 1;
    }
    dog.hungrytime = Math.max(dog.hungrytime ?? 0, (state.moves ?? 0) + 1000);
    monster.edog = dog;
    monster.mextra = { ...(monster.mextra || {}), edog: dog };
    if (!state.u.uconduct)
        state.u.uconduct = {};
    if (!state.u.uconduct.pets && state._moveloopStarted) {
        const pet = withIndefiniteArticle(monsterTypeName(monster.mnum, monster.female));
        recordGameLogEvent(`obtained ${state.flags.female ? 'her' : 'his'} first pet (${pet})`, { state, flags: LL_CONDUCT });
    }
    state.u.uconduct.pets = (state.u.uconduct.pets || 0) + 1;
    return true;
}
export async function makePetWary(monster, { wasDead = true, state = game, random = rn2, publish = plineWithContinuation, repaint = newsym, } = {}) {
    if (!monster)
        return;
    await finishMonsterEating(monster, state);
    if (monster.mtame === undefined || monster.mtame <= 0)
        return;
    const dog = monster.isminion
        ? null : monster.edog || monster.mextra?.edog;
    if (dog?.mhpmax_penalty) {
        monster.mhpmax = (monster.mhpmax ?? 1) + dog.mhpmax_penalty;
        monster.mhp = (monster.mhp ?? 1) + dog.mhpmax_penalty;
        dog.mhpmax_penalty = 0;
    }
    if (dog && (dog.killed_by_u === 1 || (dog.abuse ?? 0) > 2)) {
        monster.mtame = 0;
        monster.mpeaceful = 0;
        if ((dog.abuse ?? 0) >= 0 && (dog.abuse ?? 0) < 10
            && random((dog.abuse ?? 0) + 1) === 0) {
            monster.mpeaceful = 1;
        }
        if (!wasDead && cansee(monster.mx, monster.my) && heroHasEyes(state)) {
            const subject = monsterName(monster, { state, capitalized: true });
            const hasEyes = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x1000);
            await publish(hasEyes
                ? `${subject} ${monster.mpeaceful ? 'seems unable' : 'refuses'} to look you in the ${heroEyeName(state)}.`
                : `${subject} avoids your gaze.`);
        }
    }
    else {
        monster.mtame = random(monster.mtame + 1);
        if (!monster.mtame)
            monster.mpeaceful = random(2) === 0 ? 0 : 1;
    }
    monster.pet = monster.mtame > 0;
    if (!monster.mtame) {
        if (!wasDead && canSpotMonster(monster)) {
            const subject = monsterName(monster, { state, capitalized: true });
            await publish(`${subject} ${monster.mpeaceful ? 'is no longer tame' : 'has become feral'}.`);
        }
        await repaint(monster.mx, monster.my);
        if (monster.mleashed)
            await releaseMonsterLeashWithFeedback(monster, { state, publish });
        if (state.u.usteed === monster)
            await dismountHero(DISMOUNT_THROWN, { state, announce: publish });
        return;
    }
    if (dog) {
        dog.revivals = (dog.revivals ?? 0) + 1;
        dog.killed_by_u = 0;
        dog.abuse = 0;
        dog.ogoal = { x: -1, y: -1 };
        const hungerFloor = (state.moves ?? 0) + 500;
        if (wasDead || (dog.hungrytime ?? 0) < hungerFloor)
            dog.hungrytime = hungerFloor;
        if (wasDead) {
            dog.droptime = 0;
            dog.dropdist = 10000;
            dog.whistletime = 0;
            dog.apport = 5;
        }
    }
}
// C newedog() allocates a zeroed record and sets its parent before initedog().
function newPetData(monster) {
    return {
        parentmid: monster.m_id, droptime: 0, dropdist: 0, apport: 0,
        whistletime: 0, hungrytime: 0, ogoal: { x: 0, y: 0 }, abuse: 0,
        revivals: 0, mhpmax_penalty: 0, killed_by_u: 0,
    };
}
// C dog.c:tamedog(). Food may be caught and consumed; magic has no object
// transfer. A true result tells a projectile caller that the food was caught,
// even when its meal kills the new pet.
const M2_DEMON_TAMING = 0x00000100;
const M3_WANTSARTI = 0x0010;
const M3_COVETOUS = 0x001f;
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const S_DOG = 4;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
export async function tameMonster(monster, source = null, { state = game, announce = false, } = {}) {
    requireLiveGame(state);
    const magic = source?.oclass === SCROLL_CLASS || source?.oclass === SPBOOK_CLASS;
    const blessedScroll = !!(magic && source?.blessed);
    const food = magic ? null : source;
    if (monster.mfrozen)
        monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    if (monster.msleeping)
        await wakeMonstersNearWithMessages(monster.mx, monster.my, 1, state);
    const speciesFlags = questMonsterFlags3(monster.mnum, state);
    if (monster.iswiz || monster.mnum === PM_MEDUSA || (speciesFlags & M3_WANTSARTI))
        return false;
    if (announce && !monster.mpeaceful && canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} seems ${heroIsHallucinating(state) ? 'really chill' : 'more amiable'}.`);
        announce = false;
    }
    monster.mpeaceful = 1;
    setMonsterMalign(monster, state);
    // The moon roll precedes the food/species tests, including for magic.
    if (state.flags.moonphase === 4 && sessionIsNight(state.datetime)
        && rn2(6) && food && MONSTER_SYMBOL[monster.mnum] === S_DOG)
        return false;
    monster.mflee = monster.mfleetim = 0;
    if (state.u.ustuck === monster) {
        if (state.u.uswallow) {
            const expelled = await expelHero(monster, { state });
            if (expelled.died)
                return false;
        }
        else if (!heroFormSticks(state)) {
            await releaseHeroFromMonster(monster, { state });
        }
    }
    if (monster.mtame && food) {
        if (!willCatchFood(monster, food, state))
            return false;
        await describeFoodCatch(monster, food, state);
        await feedTamedMonster(monster, food, false, state);
        return true;
    }
    if (monster.mtame && monster.mtame < 10) {
        if (monster.mtame < rnd(10))
            monster.mtame++;
        if (blessedScroll)
            monster.mtame = Math.min(monster.mtame + 2, 10);
        return false;
    }
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('shopkeeper lacks shop history');
        await makeShopkeeperHappy(monster, { state });
        return false;
    }
    if (!monster.mcanmove || monster.isgd || monster.ispriest || monster.isminion
        || (speciesFlags & M3_COVETOUS) || monsterIsHuman(monster.mnum)
        || (((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON_TAMING)
            && !((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & M2_DEMON_TAMING))
        || (food && dogFood(monster, food, rn2, [], state) >= MANFOOD))
        return false;
    if (monster.m_id === state.quest_status?.leader_m_id)
        return false;
    initializePet(monster, { state, everything: !(monster.edog || monster.mextra?.edog) });
    if (food) {
        await feedTamedMonster(monster, food, true, state);
        if (monster.dead || monster.mhp <= 0 || state.program_state.gameover)
            return true;
    }
    if (announce && canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} seems quite ${heroIsHallucinating(state) ? 'approachable' : 'friendly'}.`);
    }
    await newsym(monster.mx, monster.my);
    if (monster.wormno)
        await redrawMonsterWorm(monster, state);
    if ((MONSTER_ATTACKS[monster.mnum] || []).some(([type]) => type === AT_WEAP)) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state);
    }
    return true;
}
function willCatchFood(monster, food, state) {
    if (!monster.mcanmove || monster.mconf || monster.meating)
        return false;
    const quality = dogFood(monster, food, rn2, [], state);
    if (quality === DOGFOOD)
        return true;
    const pet = monster.edog ?? monster.mextra?.edog;
    return quality <= ACCFOOD && !!pet && pet.hungrytime <= state.moves;
}
async function describeFoodCatch(monster, food, state) {
    const visible = canSeeMonster(monster);
    if (!visible && !cansee(monster.mx, monster.my))
        return;
    observeObjectForNaming(food, { state });
    const noun = catchFoodName(food, state);
    if (visible) {
        const corpseSize = food.otyp === CORPSE && food.corpsenm !== undefined
            ? MONSTER_SIZE[food.corpsenm] : undefined;
        const tooLarge = corpseSize !== undefined
            && corpseSize > (MONSTER_SIZE[monster.mnum] ?? 0);
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} catches ${noun}${tooLarge ? ', or vice versa!' : '.'}`);
    }
    else {
        const subject = noun.charAt(0).toUpperCase() + noun.slice(1);
        await plineWithContinuation(`${subject} ${food.quan === 1 ? 'stops' : 'stop'}.`);
    }
}
function catchFoodName(food, state) {
    if (food.otyp === CORPSE)
        return corpseName(food, { definite: true });
    const name = objectName(food, state);
    const noun = food.quan === 1 ? name : pluralizeObjectNoun(food, name);
    return /^the /i.test(noun) ? noun.replace(/^The /, 'the ') : `the ${noun}`;
}
async function feedTamedMonster(monster, food, devour, state) {
    await placeObject(food, monster.mx, monster.my, state);
    const meal = beginPetEating(monster, food, { x: monster.mx, y: monster.my }, state, devour);
    await finishPetEating(monster, meal, state);
}
// C include/monflag.h M1 flags used by mon_catchup_elapsed_time().
const M1_CARNIVORE_MIGRATION = 0x20000000;
const M1_HERBIVORE_MIGRATION = 0x40000000;
const M1_REGEN = 0x00800000;
// C dog.c mon_arrive()'s `when` argument.
export const WIZ_ARRIVE = -1; // C dog.c mon_arrive(mtmp, -1) from resurrect()
const PM_LONG_WORM_MIGRATION = 114;
// C dog.c: overloading of mtrack[] is kept as explicit fields here:
// migrationArrival (mtrack[0].x), migrationFlags (mtrack[0].y),
// migrationSource (mtrack[1]), migrationOrigin (mtrack[2]).
function sameMigrationLevel(first, second) {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}
export function migrationQueue(state) {
    if (!Array.isArray(state._migratingMonsters))
        state._migratingMonsters = [];
    return state._migratingMonsters;
}
export function currentDungeonLevel(state) {
    if (!state.u.uz)
        throw new Error('Monster migration requires an initialized hero dungeon location.');
    return state.u.uz;
}
function defaultFallDestination(state) {
    // C hole falls land on the next level down within the same dungeon.
    const uz = currentDungeonLevel(state);
    const bottom = state.dungeons?.[uz.dnum]?.num_dunlevs
        ?? (uz.dlevel ?? 1);
    return {
        dnum: uz.dnum,
        dlevel: Math.min((uz.dlevel ?? 1) + 1, bottom),
    };
}
function clearNoCharge(object) {
    // C dog.c mon_leave() resets shop pricing on carried containers.
    object.no_charge = false;
    for (const content of object.contents || [])
        clearNoCharge(content);
}
// losedogs() requeues ordinary failures after all arrivals. Wizard
// resurrection has no such caller tail and returns to limbo immediately.
async function failArrival(monster, when, state) {
    const level = requireGameLevel(state);
    level.monsters = level.monsters.filter(candidate => candidate !== monster);
    monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
    monster.mx = monster.my = 0;
    if (when === WIZ_ARRIVE)
        await sendMonsterToLimbo(monster, state);
    return false;
}
// C mon_leave(): both followers and independently migrating monsters lose
// their old shop residency and carry only a tail length between levels.
export async function prepareMonsterDeparture(monster, state) {
    for (const object of monster.minvent || monster.inventory || [])
        clearNoCharge(object);
    setShopResidency(monster, true, state);
    if (monster.wormno) {
        const x = monster.mx, y = monster.my;
        const count = Math.min(monster.wormSegments?.length ?? 0, MAX_NUM_WORMS - 1);
        await removeMonsterWormBody(monster);
        monster.migratingWormSegments = count;
        if (x)
            await placeMigratingMonster(monster, x, y);
    }
}
async function placeMigratingMonster(monster, x, y) {
    await placeMonsterOnMap(monster, x, y);
    monster.mtrack = [];
}
export async function migrateMonsterOffLevel(monster, state, trap, { kind = 'level-fall-migration', mode = MIGR_RANDOM, confused = false, coordinate = null, } = {}) {
    // C dog.c migrate_to_level() plus mon_leave().
    requireLiveGame(state);
    const origin = currentDungeonLevel(state);
    const x = monster.mx, y = monster.my;
    const visible = !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2)
        && !!(!monster.minvis || state.u.seeInvisible);
    if (monster.mleashed) {
        monster.mtame = (monster.mtame ?? 0) - 1;
        monster.pet = monster.mtame > 0;
        await releaseMonsterLeashWithFeedback(monster, { state });
    }
    await prepareMonsterDeparture(monster, state);
    await detachMonsterFromLevel(monster, state);
    if (confused)
        monster.mconf = 1;
    monster.migrating = true;
    monster.mstate = (monster.mstate ?? 0) | MON_MIGRATING;
    monster.migrationMode = mode;
    monster.migrationArrival = mode;
    monster.migrationOrigin = { ...origin };
    monster.migrationDestination = { ...(trap?.dst
            || defaultFallDestination(state)) };
    monster.migrationSource = coordinate
        ? { x: coordinate.x, y: coordinate.y } : { x, y };
    const movingUp = depth(monster.migrationDestination, state.dungeons)
        < depth(origin, state.dungeons);
    monster.migrationFlags = (movingUp ? 1 : 0) | (insideWizardTower(x, y, state) ? 2 : 0);
    monster.mlstmv = state.moves ?? 0;
    monster.mx = 0;
    monster.my = 0;
    migrationQueue(state).push(monster);
    // C migrate_to_level() keeps a mobile light but turns it global (mx == 0)
    // and recalculates vision at once, so what it lit goes dark before the
    // next monster moves.
    if (monsterEmitsLight(monster.mnum))
        await vision_recalc(0);
    return {
        kind, trap, visible, destination: monster.migrationDestination,
        damage: 0, killed: false,
    };
}
// C dog.c:update_mlstmv().
// C dog.c:set_mon_lastmove().
export function updateMonsterLastMove(state = game) {
    for (const monster of state.level?.monsters || []) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        monster.mlstmv = state.moves;
    }
}
// C dog.c mon_catchup_elapsed_time().
export async function catchUpMonster(monster, moves, state) {
    if (moves < 0)
        throw new RangeError('Monster catch-up cannot start in the future.');
    const imv = Math.min(Math.trunc(moves), LARGEST_INT - 1);
    if (monster.mblinded)
        monster.mblinded = imv >= monster.mblinded ? 1
            : monster.mblinded - imv;
    if (monster.mfrozen)
        monster.mfrozen = imv >= monster.mfrozen ? 1
            : monster.mfrozen - imv;
    if (monster.mfleetim)
        monster.mfleetim = imv >= monster.mfleetim ? 1
            : monster.mfleetim - imv;
    if (monster.mtrapped && rn2(imv + 1) > 20)
        monster.mtrapped = 0;
    if (monster.mconf && rn2(imv + 1) > 25)
        monster.mconf = 0;
    if (monster.mstun && rn2(imv + 1) > 5)
        monster.mstun = 0;
    if (monster.meating) {
        if (imv > monster.meating)
            await finishMonsterEating(monster, state);
        else
            monster.meating -= imv;
    }
    if (imv > (monster.mspec_used ?? 0))
        monster.mspec_used = 0;
    else
        monster.mspec_used = (monster.mspec_used ?? 0) - imv;
    // Tameness drops by one for every 150 moves of separation.
    if (monster.mtame) {
        const wilder = Math.trunc((imv + 75) / 150);
        if (monster.mtame > wilder)
            monster.mtame -= wilder;
        else if (monster.mtame > rn2(wilder))
            monster.mtame = 0;
        else
            monster.mtame = monster.mpeaceful = 0;
    }
    // A pet that would have starved goes wild instead of dying.
    if (monster.mtame && !monster.isminion) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (flags & (M1_CARNIVORE_MIGRATION | M1_HERBIVORE_MIGRATION)) {
            const pet = monster.edog ?? monster.mextra?.edog;
            if (!pet)
                throw new Error(`Tame monster ${monster.m_id} has no feeding history.`);
            const hungrytime = pet.hungrytime;
            if ((state.moves > hungrytime + 500 && monster.mhp < 3)
                || state.moves > hungrytime + 750)
                monster.mtame = monster.mpeaceful = 0;
        }
    }
    monster.pet = (monster.mtame ?? 0) > 0;
    if (!monster.mtame && monster.mleashed)
        releaseMonsterLeash(monster, state);
    const healing = (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_REGEN
        ? imv : Math.trunc(imv / 20);
    healMonster(monster, healing);
    monster.mlstmv = state.moves ?? 0;
}
function arrivalStairway(state, origin, ladder) {
    // C stairway_find_from()/stairway_find(): the stair on this level that
    // connects back to the origin level.
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameMigrationLevel(stair.tolev, origin)
            && (ladder === undefined || stair.isladder === ladder))
            return stair;
    }
    return null;
}
function wanderLocale(state, x, y, wander) {
    // C mon_arrive(): a monster that moved during limbo arrives within
    // `wander` squares, or somewhere inside its room.
    const roomNumber = roomsAt(state.level, x, y, 0)[0];
    const room = roomNumber != null
        ? roomForRoomno(state.level, roomNumber) : null;
    if (room) {
        const coordinate = { x: 0, y: 0 };
        if (somexy(room, coordinate, state))
            return coordinate;
        return null;
    }
    const lowX = Math.max(1, x - wander);
    const highX = Math.min(COLNO - 1, x + wander);
    const lowY = Math.max(0, y - wander);
    const highY = Math.min(ROWNO - 1, y + wander);
    return {
        x: rn1(highX - lowX, lowX),
        y: rn1(highY - lowY, lowY),
    };
}
// C dog.c mon_arrive(); returns false when no placement was possible.
export async function monsterArrive(monster, when, state) {
    const level = requireGameLevel(state);
    const queue = migrationQueue(state);
    const index = queue.indexOf(monster);
    if (index >= 0)
        queue.splice(index, 1);
    monster.mstate = ((monster.mstate ?? 0) | MON_STILL_ARRIVING)
        & ~(MON_MIGRATING | MON_LIMBO);
    monster.migrating = false;
    level.monsters.push(monster);
    setShopResidency(monster, false, state);
    monster.mstrategy = (monster.mstrategy ?? 0) | STRAT_ARRIVE;
    if (monster.mnum === PM_LONG_WORM_MIGRATION) {
        initializeUnplacedMonsterWormBody(monster, monster.migratingWormSegments ?? 0, { state });
    }
    else {
        monster.wormno = 0;
    }
    delete monster.migratingWormSegments;
    // rloc_to()/mnexto() must not use stale pre-migration coordinates.
    monster.mux = state.u.ux;
    monster.muy = state.u.uy;
    let xlocale = monster.migrationSource?.x ?? 0;
    let ylocale = monster.migrationSource?.y ?? 0;
    const origin = monster.migrationOrigin;
    // C mon_arrive(): Wiz_arrive overrides the recorded arrival mode.
    const arrival = when === WIZ_ARRIVE
        ? MIGR_WITH_HERO : (monster.migrationArrival ?? MIGR_RANDOM);
    monster.mtrack = [];
    await restoreMonsterShape(monster, state);
    if (state.program_state.gameover)
        return false;
    if (monster === state.u?.usteed)
        return true;
    if (when === MON_ARRIVE_WITH_YOU) {
        // An accompanying monster usually lands beside the hero and
        // sometimes on the hero's own square (which then displaces the hero).
        const heroOccupied = level.monsters.some(candidate => monsterHasMapPosition(candidate, state) &&
            candidate !== monster && (candidate.mhp ?? 1) > 0
            && candidate.mx === state.u.ux && candidate.my === state.u.uy);
        const denominator = monster.mtame ? 10 : monster.mpeaceful ? 5 : 2;
        if (!heroOccupied && !rn2(denominator))
            await relocateMonsterTo(monster, state.u.ux, state.u.uy, { state, flags: RLOC_NOMSG });
        else {
            const nearby = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state });
            if (!nearby)
                return await failArrival(monster, when, state);
            await relocateMonsterTo(monster, nearby.x, nearby.y, { state, flags: RLOC_NOMSG });
        }
        monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
        return true;
    }
    let wander = 0;
    const lastMove = monster.mlstmv ?? state.moves ?? 0;
    if (lastMove < (state.moves ?? 0) - 1) {
        const elapsed = (state.moves ?? 0) - 1 - lastMove;
        await catchUpMonster(monster, elapsed, state);
        wander = Math.min(elapsed, 8);
    }
    switch (arrival) {
        case MIGR_APPROX_XY:
            break;
        case MIGR_EXACT_XY:
            wander = 0;
            break;
        case MIGR_WITH_HERO:
            xlocale = state.u.ux;
            ylocale = state.u.uy;
            break;
        case MIGR_STAIRS_UP:
        case MIGR_STAIRS_DOWN: {
            const stair = arrivalStairway(state, origin, false);
            if (stair)
                xlocale = stair.sx, ylocale = stair.sy;
            break;
        }
        case MIGR_LADDER_UP:
        case MIGR_LADDER_DOWN: {
            const stair = arrivalStairway(state, origin, true);
            if (stair)
                xlocale = stair.sx, ylocale = stair.sy;
            break;
        }
        case MIGR_SSTAIRS: {
            const stair = arrivalStairway(state, origin);
            if (stair)
                xlocale = stair.sx, ylocale = stair.sy;
            break;
        }
        case MIGR_PORTAL:
            if (In_endgame(state.u?.uz)) {
                const region = state.level?.upTeleportRegion;
                if (region) {
                    xlocale = rn1(region.hx - region.lx + 1, region.lx);
                    ylocale = rn1(region.hy - region.ly + 1, region.ly);
                }
                break;
            }
            {
                const portal = state.level?.traps?.find(candidate => candidate.ttyp === MAGIC_PORTAL);
                if (portal)
                    xlocale = portal.tx, ylocale = portal.ty;
                else
                    xlocale = ylocale = 0;
            }
            break;
        default:
            xlocale = ylocale = 0;
            break;
    }
    if ((monster.migflags ?? 0) & MIGR_LEFTOVERS)
        await deliverOrcRaidLoot(monster, state, true);
    if (xlocale && wander) {
        const drifted = wanderLocale(state, xlocale, ylocale, wander);
        if (drifted)
            xlocale = drifted.x, ylocale = drifted.y;
        else
            xlocale = ylocale = 0;
    }
    if (xlocale) {
        // mnearto() uses the requested square before searching its neighbours.
        const destination = goodPosition(xlocale, ylocale, { kind: 'monster', monster }, { state })
            ? { x: xlocale, y: ylocale } : findNearbyMonsterPosition(monster.mnum, xlocale, ylocale, { state });
        if (!destination)
            return await failArrival(monster, when, state);
        await relocateMonsterTo(monster, destination.x, destination.y, { state, flags: RLOC_NOMSG });
    }
    else {
        const relocation = await randomMonsterRelocation(monster, { state, flags: RLOC_NOMSG });
        if (!relocation)
            return await failArrival(monster, when, state);
    }
    monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
    return true;
}
export async function deliverMigratingMonsters(state = game, followers = []) {
    if (!state.level || !state.u?.uz)
        return 0;
    // Migration arrays append where C prepends to migrating_mons.
    const arrivals = [...migrationQueue(state)].reverse().filter(monster => sameMigrationLevel(monster.migrationDestination, state.u.uz));
    // C losedogs(): settle a pacified keeper's home-level pursuit before
    // arrivals can displace anyone. An angry returning keeper vetoes it.
    let dismissKops = false;
    let angryKeeper = false;
    for (const monster of arrivals) {
        if (!monster.isshk)
            continue;
        const shop = monster.eshk;
        if (!shop)
            throw new Error(`Migrating shopkeeper ${monster.m_id} has no shop data.`);
        if (shop.dismiss_kops) {
            dismissKops = true;
            shop.dismiss_kops = false;
        }
        else if (!monster.mpeaceful) {
            angryKeeper = true;
        }
    }
    if (followers.some(monster => monster.isshk && !monster.mpeaceful))
        angryKeeper = true;
    if (dismissKops && !angryKeeper)
        await makeShoppersHappy({ state, silentKops: true });
    const exact = arrivals.filter(monster => monster.migrationArrival === MIGR_EXACT_XY);
    const others = arrivals.filter(monster => monster.migrationArrival !== MIGR_EXACT_XY);
    const failed = [];
    let delivered = 0;
    const passes = [
        [exact, MON_ARRIVE_BEFORE_YOU], [followers, MON_ARRIVE_WITH_YOU], [others, MON_ARRIVE_AFTER_YOU],
    ];
    for (const [group, when] of passes) {
        for (const monster of group) {
            if (await monsterArrive(monster, when, state))
                delivered++;
            else
                failed.push(monster);
            if (state.program_state.gameover)
                return delivered;
        }
    }
    // C prepends failed_arrivals, then migrates that list only after all
    // arrivals. An exact arrival must not retry as approximate in this visit.
    for (const monster of failed.reverse())
        await sendMonsterToLimbo(monster, state);
    return delivered;
}
export function discardMigrations(state = game) {
    // C dog.c discard_migrations(): entering the endgame discards monsters
    // scheduled for unreachable levels; the Wizard always stays queued.
    const queue = migrationQueue(state);
    state._migratingMonsters = queue.filter(monster => monster.iswiz || In_endgame(monster.migrationDestination));
}
// C dog.c:keepdogs(), keep_mon_accessible(), and mondata.c:levl_follower().
const M2_STALK = 0x01000000;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
// The caller skips this entire transaction when iflags.nofollowers is set.
// Returned monsters are detached from the old level in native mydogs order.
// C dog.c:keepdogs().
export async function collectLevelFollowers(state = game, petsOnly = false) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const level = state.level;
    const followers = [];
    // Births append in the port; C fmon links each new monster at the head.
    for (const monster of level.monsters.slice().reverse()) {
        if (monster.mhp <= 0)
            continue;
        if (petsOnly) {
            if (!monster.mtame)
                continue;
            monster.mtrapped = 0;
            await finishMonsterEating(monster, state);
            monster.msleeping = monster.mfrozen = 0;
            monster.mcanmove = 1;
        }
        const follows = (nearHero(monster, state) && levelFollower(monster, state)
            || state.u.uhave.amulet && monster.iswiz)
            && (!(monster.msleeping || !monster.mcanmove) || monster === state.u.usteed)
            && !((monster.mstrategy ?? 0) & STRAT_WAITFORU);
        if (follows) {
            if (monster.mtrapped) {
                await tryMonsterTrapEscape(monster, state, {
                    describeMonster: target => monsterName(target, { capitalized: true, state }),
                });
            }
            if (monster === state.u.usteed) {
                monster.mtrapped = 0;
                monster.meating = 0;
                await dropSpecialMonsterObjects(monster, state);
            }
            else if (await staysBehind(monster, state)) {
                continue;
            }
            await prepareMonsterDeparture(monster, state);
            await detachMonsterFromLevel(monster, state);
            monster.mx = monster.my = 0;
            monster.mlstmv = state.moves;
            // C relmon() prepends each transferred monster to mydogs.
            followers.unshift(monster);
        }
        else if (keepAccessible(monster, state.u.uz)) {
            await migrateMonsterOffLevel(monster, state, { dst: { ...state.u.uz } }, {
                kind: 'level-migration', mode: MIGR_EXACT_XY,
            });
        }
        else if (monster.mleashed) {
            const name = monsterName(monster, { capitalized: true, state });
            await plineWithContinuation(`${possessiveName(name)} leash goes slack.`);
            releaseMonsterLeash(monster, state);
        }
    }
    return followers;
}
function nearHero(monster, state) {
    const dx = monster.mx - state.u.ux;
    const dy = monster.my - state.u.uy;
    const distance = dx * dx + dy * dy;
    return distance < 3 && !(distance === 2 && monster.mnum === PM_GRID_BUG);
}
async function staysBehind(monster, state) {
    let message;
    if (monster.meating || monster.mtrapped) {
        message = `is still ${monster.meating ? 'eating' : 'trapped'}.`;
    }
    else if (monsterCarriesAmulet(monster)) {
        message = 'seems very disoriented for a moment.';
    }
    else {
        return false;
    }
    if (canSeeMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} ${message}`);
    }
    if (monster.mleashed) {
        // This is a species/sex pronoun, independent of visibility or hallucination.
        const whose = monsterIsHumanoid(monster.mnum)
            ? monster.female ? 'Her' : 'His' : 'Its';
        await plineWithContinuation(`${whose} leash suddenly comes loose.`);
        releaseMonsterLeash(monster, state);
    }
    return true;
}
// C dog.c:keep_mon_accessible().
function keepAccessible(monster, current) {
    if (monster.iswiz)
        return true;
    const homes = [
        monster.isshk ? monster.eshk?.shoplevel : null,
        monster.ispriest ? (monster.epri ?? monster.mextra?.epri)?.shrlevel : null,
        monster.isgd ? monster._egd?.gdlevel : null,
    ];
    for (const home of homes) {
        if (home === undefined)
            throw new Error(`Monster ${monster.m_id} has no home level for its resident role.`);
        if (home !== null && (home.dnum !== current.dnum || home.dlevel !== current.dlevel))
            return true;
    }
    return false;
}
//# sourceMappingURL=dog.js.map