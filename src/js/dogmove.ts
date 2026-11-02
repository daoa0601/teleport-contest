import { questMonsterSound } from './role_monsters.js';
import { performMonsterHeroAttack, beginMonsterHeroAttack, presentMonsterAttackEffects } from './mhitu.js';
import { inventoryItemDescription } from './invent.js';
import { monsterFliesOrFloats, isLavaAt, isPoolAt } from './terrain_properties.js';
import { monsterName, visibleMonsterSubject } from './do_name.js';
import { observeDistantObjectForNaming } from './objnam.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Hero } from './hero_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Position } from './map_types.js';
import type {
    AttackTuple, MonsterCallLog, MonsterCombatResult, MonsterMovement, MonsterMovementAction, RandomBelow,
    RollDice, RollOne,
} from './monster_action_types.js';
import type { PetRangedSelection, PetRangedTarget, PetTargetOptions } from './pet_ranged_types.js';
import {
    monsterAvoidsKickedLocation, monsterAvoidsSokobanPushLocation, readyMonsterDiggingWeapon,
    speciesHasWeaponAttack, setMonsterApparentHeroPosition,
} from './monmove.js';
import { mfndpos, monAllowFlags, monsterMayDigLocation, resistConflict } from './mon.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { couldSeeFromHero, cansee, clearPath, visibleCellsFrom } from './vision.js';
import { trapAt } from './trap.js';
import { attackMonsterWithMonster, beginMonsterMeleeAttack, monsterAttackStopsAggressor } from './mhitm.js';
import { monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt, dismountHero } from './steed.js';
import { dist2, distmin, isok } from './hacklib.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsVampireShifter, monsterTypeName,
} from './monster_data.js';
import { ACCFOOD, CADAVER, DOGFOOD, MANFOOD, UNDEF, dogFood } from './pet_food.js';
import { petDroppableObject } from './dog.js';
import { applyPetHunger } from './pet_hunger.js';
import { beginPetEating, finishPetEating } from './pet_eating.js';
import { releaseMonsterInventory, addObjectToMonsterInventory } from './steal.js';
import { monsterCanCarryObject, monsterCarryAmount } from './mon.js';
import { splitObjectStack } from './object_stack.js';
import { isLevelPrize } from './level_prize.js';
import {
    BOULDER, OBJECT_DESCRIPTIONS, OBJECT_NAMES, SCR_MAIL, TRIPE_RATION, requireObjectData,
} from './object_data.js';
import { loseGuardianAngel } from './guardian_angel.js';
import { heroHasConflict } from './hero_conflict.js';
import { updateMonsterRegions } from './regions.js';
import { goodPosition } from './teleport_rules.js';
import {
    ALLOW_M, ALLOW_MDISP, ALLOW_TRAPS, ALLOW_U, COLNO, D_CLOSED, D_LOCKED, DISMOUNT_THROWN, IS_DOOR, IS_OBSTRUCTED,
    IS_ROOM, Is_rogue_level, MAGIC_PORTAL, MMOVE_DIED, MMOVE_DONE, MMOVE_MOVED, MMOVE_NOTHING, M_ATTK_AGR_DIED,
    M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, DISMOUNT_POLY, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING,
    M_AP_OBJECT, M_AP_TYPE, NEED_HTH_WEAPON, NEED_WEAPON, xdir, ydir,
} from './const.js';
import {
    AD_ACID, AD_COLD, AD_DCAY, AD_ELEC, AD_FIRE, AD_PHYS, AD_RUST, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW,
    AT_ENGL, AT_HUGS, AT_KICK, AT_NONE, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import { canSeeMonster, canSpotMonster, glyphAt, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { remove_object } from './floor_object.js';
import { wieldMonsterWeapon } from './weapon.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { releaseMonsterLeash } from './leash_apply.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { displayMessageWindow } from './tty_topline.js';
import { monsterSentenceSubject, publishMonsterNoise, publishMonsterWhimper } from './ambient_sounds.js';
import { touchPetrifies } from './stoning.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance,
    monsterHasStoneResistance, monsterLocomotion,
} from './mondata.js';
import { monsterReflectsRay } from './ray.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { getTrack } from './track.js';
import { d, rn2, rnd } from './rng.js';
import { requireInitializedGame, requireLiveGame, game } from './gstate.js';

const DOG_HUNGRY = 300;
const M1_SEE_INVIS = 0x01000000;
const MS_LEADER = 36;
const MS_GUARDIAN = 38;
const S_VAMPIRE = 48;
// include/monst.h flag bits used by the moved dogmove.c helpers.
const M1_TUNNEL = 0x00000020;
const M1_WALLWALK = 0x00000008;
const M1_NOEYES = 0x00001000;
const M2_NEUTER = 0x00040000;
// include/objclass.h nofetch classes dog_invent() refuses to carry.
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

// C dogmove.c:pet_ranged_attk(). Selection and hunger precede the shared
// monster attack; only a forced attempt without an admitted target makes noise.
export function selectPetRangedTarget(
    pet: Monster,
    state: PlayingGameState,
    { forced = false, random = rn2, rollOne = rnd }: PetTargetOptions = {},
): PetRangedSelection {
    const hungry = !pet.isminion && state.moves > (pet.edog?.hungrytime ?? 0) + DOG_HUNGRY;
    const target = bestPetRangedTarget(pet, state, { forced, random, rollOne });
    if (!target || (hungry && random(5) !== 0)) {
        return { target: null, makeNoise: forced };
    }
    return { target, makeNoise: false };
}

// C dogmove.c:best_target().
export function bestPetRangedTarget(
    pet: Monster,
    state: PlayingGameState,
    { forced = false, random = rn2, rollOne = rnd }: PetTargetOptions = {},
): PetRangedTarget | null {
    if (pet.mcansee === 0 || pet.mcansee === false) return null;
    let bestTarget: PetRangedTarget | null = null;
    let bestScore = -40000;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const target = findTarget(pet, dx, dy, state);
            if (!target) continue;
            const score = scoreTarget(pet, target, state, random, rollOne);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }
    }
    return !forced && bestScore < 0 ? null : bestTarget;
}

export function monsterBreathAttack(monster: Monster): AttackTuple | null {
    return MONSTER_ATTACKS[monster.mnum]?.find(([attackType]) => attackType === AT_BREA) ?? null;
}

function isHeroTarget(target: PetRangedTarget, state: PlayingGameState): target is Hero {
    return target === state.u;
}

function targetPosition(target: PetRangedTarget, state: PlayingGameState) {
    return isHeroTarget(target, state)
        ? { x: state.u.ux, y: state.u.uy }
        : { x: target.mx, y: target.my };
}

function petSeesInvisible(pet: Monster) {
    return !!((MONSTER_FLAGS1[pet.mnum] ?? 0) & M1_SEE_INVIS);
}

function petCanSee(pet: Monster, x: number, y: number) {
    return clearPath(pet.mx, pet.my, x, y);
}

