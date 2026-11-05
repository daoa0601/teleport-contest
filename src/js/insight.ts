// insight.js — Enlightenment, attributes, conducts, achievements, the
// chronicle, vanquished/genocided species lists, and hero/monster status
// lines.  One C file, one TS module.
// C ref: insight.c — enlightenment()/doattributes(), the enlght_* row
// builders, attributes_enlightenment(), background_enlightenment(),
// basics_enlightenment(), characteristics_enlightenment()/one_characteristic()/
// attrval(), status_enlightenment(), weapon_insight(), show_conduct(),
// show_achievements()/record_achievement()/achieve_rank(), do_gamelog()/
// show_gamelog(), vanqsort_cmp()/set_vanq_order()/dovanquished()/
// list_vanquished()/num_gone()/list_genocided()/doborn(), youhiding(),
// mstatusline(), ustatusline().

import { OBJ_NAME, objectPropertyName } from './object_data.js';
import { levitationAtWill, propertyTimeout, hasPermanentIntrinsicProperty, propertyIsActive, propertyIsBlocked } from './properties.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { heroIsHallucinating, blindfolded, heroIsBlind, heroIsDeaf, permanentBlind, blindnessBlocked } from './senses.js';
import { makePlural, withIndefiniteArticle, simpleObjectName, simpleObjectNameWithArticle, simpleObjectTypeName } from './objnam.js';
import { game, requireInitializedGame, requirePlayingGame } from './gstate.js';
import { expiredFatally } from './timeout.js';
import { pline } from './pline.js';
import { showDisclosureOverlay, showTextMenuOverlay, showTextPages, showTextWindow, ATR_NONE, showInventoryWindow } from './windows.js';
import { gameLogEvents, isSpoilerGameLogEvent, recordGameLogEvent } from './gamelog.js';
import { G_GENOD, FROMFORM, FROMOUTSIDE, Upolyd, ACH_AMUL, ACH_ASTR, ACH_BELL, ACH_BGRM, ACH_BLND, ACH_BOOK, ACH_CNDL, ACH_ENDG, ACH_INVK, ACH_MEDU, ACH_MINE_PRIZE, ACH_NOVL, ACH_NUDE, ACH_ORCL, ACH_SHOP, ACH_SOKO, ACH_SOKO_PRIZE, ACH_TMPL, ACH_TUNE, ACH_UWIN, ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD, MGIVENNAME, NOT_HUNGRY, M_AP_NOTHING, M_AP_TYPE, P_ISRESTRICTED, P_NONE, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED, SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, STRAT_WAITMASK, A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, AC_MAX, G_EXTINCT, G_GONE, In_endgame, In_quest, Is_knox_level, Is_rogue_level, LL_ACHIEVE, LL_DUMP, LL_MINORAC, LL_SPOILER, LL_UMONST, Luck, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, PICK_ONE, SPIKED_PIT, STRANGE_OBJECT, TT_PIT, W_ACCESSORY, W_ARMOR, W_ART, W_WEP, HANDED, LEG, FINGER } from './const.js';
import { simpleArmorName, fingersOrGloves, armorSimpleName, findArmorClass, heroIsStrangled, ringRemovalObstacle } from './do_wear.js';
import {
    SHIELD_OF_REFLECTION, AMULET_OF_GUARDING, DUNCE_CAP, DWARVISH_CLOAK, GAUNTLETS_OF_POWER, LUCKSTONE,
    OBJECT_NAMES, RIN_PROTECTION, ROBE, TOWEL,
} from './object_data.js';
import {
    canAdvanceHeroSkill, ensureHeroSkills, skillName, SKILL_LEVEL_NAMES, weaponDescription, weaponSkillType,
} from './weapon.js';
import { isLauncherAmmunition, isWetTowel, objectIsMetallic } from './object_properties.js';
import { emptyHandedDescription } from './wield.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { possessiveName, ordinalSuffix, upstart } from './hacklib.js';
import { MONSTER_NAME, MONSTER_SIZE, MONSTER_CLASS_EXPLAIN, MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_LEVEL, MONSTER_SYMBOL, monsterTypeName } from './monster_data.js';
import { feelingAfterSelfGenocide, heroHasBeenGenocided, heroFormSticks, floorObjects, heroFormClings, heroFormHidesUnderObjects, heroHatesSilver, heroIsAmphibious, heroIsBreathless, heroIsFlying, heroMonsterForm, heroPassesWalls, body_part, mbodypart, heroSpecies } from './polyself.js';
import { heroIsSick, heroIsVomiting } from './potion.js';
import { monsterSaddle } from './steed.js';

import { waterbodyName } from './pager.js';
import { trapName } from './trap.js';
import { monsterAlignmentType } from './priest.js';
import { wormSegmentIndexAt } from './worm.js';
import { visibleRegionAt } from './region.js';
import { findMonsterArmorClass } from './worn.js';
import { monsterHiddenConditions } from './pager.js';
import type { PropertyName } from './property_types.js';
import type { TextPage, InventoryMenuItem, TextMenuEntry } from './windows.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { invWeight, nearCapacity, heroGoldAmount } from './hack.js';
import { stopDisclosure, ynQuestion } from './end.js';
import type { DisclosureDefault } from './end.js';
import { canPraySafely, deityName } from './pray.js';
import { magic_negation } from './mhitu.js';
import { confersLuck, currency } from './invent.js';
import { temp_resist } from './eat.js';
import { itemResistanceCause } from './zap.js';
import { ATTRIBUTE_DISPLAY_ORDER, currentAttribute, extrinsicPropertyMask, fromWhat, heroHasNoEyes, intrinsicPropertyMask, maximumAttribute, veryFast } from './attrib.js';
import type { AttributeIndex } from './attrib.js';
import { artifactById } from './artifact.js';
import { recorderLocalHour } from './calendar.js';
import { costlySpot } from './shk.js';
import { hiddenGold } from './vault.js';
import { newExperienceThreshold } from './exper.js';
import { rankOf, roleSwitch } from './botl.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroIsPetrifying } from './stoning.js';
import { depth, endgameLevelName, levelHasCeiling, surfaceName, ceilingName } from './dungeon.js';
import type { DungeonLocation } from './dungeon_types.js';
import { is_male, is_neuter, lays_eggs, monsterDigests, monsterEnfolds, monsterHasProperName, monsterIsAnimal, monsterIsClinger, monsterIsEel, monsterIsFemale, monsterIsFlyer, monsterHasEyes } from './mondata.js';

export interface EnlightenmentOptions { basic?: boolean; magic?: boolean }

function plural(n: number, singular: string, pluralForm = `${singular}s`) {
    return n === 1 ? singular : pluralForm;
}

// C insight.c:background_enlightenment(), basics_enlightenment(),
// characteristics_enlightenment(), one_characteristic(), attrval().

export function enlightenmentRoleName(): string {
    const female = Upolyd(game.u) ? game.u.mfemale : game.flags.female;
    return female && game.urole?.name.f ? game.urole.name.f : game.urole?.name.m ?? 'Adventurer';
}

// C insight.c:background_enlightenment(): name, role, race, and alignment
// rows of the attributes page. C insight.c:align_str(): alignmentName.
// C botl.c:rank_of(): the rank title from the experience level.
// C pray.c:u_gname(): deityName. C insight.c:enlght_line(): each row's
// sentence assembly; C insight.c:enlght_out(): the string-array sink.
// Also C calendar.c:midnight(): inlined here when testing the local hour.
export function backgroundEnlightenmentLines(final: EnlightenmentFinal = 0): string[] {
    const { u, urole, urace } = requireInitializedGame();
    const female = Upolyd(u) ? u.mfemale : game.flags.female;
    const role = enlightenmentRoleName();
    const rank = rankOf(u.ulevel, roleSwitch(game), !!female, game);
    const gender = female ? 'female' : 'male';
    const genderedRole = urole.name.f && urole.name.f !== urole.name.m;
    const changedGender = game.flags.initgend !== undefined && Number(!!female) !== game.flags.initgend;
    const genderPrefix = !genderedRole && (urole.key !== 'valkyrie' || changedGender) ? `${gender} ` : '';
    const lines = ['', ' Background:'];
    if (Upolyd(u)) {
        const species = monsterTypeName(u.umonnum, !!game.flags.female);
        const formGender = (is_male(u.umonnum) || monsterIsFemale(u.umonnum) || is_neuter(u.umonnum)) ? '' : `${game.flags.female ? 'female' : 'male'} `;
        const vampire = (u.mcham ?? -1) >= 0 ? monsterTypeName(u.mcham ?? -1, !!game.flags.female) : null;
        const currentForm = vampire && vampire !== species
            ? `${withIndefiniteArticle(`${formGender}${vampire}`)} in ${species} form`
            : `in ${formGender}${species} form`;
        lines.push(`  You ${final ? 'were' : 'are'} ${final ? '' : 'currently '}${currentForm}.`);
    }
    const identity = rank.toLowerCase() === role.toLowerCase()
        ? `${withIndefiniteArticle(rank)}, level ${u.ulevel} ${genderPrefix}${urace.noun}`
        : `${withIndefiniteArticle(rank)}, a level ${u.ulevel} ${genderPrefix}${urace.adj} ${role}`;
    lines.push(`  You ${final ? 'were' : 'are'} ${Upolyd(u) ? 'actually ' : ''}${identity}.`);
    const alignment = u.ualign.type;
    const [current, original] = u.ualignbase;
    const temporary = alignment !== current;
    const converted = current !== original;
    const modifier = temporary ? final ? 'temporarily ' : 'currently '
        : converted ? final ? 'belatedly ' : 'now '
            : !u.uconduct.gnostic && game.moves > 1000 ? 'nominally ' : '';
    const opponents = [1, 0, -1].filter(value => value !== alignment)
        .map(value => `${deityName(value)} (${alignmentName(value)})`);
    lines.push(`  You ${final ? 'were' : 'are'} ${alignmentName(alignment)}, ${modifier}on a mission for ${deityName(alignment)}`,
        `  who ${final ? 'was' : 'is'} opposed by ${opponents.join(' and ')}.`);
    if (temporary) lines.push(`  You ${final ? 'were' : 'are'} actually ${alignmentName(current)}.`);
    if (changedGender || converted) lines.push(`  You started out ${changedGender ? game.flags.initgend ? 'female' : 'male' : ''}${
        changedGender && converted ? ' and ' : ''}${converted ? alignmentName(original) : ''}.`);
    lines.push(`  You ${final ? 'were' : 'are'} ${handednessDescription()}.`, locationLine(final));
    lines.push(game.moves === 1
        ? `  You ${final ? 'had' : 'have'} just started your adventure.`
        : `  You entered the dungeon ${game.moves} turn${game.moves === 1 ? '' : 's'} ago.`);
    // insight.c reads iflags.at_night/at_midnight for the final report:
    // the clock as it stood when the game ended, not disclosure time.
    const finalClock = final ? game._finalNight : undefined;
    const hour = recorderLocalHour(game.datetime);
    if (finalClock ? finalClock.midnight : hour === 0)
        lines.push(`  It ${final ? 'was' : 'is'} the midnight hour.`);
    else if (finalClock ? finalClock.night : hour < 6 || hour > 21)
        lines.push(`  It ${final ? 'was' : 'is'} nighttime.`);
    if (game.flags.moonphase === 4 || game.flags.moonphase === 0)
        lines.push(`  There ${final ? 'was' : 'is'} a ${game.flags.moonphase === 4 ? 'full' : 'new'} moon in effect${final ? ' when your adventure ended' : ''}.`);
    if (game.flags.friday13)
        lines.push(`  Bad things ${final === 2 ? 'happened' : final ? 'could have happened' : 'can happen'} on Friday the 13th.`);
    if (!Upolyd(u)) {
        const delta = newExperienceThreshold(u.ulevel) - u.uexp;
        const needed = u.ulevel < 30 && (final || game.flags.debug)
            ? `, ${delta} ${u.uexp > 0 ? 'more ' : ''}${final ? delta === 1 ? 'was ' : 'were ' : ''}needed ${u.ulevel < 18 ? 'to attain' : 'for'} level ${u.ulevel + 1}` : '';
        lines.push(`  You ${final ? 'had' : 'have'} ${u.uexp} experience point${u.uexp === 1 ? '' : 's'}${needed}.`);
    }
    return lines;
}

// C insight.c:basics_enlightenment().
export function basicsEnlightenmentLines(final: EnlightenmentFinal = 0): string[] {
    const { u } = requireInitializedGame();
    const hp = Math.max(0, Upolyd(u) ? u.mh : u.uhp);
    const maxHp = Upolyd(u) ? u.mhmax : u.uhpmax;
    const health = hp === maxHp && maxHp > 1 ? `all ${maxHp} hit points` : `${hp} out of ${maxHp} hit point${maxHp === 1 ? '' : 's'}`;
    const energy = !u.uenmax ? 'no' : u.uen === u.uenmax && u.uenmax === 2 ? 'both'
        : u.uen === u.uenmax && u.uenmax > 2 ? `all ${u.uen}` : `${u.uen} out of ${u.uenmax}`;
    const lines = ['', ' Basics:', `  You ${final ? 'had' : 'have'} ${health}.`,
        `  You ${final ? 'had' : 'have'} ${energy} energy points (spell power).`];
    if (Upolyd(u)) {
        const dice = MONSTER_LEVEL[u.umonnum] ?? 0;
        lines.push(`  You ${final ? 'had' : 'have'} ${dice === 0 ? '0 hit dice (actually 1/2)' : dice === 1 ? '1 hit die' : `${dice} hit dice`}.`);
    }
    findArmorClass();
    lines.push(`  Your armor class ${final ? 'was' : 'is'} ${u.uac}${Math.abs(u.uac) === AC_MAX ? `, the ${u.uac < 0 ? 'best' : 'worst'} possible` : ''}.`,
        ...goldInsightLines(!!final), `  Autopickup ${final ? 'was' : 'is'} ${autopickupDescription()}.`);
    return lines;
}

