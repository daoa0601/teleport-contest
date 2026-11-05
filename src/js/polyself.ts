// Hero form changes and equipment.
// C refs: polyself.c polyself(), polymon(), set_uasmon(), polysense(),
// newman(), break_armor(), drop_weapon(), mbodypart(), body_part(), the
// #monster abilities
// (dobreathe, dospit, doremove, dospinweb, dosummon, dogaze, dopoly,
// domindblast), uunstick(), ugolemeffects(), armor_to_dragon(),
// ugenocided(), udeadinside().

import { stack_object } from './invent.js';
import { WEAPON_CLASS } from './objclass.js';
import { OBJ_NAME } from './object_data.js';
import {
    objectSkill, ACID_VENOM, BLINDING_VENOM, CORPSE, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING,
    ELVEN_MITHRIL_COAT, LEASH, LOADSTONE, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL,
    YELLOW_DRAGON_SCALES, RIN_POLYMORPH_CONTROL, RIN_PROTECTION_FROM_SHAPE_CHANGERS,
} from './object_data.js';
import { setHeroGrip, angerAttackedMonster, hideHeroUnder, monstersInFmonOrder, wakeMonster, validVampireShiftForm,
    finishHeroMonsterKill, finishHeroMonsterKillOutcome,
} from './mon.js';
import { cansee, couldsee, monsterEmitsLight } from './vision.js';
import { weaponDescription } from './weapon.js';
import { isWeldedPrimary, uswapwepgone, uwepgone, heroCanUseTwoWeapons, stopTwoWeaponCombat } from './wield.js';
import {
    BOLT_LIM, P_SHORT_SWORD, P_SABER, ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, GENOCIDED,
    HOLE, IS_AIR, IS_SOFT, KILLED_BY, LANDMINE, LEVEL_TELEP, LOST_THROWN, M_AP_FURNITURE, M_AP_TYPE,
    MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SHOPBASE,
    SHOP_WEB_COST, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STAIRS, STONING, TELEP_TRAP, TRAPDOOR,
    VIBRATING_SQUARE, WEB, A_CHA, A_CON, A_DEX, A_STR, A_WIS, ARM, EYE, FINGER, FINGERTIP, FOOT, G_GENOD,
    HAIR, HAND, HANDED, HEAD, I_SPECIAL, In_endgame, LEG, M_AP_NOTHING, M_AP_OBJECT, NECK, NO_PART, NOSE,
    STR18, STR19, TOE, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, Upolyd,
    POLY_CONTROLLED, POLY_LOW_CTRL, POLY_MONSTER, POLY_NOFLAGS, POLY_REVERT, W_ACCESSORY, W_ARMOR, W_SADDLE,
    STRANGE_OBJECT, LL_CONDUCT, LL_MINORAC,
} from './const.js';
import { corpseName, verbForSubject, makePlural, withIndefiniteArticle, minimalObjectName, ownedObjectName, simpleObjectName } from './objnam.js';
import { learnObjectType, observeObject } from './o_init.js';
import { formatFeltMessage, plineWithContinuation, recordGameLogEvent } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler, FinishHeroDeathOptions } from './end.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MonsterAttack } from './data_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { PropertyName } from './property_types.js';
import type { HeroCoordinates } from './hero_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import { captureThrownObjectFlight, flyHeroThrownObject, heroThrowTrajectory } from './thrown_object.js';
import type { ProjectileFlightCapture } from './thrown_object.js';
import { heroBreathAttack, hitHeroWithRay, destroyFireMonsterInventory, monsterHasElementalResistance } from './zap.js';
import type { HeroRayResult, NativeRayResult } from './zap.js';
import { counterWereSpecies, heroCanSummonWerePack, isWereMonster, summonWerePack, wereBeastForSpecies } from './were.js';
import type { HeroWereChangeOptions } from './were.js';
import { AD_BLND, AD_COLD, AD_CONF, AD_DRST, AD_ELEC, AD_FIRE, AD_HALU, AD_MAGM, AD_RBRE, AT_BREA, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_SPIT } from './monster_attack_types.js';
import type { DamageType } from './monster_attack_types.js';
import { character_race, races } from './role.js';
import type { RoleKey } from './role.js';
import { reassessStatusFields } from './botl.js';
import { heroIsUnaware, heroIsBlind, heroIsHallucinating, setHeroBlindnessTimeout, syncBlindness } from './senses.js';
import { heroHasInvoluntaryDelay, promptDirection, yn_function } from './cmd.js';
import { clearHeroStrangulation, heroHasFreeAction, heroIsStrangled, pendingArmorAction, cancelDonning, findArmorClass, removeHeroArmor, simpleArmorName, isBeingTakenOff, removeEyewear } from './do_wear.js';
import { endVoluntaryMultiTurn, nomul, roomsAt, applyHeroLocationEffects, loseHeroHp, roundDiv } from './hack.js';
import { finishHeroHelplessness } from './allmain.js';
import { makeBlinded, setSlipperyHands, cureHeroSickness, heroIsSick, clearHeroSliming, heroIsSliming, resetHeroSlimingCountdown } from './potion.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { newuhs } from './eat.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { levelHasCeiling, surfaceName } from './dungeon.js';
import { heroHidingStatus } from './insight.js';
import { game, requireInitializedGame, requirePlayingGame } from './gstate.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import { randomExperience } from './exper.js';
import { rankOf, roleSwitch } from './botl.js';
import { dist2, possessiveName } from './hacklib.js';
import { heroCanSeeInvisible } from './mcastu.js';
import { breatheInDirection } from './breath_ray.js';
import { hitMonsterWithThrownEggPieOrVenom } from './hero_thrown_egg_pie_venom.js';
import { hurtleHero, breakFloorObject, breakObjectAtLocation, objectBreaksOnImpact, tossObjectUp } from './dothrow.js';
import { mksobj, placeCreatedObject } from './mkobj.js';
import { deleteTrap, feelTrap, dotrap, igniteItems, resetUtrap, maketrap, selfTouchPetrifyingWeapons } from './trap.js';
import { buryFloorObjectsAt, freeHeroFromBuriedBall } from './dig.js';
import { adjustLevelAbilities, currentAttribute, exerciseAttribute, maximumAttribute, newHeroHitPoints, redistributeActiveAttributes } from './attrib.js';
import { encumber_msg } from './pickup.js';
import {
    FLAMING_SPECIES, MONSTER_ATTACKS, MONSTER_EXPERIENCE_META, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL,
    MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL, PM_GREEN_SLIME,
    S_GHOST, SPECIAL_PM, monsterTypeName,
} from './monster_data.js';
import { canSeeMonster, canSpotMonster, newsym, see_monsters, set_mimic_blocking } from './display.js';
import { addShopDamage, deleteObject } from './shk.js';
import { is_elven_armor, isFlimsyObject } from './object_properties.js';
import { grantIntrinsicProperty, refreshMovementProperties, refreshProperty, revokeIntrinsicProperty } from './properties.js';
import { heroIsInvisible, syncHeroInvisibility } from './hero_invisibility.js';
import { adjustObjectLightAfterBlessing as adjustObjectLight, objectLightRadius } from './light.js';
import { endObjectBurn, learnEggType } from './timeout.js';
import {
    nameToMonster, resolveMonsterClass, speciesCanBlow, your_race, monsterIsMindless, infravision, is_dwarf,
    is_elf, is_gnome, is_male, is_neuter, is_orc, is_were, lays_eggs, monsterBreaksArmor, monsterCanTeleport,
    monsterControlsTeleport, monsterDigests, monsterHasEyes, monsterHasHead, monsterHasNoHands, monsterHasNoLimbs,
    monsterHasProperName, monsterHidesUnder, monsterHornCount, monsterIsAmorphous, monsterIsAmphibious,
    monsterIsAnimal, monsterIsBat, monsterIsBreathless, monsterIsCentaur, monsterIsClinger, monsterIsDemon,
    monsterIsEel, monsterIsFemale, monsterIsFlyer, monsterIsGiant, monsterIsHider, monsterIsHumanoid,
    monsterIsMindFlayer, monsterIsNonliving, monsterIsSlithy, monsterIsSwimmer, monsterIsTelepathic,
    monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, monsterIsVampire, monsterIsVerySmall,
    monsterIsWeirdNonliving, monsterIsWhirly, monsterPassesWalls, monsterPerceives, monsterSlipsArmor,
    monsterSpeciesHatesSilver, monsterSpeciesSticks, monsterWrappingAllowed, notake, polyok, regenerates,
    strongmonst, cantwield, formCanBecomeStoneGolem, touchPetrifies, PM_STONE_GOLEM,
} from './mondata.js';
import { getLine, promptYesNo } from './query.js';
import { clearHeroPetrification, heroIsPetrifying } from './stoning.js';
import { retouchEquipment } from './artifact.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { dropInventoryObjectAtHero } from './do.js';
import { heroIsPunished } from './ball.js';
import { unpunishHero } from './read.js';
import { handleRidingAfterFormChange } from './steed.js';
import { golemHitPoints, isHomeElemental } from './makemon.js';
import { expelHero } from './mhitu.js';

const G_FREQ = 0x0007;
const G_NOGEN = 0x0200;
const G_HELL = 0x0400;
const G_NOHELL = 0x0800;
const G_UNIQ = 0x1000;
const S_MIMIC = 13;
const S_NYMPH = 14;
const S_DRAGON = 30;

const MS_SHRIEK = 18;
const MZ_SMALL = 1;
const MZ_HUGE = 4;
const MAXULEV = 30;
const MUMMY_WRAPPING = 138;
const ALCHEMY_SMOCK = 144;
const PM_HUMAN = MONSTER_NAME.indexOf('human');
const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_URUK_HAI = MONSTER_NAME.indexOf('Uruk-hai');
const PM_ORC_CAPTAIN = MONSTER_NAME.indexOf('orc-captain');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');
const S_LICH = MONSTER_SYMBOL[MONSTER_NAME.indexOf('lich')];
const PLACEHOLDER_MONSTERS = new Set(['orc', 'giant', 'elf', 'human']
    .map(name => MONSTER_NAME.indexOf(name)));