// C dogmove.c:find_targ(). Walks outward for a ranged-attack target.
function findTarget(
    pet: Monster,
    dx: number,
    dy: number,
    state: PlayingGameState,
): PetRangedTarget | null {
    let x = pet.mx;
    let y = pet.my;
    for (let distance = 0; distance < 7; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y) || !petCanSee(pet, x, y)) break;
        if (x === pet.mux && y === pet.muy) return state.u;

        const target = monsterAtPosition(state.level, x, y);
        if (!target) continue;
        if ((!target.minvis || petSeesInvisible(pet)) && !target.mundetected
            && target.mx === x && target.my === y) return target;
    }
    return null;
}

function targetHasFriendBehind(pet: Monster, target: PetRangedTarget, state: PlayingGameState) {
    const targetPos = targetPosition(target, state);
    const dx = Math.sign(targetPos.x - pet.mx);
    const dy = Math.sign(targetPos.y - pet.my);
    let x = targetPos.x;
    let y = targetPos.y;
    let distance = distmin(pet.mx, pet.my, x, y);

    for (; distance <= 15; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y) || !petCanSee(pet, x, y)) return false;
        if (x === pet.mux && y === pet.muy) return true;

        const friend = monsterAtPosition(state.level, x, y);
        if (!friend) continue;
        if (friend.mtame) {
            if (!friend.minvis || petSeesInvisible(pet)) return true;
            continue;
        }
        const sound = questMonsterSound(friend.mnum, state);
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return true;
    }
    return false;
}

function holyAlignment(monster: PetRangedTarget) {
    if (!('mnum' in monster)) return { faithful: false, alignment: null };
    if (monster.isminion) {
        return {
            faithful: true,
            alignment: monster.emin?.min_align ?? monster.mextra?.emin?.min_align,
        };
    }
    if (monster.ispriest) {
        return {
            faithful: true,
            alignment: monster.epri?.shralign ?? monster.mextra?.epri?.shralign,
        };
    }
    return { faithful: false, alignment: null };
}

function onQuestStartLevel(state: PlayingGameState) {
    return state._activeSpecialLevel?.prototype?.endsWith('-strt') || false;
}

// C dogmove.c:score_targ().
function scoreTarget(
    pet: Monster,
    target: PetRangedTarget,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
) {
    let score = 0;
    if (!pet.mconf || random(3) === 0 || onQuestStartLevel(state)) {
        const petFaith = holyAlignment(pet);
        const targetFaith = holyAlignment(target);
        const sound = isHeroTarget(target, state) ? 0 : questMonsterSound(target.mnum, state);
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return -5000;
        if (
            petFaith.faithful &&
            targetFaith.faithful &&
            petFaith.alignment === targetFaith.alignment &&
            !isHeroTarget(target, state) &&
            target.mpeaceful
        )
            return -5000;

        const targetPos = targetPosition(target, state);
        if (distmin(pet.mx, pet.my, targetPos.x, targetPos.y) <= 1) return -3000;
        if (isHeroTarget(target, state) || target.mtame) return -3000;
        if (targetHasFriendBehind(pet, target, state)) return -3000;
        if (!target.mpeaceful) score += 10;
        if ((MONSTER_ATTACKS[target.mnum]?.[0]?.[0] ?? 0) === 0) score -= 1000;

        const petLevel = pet.m_lev ?? MONSTER_LEVEL[pet.mnum] ?? 0;
        const targetLevel = target.m_lev ?? MONSTER_LEVEL[target.mnum] ?? 0;
        const heroLevel = state.u?.ulevel ?? 1;
        if (
            (targetLevel < 2 && petLevel > 5) ||
            (petLevel > 12 &&
                targetLevel < petLevel - 9 &&
                heroLevel > 8 &&
                targetLevel < heroLevel - 7)
        ) {
            score -= 25;
        }

        let attackLevel = petLevel;
        if (monsterIsVampireShifter(pet) && MONSTER_SYMBOL[pet.mnum] !== S_VAMPIRE) {
            attackLevel =
                (pet.cham === undefined ? undefined : MONSTER_LEVEL[pet.cham]) ?? petLevel;
            attackLevel += random(Math.trunc(attackLevel / 2) + 1);
            attackLevel = Math.max(attackLevel, petLevel);
        }
        if (targetLevel > attackLevel + 4) score -= (targetLevel - attackLevel) * 20;
        score += targetLevel * 2 + Math.trunc((target.mhp ?? 0) / 3);
    }

    score += rollOne(5);
    if (pet.mconf && random(3) === 0) score -= 1000;
    return score;
}

function nearbyFloorObjects(monster: Monster, state: PlayingGameState) {
    const objects = [];
    let scanOrder = 0;
    const minX = Math.max(1, monster.mx - 5);
    const maxX = Math.min(79, monster.mx + 5);
    const minY = Math.max(0, monster.my - 5);
    const maxY = Math.min(20, monster.my + 5);
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (const object of state?.level?.objects?.[x]?.[y] || []) {
                objects.push({ object, scanOrder: scanOrder++ });
            }
        }
    }
    // C walks the global fobj chain newest-first, independently of map
    // coordinates.  Explicitly linked runtime drops carry that order; older
    // generated objects retain the established coordinate-order fallback
    // until every construction path shares the same floor-chain owner.
    return objects
        .sort((a, b) => {
            const ao = a.object._fobjOrder;
            const bo = b.object._fobjOrder;
            if (isFiniteNumber(ao) || isFiniteNumber(bo)) {
                if (!isFiniteNumber(ao)) return 1;
                if (!isFiniteNumber(bo)) return -1;
                if (ao !== bo) return bo - ao;
            }
            return a.scanOrder - b.scanOrder;
        })
        .map((entry) => entry.object);
}

// C dogmove.c:can_reach_location().
function petCanReachLocation(
    monster: Monster,
    mx: number,
    my: number,
    fx: number,
    fy: number,
    state: PlayingGameState,
) {
    if (mx === fx && my === fy) return true;
    if (!isok(mx, my)) return false;

    // dogmove.c does not run a general pathfinder here.  It recursively takes
    // only neighbours which strictly reduce squared distance to the object.
    // That distinction matters for niche/corner objects: a BFS can find a
    // detour which the C anti-stuck check deliberately rejects.
    const distance = dist2(mx, my, fx, fy);
    for (let x = mx - 1; x <= mx + 1; x++) {
        for (let y = my - 1; y <= my + 1; y++) {
            if (!isok(x, y) || dist2(x, y, fx, fy) >= distance) continue;
            const loc = state?.level?.at?.(x, y);
            if (!loc) continue;
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if (IS_OBSTRUCTED(loc.typ) && !(flags & M1_WALLWALK)
                && (!monsterMayDigLocation(loc) || !(flags & M1_TUNNEL)
                    || Is_rogue_level(state.u.uz, state))) continue;
            if (IS_DOOR(loc.typ) && (loc.doormask ?? 0) & (D_CLOSED | D_LOCKED)) continue;
            if (!monsterCouldReachItem(monster, x, y, state)) continue;
            if (petCanReachLocation(monster, x, y, fx, fy, state)) return true;
        }
    }
    return false;
}