// C insight.c:characteristics_enlightenment().
export function characteristicEnlightenmentLines(magic: boolean, final: EnlightenmentFinal = 0): string[] {
    return ['', ` ${final ? 'Final ' : ''}Characteristics:`,
        ...ATTRIBUTE_DISPLAY_ORDER.map(attribute => characteristicLine(attribute, magic, final))];
}

// C insight.c:one_characteristic().
function characteristicLine(attribute: AttributeIndex, magic: boolean, final: EnlightenmentFinal): string {
    const { u } = requireInitializedGame();
    const names = { [A_STR]: 'strength', [A_DEX]: 'dexterity', [A_CON]: 'constitution',
        [A_INT]: 'intelligence', [A_WIS]: 'wisdom', [A_CHA]: 'charisma' };
    const current = currentAttribute(attribute);
    const details: string[] = [];
    if (!hideInnateCharacteristic(attribute, magic)) {
        const base = u.acurr.a[attribute];
        const peak = u.amax.a[attribute];
        const limit = maximumAttribute(attribute);
        const value = (amount: number) => characteristicValue(attribute, amount);
        if (current !== base) details.push(`base:${value(base)}`);
        if (base !== peak) details.push(`peak:${value(peak)}`);
        if (final || limit !== (attribute === A_STR ? 118 : 18))
            details.push(`${current > limit ? 'innate ' : ''}limit:${value(limit)}`);
    }
    return `  Your ${names[attribute]} ${final ? 'was' : 'is'} ${characteristicValue(attribute, current)}${
        details.length ? ` (${final ? '' : 'current; '}${details.join(', ')})` : ''}.`;
}

function hideInnateCharacteristic(attribute: AttributeIndex, magic: boolean): boolean {
    if (Upolyd(game.u)) return true;
    if (magic) return false;
    const sustain = OBJECT_NAMES.indexOf('sustain ability');
    if (ringRemovalObstacle(game.uleft, sustain) || ringRemovalObstacle(game.uright, sustain)) return true;
    if (attribute === A_STR && game.uarmg?.otyp === GAUNTLETS_OF_POWER && game.uarmg.cursed) return true;
    if (attribute === A_CON && game.uwep?.cursed && artifactById(game.uwep.oartifact)?.name === 'Ogresmasher') return true;
    return (attribute === A_INT || attribute === A_WIS) && game.uarmh?.otyp === DUNCE_CAP && game.uarmh.cursed === true;
}

// C insight.c:attrval().
function characteristicValue(attribute: AttributeIndex, value: number): string {
    if (attribute !== A_STR || value <= 18) return String(value);
    return value > 118 ? String(value - 100) : `18/${String(value - 18).padStart(2, '0')}`;
}

export function goldInsightLines(final: boolean, indent = '  '): [string, ...string[]] {
    const purse = heroGoldAmount(game);
    const stashed = hiddenGold(game, final);
    let wallet = purse ? `Your wallet ${final ? 'contained' : 'contains'} ${purse} ${currency(purse)}`
        : `Your wallet ${final ? 'was' : 'is'} empty`;
    wallet += stashed ? purse ? ', and' : ', but' : '.';
    const lines: [string, ...string[]] = [`${indent}${wallet}`];
    if (stashed) lines.push(`${indent}you ${final ? 'had' : 'have'} ${stashed} ${purse ? 'more' : currency(stashed)} stashed away in your pack.`);
    return lines;
}

export function handednessDescription(): string {
    return `${body_part(HANDED) === 'handed' ? '' : 'normally '}${game.u.rightHanded ? 'right' : 'left'}-handed`;
}

function alignmentName(value: number): 'lawful' | 'neutral' | 'chaotic' {
    return value > 0 ? 'lawful' : value < 0 ? 'chaotic' : 'neutral';
}

function locationLine(final: EnlightenmentFinal): string {
    const { u } = requireInitializedGame();
    let location: string;
    if (In_endgame(u.uz)) {
        const name = endgameLevelName(u.uz);
        location = `in the endgame, on the ${name.startsWith('Plane') ? 'Elemental ' : ''}${name}`;
    } else if (Is_knox_level(u.uz)) location = `on the ${game.dungeons[u.uz.dnum]?.dname ?? 'Fort Ludios'} level`;
    else {
        const dungeon = (game.dungeons[u.uz.dnum]?.dname ?? 'the dungeon').replace(/^The /i, 'the ');
        const bigroom = game.specialLevels?.get('bigrm');
        const inBigroom = bigroom?.dnum === u.uz.dnum && bigroom.dlevel === u.uz.dlevel;
        const note = Is_rogue_level(u.uz) ? ', a primitive area' : inBigroom && !heroIsBlind() ? ', a very big room' : '';
        location = `in ${dungeon}, on level ${In_quest(u.uz) ? u.uz.dlevel : depth(u.uz)}${note}`;
    }
    return `  You ${final ? 'were' : 'are'} ${location}.`;
}

function autopickupDescription(): string {
    if (!game.flags.pickup) return 'off';
    if (costlySpot(game.u.ux, game.u.uy)) return 'on, but temporarily disabled while inside the shop';
    const types = game.flags.pickup_types;
    // C appends ", with exceptions" whenever ga.apelist holds any rule.
    const exceptions = (game.iflags.autopickupExceptions?.length ?? 0) > 0
        ? ', with exceptions' : '';
    return `on for ${types ? `'${types}'` : 'all types'}${types && game.flags.pickup_thrown !== false ? ' plus thrown' : ''}${exceptions}`;
}