const OLFACTIONLESS_SYMBOLS = new Set([
    2,  // S_BLOB
    5,  // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);

function wornPropertyObject(
    state: GameState, otyp: number,
    slots: readonly ('uleft' | 'uright' | 'uamul')[],
) {
    return slots.some(slot => {
        const object = state[slot] || state.u?.[slot];
        return object?.otyp === otyp && object.worn !== false;
    });
}

export function heroHasPolymorphControl(state = game) {
    return !!(state.u?.polymorphControl || state.polymorphControl)
        || wornPropertyObject(
            state, RIN_POLYMORPH_CONTROL, ['uleft', 'uright'],
        );
}

export function heroIsUnchanging(state = game) {
    return !!(state.u?.unchanging || state.unchanging)
        || wornPropertyObject(state, AMULET_OF_UNCHANGING, ['uamul']);
}

export function heroCanControlPolymorph(state = game) {
    const unaware = heroIsUnaware(state);
    const stunned = !!(state.u?.stunned
        || (state.u?.stunnedTurns ?? 0) > 0);
    return heroHasPolymorphControl(state) && !unaware && !stunned;
}

export function heroHasProtectionFromShapeChangers(state = game) {
    if (state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers) return true;
    return wornPropertyObject(
        state,
        RIN_PROTECTION_FROM_SHAPE_CHANGERS,
        ['uleft', 'uright'],
    );
}

export function heroIsPolymorphed(state = game) {
    return Upolyd(state.u);
}

// C polyself.c:ugolemeffects(). Hero golems heal, but do not gain the
// monster-only slow/haste changes that would outlive their borrowed form.
export async function applyHeroGolemEffects(damageType: DamageType, damage: number, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}) {
    requirePlayingGame(state);
    const form = heroMonsterForm(state);
    if (form === null) return;
    const species = MONSTER_NAME[form];
    const healing = species === 'flesh golem' && damageType === AD_ELEC
        ? Math.trunc((damage + 5) / 6)
        : species === 'iron golem' && damageType === AD_FIRE ? damage : 0;
    if (!healing || state.u.mh >= state.u.mhmax) return;
    state.u.mh = Math.min(state.u.mhmax, state.u.mh + healing);
    state.context.botl = true;
    await publish('Strangely, you feel better than before.');
    await exerciseAttribute(A_STR, true, state);
}

export function heroMonsterForm(state = game): number | null {
    if (!heroIsPolymorphed(state)) return null;
    const form = state.u.umonnum;
    if (form === undefined) throw new Error('A polymorphed hero requires a current species');
    return form;
}

export function heroIsFlying(state = game) {
    return !!state.u?.flying;
}

export function heroFormClings(state = game) {
    return monsterIsClinger(heroMonsterForm(state) ?? -1);
}

export function heroFormHidesUnderObjects(state = game) {
    return monsterHidesUnder(heroMonsterForm(state) ?? -1);
}

export function heroFormHidesWithoutCover(state = game) {
    return monsterIsHider(heroMonsterForm(state) ?? -1);
}

export function heroHidesOnCeiling(state = game) {
    const form = heroMonsterForm(state);
    if (form == null || !state.u?.uundetected
        || !heroFormHidesWithoutCover(state)) return false;
    return heroIsFlying(state)
        || (heroFormClings(state) && MONSTER_SYMBOL[form] !== S_MIMIC);
}

export function heroHasNoHands(state = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterHasNoHands(form);
}

export function heroCannotTake(state = game) {
    return notake(heroMonsterForm(state) ?? -1);
}

export function heroHasNoLimbs(state = game) {
    return monsterHasNoLimbs(heroMonsterForm(state) ?? -1);
}

export function heroIsVerySmall(state = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterIsVerySmall(form);
}

// C mondata.c:olfaction().  This is a current-form sensory capability, not
// a blindness check: molds and several other body classes can sense smoke
// but cannot smell it, while an ordinary blind humanoid still has olfaction.
export function heroHasOlfaction(state = game) {
    const form = heroMonsterForm(state);
    if (form === null) return true;
    const symbol = MONSTER_SYMBOL[form];
    return symbol === undefined || !OLFACTIONLESS_SYMBOLS.has(symbol);
}

const PM_FIRE_ELEMENTAL = MONSTER_NAME.indexOf('fire elemental');
const PM_SALAMANDER = MONSTER_NAME.indexOf('salamander');
// C mondata.c:can_blow(). Silent or buzzing bodies need enough size, a
// head, and breath; bodies which can make other sounds can blow too.
export function heroCanBlow(state: GameState = game) {
    if (state.u.strangled || (state.u.strangledTurns ?? 0) > 0) return false;
    return speciesCanBlow(heroSpecies(state));
}

const RESISTANCE_BITS: ReadonlyArray<readonly [PropertyName, number]> = [
    ['fireResistance', 0x01],
    ['coldResistance', 0x02],
    ['sleepResistance', 0x04],
    ['disintegrationResistance', 0x08],
    ['shockResistance', 0x10],
    ['poisonResistance', 0x20],
    ['acidResistance', 0x40],
    ['stoneResistance', 0x80],
];
const TELEPATHIC_SPECIES = new Set([
    'floating eye', 'mind flayer', 'master mind flayer',
].map(name => MONSTER_NAME.indexOf(name)));

// C ref: mondata.c sticks().
export function heroFormSticks(state: GameState = game) {
    return Upolyd(state.u) && monsterSpeciesSticks(heroSpecies(state));
}

// C set_uasmon(): install the body and replace only its property sources.
export function setHeroSpecies(mnum: number, state: GameState = game) {
    const hero = state.u;
    const oldSpeed = hero.umonnum === undefined ? 12
        : speciesEntry(MONSTER_MOVE, hero.umonnum);
    const newSpeed = speciesEntry(MONSTER_MOVE, mnum);
    if (hero.umovement && newSpeed < oldSpeed && oldSpeed > 0)
        hero.umovement = Math.trunc(hero.umovement * newSpeed / oldSpeed);
    hero.umonnum = mnum;
    // Native set_uasmon() calls float_vs_flight(), which requests bot().
    if (!state.program_state.restoring) state.context.botl = true;
    if (hero.protectionFromShapeChangers || state.protectionFromShapeChangers)
        hero.mcham = -1;
    else if (monsterIsVampire(mnum)) hero.mcham = mnum;
    else if (!validVampireShiftForm(hero.mcham ?? -1, mnum)) hero.mcham = -1;
    if (Upolyd(hero)) hero.formArmorClass = speciesEntry(MONSTER_EXPERIENCE_META, mnum)[0];
    else delete hero.formArmorClass;

    const symbol = speciesEntry(MONSTER_SYMBOL, mnum);
    const name = speciesEntry(MONSTER_NAME, mnum);
    const attacks = speciesEntry(MONSTER_ATTACKS, mnum);
    const inflicts = (damage: number) => attacks.some(attack => attack[1] === damage);
    const floater = symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
    const sightSpecies = Upolyd(hero) ? mnum : state.urace?.mnum;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    const dragonDefense = mnum >= firstDragon && mnum <= lastDragon
        ? mnum : dragonFormForArmor(state.uarm || hero.uarm);
    const properties: Array<readonly [PropertyName, boolean]> = [
        ['drainResistance', (monsterIsUndead(mnum) || (is_were(mnum) || monsterIsDemon(mnum)))
            || (hero.ulycn ?? -1) >= 0 || name === 'Death'
            || validVampireShiftForm(hero.mcham ?? -1, mnum)
            || dragonDefense === MONSTER_NAME.indexOf('black dragon')],
        ['antimagic', inflicts(AD_MAGM) || inflicts(AD_RBRE)
            || name === 'baby gray dragon'],
        ['sicknessResistance', symbol === 32 || name === 'ghoul'],
        ['stunned', name === 'stalker' || monsterIsBat(mnum)],
        ['hallucinationResistance', inflicts(AD_HALU)],
        ['seeInvisible', monsterPerceives(mnum)],
        ['telepathy', TELEPATHIC_SPECIES.has(mnum)],
        ['infravision', !!infravision(sightSpecies ?? -1)],
        ['invisible', name === 'stalker' || name === 'black light'],
        ['teleportation', monsterCanTeleport(mnum)],
        ['teleportControl', monsterControlsTeleport(mnum)],
        ['levitation', floater],
        ['flying', monsterIsFlyer(mnum) && !floater],
        ['swimming', monsterIsSwimmer(mnum)],
        ['passesWalls', monsterPassesWalls(mnum)],
        ['regeneration', regenerates(mnum)],
        ['reflection', name === 'silver dragon'],
        ['blinded', !monsterHasEyes(mnum)],
        ['blindResistance', attacks.some(([type, damage]) => damage === AD_BLND
            && (type === AT_EXPL || type === AT_GAZE))],
    ];
    for (const [property, bit] of RESISTANCE_BITS)
        properties.push([property, !!(speciesEntry(MONSTER_RESISTS, mnum) & bit)]);
    for (const [property, active] of properties) {
        if (active) grantIntrinsicProperty(property, 'form', state);
        else revokeIntrinsicProperty(property, 'form', state);
    }
    syncBlindness(state);
    syncHeroInvisibility(state);
    refreshMovementProperties(state);
    setFormSenses(mnum, state);
    // set_uasmon() reassesses status fields when the hero's body changes.
    reassessStatusFields(state);
    state.were_changes = 0;
}

export function heroWarnsOfMonster(monster: Pick<Monster, 'mnum'> | null | undefined, state: GameState = game) {
    if (!state.u.warnOfMonster || !monster) return false;
    const warning = state.context.warntype;
    if (!warning) throw new Error('Monster warning sources are not initialized');
    const types = (warning.obj || 0) | (warning.polyd || 0);
    // C hack.h:MATCH_WARN_OF_MON intersects the raw warning mask with mflags2.
    return !!(types & speciesEntry(MONSTER_FLAGS2, monster.mnum))
        || warning.speciesidx === monster.mnum;
}

// C polyself.c:polysense().
function setFormSenses(mnum: number, state: GameState) {
    const name = speciesEntry(MONSTER_NAME, mnum);
    const speciesidx = ['purple worm', 'baby purple worm'].includes(name)
        ? MONSTER_NAME.indexOf('shrieker') : -1;
    const polyd = ['vampire', 'vampire leader'].includes(name)
        ? 0x08 | 0x10 : 0; // M2_HUMAN | M2_ELF
    const warning = state.context.warntype ||= { speciesidx, polyd };
    warning.speciesidx = speciesidx;
    warning.polyd = polyd;
    if (warning.speciesidx >= 0 || warning.polyd)
        grantIntrinsicProperty('warnOfMonster', 'form', state);
    else revokeIntrinsicProperty('warnOfMonster', 'form', state);
}

// C youmonst.data always describes u.umonnum, including the unpolymorphed
// role body. Racial rules use urace separately; a human Monk is herbivorous.
export function heroSpecies(state: GameState = game) {
    const species = state.u.umonnum;
    if (species === undefined) throw new Error('Hero species is not initialized');
    return species;
}

// C polyself.c:poly_gender(): non-humanoid and neuter forms use neuter prose.
export function heroPolyGender(state: GameState = game) {
    const species = heroSpecies(state);
    if (is_neuter(species)
        || !monsterIsHumanoid(species)) return 2;
    return state.flags.female ? 1 : 0;
}

// C polyself.c:change_sex(). Fixed-sex forms retain their visible sex;
// a polymorphed hero still changes the saved sex used on rehumanization.
export function changeHeroSex(state: GameState = game) {
    const polymorphed = Upolyd(state.u);
    const species = heroSpecies(state);
    const fixedSex = ((is_male(species) || monsterIsFemale(species)) || is_neuter(species));
    if (!polymorphed || !fixedSex) state.flags.female = !state.flags.female;
    if (polymorphed) state.u.mfemale = !state.u.mfemale;
    if (!polymorphed) {
        if (state.u.umonster === undefined)
            throw new Error('Hero role species is not initialized');
        state.u.umonnum = state.u.umonster;
    }
    else if (species === MONSTER_NAME.indexOf('amorous demon')) {
        state.flags.female = !state.flags.female;
        setHeroSpecies(species, state);
    }
}

export function heroHatesSilver(state: GameState) {
    if ((state.u.ulycn ?? -1) >= 0) return true;
    return monsterSpeciesHatesSilver(heroSpecies(state));
}

export function heroHasNoHead(state: GameState) {
    return Upolyd(state.u)
        && !monsterHasHead({ mnum: heroSpecies(state) });
}

export function heroIsBreathless(state: GameState = game) {
    return !!state.u.magicalBreathing
        || monsterIsBreathless(heroSpecies(state));
}

// C youprop.h:Amphibious. Breathless bodies alone do not qualify.
export function heroIsAmphibious(state: GameState = game) {
    return !!state.u.magicalBreathing
        || monsterIsAmphibious(heroSpecies(state));
}

export function heroPassesWalls(state: GameState = game) {
    return !!state.u.passesWalls || monsterPassesWalls(heroSpecies(state));
}

export function heroLikesLava(state: GameState = game) {
    const hero = state.u;
    if (!Upolyd(hero)) return false;
    return hero.umonnum === PM_FIRE_ELEMENTAL
        || hero.umonnum === PM_SALAMANDER;
}

// C mondata.h:flaming()/noncorporeal()/slimeproof(), for the hero's current
// form; the species predicates live in mondata.js.
export function heroIsFlaming(state: GameState = game): boolean {
    const form = heroMonsterForm(state);
    return form !== null && FLAMING_SPECIES.has(form);
}

export function heroIsNoncorporeal(state: GameState = game): boolean {
    const form = heroMonsterForm(state);
    return form !== null && MONSTER_SYMBOL[form] === S_GHOST;
}

export function heroIsGreenSlime(state: GameState = game): boolean {
    return heroMonsterForm(state) === PM_GREEN_SLIME;
}

export function heroIsSlimeproof(state: GameState = game): boolean {
    return heroIsGreenSlime(state)
        || heroIsFlaming(state)
        || heroIsNoncorporeal(state);
}

// C mondata.c:can_be_strangled(): headless bodies have no neck to squeeze,
// and a mindless body that does not breathe is not strangled by pressure.
export function heroCanBeStrangled(state = game) {
    if (heroHasNoHead(state)) return false;
    const form = state.u.umonnum;

    const mindless = monsterIsMindless(form ?? -1);
    return !mindless || !heroIsBreathless(state);
}

// C polyself.c:check_strangling(), turning the amulet's grip off and on.
export async function stopStrangulationInImmuneForm(
    state = game, publish: MessagePublisher = plineWithContinuation,
) {
    if (!heroIsStrangled(state) || heroCanBeStrangled(state)) return;
    clearHeroStrangulation(state);
    await publish('You are no longer being strangled.');
}

// C polyself.c:check_strangling() with on=TRUE: polymon() and polyman()
// reach this half. The grip tightening also runs
// makeknown(AMULET_OF_STRANGULATION) — discover_object() through
// learnObjectType() — so the amulet enters the discoveries list even when
// it was first put on in an immune body.
export async function restartAmuletStrangulation(
    state = game, publish: MessagePublisher = plineWithContinuation,
) {
    const amulet = state.uamul || state.u.uamul;
    if (amulet?.otyp !== AMULET_OF_STRANGULATION || !heroCanBeStrangled(state))
        return;
    const wasStrangled = heroIsStrangled(state);
    state.u.strangledTurns = 6;
    state.context.botl = true;
    refreshProperty('strangled', state);
    const action = wasStrangled ? 'still constricts' : 'begins constricting';
    const name = simpleObjectName(amulet, state);
    await publish(`Your ${name} ${action} your ${body_part(NECK, state)}!`); /* "throat" */
    learnObjectType(AMULET_OF_STRANGULATION, state);
}

function speciesEntry<Value>(table: readonly Value[], species: number): Value {
    const value = table[species];
    if (value === undefined)
        throw new RangeError(`No monster species data for ${species}`);
    return value;
}

// polyman() also runs when newman() renews an already-human body.
interface RestoredHumanBody {
    changed: boolean;
    regainedSight: boolean;
    changedSeeInvisible: boolean;
    race: string;
}

async function restoreHumanBody(
    state: PlayingGameState, publish: MessagePublisher = plineWithContinuation,
): Promise<RestoredHumanBody> {
    const u = state.u;
    const changed = heroIsPolymorphed(state);
    const wasBlind = heroIsBlind(state);
    const hadSeeInvisible = !!u.seeInvisible;
    const wasMimicking = (u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING;
    const wasHolding = u.ustuck && !u.uswallow && heroFormSticks(state);
    if (changed) {
        if (u.macurr) u.acurr = { a: [...u.macurr.a] };
        if (u.mamax) u.amax = { a: [...u.mamax.a] };
        if (state.flags && typeof u.mfemale === 'boolean')
            state.flags.female = u.mfemale;
    }

    setHeroSpecies(u.umonster, state);
    u.mh = 0;
    u.mhmax = 0;
    u.mtimedone = 0;
    await restoreDragonArmor(state, publish);
    u.uundetected = 0;
    if (wasHolding) await releaseHeroGrip(state, publish);
    const regainedSight = wasBlind && !heroIsBlind(state);

    findArmorClass(state);
    if (wasMimicking) {
        if (heroHasInvoluntaryDelay(state)) await finishHeroHelplessness('', state);
        u.m_ap_type = M_AP_NOTHING;
        u.mappearance = 0;
    }
    await newsym(u.ux, u.uy);
    return {
        changed,
        regainedSight,
        changedSeeInvisible: hadSeeInvisible !== !!u.seeInvisible,
        race: state.urace?.adj || state.urace?.noun || 'human',
    };
}

// C polyman(): both a restored body and newman() cross this same fatal
// boundary before any regained senses, terrain, or equipment aftermath.
async function becomeHuman(
    announcement: string, state: PlayingGameState,
    publish: MessagePublisher = plineWithContinuation, die: DeathHandler = finishHeroDeath,
) {
    const restored = await restoreHumanBody(state, publish);
    if (state.program_state.gameover) return { ...restored, died: true };
    await publish(announcement, { urgent: true });
    if (heroHasBeenGenocided(state)) {
        const cause = takePolymorphGenocide(state) ?? 'self';
        if (await die(genocideDeathOptions(cause))) return { ...restored, died: true };
    }
    const died = await finishHumanFormChange(restored, state, publish);
    return { ...restored, died };
}

export async function returnHeroToHumanForm(state = game, {
    publish = plineWithContinuation,
    die = finishHeroDeath,
}: { publish?: MessagePublisher; die?: DeathHandler } = {}) {
    requirePlayingGame(state);
    if (!heroIsPolymorphed(state))
        return { changed: false, regainedSight: false, died: false };
    const wasFlying = !!state.u.flying;
    if (heroIsUnchanging(state)) {
        if (state.u.mh < 1) {
            const died = await die({
                killer: 'killed while stuck in creature form',
                deathCause: 'killed while stuck in creature form',
                deathLineShown: true,
            });
            return { changed: false, regainedSight: false, died };
        }
        const amulet = state.uamul || state.u.uamul;
        if (amulet?.otyp === AMULET_OF_UNCHANGING) {
            await publish(`Your ${minimalObjectName(amulet, state)} fails!`);
            observeObject(amulet, state);
            learnObjectType(AMULET_OF_UNCHANGING, state);
        }
    }

    // rehumanize() deletes the body's light source before polyman() prints.
    // Its pending vision refresh must reach the announcement's map flush.
    extinguishHeroFormLight(state);
    const race = state.urace.adj;
    const restored = await becomeHuman(`You return to ${race} form!`, state, publish, die);
    if (restored.died) return restored;
    if (state.u.uhp < 1) {
        await publish('Your old form was not healthy enough to survive.');
        const died = await die({
            killer: `reverting to unhealthy ${restored.race} form`,
            deathLineShown: true,
        });
        if (died) return { ...restored, died };
    }
    endVoluntaryMultiTurn(state);
    state.context.botl = true;
    state.vision_full_recalc = 1;
    await encumber_msg(state, publish);
    if (wasFlying && !state.u.flying && state.u.usteed)
        await publish(`You and ${monsterName(state.u.usteed, { state })} return gently to the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
    const retouch = await retouchEquipment(2, { state, publish, die });
    if (retouch.died) return { ...restored, died: true };
    const selfTouch = state.uarmg || state.u?.uarmg ? { died: false }
        : await selfTouchPetrifyingWeapons({ state, publish, die });
    return { ...restored, died: selfTouch.died };
}

async function finishHumanFormChange(
    restored: RestoredHumanBody, state: PlayingGameState, publish: MessagePublisher,
) {
    const hero = state.u;
    // C polyman() only toggles mimic light blocking; its closing see_monsters() redraws.
    if (restored.changedSeeInvisible) set_mimic_blocking({ state });
    if (!heroCanUseTwoWeapons(state)) await stopTwoWeaponCombat(state);
    if (hero.utrap && hero.utraptype === TT_PIT) hero.utrap = rn1(6, 2);
    if (restored.regainedSight) {
        setHeroBlindnessTimeout(1, state);
        await makeBlinded(0, { state, publish });
    }
    await restartAmuletStrangulation(state, publish);
    if (!hero.levitation && !hero.ustuck
        && (isPoolAt(hero.ux, hero.uy, state) || isLavaAt(hero.ux, hero.uy, state))) {
        const result = await applyHeroLocationEffects(publish);
        if (result.died) return true;
    }
    await see_monsters();
    return false;
}

// C polyself.c:dropp().
async function dropCarriedObject(
    object: GameObject | null | undefined, options: { cancelledDon?: boolean } = {},
) {
    if (!object) return;
    await removeWornHeroItem(object, game, options);
    if (game.program_state?.gameover) return;
    if (!game.inventory.includes(object)) return;
    await dropInventoryObjectAtHero(object);
}

function cancelPolymorphDressing(object: GameObject) {
    const delayed = pendingArmorAction(game);
    const cancelledDon = delayed?.object === object && delayed.kind === 'wear';
    if (delayed?.object === object || isBeingTakenOff(object)) cancelDonning();
    return { cancelledDon };
}

export interface PolymonOptions {
    sexChangeAllowed?: boolean;
    announceForm?: boolean;
}

async function beginMonsterForm(mnum: number, {
    sexChangeAllowed = false, announceForm = true,
}: PolymonOptions = {}) {
    requirePlayingGame(game);
    const u = game.u;
    const previousMnum = u.umonnum;
    const wasPolymorphed = heroIsPolymorphed(game);
    if (!wasPolymorphed) {
        u.macurr = { a: [...u.acurr.a] };
        u.mamax = { a: [...u.amax.a] };
        u.mfemale = !!game.flags?.female;
    }

    if (!u.uconduct) u.uconduct = {};
    const firstPolymorph = !u.uconduct.polyselfs;
    u.uconduct.polyselfs = (u.uconduct.polyselfs || 0) + 1;
    if (firstPolymorph) {
        const form = monsterTypeName(mnum, game.flags.female);
        recordGameLogEvent(`changed form for the first time, becoming ${withIndefiniteArticle(form)}`, { flags: LL_CONDUCT });
    }

    // polymon() exercises the human attributes before installing the
    // monster form, so these two calls belong ahead of duration and HP.
    await exerciseAttribute(A_CON, false);
    await exerciseAttribute(A_WIS, true);

    if (wasPolymorphed) {
        u.acurr = { a: [...(u.macurr?.a || u.acurr.a)] };
        u.amax = { a: [...(u.mamax?.a || u.amax.a)] };
        if (game.flags) game.flags.female = !!u.mfemale;
    }

    if (heroHasInvoluntaryDelay(game) && u.m_ap_type === M_AP_OBJECT
        && MONSTER_SYMBOL[previousMnum] !== S_MIMIC)
        await finishHeroHelplessness('', game);
    if (MONSTER_SYMBOL[mnum] !== S_MIMIC) {
        u.m_ap_type = M_AP_NOTHING;
        u.mappearance = 0;
    }

    const female = !!game.flags.female;
    if (is_male(mnum)) game.flags.female = false;
    else if (monsterIsFemale(mnum)) game.flags.female = true;
    else if (!is_neuter(mnum) && mnum !== u.ulycn
        && sexChangeAllowed && rn2(10) === 0)
        game.flags.female = !female;

    const holderName = u.ustuck
        ? monsterName(u.ustuck, { capitalized: true, augmentIt: true }) : '';
    if (announceForm) {
        const sexChanged = female !== game.flags.female;
        const gendered = (is_male(mnum) || monsterIsFemale(mnum));
        const sex = sexChanged && !gendered
            ? game.flags.female ? 'female ' : 'male ' : '';
        const renewed = previousMnum === mnum ? 'new ' : '';
        const name = renewed + sex + monsterTypeName(mnum, game.flags.female);
        const verb = previousMnum === mnum ? 'feel like' : 'turn into';
        await plineWithContinuation(`You ${verb} ${withIndefiniteArticle(name)}!`);
    }

    if (heroIsPetrifying(game) && formCanBecomeStoneGolem(mnum)) {
        mnum = MONSTER_NAME.indexOf('stone golem');
        clearHeroPetrification(game);
        await plineWithContinuation('You turn to stone!');
    }
    u.mtimedone = rn1(500, 500);
    setHeroSpecies(mnum, game);
    const strong = strongmonst(mnum);
    const maximumStrength = formMaximumStrength(mnum);
    u.amax.a[A_STR] = maximumStrength;
    u.acurr.a[A_STR] = strong
        ? maximumStrength : Math.min(u.acurr.a[A_STR], maximumStrength);

    if (u.stoneResistance && heroIsPetrifying(game)) {
        clearHeroPetrification(game);
        await plineWithContinuation('You no longer seem to be petrifying.');
    }
    if (u.sicknessResistance && heroIsSick(game)) {
        cureHeroSickness(game);
        await plineWithContinuation('You no longer feel sick.');
    }
    if (heroIsSliming(game)) {
        if (heroIsFlaming(game)) {
            clearHeroSliming(game);
            await plineWithContinuation('The slime burns away!');
        } else if (MONSTER_NAME[mnum] === 'green slime') {
            clearHeroSliming(game);
        }
    }
    await stopStrangulationInImmuneForm();
    if (heroHasNoHands(game)) setSlipperyHands(0, game);

    const monsterLevel = MONSTER_LEVEL[mnum] ?? 0;
    const fixedGolemHitPoints = golemHitPoints(mnum);
    if (fixedGolemHitPoints) u.mhmax = fixedGolemHitPoints;
    else if (MONSTER_SYMBOL[mnum] === S_DRAGON
        && mnum >= MONSTER_NAME.indexOf('gray dragon'))
        u.mhmax = In_endgame(game.u.uz)
            ? 8 * monsterLevel : 4 * monsterLevel + d(monsterLevel, 4);
    else {
        u.mhmax = monsterLevel > 0 ? d(monsterLevel, 8) : rnd(4);
        if (isHomeElemental(mnum)) u.mhmax *= 3;
    }
    u.mh = u.mhmax;
    if ((u.ulevel ?? 1) < monsterLevel) {
        u.mtimedone = Math.trunc(
            u.mtimedone * (u.ulevel ?? 1) / monsterLevel,
        );
    }
    // polymon() does not repaint the accepted form until break_armor() has
    // completed.  A garment pager can therefore still expose the old hero
    // glyph even though monster HP and status metadata are already live.
    return { mnum, holderName };
}

// C polyself.c:uasmon_maxStr(). Racial limits also apply to undead relatives,
// but living giants are stronger than giant zombies and mummies.
// character_race() (role.c) resolves the player-race species.
export function formMaximumStrength(mnum: number) {
    let race;
    if (is_orc(mnum)) {
        if (mnum !== PM_URUK_HAI && mnum !== PM_ORC_CAPTAIN)
            race = races.find(candidate => candidate.name === 'orc');
    } else if (is_elf(mnum)) {
        race = races.find(candidate => candidate.name === 'elf');
    } else if (is_dwarf(mnum)) {
        race = races.find(candidate => candidate.name === 'dwarf');
    } else if (is_gnome(mnum)) {
        race = races.find(candidate => candidate.name === 'gnome');
    }
    race ||= character_race(mnum);
    if (race) return race.attrmax[A_STR];
    if (!strongmonst(mnum)) return 18;
    return monsterIsGiant(mnum) && !monsterIsUndead(mnum) ? STR19(19) : STR18(100);
}

// C polyself.c:polymon(). Selection is separate from changing the body.
export async function polymonHero(mnum: number, options: PolymonOptions = {}) {
    requirePlayingGame(game);
    if (!Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        throw new RangeError(`Invalid polymorph species: ${mnum}`);
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD) {
        await plineWithContinuation(formatFeltMessage(`rather ${monsterTypeName(mnum, game.flags.female)}-ish.`));
        await exerciseAttribute(A_WIS, true);
        return { transformed: false };
    }

    const wasHolding = game.u.ustuck && !game.u.uswallow && heroFormSticks(game);
    const wasBlind = heroIsBlind(game);
    const wasHidingUnder = game.u.uundetected && heroFormHidesUnderObjects(game);
    const body = await beginMonsterForm(mnum, options);
    mnum = body.mnum;
    if (game.uskin && dragonFormForArmor(game.uskin) !== mnum)
        await restoreDragonArmor(game);
    await changeArmorForHeroForm(mnum);
    if (game.program_state.gameover) return { transformed: true, mnum, died: true };
    await dropPolymorphWeapons(true);
    if (game.program_state.gameover) return { transformed: true, mnum, died: true };
    findArmorClass(game);
    if (wasHidingUnder) await hideHeroUnder(game);
    if (game.u.utrap && game.u.utraptype === TT_PIT)
        game.u.utrap = rn1(6, 2);
    if (wasBlind && !heroIsBlind(game)) {
        setHeroBlindnessTimeout(1, game);
        await makeBlinded(0, { state: game });
    }
    // C leaves the sight refresh for the end of polymon(); messages before
    // see_monsters() still show the old view of neighbors.
    await newsym(game.u.ux, game.u.uy);

    const hero = game.u;
    if (lays_eggs(hero.umonnum)) {
        learnEggType(hero.umonnum, game);
        const name = MONSTER_NAME[hero.umonnum];
        const ordinaryEgg = name === 'queen bee' ? nameToMonster('killer bee')
            : name === 'winged gargoyle' ? nameToMonster('gargoyle') : hero.umonnum;
        learnEggType(ordinaryEgg, game);
    }
    const holder = hero.ustuck;
    const unsolid = monsterIsUnsolid({ mnum: hero.umonnum });
    let wasExpelled = false;
    if (hero.uswallow) {
        if (!holder) throw new Error('A swallowed hero requires an engulfing monster');
        const size = MONSTER_SIZE[hero.umonnum];
        const holderSize = MONSTER_SIZE[holder.mnum];
        if (size === undefined || holderSize === undefined)
            throw new Error('Polymorph escape requires both body sizes');
        if (unsolid || size >= MZ_HUGE
            || (size > holderSize && !monsterIsWhirly(holder))) {
            if (unsolid) {
                const subject = canSpotMonster(holder)
                    ? monsterName(holder, { capitalized: true }) : body.holderName;
                await plineWithContinuation(
                    `${subject} can no longer contain you.`,
                );
            }
            const result = await expelHero(holder, { message: !unsolid });
            if (result.died) return { transformed: true, mnum, died: true };
            wasExpelled = true;
        }
    } else if (holder && !wasHolding && (heroFormSticks() || unsolid)) {
        const subject = canSpotMonster(holder)
            ? monsterName(holder, { capitalized: true }) : body.holderName;
        setHeroGrip(null);
        await plineWithContinuation(`${subject} loses its grip on you.`);
    } else if (wasHolding && !heroFormSticks()) {
        await releaseHeroGrip();
    }
    const riding = await handleRidingAfterFormChange();
    if (riding.died) return { transformed: true, mnum, died: true };
    if (!wasExpelled
        && ((!hero.levitation && !hero.flying && !hero.ustuck
                && (isPoolAt(hero.ux, hero.uy) || isLavaAt(hero.ux, hero.uy)))
            || (hero.uinwater && !hero.swimming))) {
        const result = await applyHeroLocationEffects();
        if (result.died) return { transformed: true, mnum, died: true };
    }
    await escapeTrapsAfterFormChange();
    await restartAmuletStrangulation();
    game.context.botl = true;
    game.vision_full_recalc = 1;
    await see_monsters();

    // dropz() may already have reported the new body's carrying capacity
    // while dropping armor. Native encumber_msg() shares that cached level.
    await encumber_msg(game);

    const retouch = await retouchEquipment(2);
    if (retouch.died) return { transformed: true, mnum, died: true };
    const selfTouch = game.uarmg || game.u?.uarmg ? { died: false }
        : await selfTouchPetrifyingWeapons();
    if (selfTouch.died) return { transformed: true, mnum, died: true };

    if (game.flags.verbose !== false) await explainFormAbilities();
    return { transformed: true, mnum };
}

async function explainFormAbilities() {
    requirePlayingGame(game);
    const form = game.u.umonnum;
    const attacks = MONSTER_ATTACKS[form] ?? [];
    const hasAttack = (type: number) => attacks.some(([attack]) => attack === type);
    const explain = (action: string) => plineWithContinuation(`Use the command #monster to ${action}.`);
    const mightHide = heroFormHidesUnderObjects() || heroFormHidesWithoutCover();
    const webmaker = heroCanSpinWeb();
    if (hasAttack(AT_BREA)) await explain('use your breath weapon');
    if (hasAttack(AT_SPIT)) await explain('spit venom');
    if (MONSTER_SYMBOL[form] === S_NYMPH) await explain('remove an iron ball');
    if (hasAttack(AT_GAZE)) await explain('gaze at monsters');
    if (mightHide && webmaker) await explain('hide or to spin a web');
    else if (mightHide) await explain('hide');
    else if (webmaker) await explain('spin a web');
    if (isWereMonster({ mnum: form })) await explain('summon help');
    if (MONSTER_NAME[form] === 'gremlin') await explain('multiply in a fountain');
    if (monsterIsUnicorn(form)) await explain('use your horn');
    if (monsterIsMindFlayer(form)) await explain('emit a mental blast');
    if (MONSTER_SOUND[form] === MS_SHRIEK) await explain('shriek');
    if (heroCanChangeVampireShape()) await explain('change shape');
    const laysEggs = lays_eggs(form);
    const name = MONSTER_NAME[form];
    if (laysEggs && game.flags.female && name !== 'giant eel' && name !== 'electric eel') {
        const waterEggs = monsterIsEel(form) && game.u.swimming;
        await plineWithContinuation(`Use the command #sit to ${waterEggs ? 'spawn in the water' : 'lay an egg'}.`);
    }
}

async function escapeTrapsAfterFormChange() {
    requirePlayingGame(game);
    const hero = game.u;
    if (hero.passesWalls && hero.utrap
        && (hero.utraptype === TT_INFLOOR || hero.utraptype === TT_BURIEDBALL)) {
        if (hero.utraptype === TT_INFLOOR) {
            await plineWithContinuation('The rock seems to no longer trap you.');
        } else {
            await plineWithContinuation('The buried ball is no longer bound to you.');
            await freeHeroFromBuriedBall();
        }
        await resetUtrap(false);
    } else if (heroLikesLava() && hero.utrap && hero.utraptype === TT_LAVA) {
        await plineWithContinuation(`The ${displayLiquidName('lava')} now feels soothing.`);
        await resetUtrap(true);
    }

    const body = { mnum: hero.umonnum };
    const slipsFree = monsterIsAmorphous(body) || monsterIsWhirly(body)
        || monsterIsUnsolid(body);
    if (slipsFree) {
        if (heroIsPunished()) {
            await plineWithContinuation('You slip out of the iron chain.');
            await unpunishHero();
        } else if (hero.utrap && hero.utraptype === TT_BURIEDBALL) {
            await plineWithContinuation('You slip free of the buried ball and chain.');
            await freeHeroFromBuriedBall();
        }
    }
    const bodySize = MONSTER_SIZE[hero.umonnum];
    if (hero.utrap && (hero.utraptype === TT_WEB || hero.utraptype === TT_BEARTRAP)
        && (slipsFree
            || (bodySize !== undefined && bodySize <= MZ_SMALL
                && hero.utraptype === TT_BEARTRAP))) {
        const trapName = hero.utraptype === TT_WEB ? 'web' : 'bear trap';
        await plineWithContinuation(`You are no longer stuck in the ${trapName}.`);
        await resetUtrap(true);
    }
    if (heroCanSpinWeb() && hero.utrap && hero.utraptype === TT_WEB) {
        await plineWithContinuation('You orient yourself on the web.');
        await resetUtrap(true);
    }
}

// C break_armor(): garments react in body-slot order. Read each slot when
// reached because removing one item can change the remaining equipment.
async function changeArmorForHeroForm(mnum: number) {
    const worn = (slot: 'uarm' | 'uarmc' | 'uarmu' | 'uarmh' | 'uarmg'
        | 'uarmf' | 'uarms' | 'uwep' | 'ublindf') => game[slot] || game.u[slot];
    const breaksArmor = monsterBreaksArmor(mnum);
    const slipsArmor = monsterSlipsArmor(mnum);
    const whirly = monsterIsWhirly({ mnum });
    const noHands = monsterHasNoHands(mnum);
    const verySmall = monsterIsVerySmall(mnum);
    let object;

    if (breaksArmor) {
        if ((object = worn('uarm'))) {
            const dressing = cancelPolymorphDressing(object);
            if (object.lamplit) endObjectBurn(object, game);
            await plineWithContinuation('You break out of your armor!');
            await exerciseAttribute(A_STR, false);
            await removeHeroArmor(object, game, { ...dressing, voluntary: false });
            if (game.program_state.gameover) return;
            await deleteObject(object);
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            if (object.otyp === MUMMY_WRAPPING) {
                await plineWithContinuation(`Your ${simpleArmorName(object, 'uarmc', game)} tears apart!`);
                await deleteObject(object);
            } else {
                const fastening = object.otyp === ALCHEMY_SMOCK ? 'knot' : 'clasp';
                const action = object.otyp === ALCHEMY_SMOCK ? 'is pulled apart' : 'breaks open';
                await plineWithContinuation(`The ${fastening} on your ${simpleArmorName(object, 'uarmc', game)} ${action}!`);
                await dropCarriedObject(object);
                if (game.program_state.gameover) return;
            }
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation('Your shirt rips to shreds!');
            await deleteObject(object);
        }
    } else if (slipsArmor) {
        if ((object = worn('uarm'))
            && !(MONSTER_NAME[mnum] === 'hobbit' && is_elven_armor(object))) {
            const dressing = cancelPolymorphDressing(object);
            await plineWithContinuation('Your armor falls around you!');
            await removeHeroArmor(object, game, { ...dressing, voluntary: false });
            if (game.program_state.gameover) return;
            await dropCarriedObject(object);
            if (game.program_state.gameover) return;
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            const name = simpleArmorName(object, 'uarmc', game);
            await plineWithContinuation(whirly
                ? `Your ${name} falls, unsupported!`
                : `You shrink out of your ${name}!`);
            await dropCarriedObject(object);
            if (game.program_state.gameover) return;
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation(whirly
                ? 'You seep right through your shirt!'
                : 'You become much too small for your shirt!');
            await dropCarriedObject(object);
            if (game.program_state.gameover) return;
        }
    }

    const hornCount = monsterHornCount(mnum);
    if (hornCount && (object = worn('uarmh'))) {
        if (isFlimsyObject(object, game) && pendingArmorAction(game)?.object !== object
            && !isBeingTakenOff(object)) {
            await plineWithContinuation(
                `Your ${hornCount === 1 ? 'horn pierces' : 'horns pierce'} through ${ownedObjectName(object, game, { capitalized: false })}.`,
            );
        } else {
            const dressing = cancelPolymorphDressing(object);
            await plineWithContinuation(
                `Your ${simpleArmorName(object, 'uarmh', game)} falls to the ${surfaceName(game.u.ux, game.u.uy)}!`,
            );
            await dropCarriedObject(object, dressing);
            if (game.program_state.gameover) return;
        }
    }
    if (noHands || verySmall) {
        if ((object = worn('uarmg'))) {
            const dressing = cancelPolymorphDressing(object);
            await plineWithContinuation(
                `You drop your gloves${worn('uwep') ? ' and weapon' : ''}!`,
            );
            await dropPolymorphWeapons(false);
            if (game.program_state.gameover) return;
            await dropCarriedObject(object, dressing);
            if (game.program_state.gameover) return;
        }
        if ((object = worn('uarms'))) {
            await plineWithContinuation('You can no longer hold your shield!');
            await dropCarriedObject(object);
            if (game.program_state.gameover) return;
        }
        if ((object = worn('uarmh'))) {
            const dressing = cancelPolymorphDressing(object);
            await plineWithContinuation(
                `Your ${simpleArmorName(object, 'uarmh', game)} falls to the ${surfaceName(game.u.ux, game.u.uy)}!`,
            );
            await dropCarriedObject(object, dressing);
            if (game.program_state.gameover) return;
        }
    }
    if ((noHands || verySmall || monsterIsSlithy(mnum) || monsterIsCentaur(mnum))
        && (object = worn('uarmf'))) {
        const dressing = cancelPolymorphDressing(object);
        await plineWithContinuation(whirly
            ? 'Your boots fall away!'
            : verySmall
                ? 'Your boots slide off your feet!'
                : 'Your boots are pushed off your feet!');
        await dropCarriedObject(object, dressing);
        if (game.program_state.gameover) return;
    }
    if (heroHasNoHead(game) && (object = worn('ublindf'))) {
        const name = simpleObjectName(object, game).replace(/^pair of /, '');
        await plineWithContinuation(
            `Your ${name} ${verbForSubject(name, 'fall')} off!`,
        );
        await removeEyewear();
        if (game.program_state.gameover) return;
        await dropCarriedObject(object);
        if (game.program_state.gameover) return;
    }
}

// C polyself.c:drop_weapon().
async function dropPolymorphWeapons(alone: boolean) {
    requirePlayingGame(game);
    const primary = game.uwep || game.u.uwep;
    if (!primary) return;
    const form = game.u.umonnum;
    if (alone && !cantwield(form)) {
        if (!heroCanUseTwoWeapons()) await stopTwoWeaponCombat();
        return;
    }

    const secondary = game.u.twoweap ? game.uswapwep || game.u.uswapwep : null;
    const canDropPrimary = canDropPolymorphWeapon(primary);
    const canDropSecondary = !secondary || canDropPolymorphWeapon(secondary);
    if (alone) {
        const verb = canDropPrimary && canDropSecondary ? 'drop' : 'release';
        let noun = droppedWeaponNoun(primary);
        if (secondary && noun !== droppedWeaponNoun(secondary)) noun = 'weapon';
        if (primary.quan !== 1 || secondary) noun = makePlural(noun);
        await plineWithContinuation(
            `You find you must ${verb} ${noun.startsWith('corpse') ? 'the' : 'your'} ${noun}!`,
        );
    }
    const weapons: [GameObject | null | undefined, boolean][] = [
        [secondary, canDropSecondary], [primary, canDropPrimary],
    ];
    for (const [object, canDrop] of weapons) {
        if (!object) continue;
        if (object === primary) await uwepgone(game);
        else await uswapwepgone(game);
        if (!object.in_use && canDrop) await dropCarriedObject(object);
        if (game.program_state.gameover) return;
    }
}

function droppedWeaponNoun(object: GameObject): string {
    const skill = objectSkill(object.otyp);
    return object.oclass === WEAPON_CLASS && skill >= P_SHORT_SWORD && skill <= P_SABER
        ? 'sword' : weaponDescription(object);
}

function canDropPolymorphWeapon(object: GameObject) {
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE)) return false;
    if (isWeldedPrimary(object)) {
        object.bknown = true;
        return false;
    }
    if (object.otyp === LOADSTONE && object.cursed) {
        object.corpsenm = 0;
        object.bknown = true;
        return false;
    }
    return !(object.otyp === LEASH && object.leashmon);
}

// role.js currently stores the pre-consumed initial energy die separately
// during startup.  These are the corresponding role.c enadv.inrnd values
// needed when newman() rolls an entirely new level-zero power increment.
const INITIAL_ENERGY_RANDOM: Partial<Record<RoleKey, number>> = {
    priest: 3,
    wizard: 3,
    healer: 4,
    knight: 4,
    monk: 2,
};

function energyModifier(energy: number) {
    requirePlayingGame(game);
    if (['priest', 'wizard'].includes(game.urole?.key)) return 2 * energy;
    if (['healer', 'knight'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 2);
    if (['barbarian', 'valkyrie'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 4);
    return energy;
}

function newmanPowerIncrement(level: number) {
    requirePlayingGame(game);
    const role = game.urole.enadv;
    const race = game.urace.enadv;
    let power;
    if (level === 0) {
        power = (role.infix || 0) + (race.infix || 0);
        const roleRange = role.inrnd
            || INITIAL_ENERGY_RANDOM[game.urole?.key] || 0;
        if (roleRange > 0) power += rnd(roleRange);
        if ((race.inrnd || 0) > 0) power += rnd(race.inrnd);
    } else {
        const lower = level < (game.urole?.xlev ?? 10);
        const fixedKey = lower ? 'lofix' : 'hifix';
        const randomKey = lower ? 'lornd' : 'hirnd';
        const range = Math.trunc(currentAttribute(A_WIS) / 2)
            + (role[randomKey] || 0) + (race[randomKey] || 0);
        const fixed = (role[fixedKey] || 0) + (race[fixedKey] || 0);
        power = energyModifier(rn2(range) + fixed);
    }
    power = Math.max(1, power);
    if (level < MAXULEV) game.u.ueninc[level] = power;
    return power;
}

function newHumanFormName() {
    if (game.urace?.name === 'human' || game.urace?.noun === 'human')
        return (Upolyd(game.u) ? game.u.mfemale : game.flags.female) ? 'woman' : 'man';
    return game.urace?.noun || game.urace?.name || 'creature';
}

// C newman(): rebuild the human level, health, power, and attributes.
// Both random polymorph and a selected human form can reach this operation.
async function renewHumanForm(sexChangeAllowed = true) {
    requirePlayingGame(game);
    const state: PlayingGameState = game;
    const u = game.u;
    const oldLevel = u.ulevel ?? 1;
    let newLevel = oldLevel + rn2(5) - 2;
    if (newLevel < 1 || newLevel > 127) return unsuccessfulPolymorph();
    newLevel = Math.min(MAXULEV, newLevel);
    if (newLevel < oldLevel)
        u.ulevelmax = (u.ulevelmax ?? oldLevel) - (oldLevel - newLevel);
    u.ulevelmax = Math.max(u.ulevelmax ?? newLevel, newLevel);
    u.ulevel = newLevel;

    const oldGender = heroPolyGender(game);
    if (sexChangeAllowed && rn2(10) === 0) changeHeroSex(game);

    await adjustLevelAbilities(oldLevel, newLevel);

    u.uexp = randomExperience();
    redistributeActiveAttributes();

    let hpMaximum = u.uhpmax ?? 1;
    for (let i = 0; i < oldLevel; i++)
        hpMaximum -= Number(u.uhpinc?.[i] || 0);
    hpMaximum = roundDiv(hpMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        hpMaximum += newHeroHitPoints(state);
    }
    u.ulevel = newLevel;
    hpMaximum = Math.max(hpMaximum, newLevel);
    u.uhp = roundDiv(
        (u.uhp ?? 1) * hpMaximum,
        Math.max(1, u.uhpmax ?? 1),
    );
    u.uhpmax = hpMaximum;
    u.uhp = Math.min(u.uhp, u.uhpmax);
    u.uhppeak = Math.max(u.uhppeak ?? 0, u.uhpmax);

    let powerMaximum = u.uenmax ?? 0;
    for (let i = 0; i < oldLevel; i++)
        powerMaximum -= Number(u.ueninc?.[i] || 0);
    powerMaximum = roundDiv(powerMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        powerMaximum += newmanPowerIncrement(i);
    }
    u.ulevel = newLevel;
    powerMaximum = Math.max(powerMaximum, newLevel);
    u.uen = roundDiv(
        (u.uen ?? 0) * powerMaximum,
        Math.max(1, u.uenmax ?? 0),
    );
    u.uenmax = powerMaximum;
    u.uen = Math.min(u.uen, u.uenmax);

    u.uhunger = 500 + rn2(500);
    cureHeroSickness(game);
    clearHeroPetrification(game);
    if (u.uhp <= 0) {
        if (heroHasPolymorphControl(game)) u.uhp = 1;
        else return unsuccessfulPolymorph();
    }

    await newuhs(false);
    if (game.program_state.gameover) return { transformed: false, died: true };
    const formName = newHumanFormName();
    const restored = await becomeHuman(`You feel like a new ${formName}!`, game);
    if (restored.died)
        return { transformed: true, newman: true, oldLevel, newLevel, died: true };
    if (newLevel !== oldLevel)
        recordGameLogEvent(`became experience level ${newLevel} as a new ${formName}`, { flags: LL_MINORAC });
    else recordRenewedHumanGender(oldGender);
    if (heroIsSliming(game)) {
        await plineWithContinuation('Your body transforms, but there is still slime on you.');
        resetHeroSlimingCountdown(game);
    }
    game.context.botl = true;
    await see_monsters();
    await encumber_msg(game);
    const retouch = await retouchEquipment(2);
    const selfTouch = retouch.died || game.uarmg || game.u?.uarmg ? retouch
        : await selfTouchPetrifyingWeapons();
    if (selfTouch.died) {
        return {
            transformed: true, newman: true, oldLevel, newLevel, died: true,
        };
    }
    return {
        transformed: true,
        newman: true,
        oldLevel,
        newLevel,
    };
}

async function unsuccessfulPolymorph() {
    await plineWithContinuation("Your new form doesn't seem healthy enough to survive.", { urgent: true });
    const died = await finishHeroDeath({ killer: 'unsuccessful polymorph', deathLineShown: true });
    if (!died) {
        await newuhs(false);
        await encumber_msg(game);
    }
    return { transformed: false, died };
}

// C polyself.c:livelog_newform()
function recordRenewedHumanGender(oldGender: number): void {
    requirePlayingGame(game);
    const newGender = heroPolyGender(game);
    if (Upolyd(game.u) || oldGender === newGender) return;
    const role = game.urole;
    // C polyself.c:livelog_newform() tests the gender for truth, so a
    // neuter form's poly_gender() of 2 selects the female role and rank
    // names; the two ranks read rank_of(u.ulevel, Role_switch, gend).
    const oldSex = oldGender !== 0 ? 'f' : 'm';
    const newSex = newGender !== 0 ? 'f' : 'm';
    const oldRole = role.name[oldSex] || role.name.m;
    const newRole = role.name[newSex] || role.name.m;
    const oldRank = rankOf(game.u.ulevel, roleSwitch(game), oldGender !== 0, game);
    const newRank = rankOf(game.u.ulevel, roleSwitch(game), newGender !== 0, game);
    const description = oldRole !== newRole ? newRole
        : oldRank !== newRank ? newRank
            : `${game.flags.female ? 'female' : 'male'} ${newRank}`;
    recordGameLogEvent(`polymorphed into ${withIndefiniteArticle(description)}`, { flags: LL_MINORAC });
}

// C polyself(): select a form, then use the same body-change operations
// whether the request came from a wand, a throne, or a monster ability.
// C light.c:del_light_source(LS_MONSTER, &youmonst), as rehumanize() and
// the slime timeout call it before changing the body.
export function extinguishHeroFormLight(state: GameState) {
    if (state.u.formLightRange === undefined) return;
    delete state.u.formLightRange;
    state.vision_full_recalc = 1;
}

// C polyself.c:polyself() made_change. polymon() leaves the old body's light
// in place, so vision during the change still sees it; only polyself()
// replaces it, doubling a radius of one so the light is detectable.
function updateHeroFormLight(oldLight: boolean, state: PlayingGameState) {
    const newLight = monsterEmitsLight(state.u.umonnum);
    if (oldLight === newLight) return;
    if (oldLight) extinguishHeroFormLight(state);
    if (!newLight) return;
    // C light.c:new_light_source() asks for a full recalc so the source shows.
    state.u.formLightRange = 2;
    state.vision_full_recalc = 1;
}

export async function polymorphHero(flags = POLY_NOFLAGS) {
    requirePlayingGame(game);
    if (heroIsUnchanging(game)) {
        await plineWithContinuation('You fail to transform!');
        return { transformed: false };
    }
    const state = game;
    const oldLight = monsterEmitsLight(state.u.umonnum);
    const result = await changeHeroForm(flags);
    updateHeroFormLight(oldLight, state);
    return result;
}

async function changeHeroForm(flags: number) {
    requirePlayingGame(game);
    const hero = game.u;
    const armor = game.uarm || hero.uarm;
    const dragon = dragonFormForArmor(armor);
    const lycanthrope = Number.isInteger(hero.ulycn) && hero.ulycn >= 0;
    const vampire = heroCanChangeVampireShape(game);
    let forced = !!(flags & POLY_CONTROLLED);
    let controlled = heroCanControlPolymorph(game);
    let monsterChange = !!(flags & POLY_MONSTER);
    let mnum = -1;

    if (!heroHasPolymorphControl(game) && !forced
        && dragon === null && !lycanthrope && !vampire
        && rn2(20) > currentAttribute(A_CON)) {
        await plineWithContinuation('You shudder for a moment.');
        const died = await loseHeroHp(rnd(30), 'system shock');
        if (!died) await exerciseAttribute(A_CON, false);
        return { transformed: false, died };
    }

    if (flags & POLY_REVERT) {
        if (hero.mcham === undefined)
            throw new Error('Reverting a shapechange requires the original species');
        mnum = hero.mcham;
        monsterChange = true;
        controlled = false;
    }
    if (forced && (flags & POLY_LOW_CTRL)
        && (dragon !== null || monsterChange || vampire || lycanthrope))
        forced = false;

    if (monsterChange && vampire)
        return changeVampireForm(mnum, controlled);

    if (controlled || forced) {
        const choice = await chooseHeroForm({ forced, dragon, lycanthrope });
        if (choice.cancelled) return { transformed: false };
        if (choice.revert) {
            const result = await returnHeroToHumanForm(game);
            return { ...result, transformed: result.changed };
        }
        mnum = choice.mnum;
        if (choice.were) return changeWereForm(mnum);
        if (dragon !== null && (choice.random || mnum === dragon))
            return mergeDragonArmor(armor, dragon);
        if (vampire && (choice.random || mnum === PM_WOLF
            || mnum === PM_FOG_CLOUD || monsterIsBat(mnum)))
            return changeVampireForm(mnum, controlled);
    } else {
        if (dragon !== null) return mergeDragonArmor(armor, dragon);
        if (lycanthrope) return changeWereForm(mnum);
        if (vampire) return changeVampireForm(mnum, controlled);
    }

    if (mnum < 0) {
        for (let attempts = 0; attempts < 200; attempts++) {
            mnum = rn1(SPECIAL_PM, 0);
            if (legalPolymorph(mnum) && !PLACEHOLDER_MONSTERS.has(mnum)) break;
        }
    }
    if (!legalPolymorph(mnum) || (!forced && rn2(5) === 0) || ownRace(mnum))
        return renewHumanForm();
    return polymonHero(mnum, { sexChangeAllowed: true });
}

function legalPolymorph(mnum: number) {
    const flags = MONSTER_FLAGS2[mnum];
    return flags !== undefined && polyok(mnum);
}

function ownRace(mnum: number) {
    requirePlayingGame(game);
    return !!(your_race(mnum));
}

function mayChooseForm(mnum: number) {
    return legalPolymorph(mnum) || mnum === PM_HUMAN
        || mnum === game.u.umonster
        || (ownRace(mnum) && !((MONSTER_GENO[mnum] ?? 0) & G_UNIQ));
}

type HeroFormChoice =
    | { cancelled: true; revert?: never; mnum?: never; were?: never; random?: never }
    | { revert: true; cancelled?: never; mnum?: never; were?: never; random?: never }
    | { mnum: number; random?: boolean; were?: boolean; cancelled?: never; revert?: never };

async function chooseHeroForm({ forced, dragon, lycanthrope }: {
    forced: boolean; dragon: number | null; lycanthrope: boolean;
}): Promise<HeroFormChoice> {
    requirePlayingGame(game);
    let tries = 5;
    let mnum = -1;
    do {
        const answer = await getLine(
            'Become what kind of monster? [type the name]',
            (_character, key) => key >= 32 && key < 127,
        );
        if (answer === null && forced) {
            await plineWithContinuation('Never mind.');
            return { cancelled: true };
        }
        const name = answer === null ? '*' : answer.trim().replace(/\s+/g, ' ');
        if (name === '*' || name === 'random')
            return { mnum: -1, random: true };

        mnum = nameToMonster(name);
        const classMatch = mnum < 0 ? resolveMonsterClass(name) : null;
        const monsterClass = classMatch?.monsterClass ?? 0;
        if (classMatch && monsterClass) {
            for (;;) {
                mnum = classMatch.mnum >= 0 ? classMatch.mnum
                    : dragon !== null && monsterClass === S_DRAGON
                        ? dragon : pickFormFromClass(monsterClass);
                if (mnum < 0 || mayChooseForm(mnum)) break;
                if (rn2(3) || --tries > 0) continue;
                tries++;
                break;
            }
        } else if (PLACEHOLDER_MONSTERS.has(mnum)
            && mnum !== PM_HUMAN && !ownRace(mnum)) {
            let substitutes: readonly [string, string];
            const placeholder = MONSTER_NAME[mnum];
            if (placeholder === undefined)
                throw new Error(`Unknown polymorph placeholder species: ${mnum}`);
            switch (placeholder) {
            case 'orc': substitutes = ['hill orc', 'Mordor orc']; break;
            case 'elf': substitutes = ['Green-elf', 'Grey-elf']; break;
            case 'giant': substitutes = ['stone giant', 'hill giant']; break;
            default: throw new Error(`Unknown polymorph placeholder species: ${mnum}`);
            }
            mnum = nameToMonster(substitutes[rn2(3) ? 0 : 1]);
        }

        if (mnum < 0) {
            await plineWithContinuation(monsterClass
                ? "You can't polymorph into any of those."
                : "I've never heard of such monsters.");
            continue;
        }
        if (game.flags.debug && Upolyd(game.u)
            && (mnum === game.u.umonster
                || (game.urole.key === 'priest'
                    && mnum === nameToMonster('aligned cleric')
                    && !name.toLowerCase().includes('aligned'))))
            return { revert: true };

        if (lycanthrope && (wereBeastForSpecies(mnum) === game.u.ulycn
            || mnum === counterWereSpecies(game.u.ulycn)
            || (Upolyd(game.u) && mnum === PM_HUMAN)))
            return { mnum, were: true };

        if (mayChooseForm(mnum)) return { mnum, random: false };
        await plineWithContinuation(
            `You can't polymorph into ${formNameWithArticle(mnum)}.`,
        );
    } while (--tries > 0);

    await plineWithContinuation("That's enough tries!");
    return { mnum, random: true };
}

// C mkclass_poly(): choose by generation frequency, allowing extinction
// but excluding genocide, placeholders, and specially generated monsters.
export function pickFormFromClass(monsterClass: number): number {
    requirePlayingGame(game);
    const first = MONSTER_SYMBOL.indexOf(monsterClass);
    if (first < 0 || first >= SPECIAL_PM) return -1;
    const members = [];
    let mask = G_NOGEN | G_UNIQ;
    const inHell = !!game.dungeons?.[game.u.uz.dnum]?.flags?.hellish;
    if (rn2(9) || monsterClass === S_LICH)
        mask |= inHell ? G_NOHELL : G_HELL;
    let total = 0;
    for (let mnum = 0; mnum < SPECIAL_PM; mnum++) {
        if (MONSTER_SYMBOL[mnum] !== monsterClass
            || ((MONSTER_GENO[mnum] ?? 0) & mask)
            || ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD)
            || PLACEHOLDER_MONSTERS.has(mnum)
            || MONSTER_NAME[mnum] === 'mail daemon') continue;
        const frequency = (MONSTER_GENO[mnum] ?? 0) & G_FREQ;
        members.push({ mnum, frequency });
        total += frequency;
    }
    if (!total) return -1;
    let choice = rnd(total);
    for (const { mnum, frequency } of members) {
        choice -= frequency;
        if (choice <= 0) return mnum;
    }
    throw new Error('Polymorph class selection exhausted its generation weights');
}

function formNameWithArticle(mnum: number) {
    const name = monsterTypeName(mnum, game.flags.female);
    if (monsterHasProperName(mnum)) return name;
    if (((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) && mnum !== SPECIAL_PM
        && mnum !== nameToMonster('high cleric')) return `the ${name}`;
    return withIndefiniteArticle(name);
}

function changeWereForm(requested: number) {
    requirePlayingGame(game);
    return Upolyd(game.u) && wereBeastForSpecies(requested) !== game.u.ulycn
        ? renewHumanForm(false)
        : polymonHero(game.u.ulycn);
}

export function heroCanChangeVampireShape(state = game) {
    const form = state.u.umonnum;
    const originalForm = state.u.mcham;
    return form !== undefined && (monsterIsVampire(form)
        || (originalForm !== undefined && validVampireShiftForm(originalForm, form)));
}

async function changeVampireForm(mnum: number, controlled: boolean) {
    requirePlayingGame(game);
    const hero = game.u;
    if (mnum < 0 || ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)) {
        if (hero.umonnum === PM_VAMPIRE_LEADER && rn2(10) === 0)
            mnum = PM_WOLF;
        else
            mnum = rn2(4) === 0 ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
        if (hero.mcham !== undefined && Number.isInteger(hero.mcham) && hero.mcham >= 0
            && !monsterIsVampire(hero.umonnum) && rn2(2) === 0)
            mnum = hero.mcham;
    }
    if (controlled) {
        const answer = await promptYesNo(
            `Become ${formNameWithArticle(mnum)}?`,
        );
        if (answer !== 'y') return { transformed: false };
    }
    return polymonHero(mnum);
}

export interface HeroBreathOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    publish?: MessagePublisher;
    readDirection?: () => { key: string } | null | Promise<{ key: string } | null>;
    finishMonsterKill?: typeof finishHeroMonsterKill;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
}

export type HeroBreathResult =
    | { used: false; spentTime: false; reason: 'no-breath' | 'strangled' | 'energy' | 'cancelled' }
    | ((HeroRayResult | NativeRayResult) & { spentTime: true });

// C polyself.c:dobreathe().
export async function useHeroBreath({
    state = game,
    attack = heroBreathAttack(state),
    publish = plineWithContinuation,
    readDirection = promptDirection,
    finishMonsterKill = finishHeroMonsterKill,
    random = rn2,
    rollDice = d,
    rollOne = rnd,
}: HeroBreathOptions = {}): Promise<HeroBreathResult> {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-breath' };

    const hero = state.u;
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0) {
        await publish("You can't breathe.  Sorry.");
        return { used: false, spentTime: false, reason: 'strangled' };
    }
    const energy = hero.uen ?? 0;
    if (energy < 15) {
        await publish("You don't have enough energy to breathe!");
        return { used: false, spentTime: false, reason: 'energy' };
    }

    hero.uen = energy - 15;
    state.context.botl = true;
    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const result = direction.key === '.'
        ? await hitHeroWithRay({
            state, attack, publish, random, rollDice, rollOne,
        })
        : await breatheInDirection(direction.key, {
            state, attack, publish, finishMonsterKill,
            random, rollDice, rollOne,
        });
    return { ...result, spentTime: true };
}