function petCanReachObject(monster: Monster, object: GameObject, state: PlayingGameState) {
    const targetX = object?.ox;
    const targetY = object?.oy;
    if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return false;
    return (
        monsterCouldReachItem(monster, targetX, targetY, state) &&
        petCanReachLocation(monster, monster.mx, monster.my, targetX, targetY, state)
    );
}

function dogGoal(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    calls: MonsterCallLog,
) {
    if (monster === state.u.usteed) return null;
    // Preserve the object-screening side effects before falling back to the
    // hero.  Preferred nearby food owns the goal outright; this is what lets
    // a pony pursue a just-thrown carrot instead of its master's square.
    const ux = state?.u?.ux ?? monster.mx;
    const uy = state?.u?.uy ?? monster.my;
    // dog_move() computes this before dog_goal() and uses it again while
    // scoring movement candidates, including when dog_goal() finds food.
    const whappr = !!monster.edog && state.moves - (monster.edog.whistletime ?? 0) < 5;
    const followsMasterDirectly = !monster.edog || !!monster.mleashed;
    let foodGoal = null;
    let foodType = UNDEF;
    let apportGoal = null;
    const inMastersSight = couldSeeFromHero(state, monster.mx, monster.my);
    const dogHasInventory = !!petDroppableObject(monster);
    const petTile = state?.level?.at?.(monster.mx, monster.my);
    const heroTile = state?.level?.at?.(ux, uy);
    const lightingAllowsFetch = !petTile?.lit || !!heroTile?.lit;
    const nearbyObjects = followsMasterDirectly ? [] : nearbyFloorObjects(monster, state);
    for (const object of nearbyObjects) {
        const type = dogFood(monster, object, random, calls, state);
        const cursedAtLocation = (state?.level?.objects?.[object.ox]?.[object.oy] || []).some(
            (item) => item.cursed,
        );
        const avoidsCursedPile = cursedAtLocation
            && !(monster.edog?.mhpmax_penalty && type < MANFOOD);
        if (avoidsCursedPile || !petCanReachObject(monster, object, state)) continue;
        if (
            type < MANFOOD &&
            (type < foodType ||
                (type === foodType &&
                    foodGoal &&
                    dist2(object.ox, object.oy, monster.mx, monster.my) <
                        dist2(foodGoal.ox, foodGoal.oy, monster.mx, monster.my)))
        ) {
            foodGoal = object;
            foodType = type;
        } else if (
            type >= MANFOOD &&
            type < UNDEF &&
            // C stores both food and fetch candidates in gg.gtyp.  Once a
            // preferred food has lowered it below MANFOOD, every later
            // APPORT object is inferior and skips the rn2(8) gate.
            !foodGoal &&
            !apportGoal &&
            inMastersSight &&
            !dogHasInventory &&
            lightingAllowsFetch &&
            // dogmove.c:dog_goal().  MANFOOD is worth evaluating even when
            // the pet cannot see it directly; ordinary APPORT objects still
            // require m_cansee(), whose source macro is clear_path().
            (type === MANFOOD || clearPath(monster.mx, monster.my, object.ox, object.oy)) &&
            (monster.edog?.apport ?? 0) > recordRandom(random, calls, 8) &&
            monsterCanCarryObject(monster, object, state, random)
        ) {
            apportGoal = object;
        }
    }

    let goalX = ux;
    let goalY = uy;
    // C keeps a tempting cadaver as a provisional goal until after the floor
    // scan.  A content pet ignores it and falls back to following its master;
    // only preferred dog food, or food whose hunger time has arrived, wins.
    const hungryTime = monster?.edog?.hungrytime ?? 0;
    let hasObjectGoal = false;
    if (foodGoal) {
        if (foodType === DOGFOOD || state.moves >= hungryTime) {
            goalX = foodGoal.ox;
            goalY = foodGoal.oy;
            hasObjectGoal = true;
        }
        // A superior but currently unappetizing cadaver still overwrites an
        // earlier APPORT candidate in C's single gtyp slot.  The content pet
        // follows its master; it must not fall back to the inferior object.
    } else if (apportGoal) {
        goalX = apportGoal.ox;
        goalY = apportGoal.oy;
        hasObjectGoal = true;
    }
    const udist = dist2(monster.mx, monster.my, ux, uy);
    // initedog() starts whistletime at zero. During the opening moves this
    // makes dog_move() treat the pet as recently called even though the hero
    // has not used a whistle yet; that short-lived state is observable in
    // candidate choice and suppresses away-from-goal alternatives.
    const selectsFollowDistance = !followsMasterDirectly && !hasObjectGoal;
    let appr = selectsFollowDistance ? udist >= 9 ? 1 : monster.mflee ? -1 : 0 : 1;
    if (selectsFollowDistance && udist > 1) {
        const heroTile = state?.level?.at?.(ux, uy);
        if (
            !IS_ROOM(heroTile?.typ ?? 0) ||
            recordRandom(random, calls, 4) === 0 ||
            whappr ||
            (dogHasInventory &&
                recordRandom(random, calls, Math.max(1, monster.edog?.apport ?? 1)) !== 0)
        )
            appr = 1;
    }
    // C dog_goal(): when an otherwise content pet has no approach direction,
    // preferred food in the hero's live inventory makes it follow closely.
    // Inventory order is observable because dogfood() calls obj_resists()
    // before classifying each item and stops at the first DOGFOOD entry.
    if (appr === 0) {
        let onStairs = false;
        for (let stair = state.stairs; stair; stair = stair.next) {
            if (stair.sx === ux && stair.sy === uy) {
                onStairs = true;
                break;
            }
        }
        if (onStairs) {
            appr = 1;
        } else {
            const carried = state.inventory;
            for (const object of carried) {
                if (dogFood(monster, object, random, calls, state) === DOGFOOD) {
                    appr = 1;
                    break;
                }
            }
            if (appr === 0) {
                const portal = state?.level?.traps?.find((trap) => trap.ttyp === MAGIC_PORTAL);
                if (portal && dist2(ux, uy, portal.tx, portal.ty) <= 2) appr = 1;
            }
        }
    }
    if (monster.mconf) appr = 0;

    // C dog_goal(): a pet which cannot currently see its master follows the
    // newest adjacent hero track instead of targeting the hero through rock.
    // This changes candidate scoring without adding an RNG call, making it a
    // classic screen-equal/stream-different boundary.
    if (goalX === ux && goalY === uy && !inMastersSight) {
        const track = getTrack(monster.mx, monster.my, state);
        if (track) {
            goalX = track.x;
            goalY = track.y;
            if (monster.edog?.ogoal) monster.edog.ogoal.x = 0;
        } else if (
            monster.edog?.ogoal?.x &&
            (monster.edog.ogoal.x !== monster.mx || monster.edog.ogoal.y !== monster.my)
        ) {
            goalX = monster.edog.ogoal.x;
            goalY = monster.edog.ogoal.y;
            monster.edog.ogoal.x = 0;
        } else {
            // C dog_goal(): if the master and every recent track are out of
            // view, do_clear_area(..., wantdoor) chooses the square visible
            // from the pet which is closest to the hero.
            let bestDistance = (COLNO + 2) * (COLNO + 2);
            let best = null;
            const clearAreaCells = visibleCellsFrom(monster.mx, monster.my, 9);
            for (const cell of clearAreaCells) {
                const distance = dist2(cell.x, cell.y, ux, uy);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = cell;
                }
            }
            if (best && (best.x !== monster.mx || best.y !== monster.my)) {
                goalX = best.x;
                goalY = best.y;
                if (monster.edog?.ogoal) {
                    monster.edog.ogoal.x = goalX;
                    monster.edog.ogoal.y = goalY;
                }
            }
        }
    } else if (monster.edog?.ogoal) {
        monster.edog.ogoal.x = 0;
    }
    return { x: goalX, y: goalY, appr, whappr };
}