// C ref: insight.c status_enlightenment().  These rows are a projection of
// live trouble/nutrition/load state; their optional length determines every
// section that follows on the second attributes page.
// C insight.c:cause_known(): knownCause below — a worn, discovered item of
// that type is a definite cause. C insight.c:walking_on_water(): the active
// water-walking test at the swimming branch (C dbridge.c:is_pool_or_lava()
// is the isPoolAt/isLavaAt pair).
function statusEnlightenmentLines(magic = false, final: EnlightenmentFinal = 0, killer = ''): string[] {
    const u = game.u;
    const wizard = !!game.flags.debug;
    const lines: string[] = [];
    const message = (subject: string, present: string, past: string, what: string, suffix = '') =>
        lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}${suffix}.`));
    const are = (what: string, suffix = '') => message('You ', 'are ', 'were ', what, suffix);
    const have = (what: string) => message('You ', 'have ', 'had ', what);
    // A hero who died while dismounting still has u.usteed set.
    const steed = u.usteed && !(final === ENL_GAMEOVERDEAD && killer === 'riding accident') ? u.usteed : null;
    // C leaves steedname null then, which also hides the steed's wounded legs.
    const steedName = steed ? monsterName(steed, {
        article: steed.mtame ? 'your' : 'the', suppressSaddle: true, suppressHallucination: true,
    }) : '';
    let youToo = 'You ';
    if (Upolyd(u)) are(`transformed${heroHasBeenGenocided(game)
        ? ` and ${final ? 'felt' : 'feel'} ${feelingAfterSelfGenocide(game)} inside` : ''}`);
    if (steed) {
        are(`riding ${steedName}`);
        youToo += `and ${steedName} `;
    }
    if (u.levitating) {
        if (magic && levitationAtWill()) are('levitating, at will');
        else message(youToo, 'are ', 'were ', 'levitating', fromWhat('levitation'));
    } else if (u.flying) message(youToo, 'are ', 'were ', 'flying', fromWhat('flying'));
    if (u.uinwater) are('underwater');
    else if (u.waterWalking && !u.levitating && !u.flying && (isPoolAt(u.ux, u.uy) || isLavaAt(u.ux, u.uy)))
        are(`walking on ${isPoolAt(u.ux, u.uy) ? 'water' : 'lava'}`, fromWhat('waterWalking'));
    if (Upolyd(u) && (u.uundetected || M_AP_TYPE(u) !== M_AP_NOTHING)) are(heroHidingStatus(game));

    // Internal troubles, mostly in the order that prayer ranks them.
    if ((u.stonedTurns ?? 0) > 0 || expiredFatally(u.stoned, u.stonedTurns)) {
        if (final && expiredFatally(u.stoned, u.stonedTurns)) lines.push('  You turned into stone.');
        else are('turning to stone');
    }
    if ((u.slimedTurns ?? 0) > 0 || expiredFatally(u.slimed, u.slimedTurns)) {
        if (final && expiredFatally(u.slimed, u.slimedTurns)) lines.push('  You turned into slime.');
        else are('turning into slime');
    }
    if (u.strangled || (u.strangledTurns ?? 0) > 0) {
        if (u.uburied) are('buried');
        else if (final && expiredFatally(u.strangled, u.strangledTurns)) lines.push('  You died from strangulation.');
        else are(`being strangled${wizard ? ` (${u.strangledTurns ?? 0})` : ''}`, fromWhat('strangled'));
    }
    if (heroIsSick(game)) {
        const type = u.sickType ?? 0;
        // Both sicknesses share one timeout; death reports terminal illness
        // first, as the status line does.
        if (final && expiredFatally(u.sick, u.sickTurns))
            lines.push(`  You died from ${type & SICK_NONVOMITABLE ? 'terminal illness' : 'food poisoning'}.`);
        else {
            if (type & SICK_NONVOMITABLE) are('terminally sick from illness');
            if (type & SICK_VOMITABLE) are('terminally sick from food poisoning');
        }
    }
    if ((u.vomitingTurns ?? 0) > 0) are('nauseated');
    if ((u.stunnedTurns ?? 0) > 0 || u.stunned) are('stunned');
    if ((u.confusionTurns ?? 0) > 0 || u.confused) are('confused');
    if (heroIsHallucinating(game)) are('hallucinating');
    if (heroIsBlind(game)) {
        const intrinsic = intrinsicPropertyMask('blinded');
        const onlyBlindfold = blindfolded(game) && !intrinsic && !heroHasNoEyes();
        const kind = permanentBlind(game) || (intrinsic & FROMOUTSIDE) ? 'permanently'
            : intrinsic & FROMFORM ? 'innately' : onlyBlindfold ? 'deliberately' : 'temporarily';
        const timer = wizard && intrinsic === propertyTimeout('blinded') && !blindfolded()
            ? ` (${propertyTimeout('blinded')})` : '';
        are(`${kind} blind${timer}`, heroHasNoEyes() ? '' : fromWhat('blinded'));
    }
    if (heroIsDeaf(game)) are('deaf', fromWhat('deaf'));

    // External troubles, more or less.
    if (game.uball) are(`chained to ${simpleObjectNameWithArticle(game.uball)}`);
    if (u.utrap) {
        const predicament = trapPredicament(final, wizard);
        if (u.usteed) {
            const anchored = u.utraptype === TT_BURIEDBALL;
            const subject = `${anchored ? 'you and ' : ''}${steedName} `;
            message(subject.charAt(0).toUpperCase() + subject.slice(1),
                anchored ? 'are ' : 'is ', anchored ? 'were ' : 'was ', predicament);
        } else are(predicament);
    }
    const holder = u.ustuck;
    if (holder) {
        let held = monsterName(holder, { article: 'a' });
        if (held === 'it' && MGIVENNAME(holder) !== 'it') held = 'an unseen creature';
        if (u.uswallow) {
            let buf = `${monsterDigests(holder) ? 'swallowed' : 'engulfed'} by ${held}`;
            if (monsterDigests(holder)) {
                // A final digestion death leaves u.uswldtim at zero.
                buf += final && !u.uswldtim ? ' and got totally digested'
                    : ` and ${final ? 'were' : 'are'} being digested`;
            }
            are(`${buf}${wizard ? ` (${u.uswldtim ?? 0})` : ''}`);
        } else {
            are(`${heroFormSticks(game) ? 'holding' : 'held by'} ${held} (${
                distanceDescription(holder.mx - u.ux, holder.my - u.uy)})`);
        }
    }
    if (steed) {
        const saddle = monsterSaddle(steed);
        if (saddle?.cursed) are(`stuck to ${possessiveName(steedName)} ${simpleObjectName(saddle)}`);
    }
    if ((u._woundedLegTurns ?? 0) > 0 && u._woundedLegSide) {
        // When mounted these are the steed's legs, shown only in wizard mode.
        const side = u._woundedLegSide;
        const leg = u.usteed ? mbodypart(u.usteed.mnum, LEG) : body_part(LEG, game);
        const legs = side === 'both' ? `wounded ${makePlural(leg)}` : `a wounded ${side} ${leg}`;
        if (!u.usteed) have(legs);
        else if (wizard && steedName)
            message(steedName.charAt(0).toUpperCase() + steedName.slice(1), ' has ', ' had ', legs);
    }
    if ((u.glibTurns ?? 0) > 0)
        have(`slippery ${fingersOrGloves()}${wizard ? ` (${u.glibTurns})` : ''}`);
    // C insight.c:cause_known(): a worn, seen, type-discovered item confers
    // a definitely-known cause.
    const knownCause = (property: PropertyName) => (u._propertySources?.[property]?.worn ?? [])
        .some(source => {
            const object = game[source.slot];
            return object?.dknown && game._knownObjectTypes?.has(object.otyp);
        });
    if ((u.fumbling || propertyTimeout('fumbling')) && (magic || knownCause('fumbling')))
        message('You ', 'fumble', 'fumbled', '', fromWhat('fumbling'));
    if ((u.sleepy || propertyTimeout('sleepy')) && (magic || knownCause('sleepy')))
        message('You ', 'fall', 'fell', ' asleep uncontrollably', `${fromWhat('sleepy')}${wizard ? ` (${propertyTimeout('sleepy')})` : ''}`);
    if ((u.hunger || propertyTimeout('hunger')) && (magic || knownCause('hunger')))
        message('You ', 'hunger', 'hungered', ' rapidly', fromWhat('hunger'));
    // eat.c hu_stat[u.uhs], with "not hungry" supplied for the blank state.
    const hungerText = ['satiated', 'not hungry', 'hungry', 'weak from severe hunger',
        'fainting due to starvation', 'fainted due to starvation', 'starved'][u.uhs ?? NOT_HUNGRY] ?? 'not hungry';
    are(`${hungerText}${wizard ? ` <${u.uhunger}>` : ''}`);
    const capacity = nearCapacity(game);
    const encumbrance = ['unencumbered', 'burdened', 'stressed', 'strained', 'overtaxed', 'overloaded'][capacity] ?? 'unencumbered';
    const degree = ['', 'slightly', 'moderately', 'very', 'extremely', 'not possible'][capacity] ?? '';
    are(`${encumbrance}${wizard ? ` <${invWeight(game)}>` : ''}${capacity
        ? `; movement ${final ? 'was' : 'is'} ${degree}${capacity < 5 ? ' slowed' : ''}` : ''}`);
    return lines;
}

// C insight.c:trap_predicament().
function trapPredicament(final: EnlightenmentFinal, wizard: boolean): string {
    const u = game.u;
    let predicament: string;
    if (u.utraptype === TT_BURIEDBALL) predicament = 'tethered to something buried';
    else if (u.utraptype === TT_LAVA) predicament = `sinking into ${final ? 'lava' : displayLiquidName('lava')}`;
    else if (u.utraptype === TT_INFLOOR) predicament = `stuck in the ${surfaceName(u.ux, u.uy)}`;
    else {
        const trap = game.level?.traps.find(candidate => candidate.tx === u.ux && candidate.ty === u.uy);
        predicament = `trapped${trap ? ` in ${withIndefiniteArticle(trapName(trap.ttyp))}` : ''}`;
    }
    // u.utrap is an escape-attempt counter, so wizard mode uses braces.
    return wizard ? `${predicament} {${u.utrap}}` : predicament;
}

// C getpos.c:dxdy_to_dist_descr(dx, dy, TRUE).
// Also C cmd.c:directionname(): inlined here (DIRECTION_NAMES holds the
// eight directionname() strings).
function distanceDescription(dx: number, dy: number): string {
    if (!dx && !dy) return 'here';
    const direction = DIRECTION_NAMES.find(entry => entry.dx === dx && entry.dy === dy);
    if (direction) return direction.name;
    const vertical = dy ? `${Math.abs(dy)}${dy > 0 ? 'south' : 'north'}${dx ? ',' : ''}` : '';
    return `${vertical}${dx ? `${Math.abs(dx)}${dx > 0 ? 'east' : 'west'}` : ''}`;
}

const DIRECTION_NAMES = [
    { dx: -1, dy: 0, name: 'west' }, { dx: -1, dy: -1, name: 'northwest' },
    { dx: 0, dy: -1, name: 'north' }, { dx: 1, dy: -1, name: 'northeast' },
    { dx: 1, dy: 0, name: 'east' }, { dx: 1, dy: 1, name: 'southeast' },
    { dx: 0, dy: 1, name: 'south' }, { dx: -1, dy: 1, name: 'southwest' },
] as const;

// C ref: insight.c:weapon_insight().  Weapons are described by
// weapon.c:weapon_descr(); the skill rows come from the hero's live skill
// table, including two-weapon limits and pending #enhance eligibility.
function weaponInsightLines(final: EnlightenmentFinal = 0) {
    const lines: string[] = [];
    const message = (subject: string, present: string, past: string, what: string) =>
        lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}.`));
    const are = (what: string) => message('You ', 'are ', 'were ', what);
    const have = (what: string) => message('You ', 'have ', 'had ', what);
    const weapon = game.uwep ?? null;
    if (!weapon) are(emptyHandedDescription());
    else if (game.u.twoweap) are('wielding two weapons at once');
    else {
        const what = weapon.otyp === SHIELD_OF_REFLECTION ? simpleArmorName(weapon, 'uarms', game)
            : isWetTowel(weapon) ? 'wet towel' : weaponDescription(weapon);
        are(['armor', 'food', 'venom'].includes(what.toLowerCase()) ? `wielding some ${what}`
            : `wielding ${weapon.quan === 1 ? withIndefiniteArticle(what) : makePlural(what)}`);
    }

    const wtype = weaponSkillType(weapon);
    if (wtype === P_NONE || (weapon && isLauncherAmmunition(weapon))) return lines;
    const sklvl = skillLevel(wtype);
    const sklvlName = skillLevelDescription(sklvl);
    const hav = sklvl !== P_UNSKILLED && sklvl !== P_SKILLED;
    let buf = `${sklvlName} ${hav ? 'skill with' : 'in'} ${skillName(wtype)}`;
    if (!game.u.twoweap) {
        if (canAdvanceHeroSkill(wtype)) buf += ` and ${final ? 'could have enhanced' : 'can enhance'} that`;
        if (hav) have(buf);
        else are(buf);
        return lines;
    }

    const wtype2 = weaponSkillType(game.uswapwep ?? null);
    const sklvl2 = skillLevel(wtype2);
    const hav2 = sklvl2 !== P_UNSKILLED && sklvl2 !== P_SKILLED;
    let twoskl = skillLevel(P_TWO_WEAPON_COMBAT);
    let twobuf: string;
    if (twoskl === P_ISRESTRICTED) {
        // Polymorphed forms with several weapon attacks can two-weapon
        // without the skill; restricted then behaves as unskilled.
        twoskl = P_UNSKILLED;
        twobuf = 'restricted';
    } else twobuf = skillLevelDescription(twoskl);
    let also = '', also2 = '', also3 = false;
    if (twoskl < sklvl) {
        message(`Your skill in ${skillName(wtype)} `, 'is', 'was', ` limited by being ${twobuf} with two weapons`);
        also = 'also ';
    } else if (twoskl > sklvl) {
        message('Your two weapon skill ', 'is', 'was', ` limited by ${sklvl > P_ISRESTRICTED
            ? `being ${sklvlName}` : 'having no skill'} with ${skillName(wtype)}`);
        also2 = 'also ';
    } else {
        buf += ' and two weapons';
        also3 = true;
        if (hav) have(buf);
        else are(buf);
    }

    // Skip the secondary comparison when it duplicates the primary one.
    if (wtype2 !== wtype) {
        const name2 = skillName(wtype2);
        const sklvlName2 = skillLevelDescription(sklvl2);
        if (twoskl < sklvl2) {
            message(`Your skill in ${name2} `, 'is', 'was', ` ${also}limited by being ${twobuf} with two weapons`);
        } else if (twoskl > sklvl2) {
            message('Your two weapon skill ', 'is', 'was', ` ${also2}limited by ${sklvl2 > P_ISRESTRICTED
                ? `being ${sklvlName2}` : 'having no skill'} with ${name2}`);
        } else {
            const both = `${sklvlName2} ${hav2 ? 'skill with' : 'in'} ${name2} and two weapons`;
            if (also3) message('You also ', hav2 ? 'have' : 'are', hav2 ? 'had' : 'were', ` ${both}`);
            else if (hav2) have(both);
            else are(both);
        }
    }

    const a1 = canAdvanceHeroSkill(wtype);
    const a2 = wtype2 !== wtype && canAdvanceHeroSkill(wtype2);
    const ab = canAdvanceHeroSkill(P_TWO_WEAPON_COMBAT);
    if (a1 || a2 || ab) {
        const alsoWith = ' and also with ';
        const count = Number(a1) + Number(a2) + Number(ab);
        message('You ', 'can enhance', 'could have enhanced', ` skill${count > 1 ? 's' : ''} with ${
            a1 ? skillName(wtype) : ''}${a1 && a2 && ab ? ', ' : a1 && (a2 || ab) ? alsoWith : ''}${
            a2 ? skillName(wtype2) : ''}${a1 && a2 && ab ? ', and ' : a2 && ab ? alsoWith : ''}${
            ab ? 'two weapons' : ''}`);
    }
    return lines;
}

function skillLevel(skill: number): number {
    const entry = ensureHeroSkills(game)?.[skill];
    if (!entry) throw new Error(`Weapon insight requires initialized skill ${skill}`);
    return entry.skill;
}

// "no" for restricted, otherwise weapon.c:skill_level_name() lowercased.
function skillLevelDescription(level: number): string {
    if (level === P_ISRESTRICTED) return 'no';
    return (SKILL_LEVEL_NAMES[level] ?? 'Unknown').toLowerCase();
}

function statusEquipmentLines(final: EnlightenmentFinal = 0): string[] {
    const lines = weaponInsightLines(final);
    const penalty = monkArmorPenalty();
    if (penalty && game.uarm) lines.push(`  You ${final ? 'had' : 'have'} ${combatIncrement('to hit', -penalty, final)} due to your ${simpleArmorName(game.uarm, 'uarm', game)}.`);
    if (![game.uarm, game.uarmu, game.uarmc, game.uarms, game.uarmg, game.uarmf, game.uarmh].some(Boolean))
        lines.push(game.u.uroleplay?.nudist ? `  You ${final ? 'did' : 'do'} not wear any armor.`
            : `  You ${final ? "weren't" : "aren't"} wearing any armor.`);
    return lines;
}

function killedCountPhrase(count: number) {
    if (count === 1) return 'once';
    if (count === 2) return 'twice';
    if (count === 3) return 'thrice';
    return `${count} times`;
}

function rerollConductLine() {
    const roleplay = game.u.uroleplay;
    if (!roleplay?.reroll)
        return ' Character rerolling was not enabled.';
    if (!(roleplay.numrerolls || 0))
        return ' Your character was not rerolled.';
    return ` Your character was rerolled ${
        killedCountPhrase(roleplay.numrerolls)}.`;
}

export type EnlightenmentFinal = 0 | 1 | 2;
interface PiousnessOptions { showNegative?: boolean; suffix?: string }

export function piousness(record: number, { showNegative = true, suffix = '' }: PiousnessOptions = {}) {
    const description = record >= 20 ? 'piously' : record > 13 ? 'devoutly'
        : record > 8 ? 'fervently' : record > 3 ? 'stridently'
        : record === 3 ? '' : record > 0 ? 'haltingly'
        : record === 0 ? 'nominally' : !showNegative ? 'insufficiently' : record >= -3 ? 'strayed'
        : record >= -8 ? 'sinned' : 'transgressed';
    return suffix && (!showNegative || record >= 0)
        ? `${description}${record === 3 ? '' : ' '}${suffix}` : description;
}