export function heroSpitAttack(state = game) {
    const form = heroMonsterForm(state);
    if (form == null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType]) => attackType === AT_SPIT,
    ) || null;
}

function venomTypeForAttack(attack: MonsterAttack) {
    const damageType = attack?.[1];
    return damageType === AD_BLND || damageType === AD_DRST
        ? BLINDING_VENOM : ACID_VENOM;
}

async function settleVenom(venom: GameObject, x: number, y: number, state: GameState) {
    placeCreatedObject(venom, x, y);
    await stack_object(venom, state);
    await newsym(x, y);
}

async function breakVenomAtEndpoint(
    venom: GameObject, x: number, y: number, state: GameState,
    publish: MessagePublisher, random: typeof rn2,
) {
    venom.ox = x;
    venom.oy = y;
    const location = state.level?.at?.(x, y);
    if (location && !IS_SOFT(location.typ))
        objectBreaksOnImpact(venom, random);
    return breakObjectAtLocation(venom, {
        x, y, fromInventory: true, inView: cansee(x, y), state, publish, random,
    });
}

async function dropVenomAtHero(
    venom: GameObject, state: GameState, publish: MessagePublisher,
    random: typeof rn2, verbose: boolean,
) {
    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const underwater = state.underwater || state.u?.uinwater;
    if (!location || IS_SOFT(location.typ) || underwater) {
        await settleVenom(venom, x, y, state);
        return { destroyed: false };
    }

    venom.ox = x;
    venom.oy = y;
    if (verbose) {
        await publish(`A ${venom.name || 'splash of venom'} hits the ${
            surfaceName(x, y, state)}.`);
    }
    const result = await breakFloorObject(venom, {
        x, y, fromInventory: true, state, publish, random,
    });
    if (!result.destroyed) await settleVenom(venom, x, y, state);
    return result;
}