// C dogmove.c:dog_invent().  The drop, the visible "picks up" line, and
// dog_eat() all belong to this one transaction: each awaits its own
// messages before the floor pile or the pet's inventory changes.  Returns 1
// when a meal spent the move, 2 when the pet died, 0 otherwise.
async function dogInvent(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollDice: RollDice,
    rollOne: RollOne,
    calls: MonsterCallLog,
): Promise<{ result: 0 | 1 | 2; dropped?: GameObject[] }> {
    if (!monster.edog || monster.meating || monster.mfrozen || monster.msleeping)
        return { result: 0 };
    const udist =
        monster === state.u.usteed
            ? 1
            : dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my);
    if (petDroppableObject(monster)) {
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        let release = recordRandom(random, calls, udist + 1) === 0;
        if (!release) release = recordRandom(random, calls, apport) === 0;
        if (release && recordRandom(random, calls, 10) < apport) {
            const dropped = await releaseMonsterInventory(monster, state, {
                isPet: true,
                show: !!monster.minvis,
                random,
            });
            if (monster.edog && monster.edog.apport > 1) monster.edog.apport--;
            if (monster.edog) {
                monster.edog.dropdist = udist;
                monster.edog.droptime = state?.moves ?? 1;
            }
            return dropped.length ? { result: 0, dropped } : { result: 0 };
        }
        return { result: 0 };
    }
    const object = state?.level?.objects?.[monster.mx]?.[monster.my]?.[0];
    if (!object) return { result: 0 };
    // dog_invent() rejects the nofetch classes before dogfood().  In
    // particular, a pet standing on a statue must not consume an
    // obj_resists() draw here; dog_goal() will still inspect that same floor
    // object through the global fobj scan.
    const fetchableClass =
        object.oclass !== BALL_CLASS &&
        object.oclass !== CHAIN_CLASS &&
        object.oclass !== ROCK_CLASS;
    // C dogmove.c:dog_invent() also refuses delivery mail outright, before
    // dogfood() can spend its obj_resists() draw on the scroll.
    if (!fetchableClass || object.otyp === SCR_MAIL || isLevelPrize(object, state))
        return { result: 0 };
    const edible = dogFood(monster, object, random, calls, state);
    if ((edible <= CADAVER || monster.edog?.mhpmax_penalty && edible === ACCFOOD)
        && monsterCouldReachItem(monster, monster.mx, monster.my, state)) {
        const meal = beginPetEating(monster, object,
            { x: monster.mx, y: monster.my }, state);
        await finishPetEating(monster, meal, state, random, calls);
        return { result: monster.dead || monster.mhp <= 0 ? 2 : 1 };
    }
    const carryAmount = fetchableClass ? monsterCarryAmount(monster, object, state, random) : 0;
    if (carryAmount > 0 && !object.cursed
        && monsterCouldReachItem(monster, monster.mx, monster.my, state)) {
        // C dog_invent(): a failed pickup leaves the floor pile unchanged.
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        if (recordRandom(random, calls, 20) < apport + 3) {
            const approach = recordRandom(random, calls, Math.max(1, udist));
            if (approach !== 0 || recordRandom(random, calls, apport) === 0) {
                const quantity = object.quan ?? object.quantity ?? 1;
                let pickedUp = object;
                if (carryAmount !== quantity) {
                    const split = splitObjectStack(object, carryAmount, state);
                    if (!split)
                        throw new Error('A positive pet pickup amount must split its stack');
                    pickedUp = split;
                    calls.push('rnd(2)');
                }
                // dogmove.c:dog_invent() names the object with doname() while
                // it is still on the floor; obj_extract_self(), newsym() and
                // mpickobj() follow that line, in that order.
                if (cansee(monster.mx, monster.my)) {
                    observeDistantObjectForNaming(pickedUp);
                    const name = await inventoryItemDescription(pickedUp);
                    if (state.flags.verbose !== false) {
                        await plineWithContinuation(
                            `${visibleMonsterSubject(monster)} picks up ${name}.`,
                        );
                    }
                }
                await commitPetPickup(monster, pickedUp, state);
                return { result: 0 };
            }
        }
    }
    return { result: 0 };
}

// dogmove.c:dog_invent(): after the visible "picks up" line, obj_extract_self()
// and mpickobj() move the chosen object into the pet's inventory.
export async function commitPetPickup(
    monster: Monster,
    object: GameObject,
    state: PlayingGameState,
) {
    remove_object(object, state);
    await newsym(monster.mx, monster.my);
    await addObjectToMonsterInventory(monster, object, state);
    if (speciesHasWeaponAttack(monster.mnum) && monster.weaponCheck === NEED_WEAPON) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state);
    }
    checkMonsterGearNextTurn(monster);
}

interface PetRangedAttackOptions {
    forced?: boolean;
    random?: RandomBelow;
    rollDice?: RollDice;
    rollOne?: RollOne;
    calls?: MonsterCallLog;
}

export interface PetRangedAttackResult {
    status: number;
    heroDied: boolean;
    attack?: MonsterCombatResult;
    counterattack?: MonsterCombatResult;
}