// C insight.c:attributes_enlightenment(): the intrinsics and capability
// rows. C insight.c:enlght_halfdmg(): the half/reduced physical and spell
// damage lines. C insight.c:walking_on_water(): the active water-walking
// test before the "can walk on water" capability. C insight.c:enlght_out():
// the window sink is this string array. C insight.c:enlght_line(): the
// sentence assembly is each row's template, its contraction pass is
// contractEnlightenment below. C insight.c:N_times(): the "N times"
// phrasing is times(). C invent.c:carrying(): the luckstone inventory
// scan. C pray.c:u_gname(): the god's name is deityName().
// C dbridge.c:is_pool_or_lava(): the water-or-lava test under a water
// walker.
export function attributeEnlightenmentLines(final: EnlightenmentFinal = 0): string[] {
    const u = game.u;
    const wizard = !!game.flags.debug;
    const underwater = !!u.uinwater;
    const lines: string[] = ['', ` ${final ? 'Final ' : ''}Attributes:`];
    const message = (subject: string, present: string, past: string, what: string, suffix = '') =>
        lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}${suffix}.`));
    const are = (what: string, property?: PropertyName, blocked = false) =>
        message('You ', 'are ', 'were ', what, property ? fromWhat(property, game, blocked) : '');
    const have = (what: string, property?: PropertyName) =>
        message('You ', 'have ', 'had ', what, property ? fromWhat(property) : '');
    const can = (what: string, property?: PropertyName) =>
        message('You ', 'can ', 'could ', what, property ? fromWhat(property) : '');
    const active = (property: PropertyName) => propertyIsActive(property)
        || (property !== 'invulnerable' && !!u[property]);

    const honor = u.uevent?.uhand_of_elbereth;
    const honorTitle = honor && ['the Hand of Elbereth', 'the Envoy of Balance', 'the Glory of Arioch'][honor - 1];
    if (honorTitle) are(honorTitle);
    const record = u.ualign?.record ?? 0;
    const devotion = piousness(record, { suffix: 'aligned' });
    if (record >= 0) are(devotion);
    else have(devotion);
    if (wizard) message('Your alignment ', 'is ', 'was ', String(record));

    if (intrinsicPropertyMask('invulnerable')) are('invulnerable', 'invulnerable');
    if (active('antimagic') || u.magicProtection) are('magic-protected', 'antimagic');
    if (active('fireResistance')) are('fire resistant', 'fireResistance');
    lines.push(...itemResistanceLines('fireResistance', 'fire', final));
    if (active('coldResistance')) are('cold resistant', 'coldResistance');
    lines.push(...itemResistanceLines('coldResistance', 'cold', final));
    if (active('sleepResistance')) are('sleep resistant', 'sleepResistance');
    if (active('disintegrationResistance')) are('disintegration resistant', 'disintegrationResistance');
    lines.push(...itemResistanceLines('disintegrationResistance', 'disintegration', final));
    if (active('shockResistance')) are('shock resistant', 'shockResistance');
    lines.push(...itemResistanceLines('shockResistance', 'electric shocks', final));
    if (active('poisonResistance')) are('poison resistant', 'poisonResistance');
    if (active('acidResistance')) are(`${temp_resist('acidResistance')}acid resistant`, 'acidResistance');
    lines.push(...itemResistanceLines('acidResistance', 'acid', final));
    if (active('drainResistance')) are('level-drain resistant', 'drainResistance');
    if (active('sicknessResistance')) are('immune to sickness', 'sicknessResistance');
    if (active('stoneResistance')) are(`${temp_resist('stoneResistance')}petrification resistant`, 'stoneResistance');
    if (active('hallucinationResistance')) message('You ', 'resist', 'resisted', ' hallucinations', fromWhat('hallucinationResistance'));
    if (u.uedibility) can('recognize detrimental food');

    if ((intrinsicPropertyMask('blinded') || blindfolded()) && blindnessBlocked())
        message('You ', 'can ', 'could ', 'see', fromWhat('blinded', game, true));
    if (active('blindResistance') && !heroIsBlind()) are('not subject to light-induced blindness', 'blindResistance');
    if (active('seeInvisible')) {
        if (!heroIsBlind()) message('You ', 'see', 'saw', ' invisible', fromWhat('seeInvisible'));
        else message('You ', permanentBlind() ? 'would see' : 'will see', 'would have seen',
            ` invisible ${permanentBlind() ? 'if' : 'when'} not blind`);
    }
    if (active('telepathy')) are('telepathic', 'telepathy');
    if (active('warning')) are('warned', 'warning');
    const warning = game.context.warntype;
    if (active('warnOfMonster') && warning) {
        if (warning.obj) are(`aware of the presence of ${warningPeople(warning.obj, false)}`, 'warnOfMonster');
        if (warning.polyd) are(`aware of the presence of ${warningPeople(warning.polyd, true)}`);
        const species = MONSTER_NAME[warning.speciesidx ?? -1];
        if (species) are(`aware of the presence of ${makePlural(species)}`, 'warnOfMonster');
    }
    if (intrinsicPropertyMask('warnUndead')) are('warned of undead', 'warnUndead');
    if (active('searching')) have('automatic searching', 'searching');
    if (propertyIsActive('clairvoyant')) are('clairvoyant', 'clairvoyant');
    else if ((intrinsicPropertyMask('clairvoyant') || extrinsicPropertyMask('clairvoyant')) && propertyIsBlocked('clairvoyant'))
        message('You ', 'could be', 'could have been', ' clairvoyant', fromWhat('clairvoyant', game, true).replace(' because of ', ' if not for '));
    if (active('infravision')) have('infravision', 'infravision');
    if (active('detectMonsters')) {
        const timeout = propertyTimeout('detectMonsters');
        are(`sensing the presence of monsters${wizard && timeout ? ` (${timeout})` : ''}`);
    }
    if (u.umconf) {
        const hits = wizard && !final ? u.umconf === 1 ? ' (next hit only)' : ` (next ${u.umconf} hits)` : '';
        message('You ', 'will confuse', 'would have confused', ` monsters when hitting them${hits}`);
    }

    if (extrinsicPropertyMask('adorned')) {
        const adorn = [game.uleft, game.uright].reduce((sum, ring) =>
            sum + (ring && objectPropertyName(ring.otyp) === 'adorned' ? ring.spe ?? 0 : 0), 0);
        are(`${adorn > 0 ? 'more ' : adorn < 0 ? 'less ' : ''}charismatic`, 'adorned');
    }
    if (propertyIsActive('invisible') || u.invisible || u.invis) {
        are(active('seeInvisible') ? 'invisible to others' : 'invisible', 'invisible');
    } else if ((intrinsicPropertyMask('invisible') || extrinsicPropertyMask('invisible')) && propertyIsBlocked('invisible'))
        are('visible', 'invisible', true);
    if (active('displaced')) are('displaced', 'displaced');
    if (propertyIsActive('stealth')) are('stealthy', 'stealth');
    else if (intrinsicPropertyMask('stealth') || extrinsicPropertyMask('stealth'))
        message('You ', 'would be', 'would have been', ` stealthy${u.usteed ? ' if not mounted' : ''}`);
    if (active('aggravateMonster')) message('You aggravate', '', 'd', ' monsters', fromWhat('aggravateMonster'));
    if (active('conflict')) message('You cause', '', 'd', ' conflict', fromWhat('conflict'));

    if (active('jumping')) can('jump', 'jumping');
    if (active('teleportation')) can('teleport', 'teleportation');
    if (active('teleportControl')) have('teleport control', 'teleportControl');
    const trapped = (u.utrap ?? 0) > 0 && u.utraptype !== TT_PIT;
    const levitationSources = intrinsicPropertyMask('levitation') || extrinsicPropertyMask('levitation');
    const levitationTerrain = u._propertySources?.levitation?.blockedByTerrain;
    if (levitationSources && (trapped || levitationTerrain))
        message('You ', 'would levitate', 'would have levitated',
            `${trapped ? ' if not trapped' : ''}${trapped && levitationTerrain ? ' and' : ''}${levitationTerrain ? ' if surroundings permitted' : ''}`);
    const flightSources = intrinsicPropertyMask('flying') || extrinsicPropertyMask('flying')
        || monsterIsFlyer(u.usteed?.mnum ?? -1);
    if (flightSources && propertyIsBlocked('flying')) {
        const terrain = u._propertySources?.flying?.blockedByTerrain;
        const reason = propertyIsActive('levitation') ? " if you weren't levitating"
            : trapped && !terrain ? " if you weren't trapped"
                : terrain && !trapped ? ' if surroundings permitted' : ' if circumstances permitted';
        message('You ', 'would fly', 'would have flown', reason);
    }
    if (monsterIsClinger(u.umonnum ?? -1)) {
        const ceiling = levelHasCeiling();
        if (ceiling && !u.uinwater) can('cling to the ceiling');
        else message('You ', 'could cling', 'could have clung', ` to the ceiling if ${
            ceiling ? '' : 'there was one'}${!ceiling && u.uinwater ? ' and ' : ''}${
            u.uinwater ? underwater ? "you weren't underwater" : "you weren't in the water" : ''}`);
    }
    const walkingOnWater = !u.uinwater && !u.levitating && !u.flying && (isPoolAt(u.ux, u.uy) || isLavaAt(u.ux, u.uy));
    if (active('waterWalking') && !walkingOnWater) can('walk on water', 'waterWalking');
    if (active('swimming') && (underwater || !u.uinwater)) can('swim', 'swimming');
    if (heroIsBreathless()) can('survive without air', 'magicalBreathing');
    else if (heroIsAmphibious()) can('breathe water', 'magicalBreathing');
    if (heroPassesWalls()) can('walk through walls', 'passesWalls');

    if (active('regeneration')) message('You regenerate', '', 'd', '', fromWhat('regeneration'));
    if (active('slowDigestion')) have('slower digestion', 'slowDigestion');
    if (u.uhitinc) {
        const penalty = monkArmorPenalty();
        const offset = !penalty ? '' : u.uhitinc < 0 ? 'increasing'
            : u.uhitinc < 4 * penalty / 5 ? 'partly offsetting'
                : u.uhitinc < penalty ? 'nearly offsetting' : 'overcoming';
        have(combatIncrement('to hit', u.uhitinc, final) + (offset ? ` ${offset} your suit's penalty` : ''));
    }
    if (u.udaminc) have(combatIncrement('damage', u.udaminc, final));
    if (u.uspellprot || active('protection')) {
        let protection = u.uspellprot ?? 0;
        for (const ring of [game.uleft, game.uright])
            if (ring?.otyp === RIN_PROTECTION) protection += ring.spe ?? 0;
        if (game.uamul?.otyp === AMULET_OF_GUARDING) protection += 2;
        if (hasPermanentIntrinsicProperty('protection')) protection += u.ublessed ?? 0;
        if (protection) have(combatIncrement('defense', protection, final));
    }
    const cancellation = magic_negation(u);
    const protection = ['', 'warded', 'guarded', 'protected'][Math.min(3, cancellation)];
    if (protection) are(protection);
    for (const [property, kind] of [['halfPhysicalDamage', 'physical'], ['halfSpellDamage', 'spell']] as const)
        if (active(property)) message('You ', 'take', 'took', ` ${final || wizard ? 'half' : 'reduced'} ${kind} damage`, fromWhat(property));
    const eyewear = game.ublindf || u.ublindf;
    if (eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0)
        message('You ', 'take', 'took', ' reduced poison gas damage');
    if (game.spells.length) {
        const metallic = !!game.uarm && objectIsMetallic(game.uarm);
        const robe = game.uarmc?.otyp === ROBE;
        if (metallic || robe) message('Your spell casting ', 'is', 'was', metallic
            ? ` impaired by metallic armor${robe ? ', mitigated by your robe' : ''}` : ' enhanced by wearing a robe');
    }
    if (active('protectionFromShapeChangers')) are('protected from shape changers', 'protectionFromShapeChangers');
    const unchanging = active('unchanging');
    if (unchanging) {
        if (!Upolyd(u)) can('not change from your current form', 'unchanging');
        if (active('polymorph') || (u.ulycn ?? -1) >= 0) {
            const change = active('polymorph') ? 'polymorph' : 'change shape';
            message('You ', `would ${change}`, `would have ${change === 'polymorph' ? 'polymorphed' : 'changed shape'}`,
                ' periodically if not locked into your current form');
        }
    } else if (active('polymorph')) are('polymorphing periodically', 'polymorph');
    if (active('polymorphControl')) have('polymorph control', 'polymorphControl');
    const formName = monsterTypeName(u.umonnum ?? -1, !!game.flags.female);
    if (Upolyd(u) && u.umonnum !== u.ulycn && !(final === 2 && formName === 'green slime' && !unchanging)) {
        const vampire = (u.mcham ?? -1) >= 0 ? monsterTypeName(u.mcham ?? -1, !!game.flags.female) : null;
        are(`polymorphed into ${withIndefiniteArticle(vampire || formName || 'creature')}${
            vampire && vampire !== formName ? ` in ${formName} form` : ''}${wizard ? ` (${u.mtimedone})` : ''}`);
    }
    if (lays_eggs(u.umonnum ?? -1) && game.flags.female) can('lay eggs');
    const lycanthrope = (u.ulycn ?? -1) >= 0 ? monsterTypeName(u.ulycn ?? -1, !!game.flags.female) : null;
    if (lycanthrope) are(`${withIndefiniteArticle(lycanthrope)}${u.umonnum === u.ulycn
        ? ` in beast form${wizard ? ` (${u.mtimedone})` : ''}` : ''}`);
    if (unchanging && Upolyd(u)) can('not change from your current form', 'unchanging');
    if (heroHatesSilver(game)) are('harmed by silver');
    if (active('fast')) are(veryFast() ? 'very fast' : 'fast', 'fast');
    if (active('reflection')) have('reflection', 'reflection');
    if (extrinsicPropertyMask('freeAction')) have('free action', 'freeAction');
    if (extrinsicPropertyMask('sustainAbility')) have('fixed abilities', 'sustainAbility');
    if (extrinsicPropertyMask('lifeSaving')) message('Your life ', 'will be', 'would have been', ' saved');

    // C insight.c:1909 — youprop.h Luck includes the luckstone/luck item bonus.
    const luck = Luck(u);
    if (luck) are(`${Math.abs(luck) >= 10 ? 'extremely ' : Math.abs(luck) >= 5 ? 'very ' : ''}${
        luck < 0 ? 'un' : ''}lucky${wizard ? ` (${luck})` : ''}`);
    else if (wizard) message('Your luck ', 'is', 'was', ' zero');
    if (u.moreluck) have(u.moreluck > 0 ? 'extra luck' : 'reduced luck');
    const stones = game.inventory.filter(object => confersLuck(object));
    const stoneLuck = stones.reduce((sum, object) => sum + (object.cursed ? -object.quan : object.quan), 0);
    if (stones.some(object => object.otyp === LUCKSTONE) || stoneLuck) {
        const blessedLuck = stones.reduce((sum, object) => sum + (object.cursed ? -object.quan : object.blessed ? object.quan : 0), 0);
        if (blessedLuck <= 0) message('Bad luck ', 'does', 'did', ' not time out for you');
        if (blessedLuck >= 0) message('Good luck ', 'does', 'did', ' not time out for you');
    }
    if (u.ugangr) message(deityName(u.ualign?.type ?? 0), ' is', ' was', ` ${u.ugangr > 6 ? 'extremely ' : u.ugangr > 3 ? 'very ' : ''}angry with you${wizard ? ` (${u.ugangr})` : ''}`);
    else if (!final) can(`${canPraySafely() ? '' : 'not '}safely pray${wizard ? ` (${u.ublesscnt ?? 0})` : ''}`);
    const mortality = u.umortality ?? 0;
    if (final === 2) lines.push(`  You are dead${mortality > 1 ? ` (${mortality}${ordinalSuffix(mortality)} time!)` : ''}.`);
    else if (mortality) lines.push(`  You ${final ? 'survived after being killed' : 'have been killed'} ${times(mortality)}.`);
    else if (final) lines.push('  You survived.');
    return lines;
}

function warningPeople(mask: number, form: boolean): string {
    if (form && (mask & 0x18) === 0x18) return 'humans and elves';
    if (form && (mask & 0x08)) return 'humans';
    if (!form && (mask & 0x80)) return 'orcs';
    if (mask & 0x10) return 'elves';
    if (form && (mask & 0x80)) return 'orcs';
    if (mask & 0x100) return 'demons';
    return form ? 'certain monsters' : 'something';
}