interface VenomImpactOptions {
    monster: Monster;
    target: Position;
    venom: GameObject;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    swallowed: boolean;
    finishMonsterKill: typeof finishHeroMonsterKillOutcome;
}

async function hitMonsterWithVenom({
    monster, target, venom, state, publish, random, rollOne, swallowed,
    finishMonsterKill,
}: VenomImpactOptions) {
    const impact = await hitMonsterWithThrownEggPieOrVenom(
        monster, venom, {
            state,
            target,
            guaranteedHit: swallowed,
            publish,
            random,
            rollOne,
            finishMonsterKill: (victim, options) => finishMonsterKill(
                victim,
                victim.mx,
                victim.my,
                swallowed
                    ? { ...options, deathContext: { kind: 'swallowed-venom' } }
                    : options,
            ),
        },
    );
    if (!impact) throw new Error(`Spitting requires a venom object, received object type ${venom.otyp}`);
    return impact;
}

interface SpitDirection {
    key: string;
    dx: number;
    dy: number;
    dz: number;
}

interface HorizontalSpitOptions {
    venom: GameObject;
    direction: SpitDirection;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    captureFlight: ProjectileFlightCapture;
    recoilHero: typeof hurtleHero;
    finishMonsterKill: typeof finishHeroMonsterKillOutcome;
}