// C dogmove.c:pet_ranged_attk(). Selection precedes one complete mattackm or
// mattacku action; only the original target can answer it with a counterattack.
export async function performPetRangedAttack(
    pet: Monster, state: PlayingGameState, {
        forced = false, random = rn2, rollDice = d, rollOne = rnd,
        calls = DISCARDED_CALL_LOG,
    }: PetRangedAttackOptions = {},
): Promise<PetRangedAttackResult> {
    requireLiveGame(state);
    const selection = selectPetRangedTarget(pet, state, {
        forced, random: range => recordRandom(random, calls, range),
        rollOne: sides => { calls.push(`rnd(${sides})`); return rollOne(sides); },
    });
    const target = selection.target;
    if (!target) {
        if (selection.makeNoise) await publishMonsterNoise(pet, state);
        return { status: MMOVE_NOTHING, heroDied: !!state.program_state.gameover };
    }
    if (!('mnum' in target)) {
        const heroAttack = await performMonsterHeroAttack(pet, state, { random, rollDice, rollOne, calls });
        return { status: heroAttack.nativeResult === 1 ? MMOVE_DIED : MMOVE_DONE, heroDied: heroAttack.heroDied };
    }
    const attack = await attackMonsterWithMonster(pet, target, {
        state, random, rollDice, rollOne, calls,
        target: { x: pet.mx, y: pet.my, notOnHead: false },
    });
    const nativeResult = attack.kind === 'monster-attack' ? attack.nativeResult ?? M_ATTK_MISS : M_ATTK_MISS;
    const result: PetRangedAttackResult = {
        status: nativeResult === M_ATTK_MISS ? MMOVE_NOTHING : MMOVE_DONE,
        heroDied: !!attack.heroDied, attack,
    };
    if (nativeResult & M_ATTK_AGR_DIED) result.status = MMOVE_DIED;
    if (result.heroDied || result.status === MMOVE_DIED) return result;
    if ((nativeResult & M_ATTK_HIT) && !(nativeResult & M_ATTK_DEF_DIED)
        && recordRandom(random, calls, 4) !== 0 && target.mcansee
        && !((MONSTER_FLAGS1[target.mnum] ?? 0) & M1_NOEYES)) {
        const response = await attackMonsterWithMonster(target, pet,
            { state, random, rollDice, rollOne, calls });
        result.counterattack = response;
        result.heroDied = !!response.heroDied;
        if (response.kind === 'monster-attack' && ((response.nativeResult ?? 0) & M_ATTK_DEF_DIED))
            result.status = MMOVE_DIED;
    }
    return result;
}

async function petAttacksMonster(
    pet: Monster,
    target: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollDice: RollDice,
    rollOne: RollOne,
    calls: MonsterCallLog,
    selected: Position,
) {
    return await beginMonsterMeleeAttack(
        pet,
        target,
        state,
        random,
        rollDice,
        rollOne,
        calls,
        'pet',
        selected,
    );
}

// C mondata.c:max_passive_dmg().  dog_move() uses the defender's maximum
// passive retaliation, multiplied by the pet's number of contact attacks, as
// a deterministic safety gate before any melee to-hit roll is allowed.
export function maxPassiveMonsterDamage(defender: Monster, aggressor: Monster) {
    const contactTypes = new Set([
        AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_HUGS,
        AT_ENGL, AT_TENT, AT_WEAP,
    ]);
    const contactCount = (MONSTER_ATTACKS[aggressor?.mnum] || []).filter(([attackType]) =>
        contactTypes.has(attackType),
    ).length;
    if (!contactCount) return 0;

    const species = MONSTER_NAME[aggressor.mnum];
    for (const [attackType, damageType, dice, sides] of MONSTER_ATTACKS[defender?.mnum] || []) {
        if (attackType !== AT_NONE && attackType !== AT_BOOM) continue;
        // These bodies are destroyed by contact regardless of resistance or HP.
        if (damageType === AD_FIRE && (species === 'paper golem' || species === 'straw golem')
            || damageType === AD_DCAY && (species === 'wood golem' || species === 'leather golem')
            || damageType === AD_RUST && species === 'iron golem')
            return aggressor.mhp * contactCount;
        const resisted =
            (damageType === AD_FIRE && monsterHasFireResistance(aggressor)) ||
            (damageType === AD_COLD && monsterHasColdResistance(aggressor)) ||
            (damageType === AD_ELEC && monsterHasShockResistance(aggressor)) ||
            (damageType === AD_ACID && monsterHasAcidResistance(aggressor));
        if (resisted) return 0;
        if (![AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType)) return 0;
        const count = dice || (MONSTER_LEVEL[defender.mnum] ?? 0) + 1;
        return count * sides * contactCount;
    }
    return 0;
}

// dogmove.c:dog_move()'s plan through the newdogpos section.  `food` holds
// the do_eat object; `dropped` carries dog_invent()'s release for callers
// that report it on the movement record.
interface PetMovePlan {
    oldx: number;
    oldy: number;
    nix: number;
    niy: number;
    selectedInfo: number;
    reluctant: boolean;
    dropped?: GameObject[] | undefined;
    food: GameObject | null;
}

// C dogmove.c:dog_move() newdogpos: the ALLOW_U mattacku(), the swap to the
// chosen square, the reluctant-step line, mon_track_add(), dog_eat(), and
// the leash kludge for a pet which stayed in place.  Every message here is
// awaited in C order; postmov() follows only after this returns.
async function finishPetMovePlan(
    monster: Monster,
    state: PlayingGameState,
    plan: PetMovePlan,
    random: RandomBelow,
    rollDice: RollDice,
    rollOne: RollOne,
    calls: MonsterCallLog,
): Promise<MonsterMovement> {
    const { oldx, oldy, selectedInfo, reluctant, dropped, food } = plan;
    let { nix, niy } = plan;
    if (selectedInfo & ALLOW_U) {
        if (monster.mleashed) {
            const pronoun =
                (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER
                    ? 'its'
                    : monster.female
                      ? 'her'
                      : 'his';
            const subject = canSpotMonster(monster) ? monsterSentenceSubject(monster) : 'It';
            await plineWithContinuation(`${subject} breaks loose of ${pronoun} leash!`);
            releaseMonsterLeash(monster, state);
        }
        // C dog_move() runs mattacku() to completion here.  The hero-contact
        // messages are presented with the turn driver's contact deferral
        // already closed, exactly as the presenter did for the deferred flag.
        const attack = await beginMonsterHeroAttack(
            monster,
            state,
            random,
            rollOne,
            rollDice,
            calls,
        );
        const heroAction: MonsterMovementAction = {
            monster,
            calls,
            movement: {
                oldx,
                oldy,
                x: oldx,
                y: oldy,
                moved: false,
                ...attack,
            },
        };
        const previousDeferral = state._deferVisibleMonsterContact;
        state._deferVisibleMonsterContact = false;
        let heroDied = false;
        try {
            heroDied = (await presentMonsterAttackEffects(
                heroAction,
                state,
                { random, rollDice, rollOne },
            )).heroDied;
        } finally {
            state._deferVisibleMonsterContact = previousDeferral;
        }
        const offensive = heroAction.movement.heroAttackSequence?.offensive;
        const attackDeath = heroAction.movement.heroAttackResult === 1
            || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
        const petDied = monster.dead || monster.mhp <= 0;
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            heroAttackResult: attackDeath || petDied ? 1 : 0,
            ...(heroDied ? { heroDied: true } : {}),
            actionCompleted: true,
            postMoveStatus: petDied ? MMOVE_DIED : MMOVE_DONE,
            movementStage: 'postmov',
            ...(dropped ? { dropped } : {}),
        };
    }

    if (nix !== oldx || niy !== oldy) {
        updateMonsterRegions(monster, state, { x: nix, y: niy });
        if (await readyMonsterDiggingWeapon(monster, state, nix, niy)) {
            return {
                oldx, oldy, x: oldx, y: oldy, moved: false,
                postMoveStatus: MMOVE_NOTHING, movementStage: 'postmov',
                ...(dropped ? { dropped } : {}),
            };
        }
    }
    let moved = false;
    if (nix !== oldx || niy !== oldy) {
        // C dog_move() samples canseemon() before the swap so the reluctant
        // line can still refer to a pet that was visible before the move.
        const wasseen = canSeeMonster(monster);
        removeMonsterFromMapAt(oldx, oldy, state);
        await placeMonsterOnMap(monster, nix, niy, state);
        if (!Array.isArray(monster.mtrack)) monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
        if (reluctant && (wasseen || canSeeMonster(monster))) {
            await plineWithContinuation(await reluctantPetMessage(monster, { x: nix, y: niy }));
        }
        moved = true;
    } else {
        await pullLeashedPetCloser(monster, state, random, calls);
        nix = monster.mx;
        niy = monster.my;
    }
    let died = false;
    if (food) {
        // C dog_move() calls dog_eat() only after mon_track_add().
        const meal = beginPetEating(monster, food, { x: oldx, y: oldy }, state);
        await finishPetEating(monster, meal, state, random, calls);
        if (monster.dead || monster.mhp <= 0) died = true;
    }
    const movement: MonsterMovement = {
        oldx,
        oldy,
        x: nix,
        y: niy,
        moved,
        postMoveStatus: died ? MMOVE_DIED : MMOVE_MOVED,
        movementStage: 'postmov',
        ...(dropped ? { dropped } : {}),
    };
    if (movement.moved && reluctant) movement.reluctant = true;
    return movement;
}

