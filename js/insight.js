import { fromWhat, heroHasNoEyes, intrinsicPropertyMask } from './attribute_provenance.js';
import { levitationAtWill, propertyTimeout } from './properties.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel } from './terrain_properties.js';
import { formatFeltMessage } from './hero_speech.js';
// insight.js — Basic enlightenment / attributes command.
// C ref: insight.c — doattributes(), enlightenment().
import { heroIsHallucinating } from './senses.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { game } from './gstate.js';
import { bot, displayLiquidName, docrt, flushPendingTopline, flush_screen, pline, } from './display.js';
import { showDisclosureOverlay, showTextPages } from './windows.js';
import { A_WIS, G_GENOD, FROMFORM, FROMOUTSIDE, Upolyd, ACH_AMUL, ACH_ASTR, ACH_BELL, ACH_BGRM, ACH_BLND, ACH_BOOK, ACH_CNDL, ACH_ENDG, ACH_INVK, ACH_MEDU, ACH_MINE_PRIZE, ACH_NOVL, ACH_NUDE, ACH_ORCL, ACH_SHOP, ACH_SOKO, ACH_SOKO_PRIZE, ACH_TMPL, ACH_TUNE, ACH_UWIN, ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD, MGIVENNAME, NOT_HUNGRY, M_AP_NOTHING, M_AP_TYPE, P_ISRESTRICTED, P_NONE, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED, SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { simpleArmorName } from './armor.js';
import { attributeEnlightenmentLines, contractEnlightenment, combatIncrement, monkArmorPenalty } from './enlightenment_attributes.js';
export { piousness } from './enlightenment_attributes.js';
import { backgroundEnlightenmentLines, basicsEnlightenmentLines, characteristicEnlightenmentLines, enlightenmentRoleName, } from './enlightenment_background.js';
export { goldInsightLines } from './enlightenment_background.js';
import { invWeight, nearCapacity } from './weight.js';
import { ACH_HELL, ACH_MINE, ACH_RNK1, ACH_RNK8, ACH_TOWN, achievementEntries, } from './achievements.js';
import { SHIELD_OF_REFLECTION } from './object_data.js';
import { canAdvanceHeroSkill, ensureHeroSkills, skillName, SKILL_LEVEL_NAMES, weaponSkillType, } from './skills.js';
import { weaponDescription } from './weapon_description.js';
import { isAmmunition, isWetTowel } from './weapon_type.js';
import { emptyHandedDescription } from './weapon_readiness.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterDigests } from './monster_data.js';
import { feelingAfterSelfGenocide, heroHasBeenGenocided } from './hero_genocide.js';
import { heroHidingStatus } from './hero_hide.js';
import { heroIsSick } from './hero_illness.js';
import { heroFormSticks } from './hero_species.js';
import { monsterSaddle } from './steed.js';
import { simpleObjectName, simpleObjectNameWithArticle } from './objnam.js';
import { heroLegName, monsterLegName } from './body_parts.js';
import { fingersOrGloves } from './dip_water.js';
import { surfaceName } from './terrain_name.js';
import { trapName } from './trap_name.js';
import { blindfolded, heroIsBlind, heroIsDeaf, permanentBlind, } from './senses.js';
function plural(n, singular, pluralForm = `${singular}s`) {
    return n === 1 ? singular : pluralForm;
}
// C ref: insight.c status_enlightenment().  These rows are a projection of
// live trouble/nutrition/load state; their optional length determines every
// section that follows on the second attributes page.
function statusEnlightenmentLines(magic = false, final = 0, killer = '') {
    const u = game.u;
    const wizard = !!game.flags.debug;
    const lines = [];
    const message = (subject, present, past, what, suffix = '') => lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}${suffix}.`));
    const are = (what, suffix = '') => message('You ', 'are ', 'were ', what, suffix);
    const have = (what) => message('You ', 'have ', 'had ', what);
    // A hero who died while dismounting still has u.usteed set.
    const steed = u.usteed && !(final === ENL_GAMEOVERDEAD && killer === 'riding accident') ? u.usteed : null;
    const steedName = u.usteed ? monsterName(u.usteed, {
        article: u.usteed.mtame ? 'your' : 'the', suppressSaddle: true, suppressHallucination: true,
    }) : '';
    let youToo = 'You ';
    if (Upolyd(u))
        are(`transformed${heroHasBeenGenocided(game)
            ? ` and ${final ? 'felt' : 'feel'} ${feelingAfterSelfGenocide(game)} inside` : ''}`);
    if (steed) {
        are(`riding ${steedName}`);
        youToo += `and ${steedName} `;
    }
    if (u.levitating) {
        if (magic && levitationAtWill())
            are('levitating, at will');
        else
            message(youToo, 'are ', 'were ', 'levitating', fromWhat('levitation'));
    }
    else if (u.flying)
        message(youToo, 'are ', 'were ', 'flying', fromWhat('flying'));
    if (u.uinwater)
        are('underwater');
    else if (u.waterWalking && !levelIsWaterLevel() && !u.levitating && !u.flying && (isPoolAt(u.ux, u.uy) || isLavaAt(u.ux, u.uy)))
        are(`walking on ${isPoolAt(u.ux, u.uy) ? 'water' : 'lava'}`, fromWhat('waterWalking'));
    if (Upolyd(u) && (u.uundetected || M_AP_TYPE(u) !== M_AP_NOTHING))
        are(heroHidingStatus(game));
    // Internal troubles, mostly in the order that prayer ranks them.
    if ((u.stonedTurns ?? 0) > 0 || expiredFatally(u.stoned, u.stonedTurns)) {
        if (final && expiredFatally(u.stoned, u.stonedTurns))
            lines.push('  You turned into stone.');
        else
            are('turning to stone');
    }
    if ((u.slimedTurns ?? 0) > 0 || expiredFatally(u.slimed, u.slimedTurns)) {
        if (final && expiredFatally(u.slimed, u.slimedTurns))
            lines.push('  You turned into slime.');
        else
            are('turning into slime');
    }
    if (u.strangled || (u.strangledTurns ?? 0) > 0) {
        if (u.uburied)
            are('buried');
        else if (final && expiredFatally(u.strangled, u.strangledTurns))
            lines.push('  You died from strangulation.');
        else
            are(`being strangled${wizard ? ` (${u.strangledTurns ?? 0})` : ''}`, fromWhat('strangled'));
    }
    if (heroIsSick(game)) {
        const type = u.sickType ?? 0;
        // Both sicknesses share one timeout; death reports terminal illness
        // first, as the status line does.
        if (final && expiredFatally(u.sick, u.sickTurns))
            lines.push(`  You died from ${type & SICK_NONVOMITABLE ? 'terminal illness' : 'food poisoning'}.`);
        else {
            if (type & SICK_NONVOMITABLE)
                are('terminally sick from illness');
            if (type & SICK_VOMITABLE)
                are('terminally sick from food poisoning');
        }
    }
    if ((u.vomitingTurns ?? 0) > 0)
        are('nauseated');
    if ((u.stunnedTurns ?? 0) > 0 || u.stunned)
        are('stunned');
    if ((u.confusionTurns ?? 0) > 0 || u.confused)
        are('confused');
    if (heroIsHallucinating(game))
        are('hallucinating');
    if (heroIsBlind(game)) {
        const intrinsic = intrinsicPropertyMask('blinded');
        const onlyBlindfold = blindfolded(game) && !intrinsic && !heroHasNoEyes();
        const kind = permanentBlind(game) || (intrinsic & FROMOUTSIDE) ? 'permanently'
            : intrinsic & FROMFORM ? 'innately' : onlyBlindfold ? 'deliberately' : 'temporarily';
        const timer = wizard && intrinsic === propertyTimeout('blinded') && !blindfolded()
            ? ` (${propertyTimeout('blinded')})` : '';
        are(`${kind} blind${timer}`, heroHasNoEyes() ? '' : fromWhat('blinded'));
    }
    if (heroIsDeaf(game))
        are('deaf', fromWhat('deaf'));
    // External troubles, more or less.
    if (game.uball)
        are(`chained to ${simpleObjectNameWithArticle(game.uball)}`);
    if (u.utrap) {
        const predicament = trapPredicament(final, wizard);
        if (u.usteed) {
            const anchored = u.utraptype === TT_BURIEDBALL;
            const subject = `${anchored ? 'you and ' : ''}${steedName} `;
            message(subject.charAt(0).toUpperCase() + subject.slice(1), anchored ? 'are ' : 'is ', anchored ? 'were ' : 'was ', predicament);
        }
        else
            are(predicament);
    }
    const holder = u.ustuck;
    if (holder) {
        let held = monsterName(holder, { article: 'a' });
        if (held === 'it' && MGIVENNAME(holder) !== 'it')
            held = 'an unseen creature';
        if (u.uswallow) {
            let buf = `${monsterDigests(holder) ? 'swallowed' : 'engulfed'} by ${held}`;
            if (monsterDigests(holder)) {
                // A final digestion death leaves u.uswldtim at zero.
                buf += final && !u.uswldtim ? ' and got totally digested'
                    : ` and ${final ? 'were' : 'are'} being digested`;
            }
            are(`${buf}${wizard ? ` (${u.uswldtim ?? 0})` : ''}`);
        }
        else {
            are(`${heroFormSticks(game) ? 'holding' : 'held by'} ${held} (${distanceDescription(holder.mx - u.ux, holder.my - u.uy)})`);
        }
    }
    if (steed) {
        const saddle = monsterSaddle(steed);
        if (saddle?.cursed)
            are(`stuck to ${possessiveName(steedName)} ${simpleObjectName(saddle)}`);
    }
    if ((u._woundedLegTurns ?? 0) > 0 && u._woundedLegSide) {
        // When mounted these are the steed's legs, shown only in wizard mode.
        const side = u._woundedLegSide;
        const leg = u.usteed ? monsterLegName(u.usteed.mnum) : heroLegName(game);
        const legs = side === 'both' ? `wounded ${makePlural(leg)}` : `a wounded ${side} ${leg}`;
        if (!u.usteed)
            have(legs);
        else if (wizard && steedName)
            message(steedName.charAt(0).toUpperCase() + steedName.slice(1), ' has ', ' had ', legs);
    }
    if ((u.glibTurns ?? 0) > 0)
        have(`slippery ${fingersOrGloves()}${wizard ? ` (${u.glibTurns})` : ''}`);
    const knownCause = (property) => (u._propertySources?.[property]?.worn ?? [])
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
// C timeout.c:done_timeout() ORs I_SPECIAL into a fatal intrinsic after its
// timer has counted down; the port keeps that condition's flag set at zero.
function expiredFatally(active, turns) {
    return !!active && !turns;
}
// C insight.c:trap_predicament().
function trapPredicament(final, wizard) {
    const u = game.u;
    let predicament;
    if (u.utraptype === TT_BURIEDBALL)
        predicament = 'tethered to something buried';
    else if (u.utraptype === TT_LAVA)
        predicament = `sinking into ${final ? 'lava' : displayLiquidName('lava')}`;
    else if (u.utraptype === TT_INFLOOR)
        predicament = `stuck in the ${surfaceName(u.ux, u.uy)}`;
    else {
        const trap = game.level?.traps.find(candidate => candidate.tx === u.ux && candidate.ty === u.uy);
        predicament = `trapped${trap ? ` in ${withIndefiniteArticle(trapName(trap.ttyp))}` : ''}`;
    }
    // u.utrap is an escape-attempt counter, so wizard mode uses braces.
    return wizard ? `${predicament} {${u.utrap}}` : predicament;
}
// C getpos.c:dxdy_to_dist_descr(dx, dy, TRUE).
function distanceDescription(dx, dy) {
    if (!dx && !dy)
        return 'here';
    const direction = DIRECTION_NAMES.find(entry => entry.dx === dx && entry.dy === dy);
    if (direction)
        return direction.name;
    const vertical = dy ? `${Math.abs(dy)}${dy > 0 ? 'south' : 'north'}${dx ? ',' : ''}` : '';
    return `${vertical}${dx ? `${Math.abs(dx)}${dx > 0 ? 'east' : 'west'}` : ''}`;
}
const DIRECTION_NAMES = [
    { dx: -1, dy: 0, name: 'west' }, { dx: -1, dy: -1, name: 'northwest' },
    { dx: 0, dy: -1, name: 'north' }, { dx: 1, dy: -1, name: 'northeast' },
    { dx: 1, dy: 0, name: 'east' }, { dx: 1, dy: 1, name: 'southeast' },
    { dx: 0, dy: 1, name: 'south' }, { dx: -1, dy: 1, name: 'southwest' },
];
// C ref: insight.c:weapon_insight().  Weapons are described by
// weapon.c:weapon_descr(); the skill rows come from the hero's live skill
// table, including two-weapon limits and pending #enhance eligibility.
function weaponInsightLines(final = 0) {
    const lines = [];
    const message = (subject, present, past, what) => lines.push(contractEnlightenment(`  ${subject}${final ? past : present}${what}.`));
    const are = (what) => message('You ', 'are ', 'were ', what);
    const have = (what) => message('You ', 'have ', 'had ', what);
    const weapon = game.uwep ?? null;
    if (!weapon)
        are(emptyHandedDescription());
    else if (game.u.twoweap)
        are('wielding two weapons at once');
    else {
        const what = weapon.otyp === SHIELD_OF_REFLECTION ? simpleArmorName(weapon, 'uarms', game)
            : isWetTowel(weapon) ? 'wet towel' : weaponDescription(weapon);
        are(['armor', 'food', 'venom'].includes(what.toLowerCase()) ? `wielding some ${what}`
            : `wielding ${weapon.quan === 1 ? withIndefiniteArticle(what) : makePlural(what)}`);
    }
    const wtype = weaponSkillType(weapon);
    if (wtype === P_NONE || (weapon && isAmmunition(weapon)))
        return lines;
    const sklvl = skillLevel(wtype);
    const sklvlName = skillLevelDescription(sklvl);
    const hav = sklvl !== P_UNSKILLED && sklvl !== P_SKILLED;
    let buf = `${sklvlName} ${hav ? 'skill with' : 'in'} ${skillName(wtype)}`;
    if (!game.u.twoweap) {
        if (canAdvanceHeroSkill(wtype))
            buf += ` and ${final ? 'could have enhanced' : 'can enhance'} that`;
        if (hav)
            have(buf);
        else
            are(buf);
        return lines;
    }
    const wtype2 = weaponSkillType(game.uswapwep ?? null);
    const sklvl2 = skillLevel(wtype2);
    const hav2 = sklvl2 !== P_UNSKILLED && sklvl2 !== P_SKILLED;
    let twoskl = skillLevel(P_TWO_WEAPON_COMBAT);
    let twobuf;
    if (twoskl === P_ISRESTRICTED) {
        // Polymorphed forms with several weapon attacks can two-weapon
        // without the skill; restricted then behaves as unskilled.
        twoskl = P_UNSKILLED;
        twobuf = 'restricted';
    }
    else
        twobuf = skillLevelDescription(twoskl);
    let also = '', also2 = '', also3 = false;
    if (twoskl < sklvl) {
        message(`Your skill in ${skillName(wtype)} `, 'is', 'was', ` limited by being ${twobuf} with two weapons`);
        also = 'also ';
    }
    else if (twoskl > sklvl) {
        message('Your two weapon skill ', 'is', 'was', ` limited by ${sklvl > P_ISRESTRICTED
            ? `being ${sklvlName}` : 'having no skill'} with ${skillName(wtype)}`);
        also2 = 'also ';
    }
    else {
        buf += ' and two weapons';
        also3 = true;
        if (hav)
            have(buf);
        else
            are(buf);
    }
    // Skip the secondary comparison when it duplicates the primary one.
    if (wtype2 !== wtype) {
        const name2 = skillName(wtype2);
        const sklvlName2 = skillLevelDescription(sklvl2);
        if (twoskl < sklvl2) {
            message(`Your skill in ${name2} `, 'is', 'was', ` ${also}limited by being ${twobuf} with two weapons`);
        }
        else if (twoskl > sklvl2) {
            message('Your two weapon skill ', 'is', 'was', ` ${also2}limited by ${sklvl2 > P_ISRESTRICTED
                ? `being ${sklvlName2}` : 'having no skill'} with ${name2}`);
        }
        else {
            const both = `${sklvlName2} ${hav2 ? 'skill with' : 'in'} ${name2} and two weapons`;
            if (also3)
                message('You also ', hav2 ? 'have' : 'are', hav2 ? 'had' : 'were', ` ${both}`);
            else if (hav2)
                have(both);
            else
                are(both);
        }
    }
    const a1 = canAdvanceHeroSkill(wtype);
    const a2 = wtype2 !== wtype && canAdvanceHeroSkill(wtype2);
    const ab = canAdvanceHeroSkill(P_TWO_WEAPON_COMBAT);
    if (a1 || a2 || ab) {
        const alsoWith = ' and also with ';
        const count = Number(a1) + Number(a2) + Number(ab);
        message('You ', 'can enhance', 'could have enhanced', ` skill${count > 1 ? 's' : ''} with ${a1 ? skillName(wtype) : ''}${a1 && a2 && ab ? ', ' : a1 && (a2 || ab) ? alsoWith : ''}${a2 ? skillName(wtype2) : ''}${a1 && a2 && ab ? ', and ' : a2 && ab ? alsoWith : ''}${ab ? 'two weapons' : ''}`);
    }
    return lines;
}
function skillLevel(skill) {
    const entry = ensureHeroSkills(game)?.[skill];
    if (!entry)
        throw new Error(`Weapon insight requires initialized skill ${skill}`);
    return entry.skill;
}
// "no" for restricted, otherwise weapon.c:skill_level_name() lowercased.
function skillLevelDescription(level) {
    if (level === P_ISRESTRICTED)
        return 'no';
    return (SKILL_LEVEL_NAMES[level] ?? 'Unknown').toLowerCase();
}
function statusEquipmentLines(final = 0) {
    const lines = weaponInsightLines(final);
    const penalty = monkArmorPenalty();
    if (penalty && game.uarm)
        lines.push(`  You ${final ? 'had' : 'have'} ${combatIncrement('to hit', -penalty, final)} due to your ${simpleArmorName(game.uarm, 'uarm', game)}.`);
    if (![game.uarm, game.uarmu, game.uarmc, game.uarms, game.uarmg, game.uarmf, game.uarmh].some(Boolean))
        lines.push(game.u.uroleplay?.nudist ? `  You ${final ? 'did' : 'do'} not wear any armor.`
            : `  You ${final ? "weren't" : "aren't"} wearing any armor.`);
    return lines;
}
function killedCountPhrase(count) {
    if (count === 1)
        return 'once';
    if (count === 2)
        return 'twice';
    if (count === 3)
        return 'thrice';
    return `${count} times`;
}
function rerollConductLine() {
    const roleplay = game.u.uroleplay;
    if (!roleplay?.reroll)
        return ' Character rerolling was not enabled.';
    if (!(roleplay.numrerolls || 0))
        return ' Your character was not rerolled.';
    return ` Your character was rerolled ${killedCountPhrase(roleplay.numrerolls)}.`;
}
function paginateAttributeLines(lines) {
    const contentRows = 23;
    const count = Math.ceil(lines.length / contentRows);
    const pages = [];
    for (let index = 0; index < count; index++) {
        const pageLines = lines.slice(index * contentRows, (index + 1) * contentRows);
        // tty numbers the pages only when the window needs more than one.
        const marker = count > 1 ? ` (${index + 1} of ${count})` : ' (end)';
        pageLines.push(marker);
        pages.push({
            lines: pageLines,
            cursor: [marker.length + (count > 1 ? 0 : 1), pageLines.length - 1],
        });
    }
    return pages;
}
// C insight.c:enlightenment() emits one ordered text stream.  tty owns its
// pagination, so optional status rows move all later page boundaries.
function attributePages({ basic = true, magic = false } = {}) {
    const roleName = enlightenmentRoleName();
    const lines = [
        ` ${game.displayName || game.plname} the ${roleName}'s attributes:`,
    ];
    if (basic)
        lines.push(...backgroundEnlightenmentLines(), ...basicsEnlightenmentLines(), ...characteristicEnlightenmentLines(magic));
    lines.push('', ' Status:', ...statusEnlightenmentLines(magic));
    lines.push(...statusEquipmentLines());
    if (magic)
        lines.push(...attributeEnlightenmentLines());
    lines.push(...miscellaneousLines(basic));
    return paginateAttributeLines(lines);
}
export async function showEnlightenment(options = {}) {
    await showTextPages(attributePages(options), {
        validKeys: [27, 32, 10, 13],
    });
    await docrt();
    await bot();
    await flush_screen(1);
}
export async function doattributes() {
    const magic = !!(game.flags?.debug || game.flags?.explore);
    await showEnlightenment({ magic });
    game.context.move = 0;
}
export async function doEnlightenmentEffect() {
    await pline(formatFeltMessage('self-knowledgeable...'));
    // zap.c displays WIN_MESSAGE before opening the enlightenment menu.
    await flushPendingTopline();
    await showEnlightenment({ basic: false, magic: true });
    await pline('The feeling subsides.');
    await exerciseAttribute(A_WIS, true);
}
// C insight.c:enlightenment() "Miscellaneous" section.  The recorder's
// fixed clock leaves urealtime.realtime at zero, so elapsed time is " none".
function miscellaneousLines(basic, final = 0) {
    const lines = ['', ' Miscellaneous:'];
    const wizard = !!game.flags.debug, discover = !!game.flags.explore;
    if (basic && (wizard || discover || final)) {
        if (wizard || discover)
            lines.push(`  You ${final ? 'were' : 'are'} running in ${wizard ? 'debug' : 'explore'} mode.`);
        // you_have_X(): the final form drops the verb ("You encountered").
        if (game.flags.bones === false) {
            // Storing is mentioned only when the hero has just died.
            lines.push(`  You ${final ? '' : 'have '}disabled loading${final === ENL_GAMEOVERDEAD ? ' and storing' : ''} of bones levels.`);
        }
        else if (!game._bonesEncountered) {
            lines.push(`  You ${final ? "didn't encounter" : "haven't encountered"} any bones levels.`);
        }
        else
            lines.push(`  You ${final ? '' : 'have '}encountered 1 bones level.`);
    }
    lines.push(`  Total elapsed playing time ${final ? 'was' : 'is'} none.`);
    return lines;
}
function finalAttributePages({ final, killer = '' }) {
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
    const pages = [];
    for (let offset = 0; offset < textLines.length; offset += 23) {
        const pageLines = textLines.slice(offset, offset + 23);
        pageLines.push(' --More--');
        pages.push({ lines: pageLines, cursor: [9, pageLines.length - 1] });
    }
    return pages;
}
// C end.c:disclose() -> enlightenment(BASIC | MAGIC, final).
export async function showFinalAttributes(options) {
    return showTextPages(finalAttributePages(options), {
        validKeys: [27, 32, 10, 13],
    });
}
function currentAchievementLines() {
    if (!game.flags?.debug)
        return [];
    const achievements = achievementEntries(game);
    if (!achievements.length)
        return [];
    const lines = [
        '',
        `Achievement${achievements.length === 1 ? '' : 's'}:`,
    ];
    for (const achievement of achievements) {
        const identity = Math.abs(achievement);
        if (identity === ACH_HELL) {
            lines.push(' You have entered Gehennom.');
        }
        else if (identity === ACH_MINE) {
            lines.push(' You have entered the Gnomish Mines.');
        }
        else if (identity === ACH_TOWN) {
            lines.push(' You have entered Minetown.');
        }
        else if (identity >= ACH_RNK1 && identity <= ACH_RNK8) {
            const rank = identity - ACH_RNK1 + 1;
            const title = game.urole?.title?.[rank];
            const gender = achievement < 0 ? 'f' : 'm';
            const name = title?.[gender] || title?.m || title?.f
                || `rank ${rank}`;
            lines.push(` You have attained the rank of ${name}.`);
        }
    }
    return lines;
}
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
    if (!(conduct.food || 0))
        lines.push(' You have gone without food.');
    else if (!(conduct.unvegan || 0))
        lines.push(' You have followed a strict vegan diet.');
    else if (!(conduct.unvegetarian || 0))
        lines.push(' You have been vegetarian.');
    if (!(conduct.gnostic || 0))
        lines.push(' You have been an atheist.');
    if (!(conduct.weaphit || 0)) {
        lines.push(' You have never hit with a wielded weapon.');
    }
    else if (game.flags?.debug) {
        const count = conduct.weaphit;
        lines.push(` You have hit with a wielded weapon ${count} time${count === 1 ? '' : 's'}.`);
    }
    if (!(conduct.killer || 0))
        lines.push(' You have been a pacifist.');
    if (!(conduct.literate || 0)) {
        lines.push(' You have been illiterate.');
    }
    else if (game.flags?.debug) {
        const count = conduct.literate;
        lines.push(` You have read items or engraved ${count} time${count === 1 ? '' : 's'}.`);
    }
    if (!(conduct.pets || 0))
        lines.push(' You have never had a pet.');
    if (!(conduct.genocides || 0))
        lines.push(' You have never genocided any monsters.');
    if (!(conduct.polypiles || 0)) {
        lines.push(' You have never polymorphed an object.');
    }
    else if (game.flags?.debug) {
        const count = conduct.polypiles;
        lines.push(` You have polymorphed ${count} item${count === 1 ? '' : 's'}.`);
    }
    if (!(conduct.polyselfs || 0)) {
        lines.push(' You have never changed form.');
    }
    else if (game.flags?.debug) {
        const count = conduct.polyselfs;
        lines.push(` You have changed form ${count} time${count === 1 ? '' : 's'}.`);
    }
    if (!(conduct.wishes || 0)) {
        lines.push(' You have used no wishes.');
    }
    else {
        const count = conduct.wishes;
        lines.push(` You have used ${count} wish${count === 1 ? '' : 'es'}.`);
        if (!(conduct.wisharti || 0))
            lines.push(" You haven't wished for any artifacts.");
    }
    lines.push(...currentAchievementLines());
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
    if (!(conduct.food || 0))
        lines.push(' You went without food.');
    else if (!(conduct.unvegan || 0))
        lines.push(' You followed a strict vegan diet.');
    else if (!(conduct.unvegetarian || 0))
        lines.push(' You were vegetarian.');
    if (!(conduct.gnostic || 0))
        lines.push(' You were an atheist.');
    if (!conduct.weaphit)
        lines.push(' You never hit with a wielded weapon.');
    else if (game.flags.debug)
        lines.push(` You hit with a wielded weapon ${conduct.weaphit} ${plural(conduct.weaphit, 'time')}.`);
    if (!(conduct.killer || 0))
        lines.push(' You were a pacifist.');
    if (!conduct.literate)
        lines.push(' You were illiterate.');
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
    if (!conduct.polyselfs)
        lines.push(' You never changed form.');
    else if (game.flags.debug)
        lines.push(` You changed form ${conduct.polyselfs} ${plural(conduct.polyselfs, 'time')}.`);
    if (!conduct.wishes)
        lines.push(' You used no wishes.');
    else {
        const wishes = conduct.wishes;
        const artifacts = conduct.wisharti ?? 0;
        let text = ` You used ${wishes} wish${wishes === 1 ? '' : 'es'}`;
        if (artifacts) {
            const count = artifacts !== wishes ? `${artifacts} `
                : artifacts > 2 ? 'all ' : artifacts === 2 ? 'both ' : '';
            text += ` (${count}for ${artifacts === 1 ? 'an artifact' : 'artifacts'})`;
        }
        lines.push(`${text}.`);
        if (!artifacts)
            lines.push(' You did not wish for any artifacts.');
    }
    if (achievementEntries(game).includes(ACH_SOKO)) {
        const cheated = conduct.sokocheat ?? 0;
        lines.push(cheated
            ? ` You violated the special Sokoban rules ${killedCountPhrase(cheated)}.`
            : ' You did not violate any of the special Sokoban rules.');
    }
    lines.push(...finalAchievementLines());
    return lines;
}
function finalAchievementLines() {
    let entries = achievementEntries(game);
    if (!entries.length)
        return [];
    if (entries.includes(ACH_UWIN)) {
        entries = entries.filter(entry => entry !== ACH_AMUL && entry !== ACH_UWIN);
        if (achievementEntries(game).includes(ACH_AMUL))
            entries.push(ACH_AMUL);
        entries.push(ACH_UWIN);
        game.u.uachieved = entries;
    }
    const actions = new Map([
        [ACH_BLND, 'explored without being able to see'], [ACH_NUDE, 'went without any armor'],
        [ACH_MINE, 'entered the Gnomish Mines'], [ACH_TOWN, 'entered Minetown'],
        [ACH_SHOP, 'entered a shop'], [ACH_TMPL, 'entered a temple'],
        [ACH_ORCL, 'consulted the Oracle of Delphi'], [ACH_NOVL, 'read from a Discworld novel'],
        [ACH_SOKO, 'entered Sokoban'], [ACH_SOKO_PRIZE, 'completed Sokoban'],
        [ACH_MINE_PRIZE, 'completed the Gnomish Mines'], [ACH_BGRM, 'entered the Big Room'],
        [ACH_MEDU, 'defeated Medusa'], [ACH_TUNE, "learned the tune to open and close the Castle's drawbridge"],
        [ACH_BELL, `${game.u.uhave?.bell ? 'had' : 'handled'} the Bell of Opening`],
        [ACH_HELL, 'entered Gehennom'],
        [ACH_CNDL, `${game.u.uhave?.menorah ? 'had' : 'handled'} the Candelabrum of Invocation`],
        [ACH_BOOK, `${game.u.uhave?.book ? 'had' : 'handled'} the Book of the Dead`],
        [ACH_INVK, "gained access to Moloch's Sanctum"],
        [ACH_AMUL, `${game.u.uevent?.ascended ? 'delivered' : game.u.uhave?.amulet ? 'had' : 'had obtained'} the Amulet of Yendor`],
        [ACH_ENDG, 'reached the Elemental Planes'], [ACH_ASTR, 'reached the Astral Plane'],
    ]);
    const lines = ['', `Achievement${entries.length === 1 ? '' : 's'}:`];
    for (const entry of entries) {
        const identity = Math.abs(entry);
        if (identity === ACH_UWIN) {
            lines.push(' You ascended!');
        }
        else if (identity >= ACH_RNK1 && identity <= ACH_RNK8) {
            const rank = game.urole?.title?.[identity - ACH_RNK1 + 1];
            const title = (entry < 0 ? rank?.f : rank?.m) || rank?.m || 'Adventurer';
            lines.push(` You attained the rank of ${title}.`);
        }
        else {
            const action = actions.get(identity);
            lines.push(action ? ` You ${action}.` : ` [Unexpected achievement #${entry}.]`);
        }
    }
    return lines;
}
//# sourceMappingURL=insight.js.map