async function spitHorizontally({
    venom, direction, state, publish, random, rollOne,
    captureFlight, recoilHero, finishMonsterKill,
}: HorizontalSpitOptions) {
    if (state.u?.uswallow && state.u?.ustuck) {
        const impact = await hitMonsterWithVenom({
            monster: state.u.ustuck, venom, state, publish, random, rollOne,
            target: { x: state.u.ux, y: state.u.uy },
            swallowed: true, finishMonsterKill,
        });
        return { ...impact, destroyed: true };
    }

    const underwater = state.underwater || state.u?.uinwater;
    const trajectory = underwater
        ? { range: 1, recoil: 0 }
        : heroThrowTrajectory(venom, state);
    const flight = await flyHeroThrownObject({
        state, object: venom,
        dx: direction.dx, dy: direction.dy,
        range: trajectory.range,
        captureFlight, publish, random,
    });
    if (trajectory.recoil) {
        await recoilHero(
            -direction.dx, -direction.dy, trajectory.recoil,
            { verbose: true },
        );
        // C throwit() recoils after bhit() (dothrow.c:1682); a fatal hurtle
        // ends in done(), which never returns, so the venom never reaches
        // its target or breaks afterwards.
        if (state.program_state.gameover) return { heroDied: true };
    }
    if (flight.destroyed) return flight;
    if (flight.contact) {
        const impact = await hitMonsterWithVenom({
            monster: flight.contact, venom, state, publish, random, rollOne,
            target: { x: flight.x, y: flight.y },
            swallowed: false, finishMonsterKill,
        });
        if (impact.heroDied) return impact;
        if (impact.consumed) return { ...flight, destroyed: true };
    }
    const broken = await breakVenomAtEndpoint(
        venom, flight.x, flight.y, state, publish, random,
    );
    return { ...flight, destroyed: broken.destroyed };
}

