// Hero form changes and equipment.
// C refs: polyself.c polyself(), polymon(), break_armor(), drop_weapon().
import { weaponDescription } from './weapon_description.js';
import { P_SHORT_SWORD, P_SABER } from './const.js';
import { makePlural } from './object_grammar.js';
import { OBJECT_SUBTYPE } from './object_data.js';
import { heroIsUnaware } from './hero_sleep.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay } from './command_state.js';
import { finishHeroHelplessness } from './allmain.js';
import { genocideDeathOptions, heroHasBeenGenocided, takePolymorphGenocide } from './hero_genocide.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { makeBlinded } from './sight_change.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { minimalObjectName } from './objnam.js';
import { monsterName } from './monster_name.js';
import { surfaceName } from './terrain_name.js';
import { updateHeroHunger } from './hunger.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { game, requirePlayingGame } from './gstate.js';
import { removeEyewear } from './eyewear.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import { adjustLevelAbilities, experienceRankIndex, randomExperience, } from './exper.js';
import { recordGameLogEvent } from './gamelog.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { reportHeroEncumbrance } from './attrib.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, SPECIAL_PM, monsterBreaksArmor, monsterHasNoHands, monsterHornCount, monsterIsBat, monsterIsCentaur, monsterIsAmorphous, monsterIsSlithy, monsterIsUnsolid, monsterIsVampire, monsterIsVerySmall, monsterIsWhirly, monsterSlipsArmor, monsterTypeName, monsterWrappingAllowed, validVampireShiftForm, } from './monster_data.js';
import { AD_ELEC, AD_FIRE } from './monster_attack_types.js';
import { AMULET_OF_UNCHANGING, ELVEN_MITHRIL_COAT, LEASH, LENSES, LOADSTONE, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, OBJECT_MATERIAL, OBJECT_NAMES, RIN_POLYMORPH_CONTROL, RIN_PROTECTION_FROM_SHAPE_CHANGERS, } from './object_data.js';
import { newsym, pline, plineWithContinuation, see_monsters, } from './display.js';
import { deleteObject } from './object_delete.js';
import { dragonFormForArmor, findArmorClass, removeHeroArmor } from './armor.js';
import { endObjectBurn } from './light.js';
import { encumbranceLabel, encumbranceMessage, nearCapacity, } from './weight.js';
import { A_CHA, A_CON, A_DEX, A_STR, A_WIS, G_GENOD, I_SPECIAL, In_endgame, M_AP_NOTHING, STAIRS, STR18, STR19, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, Upolyd, POLY_CONTROLLED, POLY_LOW_CTRL, POLY_MONSTER, POLY_NOFLAGS, POLY_REVERT, W_ACCESSORY, W_ARMOR, W_SADDLE, } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { heroIsBlind, setHeroBlindnessTurns, syncBlindness } from './senses.js';
import { nameToMonster, nameToMonsterClass } from './mondata.js';
import { counterWereSpecies } from './monster_species.js';
import { wereBeastForSpecies } from './were.js';
import { getLine, promptYesNo } from './query.js';
import { golemHitPoints, isHomeElemental } from './monster_hit_points.js';
import { races } from './roles.js';
import { finishHeroDeath } from './end.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { clearHeroPetrification, formCanBecomeStoneGolem, heroIsPetrifying, selfTouchPetrifyingWeapons, } from './stoning.js';
import { changeHeroSex, heroFormSticks, heroHasNoHead, heroPolyGender, setHeroSpecies, heroLikesLava } from './hero_species.js';
import { retouchEquipment } from './hero_retouch.js';
import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { loseHeroHp } from './hero_damage.js';
import { isWeldedPrimary, losePrimaryWeapon, setSecondaryWeapon } from './weapon_slots.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { heroCanUseTwoWeapons, stopTwoWeaponCombat } from './two_weapon.js';
import { vision_recalc } from './vision.js';
import { heroIsPunished } from './ball.js';
import { unpunishHero } from './punishment.js';
import { clearHeroTrap, freeHeroFromBuriedBall } from './hero_traps.js';
import { handleRidingAfterFormChange } from './steed.js';
import { heroCanSpinWeb } from './hero_web.js';
import { expelHero, holdingMonsterSubject, releaseHeroGrip, } from './hero_expulsion.js';
import { applyHeroLocationEffects } from './cmd.js';
import { restartAmuletStrangulation, stopStrangulationInImmuneForm, } from './hero_strangulation.js';
import { clearHeroSliming, heroIsFlaming, heroIsSliming, resetHeroSlimingCountdown, } from './slime.js';
const M1_NOTAKE = 0x00000800;
const M1_NOLIMBS = 0x00006000;
const M1_CLING = 0x00000010;
const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;
const M1_OVIPAROUS = 0x00400000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_STRONG = 0x04000000;
const M2_UNDEAD = 0x00000002;
const M2_ELF = 0x00000010;
const M2_DWARF = 0x00000020;
const M2_GNOME = 0x00000040;
const M2_ORC = 0x00000080;
const M2_GIANT = 0x00002000;
const M2_NOPOLY = 0x00000001;
const M2_PNAME = 0x00080000;
const G_FREQ = 0x0007;
const G_NOGEN = 0x0200;
const G_HELL = 0x0400;
const G_NOHELL = 0x0800;
const G_UNIQ = 0x1000;
const S_MIMIC = 13;
const S_DRAGON = 30;
const MZ_SMALL = 1;
const MZ_HUGE = 4;
const MAXULEV = 30;
const MUMMY_WRAPPING = 138;
const ALCHEMY_SMOCK = 144;
const LEATHER = 7;
const PM_HUMAN = MONSTER_NAME.indexOf('human');
const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');
const S_LICH = MONSTER_SYMBOL[MONSTER_NAME.indexOf('lich')];
const PLACEHOLDER_MONSTERS = new Set(['orc', 'giant', 'elf', 'human']
    .map(name => MONSTER_NAME.indexOf(name)));