// C dog_move() keeps a leashed pet close even after an action which left it
// in place. Its fallback probes use dirtocoord's map coordinates as written.
async function pullLeashedPetCloser(
    monster: Monster, state: PlayingGameState, random: RandomBelow, calls: MonsterCallLog,
): Promise<void> {
    if (!monster.mleashed || dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 4) return;
    const dx = Math.sign(monster.mx - state.u.ux);
    const dy = Math.sign(monster.my - state.u.uy);
    let destination = { x: state.u.ux + dx, y: state.u.uy + dy };
    const reachable = (position: Position) => goodPosition(position.x, position.y,
        { kind: 'monster', monster }, { state });
    if (!reachable(destination)) {
        const direction = xdir.findIndex((x, i) => i < 8 && x === dx && ydir[i] === dy);
        let found = false;
        for (const spread of [1, 2]) {
            for (let j = (direction + 8 - spread) % 8; j < (direction + spread) % 8; j++) {
                const x = xdir[j], y = ydir[j];
                if (x === undefined || y === undefined) continue;
                const candidate = { x, y };
                if (!reachable(candidate)) continue;
                destination = candidate;
                found = true;
                break;
            }
            if (found) break;
        }
        if (!found) destination = { x: monster.mx, y: monster.my };
    }
    // The native region check precedes placement and uses the unchanged
    // planned square when this is a forced leash move.
    updateMonsterRegions(monster, state);
    removeMonsterFromMapAt(monster.mx, monster.my, state);
    await placeMonsterOnMap(monster, destination.x, destination.y, state);
    await newsym(monster.mx, monster.my);
    setMonsterApparentHeroPosition(monster, state, random, calls);
}