// C insight.c:item_resistance_message(): the "Your items are protected"
// row, "somewhat" while the coverage is partial; the inventory coverage is
// C zap.c:u_adtyp_resistance_obj() (the property-source mask) and the
// sentence is enlght_line()'s assembly.
function itemResistanceLines(property: PropertyName, damage: string, final: EnlightenmentFinal): string[] {
    const mask = extrinsicPropertyMask(property);
    const extrinsic = !!(mask & (W_ARMOR | W_ACCESSORY | W_WEP | W_ART));
    const partial = !extrinsic && (property === 'fireResistance' || property === 'coldResistance')
        && game.uarmc?.otyp === DWARVISH_CLOAK;
    if (!extrinsic && !partial) return [];
    const cause = game.flags.debug ? itemResistanceCause(property) : '';
    return [`  Your items ${final ? 'were' : 'are'}${partial ? ' somewhat' : ''} protected from ${damage}${cause}.`];
}

// C insight.c:enlght_combatinc(): the size word for a to-hit, damage, or
// defense modifier; defense shrinks by a third to stretch the ranges, and
// the exact amount shows only when final or in wizard mode.
export function combatIncrement(kind: 'to hit' | 'damage' | 'defense', amount: number, final: EnlightenmentFinal): string {
    const magnitude = kind === 'defense' ? Math.trunc(Math.abs(amount) * 2 / 3) : Math.abs(amount);
    const size = magnitude <= 3 ? 'small' : magnitude <= 6 ? 'moderate' : magnitude <= 12 ? 'large' : 'huge';
    const bonus = amount >= 0 ? 'bonus' : 'penalty';
    return `${amount ? withIndefiniteArticle(size) : 'no'} ${kind === 'to hit' ? `${bonus} ${kind}` : `${kind} ${bonus}`}${
        final || game.flags.debug ? ` (${amount > 0 ? '+' : ''}${amount})` : ''}`;
}

function times(count: number): string {
    return count === 1 ? 'once' : count === 2 ? 'twice' : count === 3 ? 'thrice' : `${count} times`;
}

// C insight.c:enlght_line(): the contraction pass of the sentence builder
// ("are not" becomes "aren't" and friends).
export function contractEnlightenment(line: string): string {
    return line.replace(' are not ', " aren't ").replace(' were not ', " weren't ")
        .replace(' have not ', " haven't ").replace(' had not ', " hadn't ")
        .replace(' can not ', " can't ").replace(' could not ', " couldn't ");
}

// worn.c:setworn() sets tux_penalty from these same live fields.
export function monkArmorPenalty(): number {
    return game.uarm && game.urole?.key === 'monk' && !Upolyd(game.u)
        ? game.urole.spellcasting.armor : 0;
}

// C enlightenment() uses add_menu_str() while the game is in progress.
// The shared disclosure lines already include the tty menu leading column.
function attributeMenuLines({ basic = true, magic = false }: EnlightenmentOptions = {}): string[] {
    const roleName = enlightenmentRoleName();
    const lines = [
        ` ${game.displayName || game.plname} the ${roleName}'s attributes:`,
    ];
    if (basic) lines.push(...backgroundEnlightenmentLines(), ...basicsEnlightenmentLines(), ...characteristicEnlightenmentLines(magic));

    lines.push('', ' Status:', ...statusEnlightenmentLines(magic));
    lines.push(...statusEquipmentLines());

    if (magic) lines.push(...attributeEnlightenmentLines());

    lines.push(...miscellaneousLines(basic));
    return lines.map(line => line.startsWith(' ') ? line.slice(1) : line);
}

export async function showEnlightenment(options: EnlightenmentOptions = {}) {
    await showTextMenuOverlay(attributeMenuLines(options));
}

export async function doattributes() {
    const magic = !!(game.flags?.debug || game.flags?.explore);
    await showEnlightenment({ magic });
    game.context.move = 0;
}

// C insight.c:enlightenment() "Miscellaneous" section.  The recorder's
// fixed clock leaves urealtime.realtime at zero, so elapsed time is " none".
// C insight.c:fmt_elapsed_time(): the zero elapsed-time line it would build.
function miscellaneousLines(basic: boolean, final: EnlightenmentFinal = 0): string[] {
    const lines = ['', ' Miscellaneous:'];
    const wizard = !!game.flags.debug, discover = !!game.flags.explore;
    if (basic && (wizard || discover || final)) {
        if (wizard || discover)
            lines.push(`  You ${final ? 'were' : 'are'} running in ${wizard ? 'debug' : 'explore'} mode.`);
        // you_have_X(): the final form drops the verb ("You encountered").
        if (game.flags.bones === false) {
            // Storing is mentioned only when the hero has just died.
            lines.push(`  You ${final ? '' : 'have '}disabled loading${
                final === ENL_GAMEOVERDEAD ? ' and storing' : ''} of bones levels.`);
        } else {
            // u.uroleplay.numbones counts each bones level loaded this game.
            const bones = game.u.uroleplay?.numbones ?? 0;
            if (!bones) {
                lines.push(`  You ${final ? "didn't encounter" : "haven't encountered"} any bones levels.`);
            } else lines.push(`  You ${final ? '' : 'have '}encountered ${bones} bones level${bones === 1 ? '' : 's'}.`);
        }
    }
    lines.push(`  Total elapsed playing time ${final ? 'was' : 'is'} none.`);
    return lines;
}

export interface FinalAttributeOptions {
    final: typeof ENL_GAMEOVERALIVE | typeof ENL_GAMEOVERDEAD;
    // svk.killer.name; a dismount death excludes the steed from Final Status.
    killer?: string;
}

function finalAttributePages({ final, killer = '' }: FinalAttributeOptions): TextPage[] {
    const lines = [
        ` ${game.displayName || game.plname} the ${enlightenmentRoleName()}'s attributes:`,
        ...backgroundEnlightenmentLines(final),
        ...basicsEnlightenmentLines(final),
        ...characteristicEnlightenmentLines(true, final),
        '', ' Final Status:', ...statusEnlightenmentLines(true, final, killer),
        ...statusEquipmentLines(final),
    ];
    lines.push(...attributeEnlightenmentLines(final), ...miscellaneousLines(true, final));
    // Final disclosure uses putstr(), without the menu's extra leading column.
    const textLines = lines.map(line => line.startsWith(' ') ? line.slice(1) : line);
    const pages: TextPage[] = [];
    for (let offset = 0; offset < textLines.length; offset += 23) {
        const pageLines = textLines.slice(offset, offset + 23);
        pageLines.push(' --More--');
        pages.push({ lines: pageLines, cursor: [9, pageLines.length - 1] });
    }
    return pages;
}

// C end.c:disclose() -> enlightenment(BASIC | MAGIC, final).
export async function showFinalAttributes(options: FinalAttributeOptions) {
    return showTextPages(finalAttributePages(options), {
        validKeys: [27, 32, 10, 13],
    });
}

// C insight.c:youhiding(): the shared phrase for #monster feedback and the
// enlightenment line.  It reads the hero's disguise and current form, not
// the #monster hiding ability, so meal-induced disguises and eels in water
// are described too.
export function heroHidingStatus(state: GameState = game): string {
    const apType = state.u.m_ap_type ?? M_AP_NOTHING;
    if (apType !== M_AP_NOTHING) {
        if (apType === M_AP_OBJECT) {
            return `mimicking ${withIndefiniteArticle(
                simpleObjectTypeName(state.u.mappearance ?? STRANGE_OBJECT, state))}`;
        }
        if (apType === M_AP_FURNITURE) return 'mimicking something';
        if (apType === M_AP_MONSTER) return 'mimicking someone';
        return 'mimicking';
    }
    const form = heroMonsterForm(state);
    if (!state.u.uundetected || form == null) return 'hiding';
    const { ux, uy } = state.u;
    if (monsterIsEel(form)) {
        return isPoolAt(ux, uy, state)
            ? `hiding in the ${waterbodyName(ux, uy, state)}` : 'hiding';
    }
    if (heroFormHidesUnderObjects(state)) {
        const cover = floorObjects(state)[0];
        return cover
            ? `hiding underneath ${simpleObjectNameWithArticle(cover, state)}` : 'hiding';
    }
    if (heroFormClings(state) || heroIsFlying(state))
        return `hiding on the ${ceilingName(ux, uy, state)}`;
    if (state.u.utrap && state.u.utraptype === TT_PIT) {
        const trap = state.level?.traps?.find(candidate =>
            candidate.tx === ux && candidate.ty === uy);
        return `hiding in a ${trap?.ttyp === SPIKED_PIT ? 'spiked ' : ''}pit`;
    }
    return `hiding on the ${surfaceName(ux, uy, state)}`;
}

// Voluntary challenges, present tense.
// C insight.c:sokoban_in_play(): the Sokoban-rules conduct appears only
// once the entered-Sokoban achievement is on record.
export function currentConductLines() {
    const conduct = game.u?.uconduct || {};
    const lines = ['Voluntary challenges:'];
    lines.push(rerollConductLine());
    if (game.u?.uroleplay?.blind)
        lines.push(' You have been blind from birth.');
    if (game.u?.uroleplay?.deaf)
        lines.push(' You have been deaf from birth.');
    if (game.u?.uroleplay?.pauper) {
        lines.push((game.inventory || []).length
            ? ' You started without possessions.'
            : ' You are without possessions.');
    }
    if (game.u?.uroleplay?.nudist)
        lines.push(' You have been faithfully nudist.');
    if (!(conduct.food || 0)) lines.push(' You have gone without food.');
    else if (!(conduct.unvegan || 0))
        lines.push(' You have followed a strict vegan diet.');
    else if (!(conduct.unvegetarian || 0))
        lines.push(' You have been vegetarian.');
    if (!(conduct.gnostic || 0)) lines.push(' You have been an atheist.');
    if (!(conduct.weaphit || 0)) {
        lines.push(' You have never hit with a wielded weapon.');
    } else if (game.flags?.debug) {
        const count = conduct.weaphit;
        lines.push(` You have hit with a wielded weapon ${count} time${
            count === 1 ? '' : 's'
        }.`);
    }
    if (!(conduct.killer || 0)) lines.push(' You have been a pacifist.');
    if (!(conduct.literate || 0)) {
        lines.push(' You have been illiterate.');
    } else if (game.flags?.debug) {
        const count = conduct.literate;
        lines.push(` You have read items or engraved ${count} time${
            count === 1 ? '' : 's'
        }.`);
    }
    if (!(conduct.pets || 0)) lines.push(' You have never had a pet.');
    const genocides = (game.mvitals ?? []).filter(vital => (vital?.mvflags & G_GENOD) !== 0).length;
    if (!genocides)
        lines.push(' You have never genocided any monsters.');
    else
        lines.push(` You have genocided ${genocides} ${plural(genocides, 'type')} of ${plural(genocides, 'monster')}.`);
    if (!(conduct.polypiles || 0)) {
        lines.push(' You have never polymorphed an object.');
    } else if (game.flags?.debug) {
        const count = conduct.polypiles;
        lines.push(` You have polymorphed ${count} item${
            count === 1 ? '' : 's'
        }.`);
    }
    if (!(conduct.polyselfs || 0)) {
        lines.push(' You have never changed form.');
    } else if (game.flags?.debug) {
        const count = conduct.polyselfs;
        lines.push(` You have changed form ${count} time${
            count === 1 ? '' : 's'
        }.`);
    }
    lines.push(...wishConductLines(false));
    if (achievementEntries(game).includes(ACH_SOKO)) {
        const cheated = conduct.sokocheat ?? 0;
        lines.push(cheated
            ? ` You have violated the special Sokoban rules ${killedCountPhrase(cheated)}.`
            : " You haven't violated any of the special Sokoban rules.");
    }
    // Native only shows achievements mid-game in wizard mode.
    if (game.flags?.debug) lines.push(...achievementLines(false));
    return lines;
}

export async function doconduct() {
    await showDisclosureOverlay(currentConductLines(), {
        restoreUnderlay: true,
    });
    game._pending_message = '';
    game._retained_message = '';
    game.context.move = 0;
}

// Voluntary challenges, past tense, for the end-of-game disclosure.
// C insight.c:sokoban_in_play(): the Sokoban-rules conduct appears only
// once the entered-Sokoban achievement is on record.
export function finalConductLines() {
    const conduct = game.u?.uconduct || {};
    const lines = ['Voluntary challenges:'];
    lines.push(rerollConductLine());
    if (game.u?.uroleplay?.blind)
        lines.push(' You were blind from birth.');
    if (game.u?.uroleplay?.deaf)
        lines.push(' You were deaf from birth.');
    if (game.u?.uroleplay?.pauper)
        lines.push(' You started out without possessions.');
    if (game.u?.uroleplay?.nudist)
        lines.push(' You were faithfully nudist.');
    if (!(conduct.food || 0)) lines.push(' You went without food.');
    else if (!(conduct.unvegan || 0)) lines.push(' You followed a strict vegan diet.');
    else if (!(conduct.unvegetarian || 0)) lines.push(' You were vegetarian.');
    if (!(conduct.gnostic || 0)) lines.push(' You were an atheist.');
    if (!conduct.weaphit) lines.push(' You never hit with a wielded weapon.');
    else if (game.flags.debug)
        lines.push(` You hit with a wielded weapon ${conduct.weaphit} ${plural(conduct.weaphit, 'time')}.`);
    if (!(conduct.killer || 0)) lines.push(' You were a pacifist.');
    if (!conduct.literate) lines.push(' You were illiterate.');
    else if (game.flags.debug)
        lines.push(` You read items or engraved ${conduct.literate} ${plural(conduct.literate, 'time')}.`);
    if (!(conduct.pets || 0))
        lines.push(' You never had a pet.');
    const genocides = (game.mvitals ?? []).filter(vital => (vital.mvflags & G_GENOD) !== 0).length;
    if (!genocides)
        lines.push(' You never genocided any monsters.');
    else
        lines.push(` You genocided ${genocides} ${plural(genocides, 'type')} of ${plural(genocides, 'monster')}.`);
    if (!conduct.polypiles)
        lines.push(' You never polymorphed an object.');
    else if (game.flags.debug)
        lines.push(` You polymorphed ${conduct.polypiles} ${plural(conduct.polypiles, 'item')}.`);
    if (!conduct.polyselfs) lines.push(' You never changed form.');
    else if (game.flags.debug)
        lines.push(` You changed form ${conduct.polyselfs} ${plural(conduct.polyselfs, 'time')}.`);
    lines.push(...wishConductLines(true));
    if (achievementEntries(game).includes(ACH_SOKO)) {
        const cheated = conduct.sokocheat ?? 0;
        lines.push(cheated
            ? ` You violated the special Sokoban rules ${killedCountPhrase(cheated)}.`
            : ' You did not violate any of the special Sokoban rules.');
    }
    lines.push(...achievementLines(true));
    return lines;
}