const OLFACTIONLESS_SYMBOLS = new Set([
    2, // S_BLOB
    5, // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);
function wornPropertyObject(state, otyp, slots) {
    return slots.some(slot => {
        const object = state[slot] || state.u?.[slot];
        return object?.otyp === otyp && object.worn !== false;
    });
}
export function heroHasPolymorphControl(state = game) {
    return !!(state.u?.polymorphControl || state.polymorphControl)
        || wornPropertyObject(state, RIN_POLYMORPH_CONTROL, ['uleft', 'uright']);
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
        || state.protectionFromShapeChangers)
        return true;
    return wornPropertyObject(state, RIN_PROTECTION_FROM_SHAPE_CHANGERS, ['uleft', 'uright']);
}
export function heroIsPolymorphed(state = game) {
    return Upolyd(state.u);
}
// C polyself.c:ugolemeffects(). Hero golems heal, but do not gain the
// monster-only slow/haste changes that would outlive their borrowed form.
export async function applyHeroGolemEffects(damageType, damage, { state = game, publish = plineWithContinuation, } = {}) {
    requirePlayingGame(state);
    const form = heroMonsterForm(state);
    if (form === null)
        return;
    const species = MONSTER_NAME[form];
    const healing = species === 'flesh golem' && damageType === AD_ELEC
        ? Math.trunc((damage + 5) / 6)
        : species === 'iron golem' && damageType === AD_FIRE ? damage : 0;
    if (!healing || state.u.mh >= state.u.mhmax)
        return;
    state.u.mh = Math.min(state.u.mhmax, state.u.mh + healing);
    state.context.botl = true;
    await publish('Strangely, you feel better than before.');
    await exerciseAttribute(A_STR, true, state);
}
export function heroMonsterForm(state = game) {
    if (!heroIsPolymorphed(state))
        return null;
    const form = state.u.umonnum;
    if (form === undefined)
        throw new Error('A polymorphed hero requires a current species');
    return form;
}
export function heroFormFlags(state = game) {
    const form = heroMonsterForm(state);
    return form == null ? 0 : MONSTER_FLAGS1[form] ?? 0;
}
export function heroIsFlying(state = game) {
    return !!state.u?.flying;
}
export function heroFormClings(state = game) {
    return !!(heroFormFlags(state) & M1_CLING);
}
export function heroFormHidesUnderObjects(state = game) {
    return !!(heroFormFlags(state) & M1_CONCEAL);
}
export function heroFormHidesWithoutCover(state = game) {
    return !!(heroFormFlags(state) & M1_HIDE);
}
export function heroHidesOnCeiling(state = game) {
    const form = heroMonsterForm(state);
    if (form == null || !state.u?.uundetected
        || !heroFormHidesWithoutCover(state))
        return false;
    return heroIsFlying(state)
        || (heroFormClings(state) && MONSTER_SYMBOL[form] !== S_MIMIC);
}
export function heroHasNoHands(state = game) {
    const form = heroMonsterForm(state);
    return form !== null && monsterHasNoHands(form);
}
export function heroCannotTake(state = game) {
    return !!(heroFormFlags(state) & M1_NOTAKE);
}
export function heroHasNoLimbs(state = game) {
    return (heroFormFlags(state) & M1_NOLIMBS) === M1_NOLIMBS;
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
    if (form === null)
        return true;
    const symbol = MONSTER_SYMBOL[form];
    return symbol === undefined || !OLFACTIONLESS_SYMBOLS.has(symbol);
}
async function restoreHumanBody(state, publish = plineWithContinuation) {
    const u = state.u;
    const changed = heroIsPolymorphed(state);
    const wasBlind = heroIsBlind(state);
    const hadSeeInvisible = !!u.seeInvisible;
    const wasMimicking = (u.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING;
    const wasHolding = u.ustuck && !u.uswallow && heroFormSticks(state);
    const previousEncumbrance = state._encumbranceLevel !== undefined
        && Number.isInteger(state._encumbranceLevel)
        ? state._encumbranceLevel : nearCapacity(state);
    if (changed) {
        if (u.macurr)
            u.acurr = { a: [...u.macurr.a] };
        if (u.mamax)
            u.amax = { a: [...u.mamax.a] };
        if (state.flags && typeof u.mfemale === 'boolean')
            state.flags.female = u.mfemale;
    }
    setHeroSpecies(u.umonster, state);
    u.mh = 0;
    u.mhmax = 0;
    u.mtimedone = 0;
    await restoreDragonArmor(state, publish);
    u.uundetected = 0;
    if (wasHolding)
        await releaseHeroGrip(state, publish);
    const regainedSight = wasBlind && !heroIsBlind(state);
    findArmorClass(state);
    if (wasMimicking) {
        if (heroHasInvoluntaryDelay(state))
            await finishHeroHelplessness('', state);
        u.m_ap_type = M_AP_NOTHING;
        u.mappearance = 0;
    }
    state.vision_full_recalc = 1;
    state._encumbranceLevel = nearCapacity(state);
    u._encumbrance = encumbranceLabel(state._encumbranceLevel);
    newsym(u.ux, u.uy);
    return {
        changed,
        regainedSight,
        changedSeeInvisible: hadSeeInvisible !== !!u.seeInvisible,
        race: state.urace?.adj || state.urace?.noun || 'human',
        encumbranceMessage: encumbranceMessage(previousEncumbrance, state._encumbranceLevel),
    };
}
// C polyman(): both a restored body and newman() cross this same fatal
// boundary before any regained senses, terrain, or equipment aftermath.
async function becomeHuman(announcement, state, publish = plineWithContinuation, die = finishHeroDeath) {
    const restored = await restoreHumanBody(state, publish);
    if (state.program_state.gameover)
        return { ...restored, died: true };
    await publish(announcement, { urgent: true });
    if (heroHasBeenGenocided(state)) {
        const cause = takePolymorphGenocide(state) ?? 'self';
        if (await die(genocideDeathOptions(cause)))
            return { ...restored, died: true };
    }
    const died = await finishHumanFormChange(restored, state, publish);
    return { ...restored, died };
}
export async function returnHeroToHumanForm(state = game, { publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
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
    const race = state.urace.adj;
    const restored = await becomeHuman(`You return to ${race} form!`, state, publish, die);
    if (restored.died)
        return restored;
    if (state.u.uhp < 1) {
        await publish('Your old form was not healthy enough to survive.');
        const died = await die({
            killer: `reverting to unhealthy ${restored.race} form`,
            deathLineShown: true,
        });
        if (died)
            return { ...restored, died };
    }
    endVoluntaryMultiTurn(state);
    state.context.botl = true;
    state.vision_full_recalc = 1;
    if (restored.encumbranceMessage)
        await publish(restored.encumbranceMessage);
    if (wasFlying && !state.u.flying && state.u.usteed)
        await publish(`You and ${monsterName(state.u.usteed, { state })} return gently to the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
    const retouch = await retouchEquipment(2, { state, publish, die });
    if (retouch.died)
        return { ...restored, died: true };
    const selfTouch = state.uarmg || state.u?.uarmg ? { died: false }
        : await selfTouchPetrifyingWeapons({ state, publish, die });
    return { ...restored, died: selfTouch.died };
}
async function finishHumanFormChange(restored, state, publish) {
    const hero = state.u;
    if (restored.changedSeeInvisible)
        await refreshHeroSeeing({ state });
    if (!heroCanUseTwoWeapons(state))
        await stopTwoWeaponCombat(state);
    if (hero.utrap && hero.utraptype === TT_PIT)
        hero.utrap = rn1(6, 2);
    if (restored.regainedSight) {
        setHeroBlindnessTurns(1, state);
        await makeBlinded(0, { state, publish });
    }
    await restartAmuletStrangulation(state, publish);
    if (!hero.levitation && !hero.ustuck
        && (isPoolAt(hero.ux, hero.uy, state) || isLavaAt(hero.ux, hero.uy, state))) {
        const result = await applyHeroLocationEffects(publish);
        if (result.died)
            return true;
    }
    await see_monsters();
    return false;
}
async function dropCarriedObject(object) {
    if (!object)
        return;
    await removeWornHeroItem(object, game);
    if (game.program_state?.gameover)
        return;
    if (!game.inventory.includes(object))
        return;
    await dropInventoryObjectAtHero(object);
}
function heroSurfaceName() {
    const location = game.level?.locations?.[game.u.ux]?.[game.u.uy];
    return location?.typ === STAIRS ? 'stairs' : 'floor';
}
async function beginMonsterForm(mnum, { sexChangeAllowed = false, announceForm = true, } = {}) {
    requirePlayingGame(game);
    const u = game.u;
    const previousMnum = u.umonnum;
    const wasPolymorphed = heroIsPolymorphed(game);
    if (!wasPolymorphed) {
        u.macurr = { a: [...u.acurr.a] };
        u.mamax = { a: [...u.amax.a] };
        u.mfemale = !!game.flags?.female;
    }
    if (!u.uconduct)
        u.uconduct = {};
    u.uconduct.polyselfs = (u.uconduct.polyselfs || 0) + 1;
    // polymon() exercises the human attributes before installing the
    // monster form, so these two calls belong ahead of duration and HP.
    await exerciseAttribute(A_CON, false);
    await exerciseAttribute(A_WIS, true);
    if (wasPolymorphed) {
        u.acurr = { a: [...(u.macurr?.a || u.acurr.a)] };
        u.amax = { a: [...(u.mamax?.a || u.amax.a)] };
        if (game.flags)
            game.flags.female = !!u.mfemale;
    }
    const genderFlags = MONSTER_FLAGS2[mnum] ?? 0;
    const female = !!game.flags.female;
    if (genderFlags & M2_MALE)
        game.flags.female = false;
    else if (genderFlags & M2_FEMALE)
        game.flags.female = true;
    else if (!(genderFlags & M2_NEUTER) && mnum !== u.ulycn
        && sexChangeAllowed && rn2(10) === 0)
        game.flags.female = !female;
    if (announceForm) {
        const sexChanged = female !== game.flags.female;
        const gendered = genderFlags & (M2_MALE | M2_FEMALE);
        const sex = sexChanged && !gendered
            ? game.flags.female ? 'female ' : 'male ' : '';
        const renewed = previousMnum === mnum ? 'new ' : '';
        const name = renewed + sex + monsterTypeName(mnum, game.flags.female);
        const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
        const verb = previousMnum === mnum ? 'feel like' : 'turn into';
        await plineWithContinuation(`You ${verb} ${article} ${name}!`);
    }
    if (heroIsPetrifying(game) && formCanBecomeStoneGolem(mnum)) {
        mnum = MONSTER_NAME.indexOf('stone golem');
        clearHeroPetrification(game);
        await plineWithContinuation('You turn to stone!');
    }
    u.mtimedone = rn1(500, 500);
    setHeroSpecies(mnum, game);
    u.m_ap_type = 0;
    u.mappearance = 0;
    const strong = !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_STRONG);
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
        }
        else if (MONSTER_NAME[mnum] === 'green slime') {
            clearHeroSliming(game);
        }
    }
    await stopStrangulationInImmuneForm();
    if (heroHasNoHands(game)) {
        u.glibTurns = 0;
        u.glib = false;
    }
    const monsterLevel = MONSTER_LEVEL[mnum] ?? 0;
    const fixedGolemHitPoints = golemHitPoints(mnum);
    if (fixedGolemHitPoints)
        u.mhmax = fixedGolemHitPoints;
    else if (MONSTER_SYMBOL[mnum] === S_DRAGON
        && mnum >= MONSTER_NAME.indexOf('gray dragon'))
        u.mhmax = In_endgame(game.u.uz)
            ? 8 * monsterLevel : 4 * monsterLevel + d(monsterLevel, 4);
    else {
        u.mhmax = monsterLevel > 0 ? d(monsterLevel, 8) : rnd(4);
        if (isHomeElemental(mnum))
            u.mhmax *= 3;
    }
    u.mh = u.mhmax;
    if ((u.ulevel ?? 1) < monsterLevel) {
        u.mtimedone = Math.trunc(u.mtimedone * (u.ulevel ?? 1) / monsterLevel);
    }
    // polymon() does not repaint the accepted form until break_armor() has
    // completed.  A garment pager can therefore still expose the old hero
    // glyph even though monster HP and status metadata are already live.
    return mnum;
}
// C polyself.c:uasmon_maxStr(). Racial limits also apply to undead relatives,
// but living giants are stronger than giant zombies and mummies.
function formMaximumStrength(mnum) {
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    let race;
    if (flags & M2_ORC) {
        if (MONSTER_NAME[mnum] !== 'Uruk-hai' && MONSTER_NAME[mnum] !== 'orc captain')
            race = races.find(candidate => candidate.name === 'orc');
    }
    else if (flags & M2_ELF) {
        race = races.find(candidate => candidate.name === 'elf');
    }
    else if (flags & M2_DWARF) {
        race = races.find(candidate => candidate.name === 'dwarf');
    }
    else if (flags & M2_GNOME) {
        race = races.find(candidate => candidate.name === 'gnome');
    }
    race ||= races.find(candidate => candidate.mnum === mnum);
    if (race)
        return race.attrmax[A_STR];
    if (!(flags & M2_STRONG))
        return 18;
    return (flags & M2_GIANT) && !(flags & M2_UNDEAD) ? STR19(19) : STR18(100);
}
// C polyself.c:polymon(). Selection is separate from changing the body.
export async function polymonHero(mnum, options = {}) {
    requirePlayingGame(game);
    if (!Number.isInteger(mnum) || mnum < 0 || mnum >= MONSTER_NAME.length)
        throw new RangeError(`Invalid polymorph species: ${mnum}`);
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD) {
        await plineWithContinuation(`You feel rather ${MONSTER_NAME[mnum]}-ish.`);
        await exerciseAttribute(A_WIS, true);
        return { transformed: false };
    }
    const wasHolding = game.u.ustuck && !game.u.uswallow && heroFormSticks(game);
    const wasBlind = heroIsBlind(game);
    mnum = await beginMonsterForm(mnum, options);
    if (game.uskin && dragonFormForArmor(game.uskin) !== mnum)
        await restoreDragonArmor(game);
    await changeArmorForHeroForm(mnum);
    if (game.program_state.gameover)
        return { transformed: true, mnum, died: true };
    await dropPolymorphWeapons(true);
    if (game.program_state.gameover)
        return { transformed: true, mnum, died: true };
    findArmorClass(game);
    if (game.u.utrap && game.u.utraptype === TT_PIT)
        game.u.utrap = rn1(6, 2);
    if (wasBlind && !heroIsBlind(game)) {
        vision_recalc(0);
        await plineWithContinuation('You can see again.');
    }
    game.vision_full_recalc = 1;
    newsym(game.u.ux, game.u.uy);
    const hero = game.u;
    const holder = hero.ustuck;
    const unsolid = monsterIsUnsolid({ mnum: hero.umonnum });
    let wasExpelled = false;
    if (hero.uswallow) {
        if (!holder)
            throw new Error('A swallowed hero requires an engulfing monster');
        const size = MONSTER_SIZE[hero.umonnum];
        const holderSize = MONSTER_SIZE[holder.mnum];
        if (size === undefined || holderSize === undefined)
            throw new Error('Polymorph escape requires both body sizes');
        if (unsolid || size >= MZ_HUGE
            || (size > holderSize && !monsterIsWhirly(holder))) {
            if (unsolid) {
                await plineWithContinuation(`${holdingMonsterSubject(holder)} can no longer contain you.`);
            }
            const result = await expelHero(holder, { message: !unsolid });
            if (result.died)
                return { transformed: true, mnum, died: true };
            wasExpelled = true;
        }
    }
    else if (holder && !wasHolding && (heroFormSticks() || unsolid)) {
        hero.ustuck = null;
        await plineWithContinuation(`${holdingMonsterSubject(holder)} loses its grip on you.`);
    }
    else if (wasHolding && !heroFormSticks()) {
        await releaseHeroGrip();
    }
    const riding = await handleRidingAfterFormChange();
    if (riding.died)
        return { transformed: true, mnum, died: true };
    if (!wasExpelled
        && ((!hero.levitation && !hero.flying && !hero.ustuck
            && (isPoolAt(hero.ux, hero.uy) || isLavaAt(hero.ux, hero.uy)))
            || (hero.uinwater && !hero.swimming))) {
        const result = await applyHeroLocationEffects();
        if (result.died)
            return { transformed: true, mnum, died: true };
    }
    await escapeTrapsAfterFormChange();
    await restartAmuletStrangulation();
    game.context.botl = true;
    game.vision_full_recalc = 1;
    await see_monsters();
    // dropz() may already have reported the new body's carrying capacity
    // while dropping armor. Native encumber_msg() shares that cached level.
    await reportHeroEncumbrance(game);
    const retouch = await retouchEquipment(2);
    if (retouch.died)
        return { transformed: true, mnum, died: true };
    const selfTouch = game.uarmg || game.u?.uarmg ? { died: false }
        : await selfTouchPetrifyingWeapons();
    if (selfTouch.died)
        return { transformed: true, mnum, died: true };
    const currentForm = game.u.umonnum;
    const canBreathe = (MONSTER_ATTACKS[currentForm] || [])
        .some(([attackType]) => attackType === 12);
    if (game.flags.verbose !== false && canBreathe) {
        await plineWithContinuation('Use the command #monster to use your breath weapon.');
    }
    const laysEggs = !!((MONSTER_FLAGS1[currentForm] ?? 0) & M1_OVIPAROUS);
    const aquaticEel = MONSTER_NAME[currentForm] === 'giant eel'
        || MONSTER_NAME[currentForm] === 'electric eel';
    if (game.flags.verbose !== false && laysEggs
        && game.flags.female && !aquaticEel) {
        await plineWithContinuation('Use the command #sit to lay an egg.');
    }
    return { transformed: true, mnum };
}
async function escapeTrapsAfterFormChange() {
    requirePlayingGame(game);
    const hero = game.u;
    if (hero.passesWalls && hero.utrap
        && (hero.utraptype === TT_INFLOOR || hero.utraptype === TT_BURIEDBALL)) {
        if (hero.utraptype === TT_INFLOOR) {
            await plineWithContinuation('The rock seems to no longer trap you.');
        }
        else {
            await plineWithContinuation('The buried ball is no longer bound to you.');
            await freeHeroFromBuriedBall();
        }
        clearHeroTrap();
    }
    else if (heroLikesLava() && hero.utrap && hero.utraptype === TT_LAVA) {
        await plineWithContinuation('The lava now feels soothing.');
        clearHeroTrap();
    }
    const body = { mnum: hero.umonnum };
    const slipsFree = monsterIsAmorphous(body) || monsterIsWhirly(body)
        || monsterIsUnsolid(body);
    if (slipsFree) {
        if (heroIsPunished()) {
            await plineWithContinuation('You slip out of the iron chain.');
            await unpunishHero();
        }
        else if (hero.utrap && hero.utraptype === TT_BURIEDBALL) {
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
        clearHeroTrap();
    }
    if (heroCanSpinWeb() && hero.utrap && hero.utraptype === TT_WEB) {
        await plineWithContinuation('You orient yourself on the web.');
        clearHeroTrap();
    }
}
// C break_armor(): garments react in body-slot order. Read each slot when
// reached because removing one item can change the remaining equipment.
async function changeArmorForHeroForm(mnum) {
    const worn = (slot) => game[slot] || game.u[slot];
    const breaksArmor = monsterBreaksArmor(mnum);
    const slipsArmor = monsterSlipsArmor(mnum);
    const whirly = monsterIsWhirly({ mnum });
    const noHands = monsterHasNoHands(mnum);
    const verySmall = monsterIsVerySmall(mnum);
    let object;
    if (breaksArmor) {
        if ((object = worn('uarm'))) {
            if (object.lamplit)
                endObjectBurn(object, game);
            await plineWithContinuation('You break out of your armor!');
            await exerciseAttribute(A_STR, false);
            await removeHeroArmor(object, game, { deferArmorClass: true, voluntary: false });
            if (game.program_state.gameover)
                return;
            await deleteObject(object);
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            if (object.otyp === MUMMY_WRAPPING) {
                await plineWithContinuation('Your wrapping tears apart!');
                await deleteObject(object);
            }
            else {
                await plineWithContinuation(object.otyp === ALCHEMY_SMOCK
                    ? 'The knot on your apron is pulled apart!'
                    : 'The clasp on your cloak breaks open!');
                await dropCarriedObject(object);
                if (game.program_state.gameover)
                    return;
            }
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation('Your shirt rips to shreds!');
            await deleteObject(object);
        }
    }
    else if (slipsArmor) {
        if ((object = worn('uarm'))
            && !(MONSTER_NAME[mnum] === 'hobbit'
                && object.otyp === ELVEN_MITHRIL_COAT)) {
            await plineWithContinuation('Your armor falls around you!');
            await removeHeroArmor(object, game, { deferArmorClass: true, voluntary: false });
            if (game.program_state.gameover)
                return;
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            await plineWithContinuation(whirly
                ? 'Your cloak falls, unsupported!'
                : 'You shrink out of your cloak!');
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation(whirly
                ? 'You seep right through your shirt!'
                : 'You become much too small for your shirt!');
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
    }
    const hornCount = monsterHornCount(mnum);
    if (hornCount && (object = worn('uarmh'))) {
        const material = OBJECT_MATERIAL[object.otyp];
        if (material !== undefined && material <= LEATHER) {
            await plineWithContinuation(`Your ${hornCount === 1 ? 'horn pierces' : 'horns pierce'} through your ${object.name}.`);
        }
        else {
            await plineWithContinuation(`Your helm falls to the ${heroSurfaceName()}!`);
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
    }
    if (noHands || verySmall) {
        if ((object = worn('uarmg'))) {
            await plineWithContinuation(`You drop your gloves${worn('uwep') ? ' and weapon' : ''}!`);
            await dropPolymorphWeapons(false);
            if (game.program_state.gameover)
                return;
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
        if ((object = worn('uarms'))) {
            await plineWithContinuation('You can no longer hold your shield!');
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
        if ((object = worn('uarmh'))) {
            await plineWithContinuation(`Your helm falls to the ${heroSurfaceName()}!`);
            await dropCarriedObject(object);
            if (game.program_state.gameover)
                return;
        }
    }
    if ((noHands || verySmall || monsterIsSlithy(mnum) || monsterIsCentaur(mnum))
        && (object = worn('uarmf'))) {
        await plineWithContinuation(whirly
            ? 'Your boots fall away!'
            : verySmall
                ? 'Your boots slide off your feet!'
                : 'Your boots are pushed off your feet!');
        await dropCarriedObject(object);
        if (game.program_state.gameover)
            return;
    }
    if (heroHasNoHead(game) && (object = worn('ublindf'))) {
        const name = (object.name || 'blindfold').replace(/^pair of /, '');
        await plineWithContinuation(`Your ${name} ${name.endsWith('s') ? 'fall' : 'falls'} off!`);
        await removeEyewear();
        if (game.program_state.gameover)
            return;
        await dropCarriedObject(object);
        if (game.program_state.gameover)
            return;
    }
}
async function dropPolymorphWeapons(alone) {
    requirePlayingGame(game);
    const primary = game.uwep || game.u.uwep;
    if (!primary)
        return;
    const form = game.u.umonnum;
    if (alone && !monsterHasNoHands(form) && !monsterIsVerySmall(form)) {
        if (!heroCanUseTwoWeapons())
            await stopTwoWeaponCombat();
        return;
    }
    const secondary = game.u.twoweap ? game.uswapwep || game.u.uswapwep : null;
    const canDropPrimary = canDropPolymorphWeapon(primary);
    const canDropSecondary = !secondary || canDropPolymorphWeapon(secondary);
    if (alone) {
        const verb = canDropPrimary && canDropSecondary ? 'drop' : 'release';
        let noun = droppedWeaponNoun(primary);
        if (secondary && noun !== droppedWeaponNoun(secondary))
            noun = 'weapon';
        if (primary.quan !== 1 || secondary)
            noun = makePlural(noun);
        await plineWithContinuation(`You find you must ${verb} ${noun.startsWith('corpse') ? 'the' : 'your'} ${noun}!`);
    }
    const weapons = [
        [secondary, canDropSecondary], [primary, canDropPrimary],
    ];
    for (const [object, canDrop] of weapons) {
        if (!object)
            continue;
        if (object === primary)
            await losePrimaryWeapon();
        else
            await setSecondaryWeapon(null);
        if (!object.in_use && canDrop)
            await dropCarriedObject(object);
        if (game.program_state.gameover)
            return;
    }
}
function droppedWeaponNoun(object) {
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return object.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER
        ? 'sword' : weaponDescription(object);
}
function canDropPolymorphWeapon(object) {
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE))
        return false;
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
function roundDivPositive(numerator, denominator) {
    return Math.trunc((numerator + Math.trunc(denominator / 2)) / denominator);
}
function humanAttributeArrays() {
    requirePlayingGame(game);
    const u = game.u;
    // This follows the source ordering deliberately.  While Upolyd,
    // redist_attr() changes the active monster copy; polyman() subsequently
    // restores macurr/mamax and discards those temporary changes.
    return { base: u.acurr.a, max: u.amax.a };
}
function redistributeActiveAttributes() {
    requirePlayingGame(game);
    const { base, max } = humanAttributeArrays();
    for (const index of [A_STR, A_DEX, A_CON, A_CHA]) {
        const oldMax = max[index] || 1;
        const raceMin = game.urace?.attrmin?.[index] ?? 3;
        const raceMax = game.urace?.attrmax?.[index] ?? 18;
        max[index] = Math.max(raceMin, Math.min(raceMax, oldMax + rn2(5) - 2));
        base[index] = Math.max(raceMin, Math.trunc((base[index] || raceMin) * max[index] / oldMax));
    }
}
function constitutionHpBonus(constitution) {
    if (constitution <= 3)
        return -2;
    if (constitution <= 6)
        return -1;
    if (constitution <= 14)
        return 0;
    if (constitution <= 16)
        return 1;
    if (constitution === 17)
        return 2;
    if (constitution === 18)
        return 3;
    return 4;
}
function newmanHpIncrement(level) {
    requirePlayingGame(game);
    const role = game.urole.hpadv;
    const race = game.urace.hpadv;
    let hp;
    if (level === 0) {
        hp = (role.infix || 0) + (race.infix || 0);
        if ((role.inrnd || 0) > 0)
            hp += rnd(role.inrnd);
        if ((race.inrnd || 0) > 0)
            hp += rnd(race.inrnd);
    }
    else {
        const lower = level < (game.urole?.xlev ?? 10);
        const fixedKey = lower ? 'lofix' : 'hifix';
        const randomKey = lower ? 'lornd' : 'hirnd';
        hp = (role[fixedKey] || 0) + (race[fixedKey] || 0);
        if ((role[randomKey] || 0) > 0)
            hp += rnd(role[randomKey]);
        if ((race[randomKey] || 0) > 0)
            hp += rnd(race[randomKey]);
        hp += constitutionHpBonus(game.u?.acurr?.a?.[A_CON] || 0);
    }
    hp = Math.max(1, hp);
    if (level < MAXULEV)
        game.u.uhpinc[level] = hp;
    return hp;
}
// roles.js currently stores the pre-consumed initial energy die separately
// during startup.  These are the corresponding role.c enadv.inrnd values
// needed when newman() rolls an entirely new level-zero power increment.
const INITIAL_ENERGY_RANDOM = {
    priest: 3,
    wizard: 3,
    healer: 4,
    knight: 4,
    monk: 2,
};
function energyModifier(energy) {
    requirePlayingGame(game);
    if (['priest', 'wizard'].includes(game.urole?.key))
        return 2 * energy;
    if (['healer', 'knight'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 2);
    if (['barbarian', 'valkyrie'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 4);
    return energy;
}
function newmanPowerIncrement(level) {
    requirePlayingGame(game);
    const role = game.urole.enadv;
    const race = game.urace.enadv;
    let power;
    if (level === 0) {
        power = (role.infix || 0) + (race.infix || 0);
        const roleRange = role.inrnd
            || INITIAL_ENERGY_RANDOM[game.urole?.key] || 0;
        if (roleRange > 0)
            power += rnd(roleRange);
        if ((race.inrnd || 0) > 0)
            power += rnd(race.inrnd);
    }
    else {
        const lower = level < (game.urole?.xlev ?? 10);
        const fixedKey = lower ? 'lofix' : 'hifix';
        const randomKey = lower ? 'lornd' : 'hirnd';
        const range = Math.trunc((game.u?.acurr?.a?.[A_WIS] || 0) / 2)
            + (role[randomKey] || 0) + (race[randomKey] || 0);
        const fixed = (role[fixedKey] || 0) + (race[fixedKey] || 0);
        power = energyModifier(rn2(range) + fixed);
    }
    power = Math.max(1, power);
    if (level < MAXULEV)
        game.u.ueninc[level] = power;
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
    const u = game.u;
    const oldLevel = u.ulevel ?? 1;
    let newLevel = oldLevel + rn2(5) - 2;
    if (newLevel < 1 || newLevel > 127)
        return unsuccessfulPolymorph();
    newLevel = Math.min(MAXULEV, newLevel);
    if (newLevel < oldLevel)
        u.ulevelmax = (u.ulevelmax ?? oldLevel) - (oldLevel - newLevel);
    u.ulevelmax = Math.max(u.ulevelmax ?? newLevel, newLevel);
    u.ulevel = newLevel;
    const oldGender = heroPolyGender(game);
    if (sexChangeAllowed && rn2(10) === 0)
        changeHeroSex(game);
    await adjustLevelAbilities(oldLevel, newLevel);
    u.uexp = randomExperience();
    redistributeActiveAttributes();
    let hpMaximum = u.uhpmax ?? 1;
    for (let i = 0; i < oldLevel; i++)
        hpMaximum -= Number(u.uhpinc?.[i] || 0);
    hpMaximum = roundDivPositive(hpMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        hpMaximum += newmanHpIncrement(i);
    }
    u.ulevel = newLevel;
    hpMaximum = Math.max(hpMaximum, newLevel);
    u.uhp = roundDivPositive((u.uhp ?? 1) * hpMaximum, Math.max(1, u.uhpmax ?? 1));
    u.uhpmax = hpMaximum;
    u.uhp = Math.min(u.uhp, u.uhpmax);
    u.uhppeak = Math.max(u.uhppeak ?? 0, u.uhpmax);
    let powerMaximum = u.uenmax ?? 0;
    for (let i = 0; i < oldLevel; i++)
        powerMaximum -= Number(u.ueninc?.[i] || 0);
    powerMaximum = roundDivPositive(powerMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        powerMaximum += newmanPowerIncrement(i);
    }
    u.ulevel = newLevel;
    powerMaximum = Math.max(powerMaximum, newLevel);
    u.uen = roundDivPositive((u.uen ?? 0) * powerMaximum, Math.max(1, u.uenmax ?? 0));
    u.uenmax = powerMaximum;
    u.uen = Math.min(u.uen, u.uenmax);
    u.uhunger = 500 + rn2(500);
    cureHeroSickness(game);
    clearHeroPetrification(game);
    if (u.uhp <= 0) {
        if (heroHasPolymorphControl(game))
            u.uhp = 1;
        else
            return unsuccessfulPolymorph();
    }
    await updateHeroHunger(false);
    if (game.program_state.gameover)
        return { transformed: false, died: true };
    const formName = newHumanFormName();
    const restored = await becomeHuman(`You feel like a new ${formName}!`, game);
    if (restored.died)
        return { transformed: true, newman: true, oldLevel, newLevel, died: true };
    if (newLevel !== oldLevel)
        recordGameLogEvent(`became experience level ${newLevel} as a new ${formName}`);
    else
        recordRenewedHumanGender(oldGender);
    if (heroIsSliming(game)) {
        await pline('Your body transforms, but there is still slime on you.');
        resetHeroSlimingCountdown(game);
    }
    game.context.botl = true;
    await see_monsters();
    if (restored.encumbranceMessage)
        await pline(restored.encumbranceMessage);
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
        await updateHeroHunger(false);
        const previous = game._encumbranceLevel ?? nearCapacity(game);
        game._encumbranceLevel = nearCapacity(game);
        game.u._encumbrance = encumbranceLabel(game._encumbranceLevel);
        const message = encumbranceMessage(previous, game._encumbranceLevel);
        if (message)
            await plineWithContinuation(message);
    }
    return { transformed: false, died };
}
function recordRenewedHumanGender(oldGender) {
    requirePlayingGame(game);
    const newGender = heroPolyGender(game);
    if (Upolyd(game.u) || oldGender === newGender)
        return;
    const role = game.urole;
    const rank = role.title[experienceRankIndex(game.u.ulevel)];
    if (!rank)
        throw new Error('Renewed hero has no experience rank.');
    const oldSex = oldGender === 1 ? 'f' : 'm';
    const newSex = newGender === 1 ? 'f' : 'm';
    const oldRole = role.name[oldSex] || role.name.m;
    const newRole = role.name[newSex] || role.name.m;
    const oldRank = rank[oldSex] || rank.m;
    const newRank = rank[newSex] || rank.m;
    const description = oldRole !== newRole ? newRole
        : oldRank !== newRank ? newRank
            : `${game.flags.female ? 'female' : 'male'} ${newRank}`;
    recordGameLogEvent(`polymorphed into ${withIndefiniteArticle(description)}`);
}
// C polyself(): select a form, then use the same body-change operations
// whether the request came from a wand, a throne, or a monster ability.
export async function polymorphHero(flags = POLY_NOFLAGS) {
    requirePlayingGame(game);
    const hero = game.u;
    if (heroIsUnchanging(game)) {
        await plineWithContinuation('You fail to transform!');
        return { transformed: false };
    }
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
        && rn2(20) > hero.acurr.a[A_CON]) {
        await plineWithContinuation('You shudder for a moment.');
        const died = await loseHeroHp(rnd(30), 'system shock');
        if (!died)
            await exerciseAttribute(A_CON, false);
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
        if (choice.cancelled)
            return { transformed: false };
        if (choice.revert) {
            const result = await returnHeroToHumanForm(game);
            return { ...result, transformed: result.changed };
        }
        mnum = choice.mnum;
        if (choice.were)
            return changeWereForm(mnum);
        if (dragon !== null && (choice.random || mnum === dragon))
            return mergeDragonArmor(armor, dragon);
        if (vampire && (choice.random || mnum === PM_WOLF
            || mnum === PM_FOG_CLOUD || monsterIsBat(mnum)))
            return changeVampireForm(mnum, controlled);
    }
    else {
        if (dragon !== null)
            return mergeDragonArmor(armor, dragon);
        if (lycanthrope)
            return changeWereForm(mnum);
        if (vampire)
            return changeVampireForm(mnum, controlled);
    }
    if (mnum < 0) {
        for (let attempts = 0; attempts < 200; attempts++) {
            mnum = rn1(SPECIAL_PM, 0);
            if (legalPolymorph(mnum) && !PLACEHOLDER_MONSTERS.has(mnum))
                break;
        }
    }
    if (!legalPolymorph(mnum) || (!forced && rn2(5) === 0) || ownRace(mnum))
        return renewHumanForm();
    return polymonHero(mnum, { sexChangeAllowed: true });
}
function legalPolymorph(mnum) {
    const flags = MONSTER_FLAGS2[mnum];
    return flags !== undefined && !(flags & M2_NOPOLY);
}
function ownRace(mnum) {
    requirePlayingGame(game);
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & game.urace.selfmask);
}
function mayChooseForm(mnum) {
    return legalPolymorph(mnum) || mnum === PM_HUMAN
        || mnum === game.u.umonster
        || (ownRace(mnum) && !((MONSTER_GENO[mnum] ?? 0) & G_UNIQ));
}
async function chooseHeroForm({ forced, dragon, lycanthrope }) {
    requirePlayingGame(game);
    let tries = 5;
    let mnum = -1;
    do {
        const answer = await getLine('Become what kind of monster? [type the name]', (_character, key) => key >= 32 && key < 127);
        if (answer === null && forced) {
            await plineWithContinuation('Never mind.');
            return { cancelled: true };
        }
        const name = answer === null ? '*' : answer.trim().replace(/\s+/g, ' ');
        if (name === '*' || name === 'random')
            return { mnum: -1, random: true };
        mnum = nameToMonster(name);
        const monsterClass = mnum < 0 ? nameToMonsterClass(name) : 0;
        if (monsterClass) {
            for (;;) {
                mnum = dragon !== null && monsterClass === S_DRAGON
                    ? dragon : pickFormFromClass(monsterClass);
                if (mnum < 0 || mayChooseForm(mnum))
                    break;
                if (rn2(3) || --tries > 0)
                    continue;
                tries++;
                break;
            }
        }
        else if (PLACEHOLDER_MONSTERS.has(mnum)
            && mnum !== PM_HUMAN && !ownRace(mnum)) {
            let substitutes;
            const placeholder = MONSTER_NAME[mnum];
            if (placeholder === undefined)
                throw new Error(`Unknown polymorph placeholder species: ${mnum}`);
            switch (placeholder) {
                case 'orc':
                    substitutes = ['hill orc', 'Mordor orc'];
                    break;
                case 'elf':
                    substitutes = ['Green-elf', 'Grey-elf'];
                    break;
                case 'giant':
                    substitutes = ['stone giant', 'hill giant'];
                    break;
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
        if (mayChooseForm(mnum))
            return { mnum, random: false };
        await plineWithContinuation(`You can't polymorph into ${formNameWithArticle(mnum)}.`);
    } while (--tries > 0);
    await plineWithContinuation("That's enough tries!");
    return { mnum, random: true };
}
// C mkclass_poly(): choose by generation frequency, allowing extinction
// but excluding genocide, placeholders, and specially generated monsters.
function pickFormFromClass(monsterClass) {
    requirePlayingGame(game);
    const first = MONSTER_SYMBOL.indexOf(monsterClass);
    if (first < 0 || first >= SPECIAL_PM)
        return -1;
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
            || MONSTER_NAME[mnum] === 'mail daemon')
            continue;
        const frequency = (MONSTER_GENO[mnum] ?? 0) & G_FREQ;
        members.push({ mnum, frequency });
        total += frequency;
    }
    if (!total)
        return -1;
    let choice = rnd(total);
    for (const { mnum, frequency } of members) {
        choice -= frequency;
        if (choice <= 0)
            return mnum;
    }
    throw new Error('Polymorph class selection exhausted its generation weights');
}
function formNameWithArticle(mnum) {
    const name = monsterTypeName(mnum, game.flags.female);
    if ((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME)
        return name;
    if (((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) && mnum !== SPECIAL_PM
        && mnum !== nameToMonster('high cleric'))
        return `the ${name}`;
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}
function changeWereForm(requested) {
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
async function changeVampireForm(mnum, controlled) {
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
        const answer = await promptYesNo(`Become ${formNameWithArticle(mnum)}?`);
        if (answer !== 'y')
            return { transformed: false };
    }
    return polymonHero(mnum);
}
async function mergeDragonArmor(armor, mnum) {
    if (!armor)
        throw new Error('Merging with a dragon form requires worn dragon armor');
    if (!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD)) {
        if (armor.otyp >= GRAY_DRAGON_SCALES) {
            await plineWithContinuation('You merge with your scaly armor.');
        }
        else {
            const armorName = OBJECT_NAMES[armor.otyp];
            if (!armorName)
                throw new Error(`Unknown dragon armor type: ${armor.otyp}`);
            const name = armorName.replace(' dragon ', ' ');
            await plineWithContinuation(`Your ${name} reverts to scales as you merge with them.`);
            armor.otyp += GRAY_DRAGON_SCALES - GRAY_DRAGON_SCALE_MAIL;
            const scaleName = OBJECT_NAMES[armor.otyp];
            if (!scaleName)
                throw new Error(`Unknown dragon scales type: ${armor.otyp}`);
            armor.name = scaleName;
            if (!heroIsBlind(game))
                armor.dknown = true;
        }
        game.uskin = armor;
        game.uarm = game.u.uarm = null;
        armor.owornmask = (armor.owornmask ?? 0) | I_SPECIAL;
        armor.wornSlot = 'uskin';
    }
    return polymonHero(mnum);
}
async function restoreDragonArmor(state = game, publish = plineWithContinuation) {
    const armor = state.uskin;
    if (!armor)
        return;
    await publish('Your skin returns to its original form.');
    state.uarm = state.u.uarm = armor;
    state.uskin = null;
    armor.owornmask = (armor.owornmask ?? 0) & ~I_SPECIAL;
    armor.wornSlot = 'uarm';
}
//# sourceMappingURL=polyself.js.map