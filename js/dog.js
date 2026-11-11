import { mon_offmap } from './const.js';
// Tame monster state.
// C refs: dog.c makedog(), tamedog(), newedog(), initedog(), pet_type(),
// pick_familiar_pm(), make_familiar(), abuse_dog(), and dogfood().
import { SCROLL_CLASS, SPBOOK_CLASS, FOOD_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS } from './objclass.js';
import { currentAttribute } from './attrib.js';
import { A_CHA, DISMOUNT_THROWN, G_EXTINCT, GP_AVOID_MONPOS, MM_EDOG, MM_FEMALE, MM_IGNOREWATER, MM_MALE, MM_NOMSG, NO_MINVENT, COLNO, In_endgame, LARGEST_INT, MAGIC_PORTAL, MAX_NUM_WORMS, MIGR_APPROX_XY, MIGR_EXACT_XY, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_LEFTOVERS, MIGR_PORTAL, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, MIGR_WITH_HERO, MON_ARRIVE_AFTER_YOU, MON_ARRIVE_BEFORE_YOU, MON_ARRIVE_WITH_YOU, MON_LIMBO, MON_MIGRATING, MON_STILL_ARRIVING, NEED_HTH_WEAPON, RLOC_NOMSG, ROWNO, STRAT_ARRIVE, STRAT_WAITFORU, EYE, LL_CONDUCT, G_GENOD, MAX_EGG_HATCH_TIME, } from './const.js';
import { isPoolAt } from './dbridge.js';
import { makemonNear } from './mklev.js';
import { canSpotMonster, newsym, canSeeMonster } from './display.js';
import { plineWithContinuation, recordGameLogEvent, impossible } from './pline.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { artifactById, artifactByName } from './artifact.js';
import { veganCorpse } from './food_traits.js';
import { AD_POLY } from './monster_attack_types.js';
import { objectMaterial } from './o_init.js';
import { objectIsMetallic, objectIsOrganic, objectIsRustprone } from './object_properties.js';
import { objectResistsDestruction } from './zap.js';
import { withIndefiniteArticle, corpseName, objectName, observeObjectForNaming, pluralizeObjectNoun } from './objnam.js';
import { heroHasConflict } from './hero_conflict.js';
import { publishMonsterYelp, publishMonsterGrowl } from './sounds.js';
import { sessionIsNight } from './calendar.js';
import { releaseMonsterLeash } from './apply.js';
import { finishMonsterEating, dogEat } from './dogmove.js';
import { monsterName, setMonsterGivenName, monsterTypeName } from './do_name.js';
import { dismountHero, monsterHasMapPosition, placeMonsterOnMap, putSaddleOnMonster } from './steed.js';
import { cansee, monsterEmitsLight, vision_recalc } from './vision.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { CORPSE, RIN_AGGRAVATE_MONSTER, EXPENSIVE_CAMERA, AMULET_OF_STRANGULATION, APPLE, BANANA, CARROT, CLOVE_OF_GARLIC, EGG, ENORMOUS_MEATBALL, GLOB_OF_GREEN_SLIME, LUMP_OF_ROYAL_JELLY, MEATBALL, MEAT_RING, MEAT_STICK, RIN_SLOW_DIGESTION, SLIME_MOLD, TIN, TRIPE_RATION, } from './object_data.js';
import { rn1, rn2, rnd } from './rng.js';
import { initializeUnplacedMonsterWormBody, redrawMonsterWorm, removeMonsterWormBody } from './worm.js';
import { setMonsterMalign, makemonAt, rndmonstAdj, monsterBirthLimit, newMonsterHitPoints } from './makemon.js';
import { stairway_find, stairway_find_from } from './stairs.js';
import { levelFollower, carnivorous, herbivorous, is_domestic, monsterHasEyes, monsterIsDemon, monsterIsCovetous, monsterIsHuman, monsterIsHumanoid, regenerates, speciesHasWeaponAttack, sameMonsterRace, monsterHasAcidResistance, monsterHasPoisonResistance, monsterHasStoneResistance, metallivorous, acidic, poisonous, is_elf, is_shapeshifter, monsterHatesSilver, monsterIsNoncorporeal, monsterIsRider, monsterIsUndead, monsterIsVampireShifter, fleshPetrifies, } from './mondata.js';
import { wakeMonstersNearWithMessages, releaseHeroFromMonster, detachMonsterFromLevel, healMonster, restoreMonsterShape, sendMonsterToLimbo, resolveMonsterLiquid, finishLiquidDeathForCurrentMover, nearHero, seeMonsterCloseup } from './mon.js';
import { questMonsterFlags3 } from './role_monsters.js';
import { heroFormSticks, heroSpecies, body_part } from './polyself.js';
import { ensureHeroSkills, wieldMonsterWeapon } from './weapon.js';
import { heroIsHallucinating } from './senses.js';
import { hasShopkeeperData } from './shop_types.js';
import { enexto_gpflags } from './teleport.js';
import { nextIdent } from './mkobj.js';
import { possessiveName } from './hacklib.js';
import { depth } from './dungeon.js';
import { dropSpecialMonsterObjects } from './steal.js';
import { randomMonsterRelocation, relocateMonsterTo, enexto, goodPosition } from './teleport.js';
import { somexy } from './mkroom.js';
import { deliverOrcRaidLoot } from './dokick.js';
import { mintrap } from './trap.js';
import { monsterCarriesAmulet } from './wizard.js';
import { setShopResidency, makeShopkeeperHappy, makeShoppersHappy } from './shk.js';
import { placeObject } from './mkobj.js';
import { insideWizardTower } from './dungeon.js';
import { roomForRoomno, roomsAt } from './hack.js';
import { expelHero } from './mhitu.js';
// Part of C dog.c:abuse_dog(): the Aggravate_monster || Conflict test.
function heroAggravatesMonsters(state) {
    const rings = [
        state.uleft, state.uright, state.u?.uleft, state.u?.uright,
    ];
    return !!(state.u?.aggravateMonster || state.aggravateMonster
        || rings.some(ring => ring?.otyp === RIN_AGGRAVATE_MONSTER)
        || heroHasConflict(state));
}
// C dog.c:abuse_dog().
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
        await releaseMonsterLeash(monster, true, { state });
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
// C dog.c:initedog(). Existing pet history survives renewed taming.
export function initializePet(monster, { state = game, everything = true } = {}) {
    if (!monster)
        return false;
    const minimumTameness = is_domestic(monster.mnum) ? 10 : 5;
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
// C dog.c:pick_familiar_pm(). The figurine species comes from its
// corpsenm; a spell chooses among the role pet, the preferred pet, and a
// random domestic species weighted by clerical skill (dog.c:pet_type()).
function familiarSpecies(object, state) {
    if (object) {
        const species = object.corpsenm;
        if (species === undefined)
            throw new Error('Figurine requires a monster species');
        const specialLimit = monsterBirthLimit(species) !== 120;
        return specialLimit && (state.mvitals?.[species]?.mvflags ?? 0) & G_EXTINCT
            ? null
            : species;
    }
    if (!rn2(3)) {
        const rolePet = state.urole?.petnum;
        if (rolePet != null && rolePet >= 0)
            return rolePet;
        if (state.preferred_pet === 'c')
            return MONSTER_NAME.indexOf('kitten');
        if (state.preferred_pet === 'd')
            return MONSTER_NAME.indexOf('little dog');
        return MONSTER_NAME.indexOf(rn2(2) ? 'kitten' : 'little dog');
    }
    const clerical = ensureHeroSkills(state)?.[32]; // clerical spells
    if (!clerical)
        throw new Error('Familiar creation requires clerical skill state');
    const skill = clerical.skill;
    return rndmonstAdj(0, 3 * skill);
}
// C dog.c:make_familiar().
export async function makeFamiliar(object = null, x = game.u.ux, y = game.u.uy, quietly = false, { state = game, announce = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    let monster = null;
    for (let attempts = 100; attempts > 0; attempts--) {
        const species = familiarSpecies(object, state);
        if (species == null) {
            if (!quietly)
                await announce(object
                    ? '... into a pile of dust.'
                    : 'There seems to be nothing available for a familiar.');
            break;
        }
        let flags = MM_EDOG | MM_IGNOREWATER | NO_MINVENT | MM_NOMSG;
        const gender = object ? (object.spe ?? 0) & 3 : 0;
        if (gender === 1)
            flags |= MM_FEMALE;
        else if (gender === 2)
            flags |= MM_MALE;
        monster =
            x === state.u.ux && y === state.u.uy
                ? await makemonNear(species, x, y, flags, true)
                : await makemonAt(species, x, y, flags);
        if (monster || object) {
            if (!monster && !quietly)
                await announce('The figurine writhes and then shatters into pieces!');
            break;
        }
    }
    if (!monster)
        return null;
    monster.mtame ??= 0;
    monster.pet = false;
    if (object && monster.isminion) {
        monster.isminion = 0;
        delete monster.emin;
        if (monster.mextra)
            delete monster.mextra.emin;
    }
    if (isPoolAt(monster.mx, monster.my, state)) {
        const result = await resolveMonsterLiquid(monster, state, {
            announce,
            finishDeath: finishLiquidDeathForCurrentMover,
            monsterMoving: !!state.context.mon_moving,
        });
        if (result?.dead)
            return null;
    }
    let tame = true;
    if (object) {
        let disposition = rn2(10);
        if (disposition > 2)
            disposition = object.blessed ? 0 : !object.cursed ? 1 : 2;
        tame = disposition === 0;
        if (disposition === 2) {
            if (!quietly)
                await announce('You get a bad feeling about this.');
            monster.mpeaceful = 0;
            setMonsterMalign(monster, state);
        }
        const name = object.oextra?.oname || object.oname;
        if (name)
            setMonsterGivenName(monster, name);
    }
    if (tame)
        initializePet(monster, { state, everything: true });
    monster.msleeping = 0;
    setMonsterMalign(monster, state);
    await newsym(monster.mx, monster.my);
    if (monster.mtame && speciesHasWeaponAttack(monster.mnum)) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state, { publish: announce });
    }
    return monster;
}
// C dog.c:wary_dog().
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
        if (!wasDead && cansee(monster.mx, monster.my) && monsterHasEyes(heroSpecies(state))) {
            const subject = monsterName(monster, { state, capitalized: true });
            const hasEyes = monsterHasEyes(monster.mnum);
            await publish(hasEyes
                ? `${subject} ${monster.mpeaceful ? 'seems unable' : 'refuses'} to look you in the ${body_part(EYE, state)}.`
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
            await releaseMonsterLeash(monster, true, { state, publish });
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
// C dog.c:newedog(). Allocates a zeroed record and sets its parent before
// initedog().
function newPetData(monster) {
    return {
        parentmid: monster.m_id, droptime: 0, dropdist: 0, apport: 0,
        whistletime: 0, hungrytime: 0, ogoal: { x: 0, y: 0 }, abuse: 0,
        revivals: 0, mhpmax_penalty: 0, killed_by_u: 0,
    };
}
const M3_WANTSARTI = 0x0010;
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const S_DOG = 4;
// C dog.c:tamedog(). Food may be caught and consumed; magic has no object
// transfer. A true result tells a projectile caller that the food was caught,
// even when its meal kills the new pet.
export async function tameMonster(monster, source = null, { state = game, announce = false, } = {}) {
    requireLiveGame(state);
    const magic = source?.oclass === SCROLL_CLASS || source?.oclass === SPBOOK_CLASS;
    const blessedScroll = !!(magic && source?.blessed);
    const food = magic ? null : source;
    if (monster.mfrozen)
        monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    if (monster.msleeping)
        await wakeMonstersNearWithMessages(monster.mx, monster.my, 1, state);
    // C dog.c:tamedog() tests M3_WANTSARTI directly before pacifying the actor.
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
        // C: dog_eat expects a floor object.
        await placeObject(food, monster.mx, monster.my, state);
        await dogEat(monster, food, { x: monster.mx, y: monster.my }, state, false);
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
        || monsterIsCovetous(monster, state) || monsterIsHuman(monster.mnum)
        || (monsterIsDemon(monster.mnum)
            && !monsterIsDemon(heroSpecies(state)))
        || (food && dogFood(monster, food, rn2, [], state) >= MANFOOD))
        return false;
    if (monster.m_id === state.quest_status?.leader_m_id)
        return false;
    initializePet(monster, { state, everything: !(monster.edog || monster.mextra?.edog) });
    if (food) {
        // C defers eating until the edog extension has been set up.
        await placeObject(food, monster.mx, monster.my, state);
        if (await dogEat(monster, food, { x: monster.mx, y: monster.my }, state, true) === 2
            || state.program_state.gameover)
            return true;
    }
    if (announce && canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} seems quite ${heroIsHallucinating(state) ? 'approachable' : 'friendly'}.`);
    }
    await newsym(monster.mx, monster.my);
    if (monster.wormno)
        await redrawMonsterWorm(monster, state);
    if (speciesHasWeaponAttack(monster.mnum)) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state);
    }
    return true;
}
// Part of C dog.c:tamedog(): the thrown-food catch test.
function willCatchFood(monster, food, state) {
    if (!monster.mcanmove || monster.mconf || monster.meating)
        return false;
    const quality = dogFood(monster, food, rn2, [], state);
    if (quality === DOGFOOD)
        return true;
    const pet = monster.edog ?? monster.mextra?.edog;
    return quality <= ACCFOOD && !!pet && pet.hungrytime <= state.moves;
}
// Part of C dog.c:tamedog(): the "catches" / "stop" messages.
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
// Part of C dog.c:tamedog(): the the(xname(obj)) noun for the catch message.
function catchFoodName(food, state) {
    if (food.otyp === CORPSE)
        return corpseName(food, { definite: true });
    const name = objectName(food, state);
    const noun = food.quan === 1 ? name : pluralizeObjectNoun(food, name);
    return /^the /i.test(noun) ? noun.replace(/^The /, 'the ') : `the ${noun}`;
}
// C include/monflag.h M1 flags used by mon_catchup_elapsed_time().
// C dog.c mon_arrive()'s `when` argument.
export const WIZ_ARRIVE = -1; // C dog.c mon_arrive(mtmp, -1) from resurrect()
const PM_LONG_WORM_MIGRATION = 114;
// C dog.c: overloading of mtrack[] is kept as explicit fields here:
// migrationArrival (mtrack[0].x), migrationFlags (mtrack[0].y),
// migrationSource (mtrack[1]), migrationOrigin (mtrack[2]).
// Part of C dog.c:losedogs(): the mux/muy == u.uz destination test.
function sameMigrationLevel(first, second) {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}
// Port only: accessor for the migrating_mons list.
export function migrationQueue(state) {
    if (!Array.isArray(state._migratingMonsters))
        state._migratingMonsters = [];
    return state._migratingMonsters;
}
// Port only: u.uz access with an initialized-location check.
export function currentDungeonLevel(state) {
    if (!state.u.uz)
        throw new Error('Monster migration requires an initialized hero dungeon location.');
    return state.u.uz;
}
// Part of C dog.c:migrate_to_level(): the one-level-down fall destination
// (ledger_to_dnum()/ledger_to_dlev()).
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
// Role-keyed default dog names (C dog.c:makedog() reads data from the role
// table; the port keys them by RoleKey).
const DEFAULT_DOG_NAMES = {
    caveman: 'Slasher',
    ranger: 'Sirius',
    samurai: 'Hachi',
    barbarian: 'Idefix',
};
// C dog.c:makedog()
// Also C dog.c:pet_type(): the starting-pet species choice is inlined here.
// Also C dog.c:initedog(): the newborn pet's tame state and edog fields are inlined here.
export async function makedog() {
    const g = game;
    if (g.preferred_pet === 'n') {
        g.context.startingpet_typ = -1;
        return null;
    }
    const role = g.urole?.key;
    if (role !== 'archeologist' && role !== 'barbarian'
        && role !== 'caveman' && role !== 'ranger' && role !== 'rogue'
        && role !== 'samurai' && role !== 'tourist' && role !== 'valkyrie'
        && role !== 'priest' && role !== 'healer' && role !== 'knight'
        && role !== 'monk' && role !== 'wizard')
        return null;
    if (!g.level)
        throw new Error('Starting pet needs an initialized level');
    let pettype = g.urole?.petnum;
    if (pettype == null || pettype < 0) {
        if (g.preferred_pet === 'c')
            pettype = 32; // PM_KITTEN
        else if (g.preferred_pet === 'd')
            pettype = 16; // PM_LITTLE_DOG
        else
            pettype = rn2(2) ? 32 : 16;
    }
    g.context.startingpet_typ = pettype;
    // C makemon() places a monster made on the hero with enexto_core(),
    // first avoiding scary squares and only then accepting them.
    const spot = enexto_gpflags(pettype, g.u.ux, g.u.uy, GP_AVOID_MONPOS);
    if (!spot)
        return null;
    const monsterId = nextIdent();
    // C makemon() rolls the pet through newmonhp(): adj_lev() lowers dogs and
    // kittens to level one and the Knight's pony to level two, and an
    // all-ones roll gains a point.
    const { level, hp } = newMonsterHitPoints(pettype);
    const female = !!rn2(2);
    // Dogs, cats, and ponies are neutral. C's peace_minded() reaches its two
    // random branches only for a neutral hero, and the first denominator is
    // derived from the live alignment record rather than the role name.
    if ((g.initAlignment?.value ?? 0) === 0) {
        const record = g.u?.ualign?.record ?? 0;
        if (rn2(16 + Math.max(-15, record)))
            rn2(2); // 2 + abs(monster alignment), which is 0 here
    }
    const pet = {
        mnum: pettype, m_id: monsterId,
        mx: spot.x,
        my: spot.y,
        mhp: hp,
        mhpmax: hp,
        m_lev: level,
        female,
        mtame: 0,
        mpeaceful: 1,
        malign: 0,
        mcanmove: 1,
        mcansee: 1,
        mblinded: 0,
        movement: 0,
        mmove: MONSTER_MOVE[pettype] ?? 0,
        mspeed: 0,
        symbol: pettype === 100 ? 'u' : pettype === 32 ? 'f' : 'd',
        pet: true,
        mtrack: [],
        // C dog.c initedog(): initialize the pet's training and hunger state.
        edog: {
            droptime: 0,
            dropdist: 10000,
            // The pet is created before u_init_inventory_attrs(). At this
            // point C's ACURR(A_CHA) clamps the zeroed attribute to 3; the
            // finalized hero Charisma must not be read retroactively.
            apport: g.u?.acurr?.a?.[A_CHA] ?? 3,
            whistletime: 0,
            hungrytime: (g.moves ?? 0) + 1000,
            ogoal: { x: -1, y: -1 },
            abuse: 0,
            revivals: 0,
            mhpmax_penalty: 0,
            killed_by_u: 0,
        },
    };
    if (!g.level.monsters)
        g.level.monsters = [];
    g.level.monsters.push(pet);
    if (!g.context.startingpet_mid) {
        g.context.startingpet_mid = pet.m_id;
        if (pettype === MONSTER_NAME.indexOf('pony') && !g.u.uroleplay?.pauper)
            await putSaddleOnMonster(null, pet);
        g.bhitpos = { x: pet.mx, y: pet.my };
        g.notonhead = false;
        await seeMonsterCloseup(pet, { photo: g.inventory.some(object => object.otyp === EXPENSIVE_CAMERA) });
    }
    else {
        await impossible('makedog() when startingpet_mid is already non-zero?');
    }
    const name = pettype === MONSTER_NAME.indexOf('little dog')
        ? g.flags.dogname || DEFAULT_DOG_NAMES[role]
        : pettype === MONSTER_NAME.indexOf('kitten') ? g.flags.catname
            : pettype === MONSTER_NAME.indexOf('pony') ? g.flags.horsename : null;
    const petnameUsed = g.petname_used ?? 0;
    g.petname_used = petnameUsed + 1;
    if (!petnameUsed && name)
        setMonsterGivenName(pet, name);
    // C initedog() tames the pet after mpickobj() can forget an unseen saddle.
    pet.mtame = 10;
    setMonsterMalign(pet, g);
    if (!g.u.uconduct)
        g.u.uconduct = {};
    g.u.uconduct.pets = (g.u.uconduct.pets || 0) + 1;
    return pet;
}
// Part of C dog.c:mon_leave(): the no_charge reset via picked_container().
// Named for its caller's carried-object loop; shk.c:clear_no_charge() is a
// different function that walks a floor list with shop residency checks.
function clearCarriedNoCharge(object) {
    // C dog.c mon_leave() resets shop pricing on carried containers.
    object.no_charge = false;
    for (const content of object.contents || [])
        clearCarriedNoCharge(content);
}
// Part of C dog.c:mon_arrive(): the no-room failure path (relmon(),
// m_into_limbo()).
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
// C dog.c:mon_leave().
// Both followers and independently migrating monsters lose their old shop
// residency and carry only a tail length between levels.
export async function prepareMonsterDeparture(monster, state) {
    for (const object of monster.minvent || monster.inventory || [])
        clearCarriedNoCharge(object);
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
// Part of C dog.c:mon_leave(), dog.c:migrate_to_level(): place_monster()
// head-back and the mtrack[] destination-overload reset.
async function placeMigratingMonster(monster, x, y) {
    await placeMonsterOnMap(monster, x, y);
    monster.mtrack = [];
}
// C dog.c:migrate_to_level().
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
        await releaseMonsterLeash(monster, true, { state });
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
        if (monster.mhp <= 0 || mon_offmap(monster))
            continue;
        monster.mlstmv = state.moves;
    }
}
// C dog.c:mon_catchup_elapsed_time()
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
        if ((carnivorous(monster.mnum) || herbivorous(monster.mnum))) {
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
        await releaseMonsterLeash(monster, false, { state });
    const healing = regenerates(monster.mnum)
        ? imv : Math.trunc(imv / 20);
    healMonster(monster, healing);
    monster.mlstmv = state.moves ?? 0;
}
// Part of C dog.c:mon_arrive(): limbo wander placement within its room or
// `wander` squares.
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
// C dog.c:mon_arrive()
// Returns false when no placement was possible.
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
    if (monster === state.u?.usteed) {
        monster.mstate = (monster.mstate ?? 0) & ~MON_STILL_ARRIVING;
        return true;
    }
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
            const nearby = enexto(monster.mnum, state.u.ux, state.u.uy, { state });
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
            const stair = stairway_find_from(state, origin, false);
            if (stair)
                xlocale = stair.sx, ylocale = stair.sy;
            break;
        }
        case MIGR_LADDER_UP:
        case MIGR_LADDER_DOWN: {
            const stair = stairway_find_from(state, origin, true);
            if (stair)
                xlocale = stair.sx, ylocale = stair.sy;
            break;
        }
        case MIGR_SSTAIRS: {
            const stair = stairway_find(state, origin);
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
            ? { x: xlocale, y: ylocale } : enexto(monster.mnum, xlocale, ylocale, { state });
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
// C dog.c:losedogs().
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
// C dog.c:discard_migrations().
export function discardMigrations(state = game) {
    // C dog.c discard_migrations(): entering the endgame discards monsters
    // scheduled for unreachable levels; the Wizard always stays queued.
    const queue = migrationQueue(state);
    state._migratingMonsters = queue.filter(monster => monster.iswiz || In_endgame(monster.migrationDestination));
}
// C dog.c:keepdogs(), keep_mon_accessible(), and mondata.c:levl_follower().
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
// C dog.c:keepdogs()
// The caller skips this entire transaction when iflags.nofollowers is
// set.  Returned monsters are detached from the old level in native
// mydogs order.
// Also C dog.c:keep_mon_accessible(): merged here.
// Also C mondata.c:levl_follower(): merged here.
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
                await mintrap(monster, state, {
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
            await releaseMonsterLeash(monster, false, { state });
        }
    }
    return followers;
}
// Part of C dog.c:keepdogs(): the stay-behind branch (eating, trapped,
// amulet, loose leash).
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
        await releaseMonsterLeash(monster, false, { state });
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
// ────────────────────────────────────────────────────────────────────────────
// Pet food preferences and hazards. C refs: dog.c dogfood(), obj.h, mondata.h.
export const DOGFOOD = 0;
export const CADAVER = 1;
export const ACCFOOD = 2;
export const MANFOOD = 3;
export const APPORT = 4;
export const POISON = 5;
export const UNDEF = 6;
export const TABU = 7;
const SILVER = 14;
const S_KOBOLD = 11, S_ORC = 15, S_FUNGUS = 32, S_OGRE = 41, S_YETI = 51;
const PM_GHOUL = MONSTER_NAME.indexOf('ghoul');
const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const PM_LICHEN = MONSTER_NAME.indexOf('lichen');
const PM_PYROLISK = MONSTER_NAME.indexOf('pyrolisk');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));
// C dog.c:dogfood(): rank an object as pet food, from DOGFOOD to TABU.
// Lower ranks are preferred. TABU forbids eating or fetching; UNDEF is merely
// unsuitable. The object resistance check belongs here even for ordinary food.
export function dogFood(monster, object, random, calls, state) {
    // C stores weapon poison and a container's trap in the same bit.
    if ((object.opoisoned || object.otrapped) && !monsterHasPoisonResistance(monster))
        return POISON;
    const artifact = artifactById(object.oartifact, state);
    const questArtifact = artifactByName(state.urole?.artifactName, state);
    if ((artifact !== null && artifact.id === questArtifact?.id)
        || objectResistsDestruction(object, 0, 95, range => {
            calls.push(range);
            return random(range);
        }))
        return object.cursed ? TABU : APPORT;
    if (object.oclass === ROCK_CLASS)
        return UNDEF;
    if (object.oclass === FOOD_CLASS)
        return foodQuality(monster, object, state);
    return nonfoodQuality(monster, object, state);
}
// Part of C dog.c:dogfood(): the FOOD_CLASS branch.
function foodQuality(monster, object, state) {
    const carni = carnivorous(monster.mnum), herbi = herbivorous(monster.mnum);
    const flesh = [CORPSE, TIN, EGG].includes(object.otyp) ? object.corpsenm : undefined;
    if (object.otyp === CORPSE && flesh !== undefined && monsterIsRider({ mnum: flesh }))
        return TABU;
    if ((object.otyp === CORPSE || object.otyp === EGG)
        && fleshPetrifies(flesh) && !monsterHasStoneResistance(monster))
        return POISON;
    if (object.otyp === LUMP_OF_ROYAL_JELLY && monster.mnum === PM_KILLER_BEE) {
        const queenGenocided = !!((state.mvitals?.[PM_QUEEN_BEE]?.mvflags ?? 0) & G_GENOD);
        const queenPresent = !queenGenocided && requireGameLevel(state).monsters.some(other => other.mnum === PM_QUEEN_BEE && other.mhp > 0);
        return queenPresent ? TABU : DOGFOOD;
    }
    if (!carni && !herbi)
        return object.cursed ? UNDEF : APPORT;
    const starving = !!(monster.mtame && !monster.isminion && monster.edog?.mhpmax_penalty);
    const blindWithEyes = !monster.mcansee && monsterHasEyes(monster.mnum);
    if (monster.mnum === PM_GHOUL)
        return ghoulFood(object, flesh, starving, state);
    switch (object.otyp) {
        case TRIPE_RATION:
        case MEATBALL:
        case MEAT_RING:
        case MEAT_STICK:
        case ENORMOUS_MEATBALL:
            return carni ? DOGFOOD : MANFOOD;
        case EGG:
            if (flesh === PM_PYROLISK && !FLAMING_SPECIES.has(monster.mnum))
                return POISON;
            return carni ? CADAVER : MANFOOD;
        case CORPSE:
            return corpseQuality(monster, object, flesh, starving, carni, herbi, state);
        case GLOB_OF_GREEN_SLIME:
            return starving || monster.mnum === PM_GREEN_SLIME
                || FLAMING_SPECIES.has(monster.mnum) || monsterIsNoncorporeal(monster)
                ? ACCFOOD : POISON;
        case CLOVE_OF_GARLIC:
            if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
                return TABU;
            return herbi || starving ? ACCFOOD : MANFOOD;
        case TIN:
            return metallivorous(monster.mnum) ? ACCFOOD : MANFOOD;
        case APPLE:
            return herbi ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
        case CARROT:
            return herbi || blindWithEyes ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
        case BANANA:
            if (MONSTER_SYMBOL[monster.mnum] === S_YETI && herbi)
                return DOGFOOD;
            return herbi || starving ? ACCFOOD : MANFOOD;
        default:
            if (starving)
                return ACCFOOD;
            return object.otyp > SLIME_MOLD
                ? carni ? ACCFOOD : MANFOOD
                : herbi ? ACCFOOD : MANFOOD;
    }
}
// Part of C dog.c:dogfood(): the ghoul preference for old corpses and
// stale eggs.
function ghoulFood(object, flesh, starving, state) {
    if (object.otyp === CORPSE) {
        if (oldCorpse(object, state))
            return DOGFOOD;
        return starving && !veganCorpse(flesh) ? ACCFOOD : POISON;
    }
    if (object.otyp === EGG) {
        if (state.moves - object.age > 2 * MAX_EGG_HATCH_TIME)
            return CADAVER;
        return starving ? ACCFOOD : POISON;
    }
    return TABU;
}
// Part of C dog.c:dogfood(): the CORPSE case of the food switch.
function corpseQuality(monster, object, flesh, starving, carni, herbi, state) {
    if ((oldCorpse(object, state) && MONSTER_SYMBOL[monster.mnum] !== S_FUNGUS)
        || (acidic(flesh ?? -1) && !monsterHasAcidResistance(monster))
        || (poisonous(flesh ?? -1) && !monsterHasPoisonResistance(monster)))
        return POISON;
    if (flesh !== undefined && (monster.mtame ?? 0) > 1 && !starving
        && (is_shapeshifter(flesh)
            || MONSTER_ATTACKS[flesh]?.some(([, damage]) => damage === AD_POLY)))
        return MANFOOD;
    if (veganCorpse(flesh))
        return herbi ? CADAVER : MANFOOD;
    if (flesh !== undefined && MONSTER_FLAGS1[flesh] !== undefined
        && monsterIsHumanoid(monster.mnum) && sameMonsterRace(monster.mnum, flesh)
        && !monsterIsUndead(monster.mnum)
        && ![S_KOBOLD, S_ORC, S_OGRE].includes(MONSTER_SYMBOL[flesh] ?? 0)) {
        const elf = is_elf(monster.mnum);
        return starving && carni && !elf ? ACCFOOD : TABU;
    }
    return carni ? CADAVER : MANFOOD;
}
// Part of C dog.c:dogfood(): peek at iced corpse age to spot an old corpse.
function oldCorpse(object, state) {
    // Ice slows decay without changing the object's timers or stored age.
    const age = object.on_ice
        ? object.age + Math.trunc((state.moves - object.age) / 2) : object.age;
    return age + 50 <= state.moves
        && object.corpsenm !== PM_LIZARD && object.corpsenm !== PM_LICHEN;
}
// Part of C dog.c:dogfood(): the non-food default branch.
function nonfoodQuality(monster, object, state) {
    if (object.otyp === AMULET_OF_STRANGULATION || object.otyp === RIN_SLOW_DIGESTION)
        return TABU;
    const material = objectMaterial(object, state);
    if (monsterHatesSilver(monster) && material === SILVER)
        return TABU;
    if (monster.mnum === PM_GELATINOUS_CUBE && objectIsOrganic(object, state))
        return ACCFOOD;
    if (metallivorous(monster.mnum) && objectIsMetallic(object, state)
        && (objectIsRustprone(object, state) || monster.mnum !== PM_RUST_MONSTER)) {
        return objectIsRustprone(object, state) && !object.oerodeproof ? DOGFOOD : ACCFOOD;
    }
    return !object.cursed && object.oclass !== BALL_CLASS && object.oclass !== CHAIN_CLASS
        ? APPORT : UNDEF;
}
//# sourceMappingURL=dog.js.map