// C insight.c:show_conduct(): the wish count and its artifact suffix; the
// two tenses share the suffix, differing only in the leading "have".
function wishConductLines(final: boolean): string[] {
    const conduct = game.u?.uconduct || {};
    const wishes = conduct.wishes || 0;
    if (!wishes) return [final ? ' You used no wishes.' : ' You have used no wishes.'];
    const artifacts = conduct.wisharti ?? 0;
    let text = ` You ${final ? '' : 'have '}used ${wishes} wish${wishes === 1 ? '' : 'es'}`;
    if (artifacts) {
        const count = artifacts !== wishes ? `${artifacts} `
            : artifacts > 2 ? 'all ' : artifacts === 2 ? 'both ' : '';
        text += ` (${count}for ${artifacts === 1 ? 'an artifact' : 'artifacts'})`;
    }
    const lines = [`${text}.`];
    if (!artifacts)
        lines.push(final ? ' You did not wish for any artifacts.' : " You haven't wished for any artifacts.");
    return lines;
}

// C insight.c:show_achievements().  Achievements are displayed in the order
// they were recorded, except that an ascension defers the Amulet and the
// win itself to the end of the list; 'final' selects past-tense wording.
// C insight.c:count_achievements(): the empty-list early out.
// C insight.c:remove_achievement(): the ascension reordering below pulls
// ACH_UWIN (and ACH_AMUL with it) out of the list before re-appending.
function achievementLines(final: boolean): string[] {
    let entries = achievementEntries(game);
    if (!entries.length) return [];
    if (entries.includes(ACH_UWIN)) {
        entries = entries.filter(entry => entry !== ACH_AMUL && entry !== ACH_UWIN);
        if (achievementEntries(game).includes(ACH_AMUL)) entries.push(ACH_AMUL);
        entries.push(ACH_UWIN);
        game.u.uachieved = entries;
    }
    const bellHeld = !!game.u.uhave?.bell, candleHeld = !!game.u.uhave?.menorah,
        bookHeld = !!game.u.uhave?.book, amuletHeld = !!game.u.uhave?.amulet,
        ascended = !!game.u.uevent?.ascended;
    // [present, past] phrases; enl_msg() picks the tense from 'final'.
    const actions = new Map<number, readonly [string, string]>([
        [ACH_BLND, ['are exploring without being able to see', 'explored without being able to see']],
        [ACH_NUDE, ['have gone without any armor', 'went without any armor']],
        [ACH_MINE, ['have entered the Gnomish Mines', 'entered the Gnomish Mines']],
        [ACH_TOWN, ['have entered Minetown', 'entered Minetown']],
        [ACH_SHOP, ['have entered a shop', 'entered a shop']],
        [ACH_TMPL, ['have entered a temple', 'entered a temple']],
        [ACH_ORCL, ['have consulted the Oracle of Delphi', 'consulted the Oracle of Delphi']],
        [ACH_NOVL, ['have read from a Discworld novel', 'read from a Discworld novel']],
        [ACH_SOKO, ['have entered Sokoban', 'entered Sokoban']],
        [ACH_SOKO_PRIZE, ['have completed Sokoban', 'completed Sokoban']],
        [ACH_MINE_PRIZE, ['have completed the Gnomish Mines', 'completed the Gnomish Mines']],
        [ACH_BGRM, ['have entered the Big Room', 'entered the Big Room']],
        [ACH_MEDU, ['have defeated Medusa', 'defeated Medusa']],
        [ACH_TUNE, ["have learned the tune to open and close the Castle's drawbridge",
            "learned the tune to open and close the Castle's drawbridge"]],
        [ACH_BELL, [`${bellHeld ? 'have' : 'have handled'} the Bell of Opening`,
            `${bellHeld ? 'had' : 'handled'} the Bell of Opening`]],
        [ACH_HELL, ['have entered Gehennom', 'entered Gehennom']],
        [ACH_CNDL, [`${candleHeld ? 'have' : 'have handled'} the Candelabrum of Invocation`,
            `${candleHeld ? 'had' : 'handled'} the Candelabrum of Invocation`]],
        [ACH_BOOK, [`${bookHeld ? 'have' : 'have handled'} the Book of the Dead`,
            `${bookHeld ? 'had' : 'handled'} the Book of the Dead`]],
        [ACH_INVK, ["have gained access to Moloch's Sanctum", "gained access to Moloch's Sanctum"]],
        [ACH_AMUL, [`${amuletHeld ? 'have' : 'have obtained'} the Amulet of Yendor`,
            `${ascended ? 'delivered' : amuletHeld ? 'had' : 'had obtained'} the Amulet of Yendor`]],
        [ACH_ENDG, ['have reached the Elemental Planes', 'reached the Elemental Planes']],
        [ACH_ASTR, ['have reached the Astral Plane', 'reached the Astral Plane']],
    ]);
    const lines = ['', `Achievement${entries.length === 1 ? '' : 's'}:`];
    for (const entry of entries) {
        const identity = Math.abs(entry);
        if (identity === ACH_UWIN) {
            lines.push(' You ascended!');
        } else if (identity >= ACH_RNK1 && identity <= ACH_RNK8) {
            const rank = game.urole?.title?.[identity - ACH_RNK1 + 1];
            const title = (entry < 0 ? rank?.f : rank?.m) || rank?.m || 'Adventurer';
            lines.push(` You ${final ? '' : 'have '}attained the rank of ${title}.`);
        } else {
            const action = actions.get(identity);
            lines.push(action ? ` You ${action[final ? 1 : 0]}.` : ` [Unexpected achievement #${entry}.]`);
        }
    }
    return lines;
}

// Achievements — ordered, event-time achievement state.
// C refs: include/you.h enum achievements; insight.c record_achievement(),
// achieve_rank(), achieve_msg[]; do.c:goto_level() branch achievements;
// botl.c:rank_to_xlev().
//
// Achievements are history, not a projection of the current dungeon cache.
// Store their source identifiers in attainment order so disclosure remains
// correct after a level has been left, a rank has been lost, or an actor has
// disappeared.  A newly recorded achievement also appends its achieve_msg[]
// line to the chronicle (livelog_printf() -> gamelog_add()) unless the game
// is already over.

type AchievementState = Pick<GameState, 'u'>;
type AchievementLogState = Pick<GameState,
    'u' | 'urole' | 'context' | 'program_state' | 'moves' | 'gamelog'>;

export const ACH_HELL = 2;
export const ACH_MINE = 15;
export const ACH_TOWN = 16;
export const ACH_RNK1 = 23;
export const ACH_RNK8 = 30;

// insight.c:achieve_msg[] — one chronicle line per achievement.  The rank
// entries are empty because their text is created on the fly, and the two
// prize entries get their object name appended by recordAchievement().
const ACHIEVEMENT_LOG_TEXT: readonly string[] = [
    '', // achievements are numbered from 1
    'acquired the Bell of Opening',
    'entered Gehennom',
    'acquired the Candelabrum of Invocation',
    'acquired the Book of the Dead',
    'performed the invocation',
    'acquired The Amulet of Yendor',
    'entered the Elemental Planes',
    'entered the Astral Plane',
    'ascended',
    "acquired the Mines' End", // + prize object name
    'acquired the Sokoban', // + prize object name
    'killed Medusa',
    'hero was always blond, no, blind', // game is over when recorded
    'hero never wore armor', // game is over when recorded
    'entered the Gnomish Mines',
    'reached Mine Town',
    'entered a shop',
    'entered a temple',
    'consulted the Oracle',
    'read a Discworld novel',
    'entered Sokoban',
    'entered the Bigroom',
    '', '', '', '', '', '', '', '', // ranks: text created on the fly
    "learned castle drawbridge's tune",
];

// insight.c achieve_msg[].llflag: how each achievement classifies for
// livelog and dumplog.  Unlisted indexes (13, 14) are never logged.
const ACHIEVEMENT_LOG_FLAGS: ReadonlyMap<number, number> = new Map([
    ...Array.from({ length: 9 }, (_, index) => [index + 1, LL_ACHIEVE] as const),
    [10, LL_ACHIEVE | LL_SPOILER],
    [11, LL_ACHIEVE | LL_SPOILER],
    [12, LL_ACHIEVE | LL_UMONST],
    [15, LL_MINORAC | LL_DUMP],
    [16, LL_ACHIEVE],
    [17, LL_MINORAC],
    [18, LL_MINORAC],
    [19, LL_ACHIEVE],
    [20, LL_MINORAC | LL_DUMP],
    [21, LL_ACHIEVE],
    [22, LL_ACHIEVE],
    [23, LL_MINORAC | LL_DUMP],
    [24, LL_MINORAC | LL_DUMP],
    [25, LL_MINORAC | LL_DUMP],
    ...Array.from({ length: 5 }, (_, index) => [index + 26, LL_ACHIEVE] as const),
    [31, LL_MINORAC],
]);

// insight.c:record_achievement() message selection.
function achievementLogText(
    achievement: number, state: AchievementLogState,
): string | null {
    const index = Math.abs(achievement);
    if (index >= ACH_RNK1 && index <= ACH_RNK8) {
        // rank_of(rank_to_xlev(...)): the title for the rank's lowest level;
        // a negated achievement records that the hero was female.
        const title = state.urole?.title?.[index - ACH_RNK1 + 1];
        if (!title) return null;
        const name = (achievement < 0 && title.f) || title.m;
        return `attained the rank of ${name} (level ${state.u.ulevel})`;
    }
    if (index === ACH_SOKO_PRIZE || index === ACH_MINE_PRIZE) {
        const prizes = state.context?.achieveo;
        const otyp = index === ACH_SOKO_PRIZE
            ? prizes?.soko_prize_otyp : prizes?.mines_prize_otyp;
        const name = otyp === undefined ? null : OBJ_NAME(otyp);
        if (!name) throw new Error('A level prize needs its original object type');
        return `${ACHIEVEMENT_LOG_TEXT[index]} ${name}`;
    }
    return ACHIEVEMENT_LOG_TEXT[index] || null;
}

export function recordAchievement(
    state: AchievementLogState | null | undefined, achievement: number,
): boolean {
    if (!state?.u || !Number.isInteger(achievement) || !achievement) return false;
    if (!Array.isArray(state.u.uachieved)) state.u.uachieved = [];
    const identity = Math.abs(achievement);
    if (state.u.uachieved.some(entry => Math.abs(entry) === identity))
        return false;
    state.u.uachieved.push(achievement);
    // livelog during final disclosure is suppressed by record_achievement()
    if (!state.program_state?.gameover) {
        const text = achievementLogText(achievement, state);
        if (text) recordGameLogEvent(text, {
            state,
            flags: ACHIEVEMENT_LOG_FLAGS.get(identity) ?? 0,
        });
    }
    return true;
}

// C insight.c:achieve_rank(): a rank index to achievement number, negated
// when female so the chronicle reports gender-specific ranks.
export function rankAchievement(rank: number, female = false): number {
    if (!Number.isInteger(rank) || rank < 1 || rank > 8) return 0;
    const achievement = ACH_RNK1 + rank - 1;
    return female ? -achievement : achievement;
}

export function achievementEntries(state: Pick<GameState, 'u'> | null | undefined): number[] {
    return Array.isArray(state?.u?.uachieved)
        ? state.u.uachieved.filter(Number.isInteger) : [];
}

// do.c:goto_level(): Gehennom is logged before the branch chain; the branch
// achievement (mines or sokoban) and the bigroom follow before the livelog
// "entered <level>" line.  Callers own the endgame, quest, and Knox cases.
export function recordDungeonEntryAchievements(
    state: Pick<GameState, 'u' | 'dungeons' | 'urole' | 'context'
        | 'program_state' | 'moves' | 'gamelog' | 'sokoban_dnum' | 'specialLevels'>,
    oldDepth: DungeonLocation | null | undefined,
    newDepth: DungeonLocation | null | undefined,
    { newLevel = true }: { newLevel?: boolean } = {},
): void {
    const oldDungeon = state?.dungeons?.[oldDepth?.dnum ?? 0];
    const newDungeon = state?.dungeons?.[newDepth?.dnum ?? 0];
    if (!oldDungeon?.flags?.hellish && newDungeon?.flags?.hellish)
        recordAchievement(state, ACH_HELL);
    const newDungeonBranch = (oldDepth?.dnum ?? 0) !== (newDepth?.dnum ?? 0);
    if (newDungeonBranch && newDungeon?.dname === 'The Gnomish Mines') {
        recordAchievement(state, ACH_MINE);
    } else if (newDungeonBranch && state?.sokoban_dnum === newDepth?.dnum) {
        recordAchievement(state, ACH_SOKO);
    } else if (newLevel) {
        const bigroom = state.specialLevels?.get('bigrm');
        if (bigroom && bigroom.dnum === newDepth?.dnum
            && bigroom.dlevel === newDepth?.dlevel)
            recordAchievement(state, ACH_BGRM);
    }
}