interface HeroSpitOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    readDirection?: () => SpitDirection | null | Promise<SpitDirection | null>;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    captureFlight?: ProjectileFlightCapture;
    recoilHero?: typeof hurtleHero;
    finishMonsterKill?: typeof finishHeroMonsterKillOutcome;
}

// C polyself.c:dospit().
export async function useHeroSpit({
    state = game,
    attack = heroSpitAttack(state),
    readDirection = promptDirection,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
    captureFlight = captureThrownObjectFlight,
    recoilHero = hurtleHero,
    finishMonsterKill = finishHeroMonsterKillOutcome,
}: HeroSpitOptions = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-spit' };

    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    const venom = await mksobj(venomTypeForAttack(attack), true, false);
    venom.spe = 1;
    venom.where = 'free';
    venom.how_lost = LOST_THROWN;

    let result;
    if (state.u?.uswallow) {
        result = await spitHorizontally({
            venom, direction, state, publish, random, rollOne,
            captureFlight, recoilHero, finishMonsterKill,
        });
    } else if (direction.dz < 0) {
        const landed = await tossObjectUp(venom, { state, publish, random, rollOne });
        result = { destroyed: landed === null };
    } else if (direction.dz > 0) {
        result = await dropVenomAtHero(
            venom, state, publish, random, true,
        );
    } else {
        result = await spitHorizontally({
            venom, direction, state, publish, random, rollOne,
            captureFlight, recoilHero, finishMonsterKill,
        });
    }
    return { ...result, venom, used: true, spentTime: true };
}

export function heroCanRemovePunishment(state: GameState = game) {
    return heroIsPolymorphed(state) && state.u.umonnum !== undefined
        && MONSTER_SYMBOL[state.u.umonnum] === S_NYMPH;
}

export async function useHeroNymphAbility({
    state = game,
    publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}) {
    if (!heroCanRemovePunishment(state))
        return { used: false, spentTime: false, reason: 'not-nymph' };

    const ball = state.uball || state.u?.uball;
    if (!ball) {
        if (state.u?.utrap && state.u.utraptype === TT_BURIEDBALL) {
            await publish(
                `The ball and chain are buried firmly in the ${
                    surfaceName(state.u.ux, state.u.uy, state)
                }.`,
            );
            return { used: true, spentTime: false, reason: 'buried' };
        }
        await publish('You are not chained to anything!');
        return { used: true, spentTime: false, reason: 'not-punished' };
    }

    await unpunishHero(state);
    return { used: true, spentTime: true };
}

const PM_CAVE_SPIDER = MONSTER_NAME.indexOf('cave spider');
const PM_GIANT_SPIDER = MONSTER_NAME.indexOf('giant spider');

const TRAPS_TRIGGERED_BY_WEBBING = new Set([
    ARROW_TRAP, DART_TRAP, BEAR_TRAP, ROCKTRAP, FIRE_TRAP, LANDMINE,
    SLP_GAS_TRAP, RUST_TRAP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP,
]);

function webMaker(form: number | null | undefined) {
    return form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER;
}

export function heroCanSpinWeb(state = game) {
    return webMaker(heroMonsterForm(state));
}

export async function chooseSpiderAbility() {
    const { answer } = await yn_function('Hide [h] or spin a web [s]?', 'hsq', 'q', true, { menuable: true });
    return answer === 'h' ? 'hide' : answer === 's' ? 'spin' : null;
}

function trapAtHero(state: GameState) {
    return state.level?.traps?.find(trap =>
        trap.tx === state.u.ux && trap.ty === state.u.uy) || null;
}

function heroIsOnStairway(state: GameState): boolean {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === state.u.ux && stair.sy === state.u.uy) return true;
    }
    return false;
}

function engulfingAttack(monster: Monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(
        ([attackType]) => attackType === AT_ENGL,
    );
}

function whirlyWebMessage(monster: Monster) {
    const damageType = engulfingAttack(monster)?.[1];
    let action = '';
    if (damageType === AD_FIRE) action = 'ignites and ';
    else if (damageType === AD_ELEC) action = 'fries and ';
    else if (damageType === AD_COLD) action = 'freezes, shatters and ';
    return `The web ${action}is swept away!`;
}

async function spinWhileSwallowed(state: GameState, publish: MessagePublisher, refresh: typeof newsym) {
    const monster = state.u.ustuck;
    if (!monster) throw new Error('A swallowed hero must have an engulfing monster');
    await publish(`You release web fluid inside ${monsterName(monster, { state })}.`);
    if (monsterIsAnimal(monster)) {
        await expelHero(monster, { state, publish, refresh });
    } else if (monsterIsWhirly(monster)) {
        await publish(whirlyWebMessage(monster));
    } else {
        await publish(`The web dissolves into ${monsterName(monster, { state })}.`);
    }
}

export async function useHeroWeb({
    state = game,
    publish = plineWithContinuation,
    refresh = newsym,
    createTrap = maketrap,
    activateTrap = dotrap,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    refresh?: typeof newsym;
    createTrap?: typeof maketrap;
    activateTrap?: typeof dotrap;
} = {}) {
    if (!heroCanSpinWeb(state)) return { used: false, spentTime: false };

    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const rejectsWeb = isPoolAt(x, y, state) || isLavaAt(x, y, state)
        || (location !== null && location !== undefined && IS_AIR(location.typ));
    if (state.u.levitating || state.u.levitation || state.levitating
        || rejectsWeb) {
        await publish(`You must be on ${
            rejectsWeb ? 'solid' : 'the'
        } ground to spin a web.`);
        return { used: true, spentTime: false, reason: 'terrain' };
    }

    if (state.u.uswallow) {
        await spinWhileSwallowed(state, publish, refresh);
        return { used: true, spentTime: false };
    }
    if (state.u.utrap) {
        await publish('You cannot spin webs while stuck in a trap.');
        return { used: true, spentTime: false, reason: 'trapped' };
    }

    await exerciseAttribute(A_DEX, true, state);
    const trap = trapAtHero(state);
    if (trap) {
        if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
            await publish('You spin a web, covering up the pit.');
            deleteTrap(trap, state);
            await buryFloorObjectsAt(x, y, state, { publish });
            await refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === SQKY_BOARD) {
            await publish('The squeaky board is muffled.');
            deleteTrap(trap, state);
            await refresh(x, y);
            return { used: true, spentTime: true };
        }
        if ([
            TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, VIBRATING_SQUARE,
        ].includes(trap.ttyp)) {
            await publish('Your webbing vanishes!');
            return { used: true, spentTime: false };
        }
        if (trap.ttyp === WEB) {
            await publish('You make the web thicker.');
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
            await publish(`You web over the ${
                trap.ttyp === TRAPDOOR ? 'trap door' : 'hole'
            }.`);
            deleteTrap(trap, state);
            await refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === ROLLING_BOULDER_TRAP) {
            await publish('You spin a web, jamming the trigger.');
            deleteTrap(trap, state);
            await refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (TRAPS_TRIGGERED_BY_WEBBING.has(trap.ttyp)) {
            await publish('You have triggered a trap!');
            await activateTrap(trap);
            return { used: true, spentTime: true };
        }
        return { used: true, spentTime: false, reason: 'unknown-trap' };
    }

    // C On_stairs() uses the stairway chain even after terrain changes.
    if (heroIsOnStairway(state)) {
        await publish(`Your web fails to impede access to the ${
            location?.typ === STAIRS ? 'stairs' : 'ladder'
        }.`);
        return { used: true, spentTime: true };
    }

    const web = await createTrap(x, y, WEB);
    if (web) {
        await publish('You spin a web.');
        web.madeby_u = 1;
        await feelTrap(web, state);
        if (roomsAt(state.level, x, y, SHOPBASE).length)
            addShopDamage(x, y, SHOP_WEB_COST, state);
    }
    return { used: true, spentTime: true, trap: web };
}

interface WereSummonOptions extends HeroWereChangeOptions {
    random?: typeof rn2;
    rollOne?: typeof rnd;
}

// C polyself.c:dosummon().
export async function useHeroWereSummon({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
}: WereSummonOptions = {}) {
    requirePlayingGame(state);
    if (!heroCanSummonWerePack(state))
        return { used: false, spentTime: false, reason: 'not-were' };
    if ((state.u?.uen ?? 0) < 10) {
        await publish('You lack the energy to send forth a call for help!');
        return { used: false, spentTime: false, reason: 'energy' };
    }

    state.u.uen -= 10;
    state.context.botl = true;
    await publish('You call upon your brethren for help!');
    await exerciseAttribute(A_WIS, true, state);

    const form = heroMonsterForm(state);
    const helpers = form === null ? [] : await summonWerePack(form, true, state, random, rollOne);
    if (!helpers.length) await publish('But none arrive.');
    return { used: true, spentTime: true, helpers };
}

const MR_FIRE = 0x01;
const PM_FLOATING_EYE = 28;
const PM_MEDUSA = 284;

export function heroGazeAttack(state = game) {
    const form = heroMonsterForm(state);
    if (form == null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType]) => attackType === AT_GAZE,
    ) || null;
}

function heroIsConfused(state: GameState) {
    return !!(state.u?.confused || (state.u?.confusionTurns ?? 0) > 0);
}

function gazeCannotAffect(monster: Monster) {
    const helpless = monster.msleeping || monster.mcanmove === 0
        || monster.mcanmove === false
        || (monster.mfrozen ?? 0) > 0;
    const blind = !monster.mcansee;
    const eyeless = !monsterHasEyes(monster.mnum);
    return helpless || monster.mstun || blind || eyeless;
}

function floatingEyeFreezeDuration(monster: Monster, state: GameState, random: typeof rn2, rollDice: typeof d) {
    if ((state.u?.ulevel ?? 1) <= 6 && random(4) === 0) return 200;
    const attack = MONSTER_ATTACKS[monster.mnum]?.[0] || [];
    return rollDice((monster.m_lev ?? 0) + 1, attack[3] ?? 1);
}