export async function movePet(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollDice: RollDice,
    rollOne: RollOne,
    calls: MonsterCallLog,
): Promise<MonsterMovement> {
    const oldx = monster.mx;
    const oldy = monster.my;
    const masterDistance = dist2(oldx, oldy, state.u.ux, state.u.uy);
    if (monster.edog && await applyPetHunger(monster, state)) {
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            postMoveStatus: MMOVE_DIED, movementStage: 'postmov',
        };
    }
    if (
        monster === state.u.usteed &&
        heroHasConflict(state) &&
        !resistConflict(monster, state, rollOne, calls)
    ) {
        await dismountHero(DISMOUNT_THROWN, { state });
        return {
            oldx,
            oldy,
            x: monster.mx,
            y: monster.my,
            moved: false,
            postMoveStatus: MMOVE_MOVED,
            movementStage: 'postmov',
        };
    }
    if (monster !== state.u.usteed
        && oldx === state.u.ux && oldy === state.u.uy) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            postMoveStatus: MMOVE_NOTHING, movementStage: 'postmov',
        };
    }
    // C dog_move() sets nix/niy before dog_invent(); a meal found there
    // jumps to newdogpos without choosing a destination.
    let nix = oldx;
    let niy = oldy;
    let dropped: GameObject[] | undefined;
    if (monster.edog) {
        const inventory = await dogInvent(monster, state, random, rollDice, rollOne, calls);
        dropped = inventory.dropped;
        if (inventory.result === 2 || monster.dead || monster.mhp <= 0) {
            return {
                oldx, oldy, x: monster.mx, y: monster.my, moved: false,
                actionCompleted: true,
                postMoveStatus: MMOVE_DIED, movementStage: 'postmov',
                ...(dropped ? { dropped } : {}),
            };
        }
        if (inventory.result === 1) {
            // The meal spent the move; newdogpos can only apply the leash
            // kludge to draw the pet back toward its master.
            return finishPetMovePlan(monster, state, {
                oldx,
                oldy,
                nix,
                niy,
                selectedInfo: 0,
                reluctant: false,
                dropped,
                food: null,
            }, random, rollDice, rollOne, calls);
        }
    }
    const goal = dogGoal(monster, state, random, calls);
    if (!goal)
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            postMoveStatus: MMOVE_NOTHING,
            movementStage: 'postmov',
            ...(dropped ? { dropped } : {}),
        };
    if (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls)
        && !monster.edog) {
        const departure = await loseGuardianAngel(monster, state);
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            actorLeftLevel: true, heroDied: departure.heroDied,
            actionCompleted: true, postMoveStatus: MMOVE_DIED, movementStage: 'postmov',
            ...(dropped ? { dropped } : {}),
        };
    }
    const allowFlags = monAllowFlags(monster, state, rollOne, calls);
    const candidates = await mfndpos(monster, state, allowFlags);
    const uncursedCount = candidates.filter(
        ({ x, y }) => !(state?.level?.objects?.[x]?.[y] || []).some((object) => object.cursed),
    ).length;
    let nidist = dist2(nix, niy, goal.x, goal.y);
    let chcnt = 0;
    let reluctant = false;
    let selectedInfo = 0;

    for (const candidate of candidates) {
        const { x: nx, y: ny } = candidate;
        const nextMasterDistance = dist2(nx, ny, state.u.ux, state.u.uy);
        if (monster.mleashed && nextMasterDistance > 4) continue;
        if (!monster.edog && nextMasterDistance > 16 && nextMasterDistance >= masterDistance)
            continue;
        if (candidate.info & ALLOW_M) {
            const target = monsterAtPosition(state.level, nx, ny);
            if (!target) continue;
            const petLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
            const balk =
                petLevel +
                Math.trunc(
                    (5 * (monster.mhp ?? 1)) / Math.max(1, monster.mhpmax ?? monster.mhp ?? 1),
                ) -
                2;
            if ((target.m_lev ?? MONSTER_LEVEL[target.mnum] ?? 0) >= balk) continue;
            // C dogmove.c:dog_move().  Outside Conflict, two tame monsters
            // are allies even when mfndpos() marks the occupied square with
            // ALLOW_M.  Keep scanning movement candidates rather than
            // manufacturing a zero-hit attack transaction between pets.
            if (target.mtame && monster.mtame && !heroHasConflict(state)) continue;
            if (maxPassiveMonsterDamage(target, monster) >= (monster.mhp ?? 1)) continue;
            const targetSound = questMonsterSound(target.mnum, state);
            if ((monster.mhp * 4 < monster.mhpmax
                || targetSound === MS_GUARDIAN || targetSound === MS_LEADER)
                && target.mpeaceful && !heroHasConflict(state)) continue;
            // dog_move() usually avoids paralysis and petrifying contact even
            // when the expected passive HP damage would be survivable.
            const avoidsEye = target.mnum === MONSTER_NAME.indexOf('floating eye')
                && recordRandom(random, calls, 10) !== 0
                && !!monster.mcansee
                && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
                && !!target.mcansee
                && (!target.minvis || !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS))
                && !monsterReflectsRay(monster, state);
            const avoidsCube = target.mnum === MONSTER_NAME.indexOf('gelatinous cube')
                && recordRandom(random, calls, 10) !== 0;
            const avoidsPetrification = touchPetrifies(target.mnum)
                && !monsterHasStoneResistance(monster);
            if (avoidsEye || avoidsCube || avoidsPetrification) continue;
            // C dog_move()'s mattackm(), including the defender's return
            // attack, completes inside this transaction.
            const attack = await petAttacksMonster(
                monster,
                target,
                state,
                random,
                rollDice,
                rollOne,
                calls,
                { x: nx, y: ny },
            );
            return {
                oldx,
                oldy,
                x: oldx,
                y: oldy,
                moved: false,
                postMoveStatus: monsterAttackStopsAggressor(attack) ? MMOVE_DIED : MMOVE_DONE,
                movementStage: 'postmov',
                ...(dropped ? { dropped } : {}),
            };
        }
        if (monsterAvoidsKickedLocation(monster, nx, ny, state)) continue;
        if (monsterAvoidsSokobanPushLocation(monster, nx, ny, state)) continue;
        // dog_move() handles traps before inspecting the candidate's object
        // pile.  A pet usually refuses a harmful trap the hero has seen, but
        // an unseen trap remains eligible even when the pet knows its type.
        const trap = trapAt(state, nx, ny);
        if (candidate.info & ALLOW_TRAPS && trap) {
            if (monster.mleashed) {
                if (!heroIsDeaf(state)) await publishMonsterWhimper(monster);
            } else if (trap.tseen && recordRandom(random, calls, 40) !== 0) continue;
        }

        // dogmove.c examines every reachable, uncursed object on a candidate
        // square before applying its cursed-square avoidance roll.  Cursed
        // objects set the reluctance flag without calling dogfood(); ordinary
        // objects still own dogfood()'s obj_resists() draw even when the pet
        // ultimately rejects the square because something cursed is below.
        let cursed = false;
        let edible = null;
        const reachableFood = monsterCouldReachItem(monster, nx, ny, state);
        for (const object of monster.edog ? state.level.objects[nx]?.[ny] ?? [] : []) {
            if (object.cursed) cursed = true;
            else if (reachableFood) {
                const foodType = dogFood(monster, object, random, calls, state);
                if (
                    foodType < MANFOOD &&
                    (foodType < ACCFOOD || (monster.edog?.hungrytime ?? 0) <= (state?.moves ?? 1))
                ) {
                    edible = object;
                    break;
                }
            }
        }
        if (edible) {
            // C dog_move()'s do_eat goto jumps to newdogpos with the food
            // square selected: finishPetMovePlan() re-tests ALLOW_U (a
            // conflicted pet called to its master's square attacks the hero
            // instead of stepping onto the food beneath the hero), moves,
            // then runs dog_eat() after mon_track_add().
            return finishPetMovePlan(monster, state, {
                oldx,
                oldy,
                nix: nx,
                niy: ny,
                selectedInfo: candidate.info,
                reluctant: false,
                dropped,
                food: edible,
            }, random, rollDice, rollOne, calls);
        }
        if (cursed && !monster.mleashed && uncursedCount > 0
            && recordRandom(random, calls, 13 * uncursedCount))
            continue;

        // Guardians have no food or fetching state and do not avoid curses.
        // Their backtracking chance therefore counts every candidate square.
        if (
            !monster.mleashed &&
            distmin(oldx, oldy, state?.u?.ux ?? goal.x, state?.u?.uy ?? goal.y) > 5
        ) {
            const trackSquares = monster.edog ? uncursedCount : candidates.length;
            const trackCount = Math.min(4, Math.max(0, trackSquares - 1));
            let avoid = false;
            for (let j = 0; j < trackCount; j++) {
                const track = monster.mtrack?.[j];
                const trackRange = 4 * (trackSquares - j);
                if (track?.x === nx && track?.y === ny) {
                    if (recordRandom(random, calls, trackRange)) {
                        avoid = true;
                        break;
                    }
                }
            }
            if (avoid) continue;
        }

        const ndist = dist2(nx, ny, goal.x, goal.y);
        const direction = (ndist - nidist) * goal.appr;
        let choose = direction < 0;
        if (direction === 0) {
            choose = recordRandom(random, calls, ++chcnt) === 0;
        } else if (direction > 0 && !goal.whappr) {
            if (oldx === nix && oldy === niy) {
                choose = recordRandom(random, calls, 3) === 0;
            }
            if (!choose) choose = recordRandom(random, calls, 12) === 0;
        }
        if (!choose) continue;
        nix = nx;
        niy = ny;
        nidist = ndist;
        selectedInfo = candidate.info;
        reluctant = cursed;
        if (direction < 0) chcnt = 0;
    }

    const ranged = await performPetRangedAttack(monster, state,
        { random, rollOne, rollDice, calls });
    if (ranged.status !== MMOVE_NOTHING || ranged.heroDied) {
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            postMoveStatus: ranged.status, movementStage: 'postmov',
            actionCompleted: true, heroDied: ranged.heroDied,
            ...(dropped ? { dropped } : {}),
        };
    }
    return finishPetMovePlan(monster, state, {
        oldx,
        oldy,
        nix,
        niy,
        selectedInfo,
        reluctant,
        dropped,
        food: null,
    }, random, rollDice, rollOne, calls);
}