// C ref: insight.c:do_gamelog()/show_gamelog(ENL_GAMEINPROGRESS).  Chronicle
// is a projection of events recorded by their owning mechanics; it does not
// infer history from the command transcript or current aggregate counters.
// Spoiler-flagged lines (insight.c:spoilerevent) stay hidden outside wizard
// mode; if every entry is one, the window still shows " none".
export async function doChronicle() {
    const events = gameLogEvents(game);
    if (!events.length) {
        await pline('No chronicled events.');
        game.context.move = 0;
        return;
    }
    const visible = game.flags.debug
        ? events : events.filter(event => !isSpoilerGameLogEvent(event));
    const lines = ['Logged events:'];
    if (visible.length) {
        lines.push(' Turn');
        lines.push(...visible.map(event => `${String(event.turn).padStart(5)}: ${event.text}`));
    } else {
        lines.push(' none');
    }
    // show_gamelog() putstr()s one formatted line at a time, so the tty
    // text window's compress_str() and wrap apply per event line.
    // show_gamelog() destroys a full-screen NHW_TEXT window, whose tty
    // dismissal (erase_menu_or_text()) already redraws map and status.
    await showTextWindow(lines);
    game._pending_message = '';
    game.context.move = 0;
}

// C insight.c:dovanquished().
export async function doVanquished() {
    await listVanquished(game.iflags.menu_requested ? 'A' : 'y');
    game.context.move = 0;
}

// C insight.c:dogenocided().
export async function doGenocided() {
    await listGenocided(game.iflags.menu_requested ? 'a' : 'y');
    game.context.move = 0;
}

// C insight.c:list_vanquished()/vanqsort_cmp().  The order comes from
// flags.vanq_sortmode, chosen through the tty sort menu below; the default
// "traditional" order is monster level high to low, then internal index.
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const G_UNIQ = 0x1000;

const VANQ_MLVL_MNDX = 0;
const VANQ_MSTR_MNDX = 1;
const VANQ_ALPHA_SEP = 2;
const VANQ_ALPHA_MIX = 3;
const VANQ_MCLS_HTOL = 4;
const VANQ_MCLS_LTOH = 5;
const VANQ_COUNT_H_L = 6;
const VANQ_COUNT_L_H = 7;
const RIDER_MONSTERS = new Set(['Death', 'Famine', 'Pestilence']
    .map(name => MONSTER_NAME.indexOf(name)));
const S_ZOMBIE = 52;
// C vanqsort_cmp(): punctuation classes order after S_ZOMBIE in this
// sequence rather than by their internal indexes.
const PUNCTUATION_CLASS_ORDER = [58, 57, 55, 54, 56, 53];

function vanqSortMode(): number {
    return game.flags.vanqSortmode ?? VANQ_MLVL_MNDX;
}

function speciesIsUnique(mnum: number): boolean {
    return !!((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) && mnum !== PM_HIGH_CLERIC;
}

function monsterClassOrder(mlet: number): number {
    if (mlet > S_ZOMBIE) {
        const position = PUNCTUATION_CLASS_ORDER.indexOf(mlet);
        if (position >= 0) return S_ZOMBIE + 1 + position;
    }
    return mlet;
}

function compareCaseInsensitive(left: string, right: string): number {
    return left.toLowerCase() < right.toLowerCase() ? -1
        : left.toLowerCase() > right.toLowerCase() ? 1 : 0;
}

// C insight.c:vanqsort_cmp() over internal monster indexes.
function vanqsortCompare(mode: number, mnum1: number, mnum2: number): number {
    let result = 0;
    switch (mode) {
    case VANQ_MSTR_MNDX:
        result = (MONSTER_DIFFICULTY[mnum2] ?? 0) - (MONSTER_DIFFICULTY[mnum1] ?? 0);
        break;
    case VANQ_ALPHA_SEP:
    case VANQ_ALPHA_MIX:
        if (mode === VANQ_ALPHA_SEP) {
            const unique1 = speciesIsUnique(mnum1) ? 1 : 0;
            const unique2 = speciesIsUnique(mnum2) ? 1 : 0;
            if (unique1 !== unique2) {
                result = unique2 - unique1;
                break;
            }
        }
        result = compareCaseInsensitive(
            MONSTER_NAME[mnum1] || '', MONSTER_NAME[mnum2] || '');
        break;
    case VANQ_MCLS_HTOL:
    case VANQ_MCLS_LTOH: {
        const class1 = monsterClassOrder(MONSTER_SYMBOL[mnum1] ?? 0);
        const class2 = monsterClassOrder(MONSTER_SYMBOL[mnum2] ?? 0);
        result = class1 - class2;
        if (result === 0) {
            // Riders share a class with major demons but sort first.
            result = (RIDER_MONSTERS.has(mnum2) ? 1 : 0)
                - (RIDER_MONSTERS.has(mnum1) ? 1 : 0);
            if (result === 0) {
                result = (MONSTER_LEVEL[mnum1] ?? 0) - (MONSTER_LEVEL[mnum2] ?? 0);
                if (mode === VANQ_MCLS_HTOL) result = -result;
            }
        }
        break;
    }
    case VANQ_COUNT_H_L:
    case VANQ_COUNT_L_H: {
        const died1 = game.mvitals?.[mnum1]?.died ?? 0;
        const died2 = game.mvitals?.[mnum2]?.died ?? 0;
        result = died2 - died1;
        if (mode === VANQ_COUNT_L_H) result = -result;
        break;
    }
    default:
        result = (MONSTER_LEVEL[mnum2] ?? 0) - (MONSTER_LEVEL[mnum1] ?? 0);
        break;
    }
    return result === 0 ? mnum1 - mnum2 : result;
}

interface VanquishedEntry {
    mnum: number;
    name: string;
    count: number;
    unique: boolean;
    pname: boolean;
}

function vanquishedEntries(): VanquishedEntry[] {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const count = vital?.died ?? 0;
        if (!count) return [];
        return [{
            mnum,
            name: MONSTER_NAME[mnum] || 'monster',
            count,
            unique: speciesIsUnique(mnum),
            pname: monsterHasProperName(mnum),
        }];
    }).sort((a, b) => vanqsortCompare(vanqSortMode(), a.mnum, b.mnum));
}

export function vanquishedTypeCount(): number {
    return (game.mvitals || []).filter(vital => (vital?.died ?? 0) > 0).length;
}

// C N_times(): "once", "twice", "thrice", then "N times".
function timesText(count: number): string {
    if (count === 2) return 'twice';
    if (count === 3) return 'thrice';
    return `${count} times`;
}

// C list_vanquished() indents each entry so its name column lines up with
// the three-digit count prefix of multiple-kill rows.
function vanquishedIndent(text: string): number {
    if (/^the /i.test(text)) return 0;
    if (/^an /i.test(text)) return 1;
    if (/^a /i.test(text)) return 2;
    return /[0-9]/.test(text.charAt(2)) ? 0 : 4;
}

export function vanquishedLines(ask = false): TextMenuEntry[] {
    const mode = vanqSortMode();
    const entries = vanquishedEntries();
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const classHeaders = (mode === VANQ_MCLS_LTOH || mode === VANQ_MCLS_HTOL)
        && entries.length > 1;
    const uniqHeaders = mode === VANQ_ALPHA_SEP;
    const lines: TextMenuEntry[] = ['Vanquished creatures:', ''];
    let previousClass = 0;
    let wasUnique = false;
    let riderHeader = false;
    for (const entry of entries) {
        const rider = RIDER_MONSTERS.has(entry.mnum);
        const mlet = MONSTER_SYMBOL[entry.mnum] ?? 0;
        if (classHeaders && (mlet !== previousClass || (riderHeader && !rider))) {
            lines.push({
                text: upstart(rider ? 'Rider' : MONSTER_CLASS_EXPLAIN[mlet] ?? ''),
                attr: ask ? ATR_NONE : terminalAttrFromCAttr(game.iflags.menu_headings?.attr ?? C_ATR_INVERSE),
            });
            riderHeader = rider;
            previousClass = mlet;
        }
        let text: string;
        if (entry.unique) {
            text = `${entry.pname ? '' : 'the '}${entry.name}`;
            if (entry.count > 1) text += ` (${timesText(entry.count)})`;
            wasUnique = true;
        } else {
            if (uniqHeaders && wasUnique) {
                lines.push('');
                wasUnique = false;
            }
            if (entry.count === 1) {
                text = withIndefiniteArticle(entry.name);
            } else {
                text = `${String(entry.count).padStart(3)} ${makePlural(entry.name)}`;
            }
        }
        const indent = vanquishedIndent(text) + (classHeaders ? 1 : 0);
        lines.push(' '.repeat(indent) + text);
    }
    if (entries.length > 1) lines.push('');
    if (entries.length > 1)
        lines.push(`${total} creatures vanquished.`);
    return lines;
}

// C insight.c:dovanquished() -> list_vanquished().  The 'm' command prefix
// (iflags.menu_requested) passes 'A' and forces the sort-order choice even
// when nothing has been vanquished yet; Escape there keeps the old order
// and the (possibly empty) list still follows.
export async function listVanquished(defquery: 'y' | 'A' = 'y'): Promise<void> {
    if (defquery === 'A') await setVanqOrder(true);
    if (!vanquishedTypeCount()) {
        if (!game.program_state.gameover)
            await pline('No creatures have been vanquished.');
        return;
    }
    await showDisclosureOverlay(vanquishedLines(), {
        restoreUnderlay: true,
    });
    // Only the window path replaces the topl; the empty-list pline stays up.
    game._pending_message = '';
}

// C insight.c:doborn() (#wizborn): per-species born/died counters plus the
// genocided (G), extinct (E), or otherwise-gone (X) flag, ending on a blank
// line; native formats running totals into a buffer but never displays them.
export async function doborn(): Promise<void> {
    const lines: string[] = ['died born'];
    for (const [mnum, vital] of (game.mvitals || []).entries()) {
        const born = vital?.born ?? 0;
        const died = vital?.died ?? 0;
        const gone = vital?.mvflags ?? 0;
        if (!born && !died && (gone & G_GONE) === 0) continue;
        const flag = (gone & G_GONE) === G_EXTINCT ? 'E'
            : (gone & G_GONE) === G_GENOD ? 'G'
                : (gone & G_GONE) !== 0 ? 'X' : ' ';
        lines.push(`${String(died).padStart(4)} ${String(born).padStart(4)} ${flag} ${
            (MONSTER_NAME[mnum] ?? '').padEnd(30)}`);
    }
    lines.push('');
    await showTextWindow(lines);
    game._pending_message = '';
    game.context.move = 0;
}

interface GoneSpecies {
    mnum: number;
    genocided: boolean;
    extinctOnly: boolean;
}

// C insight.c:num_gone()/num_genocides()/num_extinct(): end-of-game
// disclosure reports genocides and extinctions together; uniques are
// never listed, and a species carrying both flags counts once.
function goneSpecies(includeExtinct = true): GoneSpecies[] {
    return (game.mvitals || []).flatMap((vital, mnum) => {
        const flags = vital?.mvflags ?? 0;
        if (!flags || speciesIsUnique(mnum)) return [];
        const genocided = !!(flags & G_GENOD);
        const extinctOnly = (flags & (G_GENOD | G_EXTINCT)) === G_EXTINCT;
        return genocided || (includeExtinct && extinctOnly)
            ? [{ mnum, genocided, extinctOnly }] : [];
    });
}

function genocidedLines(
    gone: GoneSpecies[], genocided: number, extinct: number,
    { ask, dumping = false }: { ask: boolean; dumping?: boolean },
): TextMenuEntry[] {
    let mode = vanqSortMode();
    // C list_genocided(): with more than one species the shared sort mode
    // drives the order, except that counting orders degrade to plain
    // alphabetical because every listed species counts once.
    if (gone.length > 1
        && (mode === VANQ_COUNT_H_L || mode === VANQ_COUNT_L_H))
        mode = VANQ_ALPHA_MIX;
    const ordered = gone.length > 1
        ? [...gone].sort((a, b) => vanqsortCompare(mode, a.mnum, b.mnum))
        : gone;
    const classHeaders = gone.length > 1
        && (mode === VANQ_MCLS_LTOH || mode === VANQ_MCLS_HTOL);
    const lines: TextMenuEntry[] = [
        `${genocided ? 'Genocided' : 'Extinct'}${extinct && genocided ? ' or extinct' : ''} species:`,
    ];
    if (!dumping) lines.push('');
    let previousClass = 0;
    for (const species of ordered) {
        const mlet = MONSTER_SYMBOL[species.mnum] ?? 0;
        if (classHeaders && mlet !== previousClass) {
            lines.push({
                text: upstart(MONSTER_CLASS_EXPLAIN[mlet] ?? ''),
                attr: ask ? ATR_NONE : terminalAttrFromCAttr(game.iflags.menu_headings?.attr ?? C_ATR_INVERSE),
            });
            previousClass = mlet;
        }
        const name = makePlural(MONSTER_NAME[species.mnum] || 'monster');
        lines.push(` ${name}${species.extinctOnly ? ' (extinct)' : ''}`);
    }
    if (!dumping) lines.push('');
    if (genocided > 0) lines.push(`${genocided} species genocided.`);
    if (extinct > 0) lines.push(`${extinct} species extinct.`);
    return lines;
}