async function applyGazePassive(
    monster: Monster, state: GameState, publish: MessagePublisher,
    random: typeof rn2, rollDice: typeof d, die: DeathHandler,
) {
    if (monster.mnum === PM_FLOATING_EYE && !monster.mcan) {
        const owner = possessiveName(monsterName(monster, { state }));
        if (heroHasFreeAction(state)) {
            await publish(`You stiffen momentarily under ${owner} gaze.`);
            return { heroDied: false };
        }
        await publish(`You are frozen by ${owner} gaze!`);
        state._occupation = null;
        nomul(-floatingEyeFreezeDuration(monster, state, random, rollDice), state);
        state._helplessReason = "frozen by a monster's gaze";
        state._helplessDoneMessage = null;
        return { heroDied: false, stopped: true };
    }

    if (monster.mnum !== PM_MEDUSA || monster.mcan)
        return { heroDied: false };
    const name = monsterName(monster, { state, article: 'none' });
    await publish(`Gazing at the awake ${name} is not a very good idea.`);
    await publish('You turn to stone...');
    const heroDied = await die({
        killer: "deliberately meeting Medusa's gaze",
        killerFormat: KILLED_BY,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { heroDied, stopped: heroDied };
}

async function applyConfusingGaze(monster: Monster, state: GameState, publish: MessagePublisher) {
    if (!monster.mconf)
        await publish(`Your gaze confuses ${monsterName(monster, { state })}!`);
    else
        await publish(`${monsterName(monster, { state, capitalized: true })} is getting more and more confused.`);
    monster.mconf = 1;
}

type FinishGazeKill = (monster: Monster, x: number, y: number) => unknown;

async function applyFieryGaze({
    monster, state, publish, random, rollDice, finishMonsterKill,
}: {
    monster: Monster;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollDice: typeof d;
    finishMonsterKill: FinishGazeKill;
}) {
    const name = monsterName(monster, { state });
    const originalDamage = rollDice(2, 6);
    let damage = originalDamage;
    await publish(`You attack ${name} with a fiery gaze!`);
    if (monsterHasElementalResistance(monster, MR_FIRE)) {
        await publish(`The fire doesn't burn ${name}!`);
        damage = 0;
    }
    if ((state.u?.ulevel ?? 1) > random(20)) {
        damage += await destroyFireMonsterInventory(
            monster, originalDamage, {
                publish,
                random,
                visible: canSeeMonster(monster),
            },
        );
        await igniteItems(monster.minvent || monster.inventory, {
            state,
            publish,
            random,
            visible: canSeeMonster(monster),
        });
    }
    monster.mhp -= damage;
    if (monster.mhp > 0) return false;
    await finishMonsterKill(monster, monster.mx, monster.my);
    return monster.mhp <= 0 || !!monster.dead;
}

async function confirmPeacefulGaze(monster: Monster, damageType: DamageType, state: GameState) {
    const action = damageType === AD_CONF ? 'confuse' : 'attack';
    return await promptYesNo(
        `Really ${action} ${monsterName(monster, { state })}?`,
    ) === 'y';
}

interface HeroGazeOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    finishMonsterKill?: FinishGazeKill;
    die?: DeathHandler;
}

// C polyself.c:dogaze().
export async function useHeroGaze({
    state = game,
    attack = heroGazeAttack(state),
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    finishMonsterKill = finishHeroMonsterKill,
    die = finishHeroDeath,
}: HeroGazeOptions = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-gaze' };
    const damageType = attack[1];
    if (damageType !== AD_CONF && damageType !== AD_FIRE)
        return { used: false, spentTime: false, reason: 'unsupported-gaze' };
    if (heroIsBlind(state)) {
        await publish("You can't see anything to gaze at.");
        return { used: false, spentTime: false, reason: 'blind' };
    }
    if (heroIsHallucinating(state)) {
        await publish("You can't gaze at anything you can see.");
        return { used: false, spentTime: false, reason: 'hallucinating' };
    }
    const energy = state.u.uen ?? 0;
    if (energy < 15) {
        await publish('You lack the energy to use your special gaze!');
        return { used: false, spentTime: false, reason: 'energy' };
    }
    state.u.uen = energy - 15;
    state.context.botl = true;

    let looked = 0;
    // polyself.c:dogaze() walks fmon, newest monster first.
    for (const monster of monstersInFmonOrder(state.level?.monsters || [])) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
            || !canSeeMonster(monster)
            || !couldsee(monster.mx, monster.my)) continue;
        looked++;

        if (heroIsInvisible(state)
            && !monsterPerceives(monster.mnum)) {
            await publish(`${monsterName(monster, { state, capitalized: true })} seems not to notice your gaze.`);
            continue;
        }
        if (monster.minvis && !heroCanSeeInvisible(state)) {
            await publish(`You can't see where to gaze at ${monsterName(monster, { state, capitalized: true })}.`);
            continue;
        }
        if (M_AP_TYPE(monster) === M_AP_FURNITURE
            || M_AP_TYPE(monster) === M_AP_OBJECT) {
            looked--;
            continue;
        }
        if ((state.flags?.safe_dog ?? true) && monster.mtame && !heroIsConfused(state)) {
            const target = monsterName(monster, { state, article: 'your' });
            await publish(`You avoid gazing at ${target}.`);
            continue;
        }
        if (state.flags?.confirm && monster.mpeaceful
            && !heroIsConfused(state)
            && !await confirmPeacefulGaze(monster, damageType, state)) continue;

        await angerAttackedMonster(monster);
        if (gazeCannotAffect(monster)) {
            looked--;
            continue;
        }

        let killed = false;
        if (damageType === AD_CONF)
            await applyConfusingGaze(monster, state, publish);
        else {
            killed = await applyFieryGaze({
                monster, state, publish, random, rollDice,
                finishMonsterKill,
            });
        }
        if (killed) continue;

        const passive = await applyGazePassive(
            monster, state, publish, random, rollDice, die,
        );
        if (passive.stopped)
            return { used: true, spentTime: true, looked, ...passive };
    }
    if (!looked) await publish('You gaze at no place in particular.');
    return { used: true, spentTime: true, looked, heroDied: false };
}

export async function useHeroVampireShift() {
    const previous = game.u.umonnum;
    if (heroCanChangeVampireShape(game)) {
        const result = await polymorphHero(POLY_MONSTER);
        if (result.died) return { spentTime: true, died: true };
        if (previous !== game.u.umonnum) {
            const currentForm = game.u.umonnum;
            if (currentForm === undefined) throw new Error('vampire shape change did not install a body');
            const name = monsterTypeName(currentForm, !!game.u.mfemale);
            await plineWithContinuation(`You transform into ${withIndefiniteArticle(name)}.`);
            await newsym(game.u.ux, game.u.uy);
        }
    }
    return { spentTime: true, changed: previous !== game.u.umonnum };
}

export function heroCanMindBlast(state = game) {
    const form = state.u.umonnum;
    return (state.u.mtimedone ?? 0) > 0
        && form !== undefined && monsterIsMindFlayer(form);
}

export async function useHeroMindBlast({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDamage = rnd,
    wake = wakeMonster,
    finishMonsterKill = finishHeroMonsterKill,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDamage?: typeof rnd;
    wake?: typeof wakeMonster;
    finishMonsterKill?: (monster: Monster, x: number, y: number) => unknown;
} = {}) {
    const hero = state.u;
    const energy = hero.uen ?? 0;
    if (energy < 10) {
        await publish(
            'You concentrate but lack the energy to maintain doing so.',
        );
        return { spentTime: false, hitCount: 0 };
    }

    hero.uen = energy - 10;
    state.context.botl = true;
    await publish('You concentrate.');
    await publish('A wave of psychic energy pours out.');

    let hitCount = 0;
    // C walks fmon, which lists the newest monster first.
    for (const monster of monstersInFmonOrder(state.level?.monsters || [])) {
        if (!canReachMonsterMind(monster, hero)) continue;

        const sense = mindBlastSense(monster, random);
        if (!sense) continue;

        const damage = rollDamage(15);
        await wake(monster, { attacked: damage > monster.mhp });
        await publish(
            `You lock in on ${possessiveName(monsterName(monster, { state }))} ${sense}.`,
        );
        monster.mhp -= damage;
        hitCount++;
        if (monster.mhp <= 0) {
            await finishMonsterKill(monster, monster.mx, monster.my);
        }
    }
    return { spentTime: true, hitCount };
}

function canReachMonsterMind(monster: Monster, hero: HeroCoordinates) {
    if (!monster || monster.dead || (monster.mhp ?? 0) <= 0)
        return false;
    if (monster.mpeaceful || monsterIsMindless(monster.mnum)) return false;
    return dist2(hero.ux, hero.uy, monster.mx, monster.my)
        <= BOLT_LIM * BOLT_LIM;
}

function mindBlastSense(monster: Monster, random: typeof rn2) {
    const telepathic = monsterIsTelepathic(monster.mnum);
    const blind = monster.mcansee === 0 || monster.mcansee === false;
    if (telepathic && blind) return 'telepathy';
    if (telepathic && random(2) !== 0) return 'latent telepathy';
    if (random(10) === 0)
        return telepathic ? 'latent telepathy' : 'mind';
    return null;
}

// C polyself.c:uunstick().
export async function releaseHeroGrip(state: GameState = game, publish: MessagePublisher = plineWithContinuation): Promise<void> {
    const holder = state.u.ustuck;
    if (!holder) throw new Error('Releasing the hero grip requires a held monster.');
    setHeroGrip(null, state);
    await publish(`${monsterName(holder, { state, capitalized: true })} is no longer in your clutches.`);
}

async function mergeDragonArmor(armor: GameObject | null | undefined, mnum: number) {
    if (!armor)
        throw new Error('Merging with a dragon form requires worn dragon armor');
    if (!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD)) {
        const oldLight = objectLightRadius(armor);
        if (armor.otyp >= GRAY_DRAGON_SCALES) {
            await plineWithContinuation('You merge with your scaly armor.');
        } else {
            const name = simpleObjectName(armor).replace(' dragon ', ' ');
            await plineWithContinuation(
                `Your ${name} reverts to scales as you merge with them.`,
            );
            armor.otyp += GRAY_DRAGON_SCALES - GRAY_DRAGON_SCALE_MAIL;
            const scaleName = OBJ_NAME(armor.otyp);
            if (!scaleName) throw new Error(`Unknown dragon scales type: ${armor.otyp}`);
            armor.name = scaleName;
            observeObject(armor, game);
            game.context.botl = true;
        }
        game.uskin = armor;
        game.uarm = game.u.uarm = null;
        armor.owornmask = (armor.owornmask ?? 0) | I_SPECIAL;
        armor.wornSlot = 'uskin';
        if (armor.lamplit) await adjustObjectLight(armor, oldLight);
    }
    return polymonHero(mnum);
}

// C polyself.c:skinback()
async function restoreDragonArmor(state = game, publish: MessagePublisher = plineWithContinuation) {
    const armor = state.uskin;
    if (!armor) return;
    const oldLight = objectLightRadius(armor, state);
    await publish('Your skin returns to its original form.');
    state.uarm = state.u.uarm = armor;
    state.uskin = null;
    armor.owornmask = (armor.owornmask ?? 0) & ~I_SPECIAL;
    armor.wornSlot = 'uarm';
    if (armor.lamplit) await adjustObjectLight(armor, oldLight, state);
}


const S_BLOB = 2;
const S_CENTAUR = 29;
const S_UNICORN = 21;
const S_VORTEX = 22;
const S_COCKATRICE = 3;
const S_DOG = 4;
const S_EEL = 57;
const S_ELEMENTAL = 31;
const S_EYE = 5;
const S_FELINE = 6;
const S_FUNGUS = 32;
const S_JELLY = 10;
const S_LIGHT = 25;
const S_PUDDING = 42;
const S_RODENT = 18;
const S_SPIDER = 19;
const S_WORM = 23;
const S_YETI = 51;
// not_claws: humanoids whose claw attacks should still read as hands
const S_HUMAN = 53;
const S_MUMMY = 39;
const S_ZOMBIE = 52;
const S_ANGEL = 27;
const S_LEPRECHAUN = 12;
const S_QUANTMECH = 43;
const S_VAMPIRE = 48;
const S_ORC = 15;
const S_GIANT = 34;
const PM_ROTHE = MONSTER_NAME.indexOf('rothe');
const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const PM_OWLBEAR = MONSTER_NAME.indexOf('owlbear');
const PM_JELLYFISH = MONSTER_NAME.indexOf('jellyfish');
const PM_KRAKEN = MONSTER_NAME.indexOf('kraken');
const PM_MUMAK = MONSTER_NAME.indexOf('mumak');
const PM_MASTODON = MONSTER_NAME.indexOf('mastodon');
const PM_SHARK = MONSTER_NAME.indexOf('shark');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');

const humanoid_parts: readonly string[] = [
    'arm',       'eye',  'face',         'finger',
    'fingertip', 'foot', 'hand',         'handed',
    'head',      'leg',  'light headed', 'neck',
    'spine',     'toe',  'hair',         'blood',
    'lung',      'nose', 'stomach',
];
const jelly_parts: readonly string[] = [
    'pseudopod', 'dark spot', 'front',
    'pseudopod extension', 'pseudopod extremity',
    'pseudopod root', 'grasp', 'grasped',
    'cerebral area', 'lower pseudopod', 'viscous',
    'middle', 'surface', 'pseudopod extremity',
    'ripples', 'juices', 'surface', 'sensor',
    'stomach',
];
const animal_parts: readonly string[] = [
    'forelimb',  'eye',           'face',
    'foreclaw',  'claw tip',      'rear claw',
    'foreclaw',  'clawed',        'head',
    'rear limb', 'light headed',  'neck',
    'spine',     'rear claw tip', 'fur',
    'blood',     'lung',          'nose',
    'stomach',
];
const bird_parts: readonly string[] = [
    'wing',     'eye',  'face',         'wing',
    'wing tip', 'foot', 'wing',         'winged',
    'head',     'leg',  'light headed', 'neck',
    'spine',    'toe',  'feathers',     'blood',
    'lung',     'bill', 'stomach',
];
const horse_parts: readonly string[] = [
    'foreleg',  'eye',           'face',
    'forehoof', 'hoof tip',      'rear hoof',
    'forehoof', 'hooved',        'head',
    'rear leg', 'light headed',  'neck',
    'backbone', 'rear hoof tip', 'mane',
    'blood',    'lung',          'nose',
    'stomach',
];
const sphere_parts: readonly string[] = [
    'appendage', 'optic nerve', 'body', 'tentacle',
    'tentacle tip', 'lower appendage', 'tentacle',
    'tentacled', 'body', 'lower tentacle',
    'rotational', 'equator', 'body',
    'lower tentacle tip', 'cilia', 'life force',
    'retina', 'olfactory nerve', 'interior',
];
const fungus_parts: readonly string[] = [
    'mycelium', 'visual area', 'front',
    'hypha',    'hypha',       'root',
    'strand',   'stranded',    'cap area',
    'rhizome',  'sporulated',  'stalk',
    'root',     'rhizome tip', 'spores',
    'juices',   'gill',        'gill',
    'interior',
];
const vortex_parts: readonly string[] = [
    'region',        'eye',           'front',
    'minor current', 'minor current', 'lower current',
    'swirl',         'swirled',       'central core',
    'lower current', 'addled',        'center',
    'currents',      'edge',          'currents',
    'life force',    'center',        'leading edge',
    'interior',
];
const snake_parts: readonly string[] = [
    'vestigial limb', 'eye', 'face', 'large scale',
    'large scale tip', 'rear region', 'scale gap',
    'scale gapped', 'head', 'rear region',
    'light headed', 'neck', 'length', 'rear scale',
    'scales', 'blood', 'lung', 'forked tongue',
    'stomach',
];
const worm_parts: readonly string[] = [
    'anterior segment', 'light sensitive cell',
    'clitellum', 'setae', 'setae', 'posterior segment',
    'segment', 'segmented', 'anterior segment',
    'posterior', 'over stretched', 'clitellum',
    'length', 'posterior setae', 'setae', 'blood',
    'skin', 'prostomium', 'stomach',
];
const spider_parts: readonly string[] = [
    'pedipalp', 'eye', 'face', 'pedipalp', 'tarsus',
    'claw', 'pedipalp', 'palped', 'cephalothorax',
    'leg', 'spun out', 'cephalothorax', 'abdomen',
    'claw', 'hair', 'hemolymph', 'book lung',
    'labrum', 'digestive tract',
];
const fish_parts: readonly string[] = [
    'fin', 'eye', 'premaxillary', 'pelvic axillary',
    'pelvic fin', 'anal fin', 'pectoral fin', 'finned',
    'head', 'peduncle', 'played out', 'gills',
    'dorsal fin', 'caudal fin', 'scales', 'blood',
    'gill', 'nostril', 'stomach',
];