async function distantMonsterObjectName(object: GameObject): Promise<string> {
    observeDistantObjectForNaming(object);
    return await inventoryItemDescription(object);
}
async function reluctantPetMessage(monster: Monster, square: Position): Promise<string> {
    const game = requireInitializedGame();
    const pile = game.level?.objects?.[square.x]?.[square.y] || [];
    const rememberedObject = game.level?.at(square.x, square.y)?.remembered_glyph?.kind === 'object';
    const top = !heroIsHallucinating(game) && game.level?.flags.hero_memory && rememberedObject
        ? pile[0] : undefined;
    const objectName = top ? await distantMonsterObjectName(top) : 'something';
    const verb = verbForSubject(null, monsterLocomotion(monster.mnum, 'step'));
    const subject = monsterName(monster, { state: game, capitalized: true, article: 'your', suppressIt: true });
    const preposition = monsterFliesOrFloats(monster) ? 'over' : 'onto';
    return `${subject} ${verb} reluctantly ${preposition} ${objectName}.`;
}

// C dogmove.c:could_reach_item(). Flying across a square does not make
// the objects beneath its water or lava reachable.
const M1_SWIM = 0x2, M2_ROCKTHROW = 0x08000000;
const PM_FIRE_ELEMENTAL_REACH = MONSTER_NAME.indexOf('fire elemental');
const PM_SALAMANDER = MONSTER_NAME.indexOf('salamander');

export function monsterCouldReachItem(
    monster: Monster, x: number, y: number, state: PlayingGameState,
): boolean {
    if (isPoolAt(x, y, state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SWIM)) return false;
    if (isLavaAt(x, y, state)
        && monster.mnum !== PM_FIRE_ELEMENTAL_REACH && monster.mnum !== PM_SALAMANDER) return false;
    return !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW)
        || !(state.level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER);
}

// C dogmove.c:finish_meating(). Unlike seemimic(), this does not remove
// corpse disguise metadata or change light blocking.
const S_MIMIC = 13;

export async function finishMonsterEating(monster: Monster, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    monster.meating = 0;
    if (M_AP_TYPE(monster) !== M_AP_NOTHING
        && MONSTER_SYMBOL[monster.mnum] !== S_MIMIC) {
        monster.m_ap_type = M_AP_NOTHING;
        monster.mappearance = 0;
        await newsym(monster.mx, monster.my);
    }
}

// Temporary disguises caused by eating mimic corpses. C dogmove.c:quickmimic().
const DOG_SYMBOL = 4;
const SINK_APPEARANCE = MAP_SYMBOLS.findIndex(symbol => symbol.name === 'sink');
interface MealDisguise {
    species?: number;
    symbol?: number;
    type: typeof M_AP_MONSTER | typeof M_AP_OBJECT | typeof M_AP_FURNITURE;
    appearance: number;
}

const FOOD_DISGUISE: MealDisguise = { type: M_AP_OBJECT, appearance: TRIPE_RATION };
const DISGUISES: readonly MealDisguise[] = [
    mealDisguise('little dog', 'kitten'),
    mealDisguise('dog', 'housecat'),
    mealDisguise('large dog', 'large cat'),
    mealDisguise('kitten', 'little dog'),
    mealDisguise('housecat', 'dog'),
    mealDisguise('large cat', 'large dog'),
    mealDisguise('housecat', 'giant rat'),
    { symbol: DOG_SYMBOL, type: M_AP_FURNITURE, appearance: SINK_APPEARANCE },
    FOOD_DISGUISE,
];

export async function beginMonsterMealMimicry(
    monster: Monster, state: GameState = game,
): Promise<void> {
    requireLiveGame(state);
    const wasLeashed = !!monster.mleashed;
    if (state.u.protectionFromShapeChangers || state.protectionFromShapeChangers
        || !monster.meating) return;
    if (monster === state.u.usteed) await dismountHero(DISMOUNT_POLY, { state });

    const disguise = chooseMealDisguise(monster);
    const name = monsterName(monster, { state, article: 'your' });
    const spotted = canSpotMonster(monster);
    const seeLocation = cansee(monster.mx, monster.my);
    monster.m_ap_type = disguise.type;
    monster.mappearance = disguise.appearance;
    if (!spotted && !seeLocation && !canSpotMonster(monster)) return;

    const previousGlyph = glyphAt(monster.mx, monster.my, state);
    const description = disguiseDescription(disguise, monster.female);
    await newsym(monster.mx, monster.my);
    // All animal disguises in qm[] are leashable. Furniture and food are not.
    if (wasLeashed && disguise.type !== M_AP_MONSTER) {
        await plineWithContinuation('Your leash goes slack.');
        releaseMonsterLeash(monster, state);
    }
    if (samePerceivedGlyph(previousGlyph, glyphAt(monster.mx, monster.my, state))) {
        await plineWithContinuation(`You sense that ${name} feels rather ${description}-ish.`);
    } else {
        await plineWithContinuation(`You ${seeLocation ? 'see' : 'sense that'} ${withIndefiniteArticle(description)} ${seeLocation ? 'appear' : 'has appeared'} where ${name} was!`);
    }
    await displayMessageWindow();
}

function mealDisguise(species: string, appearance: string): MealDisguise {
    return { species: MONSTER_NAME.indexOf(species),
        type: M_AP_MONSTER, appearance: MONSTER_NAME.indexOf(appearance) };
}

function chooseMealDisguise(monster: Monster): MealDisguise {
    for (let tries = 0; tries < 5; tries++) {
        const choice = DISGUISES[rn2(DISGUISES.length)];
        if (!choice) throw new RangeError('Mimic meal selected an invalid disguise.');
        if (choice.species !== undefined && choice.species === monster.mnum
            || choice.symbol !== undefined && choice.symbol === MONSTER_SYMBOL[monster.mnum]
            || choice.species === undefined && choice.symbol === undefined) return choice;
    }
    return FOOD_DISGUISE;
}

function disguiseDescription(disguise: MealDisguise, female: boolean): string {
    if (disguise.type === M_AP_MONSTER)
        return monsterTypeName(disguise.appearance, female);
    if (disguise.type === M_AP_FURNITURE) {
        const symbol = MAP_SYMBOLS[disguise.appearance];
        if (!symbol) throw new RangeError('Mimic meal has an invalid furniture appearance.');
        return symbol.name;
    }
    return requireObjectData(OBJECT_DESCRIPTIONS, disguise.appearance)
        || requireObjectData(OBJECT_NAMES, disguise.appearance) || 'something';
}

// Native glyph identity distinguishes two species even when both use 'f'.
function samePerceivedGlyph(left: ReturnType<typeof glyphAt>, right: ReturnType<typeof glyphAt>): boolean {
    if (left === right) return true;
    if (!left || !right || left.kind !== right.kind) return false;
    switch (left.kind) {
    case 'monster': return right.kind === 'monster' && left.mnum === right.mnum;
    case 'object': return right.kind === 'object' && left.otyp === right.otyp;
    case 'terrain': return right.kind === 'terrain' && left.terrainName === right.terrainName;
    case 'trap': return right.kind === 'trap' && left.trapType === right.trapType;
    case 'effect':
    case 'engraving':
    case 'invisible':
    case 'nothing':
    case 'unexplored':
    case 'warning':
        return true;
    }
}