// C insight.c:list_genocided(), shared by live commands and final disclosure.
// Native dump_redirect() writes putstr() rows without displaying a window.
// Return the dump rows so file output stays outside this listing.
export function listGenocided(defquery: 'd', ask?: false): Promise<readonly string[]>;
export function listGenocided(defquery?: DisclosureDefault | 'g', ask?: boolean): Promise<void>;
export async function listGenocided(
    defquery: DisclosureDefault | 'g' | 'd' = 'y', ask = false,
): Promise<readonly string[] | void> {
    const dumping = defquery === 'd';
    const genociding = defquery === 'g';
    const defaultAnswer: DisclosureDefault = defquery === 'g' || defquery === 'd' ? 'y' : defquery;
    const includeExtinct = !genociding && !!(game.program_state.gameover
        || game.flags.debug || game.flags.explore || game.discover);
    const gone = goneSpecies(includeExtinct);
    if (!gone.length) {
        if (!game.program_state.gameover)
            await pline(`No creatures have been genocided${genociding ? ' yet' : ''}.`);
        if (dumping) return game.program_state.gameover
            ? ['No species were genocided or became extinct.'] : [];
        return;
    }
    const genocided = gone.filter(species => species.genocided).length;
    const extinct = gone.filter(species => species.extinctOnly).length;
    if (dumping) return genocidedLines(gone, genocided, extinct, { ask: false, dumping })
        .map(line => typeof line === 'string' ? line : line.text);
    const question = `Do you want a list of ${extinct && !genocided ? 'extinct ' : ''}species${
        genocided ? ' genocided' : ''}${extinct && genocided ? ' and extinct' : ''}?`;
    const multiple = gone.length > 1;
    const answer = ask ? await ynQuestion(question, multiple ? 'ynaq' : 'ynq', defaultAnswer,
        { hiddenAll: !multiple }) : defaultAnswer;
    if (answer === 'q') { stopDisclosure(); return; }
    if (answer !== 'y' && answer !== 'a') return;
    if (answer === 'a' && multiple && await setVanqOrder(false) < 0) return;
    await showDisclosureOverlay(genocidedLines(gone, genocided, extinct, { ask }), {
        restoreUnderlay: true,
    });
}

// C insight.c:set_vanq_order().  A PICK_ONE menu over the vanqorders
// table; the currently chosen order is preselected, and Escape cancels
// by leaving the menu unanswered (select_menu returns -1).
const VANQ_ORDER_CHOICES: ReadonlyArray<readonly [number, string]> = [
    [VANQ_MLVL_MNDX, 't'], [VANQ_MSTR_MNDX, 'd'], [VANQ_ALPHA_SEP, 'a'],
    [VANQ_ALPHA_MIX, 'A'], [VANQ_MCLS_HTOL, 'C'], [VANQ_MCLS_LTOH, 'c'],
    [VANQ_COUNT_H_L, 'n'], [VANQ_COUNT_L_H, 'z'],
];

// Short descriptions in options.c use column 1 of C's vanqorders table.
export function vanquishedOptionValue(mode = vanqSortMode()): string {
    const key = 'tdaACcnz'.charAt(mode);
    switch (mode) {
    case VANQ_MLVL_MNDX: return `${key}: traditional: by monster level`;
    case VANQ_MSTR_MNDX: return `${key}: by monster difficulty rating`;
    case VANQ_ALPHA_SEP: return `${key}: alphabetically, unique monsters separate`;
    case VANQ_ALPHA_MIX: return `${key}: alphabetically, unique monsters intermixed`;
    case VANQ_MCLS_HTOL: return `${key}: by monster class, high to low level in class`;
    case VANQ_MCLS_LTOH: return `${key}: by monster class, low to high level in class`;
    case VANQ_COUNT_H_L: return `${key}: by count, high to low`;
    default: return `${key}: by count, low to high`;
    }
}

function vanqOrderDescription(mode: number, forVanquished: boolean): string {
    switch (mode) {
    case VANQ_MLVL_MNDX:
        return 'traditional: by monster level, by internal monster index';
    case VANQ_MSTR_MNDX:
        return 'by monster difficulty rating, by internal monster index';
    case VANQ_ALPHA_SEP:
        // Uniques cannot be genocided, so their separation is unlisted there.
        return forVanquished
            ? 'alphabetically, first unique monsters, then others'
            : 'alphabetically';
    case VANQ_MCLS_LTOH:
        return 'by monster class, low to high level within class';
    case VANQ_COUNT_H_L:
        return 'by count, high to low, by internal index within tied count';
    default:
        return 'by count, low to high, by internal index within tied count';
    }
}

export async function setVanqOrder(forVanquished: boolean): Promise<number> {
    const current = vanqSortMode();
    const items: InventoryMenuItem<number>[] = [];
    let preselectedKey: string | null = null;
    for (const [mode, letter] of VANQ_ORDER_CHOICES) {
        // The two uppercase orders exist in the comparator but stay
        // unlisted; counting orders don't apply to genocided species.
        if (mode === VANQ_ALPHA_MIX || mode === VANQ_MCLS_HTOL
            || (!forVanquished
                && (mode === VANQ_COUNT_H_L || mode === VANQ_COUNT_L_H)))
            continue;
        items.push({
            text: vanqOrderDescription(mode, forVanquished),
            key: letter, value: mode,
        });
        if (mode === current) preselectedKey = letter;
    }
    const selected = await showInventoryWindow([{ items }], {
        title: `Sort order for ${forVanquished
            ? 'vanquished monster counts (also genocided types)'
            : 'genocided monster types (also vanquished counts)'}`,
        pickMode: PICK_ONE, preselectedKey,
    });
    if (selected.key === 27) return -1;
    const mode = selected.value
        ?? items.find(item => item.key === String.fromCharCode(selected.key))?.value
        ?? current;
    game.flags.vanqSortmode = mode;
    return mode;
}

// ---------------------------------------------------------------------------
// Monster status text used by stethoscopes and probing magic.
// C ref: insight.c mstatusline().
// ---------------------------------------------------------------------------

const SIZE_NAMES = new Map([
    [0, 'tiny'], [1, 'small'], [2, 'medium'], [3, 'large'],
    [4, 'huge'], [7, 'gigantic'],
]);

interface StatusLineOptions {
    state?: GameState;
    x?: number;
    y?: number;
}

// One-line monster feedback for a stethoscope or probing hit.
// C insight.c:size_str(): SIZE_NAMES holds the size word of the status line.
export async function monsterStatusLine(monster: Monster, {
    state = game, x = monster.mx, y = monster.my,
}: StatusLineOptions = {}): Promise<string> {
    const alignment = monsterAlignmentType(monster);
    const alignmentName = alignment === -128 ? 'unaligned'
        : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    const sizeName = SIZE_NAMES.get(MONSTER_SIZE[monster.mnum] ?? -1) || 'unknown size';
    const conditions: string[] = [];
    if (monster.mtame) {
        let tame = 'tame';
        if (state.flags.debug) {
            const pet = monster.edog || monster.mextra?.edog;
            let details = '';
            if (!monster.isminion) {
                if (!pet) throw new Error(`Pet ${monster.m_id} has no pet state`);
                details = `; hungry ${pet.hungrytime}; apport ${pet.apport}`;
            }
            tame += ` (${monster.mtame}${details})`;
        }
        conditions.push(tame);
    }
    else if (monster.mpeaceful) conditions.push('peaceful');
    if (MONSTER_NAME[monster.mnum] === 'long worm') {
        const count = (monster.wormno ? monster.wormSegments?.length ?? 0 : 0) + 1;
        const index = wormSegmentIndexAt(monster, x, y, state);
        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
            : ['', 'st', 'nd', 'rd'][index % 10] || 'th';
        conditions.push(count === 1 ? 'single segment' : `${index}${suffix} of ${count} segments`);
    }
    if (monster.cham !== undefined && monster.cham >= 0 && monster.cham !== monster.mnum)
        conditions.push('shapechanger');
    if (monster.meating) conditions.push('eating');
    // Native gates this on the probed square, even though the hidden
    // description itself uses the head square for a long worm.
    if (monster.mundetected || monster.m_ap_type || visibleRegionAt(state, x, y))
        conditions.push(...await monsterHiddenConditions(monster, state));
    if (monster.mcan) conditions.push('cancelled');
    if (monster.mconf) conditions.push('confused');
    if (monster.mblinded || !monster.mcansee) conditions.push('blind');
    if (monster.mstun) conditions.push('stunned');
    if (monster.msleeping) conditions.push('asleep');
    else if (monster.mfrozen || !monster.mcanmove) conditions.push("can't move");
    else if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) conditions.push('meditating');
    if (monster.mflee) conditions.push('scared');
    if (monster.mtrapped) conditions.push('trapped');
    if (monster.mspeed) conditions.push(monster.mspeed === 2 ? 'fast'
        : monster.mspeed === 1 ? 'slow' : '[? speed]');
    if (monster.minvis) conditions.push('invisible');
    if (monster === state.u.ustuck) {
        if (state.u.uswallow) conditions.push(monsterDigests(monster) ? 'digesting you'
            : monsterIsAnimal(monster) && !monsterEnfolds(monster) ? 'swallowing you' : 'engulfing you');
        else conditions.push(heroFormSticks(state) ? 'held by you' : 'holding you');
    }
    if (monster === state.u.usteed) {
        conditions.push('carrying you');
        if ((state.u._woundedLegTurns ?? 0) > 0 || state.u._woundedLegSide) {
            const leg = mbodypart(monster.mnum, LEG);
            conditions.push(`injured ${state.u._woundedLegSide === 'both' ? makePlural(leg) : leg}`);
        }
    }
    if (monster.mleashed) conditions.push('leashed');
    const conditionText = conditions.length ? `, ${conditions.join(', ')}` : '';
    const armorClass = findMonsterArmorClass(monster);
    const name = monsterName(monster, {
        state, article: 'your', suppressIt: true, suppressInvisible: true,
        suppressSaddle: false,
    });
    const identity = `${name} (${alignmentName}, ${sizeName})`;
    const health = `Level ${monster.m_lev ?? 0}  HP ${monster.mhp}(${monster.mhpmax})`;
    return `Status of ${identity}:  ${health}  AC ${armorClass}${conditionText}.`;
}

// C insight.c:ustatusline().
export function heroStatusLine(state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const conditions = [];
    if (heroIsSick(state)) {
        const causes = [];
        if ((hero.sickType ?? 0) & SICK_VOMITABLE) causes.push('food poisoning');
        if ((hero.sickType ?? 0) & SICK_NONVOMITABLE) causes.push('illness');
        conditions.push(`dying from ${causes.join(' and ')}`);
    }
    if (heroIsPetrifying(state)) conditions.push('solidifying');
    if (hero.slimed || (hero.slimedTurns ?? 0) > 0) conditions.push('becoming slimy');
    if (heroIsStrangled(state)) conditions.push('being strangled');
    if (heroIsVomiting(state)) conditions.push('nauseated');
    if (hero.confused || (hero.confusionTurns ?? 0) > 0) conditions.push('confused');
    if (heroIsBlind(state)) {
        let blindness = 'blind';
        if (hero.ucreamed) {
            const otherCause = hero.ucreamed < (hero.blindTurns ?? 0)
                || blindfolded(state) || !monsterHasEyes(heroSpecies(state));
            blindness += `${otherCause ? ', covered' : 'ed'} by sticky goop`;
        }
        conditions.push(blindness);
    }
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0) conditions.push('stunned');
    if (((hero._woundedLegTurns ?? 0) > 0 || hero._woundedLegSide) && !hero.usteed) {
        const leg = body_part(LEG, state);
        conditions.push(`injured ${hero._woundedLegSide === 'both' ? makePlural(leg) : leg}`);
    }
    if ((hero.glibTurns ?? 0) > 0) {
        const gloves = state.uarmg || hero.uarmg;
        conditions.push(`slippery ${gloves ? armorSimpleName(gloves, state) : makePlural(body_part(FINGER, state))}`);
    }
    if (hero.utrap) conditions.push('trapped');
    if (hero.veryFast) conditions.push('very fast');
    else if (hero.fast) conditions.push('fast');
    if (hero.uundetected) conditions.push('concealed');
    else if (M_AP_TYPE(hero)) conditions.push('disguised');
    if (heroIsInvisible(state)) conditions.push('invisible');
    if (hero.ustuck) {
        const relation = hero.uswallow
            ? monsterDigests(hero.ustuck) ? 'being digested by' : 'engulfed by'
            : heroFormSticks(state) ? 'holding' : 'held by';
        conditions.push(`${relation} ${monsterName(hero.ustuck, { state, article: 'a' })}`);
    }
    const region = !hero.uswallow && visibleRegionAt(state, hero.ux, hero.uy);
    if (region) conditions.push(`in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`);
    const alignment = hero.ualign.type;
    const suffix = alignment === 1 ? 'lawful' : alignment === 0 ? 'neutral'
        : alignment === -1 ? 'chaotic' : 'unaligned';
    const devotion = piousness(hero.ualign.record, { showNegative: false, suffix });
    const polymorphed = Upolyd(hero);
    const level = polymorphed ? MONSTER_LEVEL[hero.umonnum] : hero.ulevel;
    const hp = polymorphed ? hero.mh : hero.uhp;
    const maximum = polymorphed ? hero.mhmax : hero.uhpmax;
    return `Status of ${state.plname} (${devotion}):  Level ${level}  HP ${hp}(${maximum})  AC ${hero.uac}${conditions.length ? `, ${conditions.join(', ')}` : ''}.`;
}