/* claw attacks are overloaded in mons[]; most humanoids with
   such attacks should still reference hands rather than claws */
const not_claws: readonly number[] = [
    S_HUMAN,     S_MUMMY,   S_ZOMBIE, S_ANGEL, S_NYMPH, S_LEPRECHAUN,
    S_QUANTMECH, S_VAMPIRE, S_ORC,    S_GIANT, /* quest nemeses */
];

// C indexes the static part tables directly; out-of-range part ids (a port
// bug) fall back to the bad-part name rather than reading past the table.
function tablePart(parts: readonly string[], part: number): string {
    return parts[part] ?? 'mystery part';
}

// C polyself.c:mbodypart()
export function mbodypart(mnum: number, part: number): string {
    const symbol = MONSTER_SYMBOL[mnum] ?? -1;

    if (part <= NO_PART) {
        // C reports impossible("mbodypart: bad part %d", part); the port only
        // passes the bodypart_types ids from const.ts, so this is unreachable
        // and a sync lookup has no message publisher.
        return 'mystery part';
    }

    /* some special cases */
    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR) {
        if (part === HAND) return 'paw';
        if (part === HANDED) return 'pawed';
        if (part === FOOT) return 'rear paw';
        if (part === ARM || part === LEG)
            return tablePart(horse_parts, part); /* "foreleg", "rear leg" */
        /* for other parts, use animal_parts[] below */
    } else if (symbol === S_YETI) { /* excl. owlbear due to 'if' above */
        /* opposable thumbs, hence "hands", "arms", "legs", &c */
        return tablePart(humanoid_parts, part); /* yeti/sasquatch, monkey/ape */
    }
    if ((part === HAND || part === HANDED)
        && (monsterIsHumanoid(mnum)
            && (MONSTER_ATTACKS[mnum] || []).some(
                ([attackType]) => attackType === AT_CLAW) /* attacktype() */
            && !not_claws.includes(symbol) && mnum !== PM_STONE_GOLEM
            && mnum !== PM_AMOROUS_DEMON))
        return (part === HAND) ? 'claw' : 'clawed';
    if ((mnum === PM_MUMAK || mnum === PM_MASTODON)
        && part === NOSE)
        return 'trunk';
    if (mnum === PM_SHARK && part === HAIR)
        return 'skin'; /* sharks don't have scales */
    if ((mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        && (part === ARM || part === FINGER || part === HAND || part === FOOT
            || part === TOE))
        return 'tentacle';
    if (mnum === PM_FLOATING_EYE && part === EYE)
        return 'cornea';
    if (monsterIsHumanoid(mnum) && (part === ARM || part === FINGER
                                   || part === FINGERTIP
                                   || part === HAND || part === HANDED))
        return tablePart(humanoid_parts, part);
    if (symbol === S_COCKATRICE)
        return tablePart(part === HAIR ? snake_parts : bird_parts, part);
    if (mnum === PM_RAVEN)
        return tablePart(bird_parts, part);
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN
        || (mnum === PM_ROTHE && part !== HAIR))
        return tablePart(horse_parts, part);
    if (symbol === S_LIGHT) {
        if (part === HANDED)
            return 'rayed';
        else if (part === ARM || part === FINGER || part === FINGERTIP
                 || part === HAND)
            return 'ray';
        else
            return 'beam';
    }
    if (mnum === PM_STALKER && part === HEAD)
        return 'head';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return tablePart(fish_parts, part);
    if (symbol === S_WORM)
        return tablePart(worm_parts, part);
    if (symbol === S_SPIDER)
        return tablePart(spider_parts, part);
    if (monsterIsSlithy(mnum) || (symbol === S_DRAGON && part === HAIR))
        return tablePart(snake_parts, part);
    if (symbol === S_EYE)
        return tablePart(sphere_parts, part);
    if (symbol === S_JELLY || symbol === S_PUDDING
        || symbol === S_BLOB || mnum === PM_JELLYFISH)
        return tablePart(jelly_parts, part);
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return tablePart(vortex_parts, part);
    if (symbol === S_FUNGUS)
        return tablePart(fungus_parts, part);
    if (monsterIsHumanoid(mnum))
        return tablePart(humanoid_parts, part);
    return tablePart(animal_parts, part);
}

// The permonst index of the hero's current body, this port's model of
// youmonst.data: u.umonnum when polymorphed, the saved role body otherwise.
function currentHeroMonsterNumber(state: GameState): number {
    const current = state.u.umonnum;
    if (typeof current === 'number' && Number.isInteger(current)) return current;
    const original = state.u.umonster;
    if (typeof original === 'number' && Number.isInteger(original)) return original;
    const role = state.urole;
    if (role && Number.isInteger(role.mnum)) return SPECIAL_PM + 1 + role.mnum;
    return PM_HUMAN;
}

// C polyself.c:body_part()
export function body_part(part: number, state: GameState = game): string {
    return mbodypart(currentHeroMonsterNumber(state), part);
}
// C polyself.c:armor_to_dragon(): scales and scale mail use the same color order.
export function dragonFormForArmor(object: Pick<GameObject, 'otyp'> | null | undefined) {
    const type = object?.otyp;
    if (type === undefined) return null;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    if (type >= GRAY_DRAGON_SCALE_MAIL && type <= YELLOW_DRAGON_SCALE_MAIL)
        return firstDragon + type - GRAY_DRAGON_SCALE_MAIL;
    if (type >= GRAY_DRAGON_SCALES && type <= YELLOW_DRAGON_SCALES)
        return firstDragon + type - GRAY_DRAGON_SCALES;
    return null;
}

export type HeroGenocideCause = 'scroll' | 'confusion' | 'throne';

export function rememberPolymorphGenocide(
    cause: HeroGenocideCause, state: GameState = game,
): void {
    state._polymorphGenocideCause = cause;
}

// Native polyman removes the delayed killer before done(), which can return
// when a wizard refuses death. A later reversion then uses self-genocide.
export function takePolymorphGenocide(state: GameState = game): HeroGenocideCause | null {
    const cause = state._polymorphGenocideCause ?? null;
    delete state._polymorphGenocideCause;
    return cause;
}

// C polyself.c:ugenocided().
export function heroHasBeenGenocided(state: GameState = game): boolean {
    const { u, urace } = requireInitializedGame(state);
    // This port's role.mnum is a role-table index; u.umonster stores its
    // initialized monster species, equivalent to native urole.mnum.
    const roleVital = state.mvitals?.[u.umonster];
    const raceVital = state.mvitals?.[urace.mnum];
    if (!roleVital || !raceVital)
        throw new Error('Hero genocide requires initialized species population state');
    return !!((roleVital.mvflags | raceVital.mvflags) & G_GENOD);
}

// C polyself.c:udeadinside().
export function feelingAfterSelfGenocide(state: GameState = game): 'dead' | 'condemned' | 'empty' {
    const species = heroSpecies(state);
    if (!monsterIsNonliving(species)) return 'dead';
    return monsterIsWeirdNonliving(species) ? 'empty' : 'condemned';
}

export function genocideDeathOptions(cause: HeroGenocideCause | 'self'): FinishHeroDeathOptions {
    let killer: string;
    let description: string;
    switch (cause) {
    case 'scroll':
        killer = 'scroll of genocide';
        description = 'a scroll of genocide';
        break;
    case 'throne':
        killer = 'imperious order';
        description = 'an imperious order';
        break;
    case 'confusion':
        killer = description = 'genocidal confusion';
        break;
    case 'self':
        killer = description = 'self-genocide';
        break;
    }
    return { killer, deathCause: `killed by ${description}`, deathType: GENOCIDED, deathLineShown: true };
}

// Hiding with #monster while polymorphed.
// C refs: cmd.c domonability(), polyself.c dohide(), insight.c youhiding().

// C polyself.c:dohide(): the #monster hide action (cmd.c:domonability()).
// C insight.c:youhiding() lives in insight.js; dohide() calls it for the
// "already hiding"/"now hiding" feedback, as in C.

interface HidingAbility {
    form: number;
    hidesUnder: boolean;
    mimic: boolean;
    flying: boolean;
    onCeiling: boolean;
}

function heroHidingAbility(state: GameState): HidingAbility | null {
    const form = heroMonsterForm(state);
    if (form == null) return null;

    const hidesUnder = heroFormHidesUnderObjects(state);
    const hidesWithoutCover = heroFormHidesWithoutCover(state);
    if (!hidesUnder && !hidesWithoutCover) return null;

    const flying = heroIsFlying(state);
    return {
        form,
        hidesUnder,
        mimic: MONSTER_SYMBOL[form] === S_MIMIC,
        flying,
        onCeiling: flying || heroFormClings(state),
    };
}

export function heroHasHidingAbility(state = game) {
    return !!heroHidingAbility(state);
}

async function revealHero(ability: HidingAbility, state: GameState, refresh: typeof newsym) {
    state.u.uundetected = 0;
    if (ability.mimic) state.u.m_ap_type = M_AP_NOTHING;
    await refresh(state.u.ux, state.u.uy);
}

function heldReason(state: GameState) {
    const holder = state.u.ustuck;
    if (!holder) return 'trapped';
    if (state.u.uswallow)
        return monsterDigests(holder) ? 'swallowed' : 'engulfed';
    if (!heroFormSticks(state)) return 'being held';
    return monsterIsHumanoid(holder.mnum)
        ? 'holding someone' : 'holding that creature';
}

export function floorObjects(state: GameState) {
    return state.level?.objects?.[state.u.ux]?.[state.u.uy] || [];
}

function petrifyingCorpseCover(objects: readonly GameObject[]) {
    const first = objects[0];
    if (!first || first.corpsenm === undefined || objects.some(object =>
        object.otyp !== CORPSE || object.corpsenm === undefined
        || !touchPetrifies(object.corpsenm))) {
        return null;
    }

    const count = objects.reduce(
        (total, object) => total + (object.quan ?? object.quantity ?? 1),
        0,
    );
    // C polyself.c:dohide() appends plur(count) to cxname(top), even when
    // the top object's own quantity already pluralized the corpse name.
    const corpse = corpseName(first);
    return count === 1 ? withIndefiniteArticle(corpse) : `${corpse}s`;
}

function sameLevel(left: DungeonLocation | null | undefined, right: DungeonLocation | null | undefined) {
    return !!left && !!right
        && left.dnum === right.dnum && left.dlevel === right.dlevel;
}

function isAirLevel(state: GameState) {
    return sameLevel(state.u.uz, state.air_level);
}

function isWaterLevel(state: GameState) {
    return sameLevel(state.u.uz, state.water_level);
}

// C polyself.c:dohide()
export async function useHeroHide({
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
    refresh = newsym,
}: { state?: GameState; publish?: MessagePublisher; die?: DeathHandler; refresh?: typeof newsym } = {}) {
    const ability = heroHidingAbility(state);
    if (!ability) return { used: false, spentTime: false };

    const trapped = state.u.utrap
        && (state.u.utraptype !== TT_PIT || ability.onCeiling);
    if (state.u.ustuck || trapped) {
        await publish(`You can't hide while you're ${
            heldReason(state)
        }.`);
        if (state.u.uundetected
            || (ability.mimic
                && (state.u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING)) {
            await revealHero(ability, state, refresh);
        }
        return { used: true, spentTime: false, reason: 'blocked' };
    }

    const objects = floorObjects(state);
    if (ability.hidesUnder && !objects.length) {
        state.u.uundetected = 0;
        await publish('There is nothing to hide under here.');
        return { used: true, spentTime: false, reason: 'no-cover' };
    }

    const corpseCover = ability.hidesUnder
        && !state.u.stoneResistance
        ? petrifyingCorpseCover(objects) : null;
    if (corpseCover) {
        await publish(`Hiding under ${corpseCover} is a fatal mistake...`);
        await publish('You turn to stone...');
        const died = await die({
            killer: `hiding under ${corpseCover}`,
            deathVerb: 'turned to stone',
            deathLineShown: true,
            deathType: STONING,
        });
        if (!died) state.u.uundetected = 0;
        return { used: true, spentTime: true, died: !!died };
    }

    if (ability.onCeiling && !levelHasCeiling(state)) {
        state.u.uundetected = 0;
        await publish('There is nowhere to hide above you.');
        return { used: true, spentTime: false, reason: 'no-ceiling' };
    }
    if (!ability.flying && heroFormHidesWithoutCover(state)
        && (isAirLevel(state) || isWaterLevel(state))) {
        state.u.uundetected = 0;
        await publish('There is nowhere to hide beneath you.');
        return { used: true, spentTime: false, reason: 'no-floor' };
    }

    const alreadyHidden = state.u.uundetected
        || (ability.mimic
            && (state.u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING);
    if (alreadyHidden) {
        await publish(`You are already ${
            heroHidingStatus(state)
        }.`);
        return { used: true, spentTime: false, reason: 'already-hidden' };
    }

    if (ability.mimic) {
        state.u.m_ap_type = M_AP_OBJECT;
        state.u.mappearance = STRANGE_OBJECT;
    } else {
        state.u.uundetected = 1;
    }
    await refresh(state.u.ux, state.u.uy);
    await publish(`You are now ${heroHidingStatus(state)}.`);
    return { used: true, spentTime: true };
}
