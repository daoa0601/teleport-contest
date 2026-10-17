import { fromWhat, heroHasNoEyes, intrinsicPropertyMask } from './attribute_provenance.js';
import { levitationAtWill, propertyTimeout } from './properties.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel } from './terrain_properties.js';
import { formatFeltMessage } from './hero_speech.js';
// insight.js — Basic enlightenment / attributes command.
// C ref: insight.c — doattributes(), enlightenment().
import { heroIsHallucinating } from './senses.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { game } from './gstate.js';
import { bot, docrt, flushPendingTopline, flush_screen, pline, } from './display.js';
import { showDisclosureOverlay, showTextPages } from './windows.js';
import { A_WIS, G_GENOD, FROMFORM, FROMOUTSIDE, Upolyd, ACH_AMUL, ACH_ASTR, ACH_BELL, ACH_BGRM, ACH_BLND, ACH_BOOK, ACH_CNDL, ACH_ENDG, ACH_INVK, ACH_MEDU, ACH_MINE_PRIZE, ACH_NOVL, ACH_NUDE, ACH_ORCL, ACH_SHOP, ACH_SOKO, ACH_SOKO_PRIZE, ACH_TMPL, ACH_TUNE, ACH_UWIN, } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { simpleArmorName } from './armor.js';
import { attributeEnlightenmentLines, contractEnlightenment, combatIncrement, monkArmorPenalty } from './enlightenment_attributes.js';
export { piousness } from './enlightenment_attributes.js';
import { backgroundEnlightenmentLines, basicsEnlightenmentLines, characteristicEnlightenmentLines, enlightenmentRoleName, } from './enlightenment_background.js';
export { goldInsightLines } from './enlightenment_background.js';
import { invWeight, nearCapacity } from './weight.js';
import { ACH_HELL, ACH_MINE, ACH_RNK1, ACH_RNK8, ACH_TOWN, achievementEntries, } from './achievements.js';
import { OBJECT_SUBTYPE, requireObjectData } from './object_data.js';
import { ensureHeroSkills, SKILL_LEVEL_NAMES, SKILL_NAMES, } from './skills.js';
import { blindfolded, heroIsBlind, heroIsDeaf, permanentBlind, } from './senses.js';
function plural(n, singular, pluralForm = `${singular}s`) {
    return n === 1 ? singular : pluralForm;
}
// C ref: insight.c status_enlightenment().  These rows are a projection of
// live trouble/nutrition/load state; their optional length determines every
// section that follows on the second attributes page.
function statusEnlightenmentLines(magic = false, final = 0) {
    const u = game.u;
    const lines = [];
    const are = (what, suffix = '') => lines.push(contractEnlightenment(`  You ${final ? 'were' : 'are'} ${what}${suffix}.`));
    const have = (what) => lines.push(`  You ${final ? 'had' : 'have'} ${what}.`);
    if (Upolyd(u))
        are('transformed');
    if (u.levitating)
        are(magic && levitationAtWill() ? 'levitating, at will' : 'levitating', magic && levitationAtWill() ? '' : fromWhat('levitation'));
    else if (u.flying)
        are('flying', fromWhat('flying'));
    if (u.uinwater)
        are('underwater');
    else if (u.uinwater)
        are(u.swimming ? 'swimming' : 'in water', fromWhat('swimming'));
    else if (u.waterWalking && !levelIsWaterLevel() && !u.levitating && !u.flying && (isPoolAt(u.ux, u.uy) || isLavaAt(u.ux, u.uy)))
        are(`walking on ${isPoolAt(u.ux, u.uy) ? 'water' : 'lava'}`, fromWhat('waterWalking'));
    if ((u.stonedTurns ?? 0) > 0)
        are('turning to stone');
    if ((u.slimedTurns ?? 0) > 0)
        are('turning into slime');
    if (u.strangled || (u.strangledTurns ?? 0) > 0) {
        const timeout = game.flags.debug ? ` (${u.strangledTurns ?? 0})` : '';
        are(u.uburied ? 'buried' : `being strangled${timeout}`, u.uburied ? '' : fromWhat('strangled'));
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
        const timer = game.flags.debug && intrinsic === propertyTimeout('blinded') && !blindfolded()
            ? ` (${propertyTimeout('blinded')})` : '';
        are(`${kind} blind${timer}`, heroHasNoEyes() ? '' : fromWhat('blinded'));
    }
    if (heroIsDeaf(game))
        are('deaf', fromWhat('deaf'));
    if (u.punished || game.uball && game.uchain)
        are('chained to a heavy iron ball');
    if ((u._woundedLegTurns ?? 0) > 0 && u._woundedLegSide) {
        const side = u._woundedLegSide;
        have(side === 'both' ? 'wounded legs' : `a wounded ${side} leg`);
    }
    const knownCause = (property) => (u._propertySources?.[property]?.worn ?? [])
        .some(source => {
        const object = game[source.slot];
        return object?.dknown && game._knownObjectTypes?.has(object.otyp);
    });
    if ((u.fumbling || propertyTimeout('fumbling')) && (magic || knownCause('fumbling')))
        lines.push(`  You ${final ? 'fumbled' : 'fumble'}${fromWhat('fumbling')}.`);
    if ((u.sleepy || propertyTimeout('sleepy')) && (magic || knownCause('sleepy')))
        lines.push(`  You ${final ? 'fell' : 'fall'} asleep uncontrollably${fromWhat('sleepy')}${game.flags.debug ? ` (${propertyTimeout('sleepy')})` : ''}.`);
    if ((u.hunger || propertyTimeout('hunger')) && (magic || knownCause('hunger')))
        lines.push(`  You ${final ? 'hungered' : 'hunger'} rapidly${fromWhat('hunger')}.`);
    const hunger = u.uhunger ?? 900;
    const hungerText = hunger > 1000 ? 'satiated' : hunger > 150 ? 'not hungry' : hunger > 50 ? 'hungry'
        : hunger > 0 ? 'weak from severe hunger' : 'fainting due to starvation';
    are(`${hungerText}${game.flags.debug ? ` <${hunger}>` : ''}`);
    const capacity = nearCapacity(game);
    const encumbrance = ['unencumbered', 'burdened', 'stressed', 'strained', 'overtaxed', 'overloaded'][capacity] ?? 'unencumbered';
    const degree = ['', 'slightly', 'moderately', 'very', 'extremely', 'not possible'][capacity] ?? '';
    are(`${encumbrance}${game.flags.debug ? ` <${invWeight(game)}>` : ''}${capacity
        ? `; movement ${final ? 'was' : 'is'} ${degree}${capacity < 5 ? ' slowed' : ''}` : ''}`);
    return lines;
}
const OBJECT_CLASS_NOUN = Object.freeze({
    1: 'strange object', 2: 'weapon', 3: 'armor', 4: 'ring', 5: 'amulet',
    6: 'tool', 7: 'food', 8: 'potion', 9: 'scroll', 10: 'spellbook',
    11: 'wand', 12: 'coin', 13: 'gem', 14: 'large rock',
    15: 'iron ball', 16: 'iron chain', 17: 'venom',
});
// C ref: insight.c:weapon_insight() -> weapon.c:weapon_descr().  A wielded
// non-weapon is described by object class and has no skill row because
// weapon_type() returns P_NONE.
function weaponInsightLines(final = 0) {
    const are = final ? 'were' : 'are';
    const have = final ? 'had' : 'have';
    if (game.u?.twoweap) {
        return [
            `  You ${are} wielding two weapons at once.`,
            `  Your skill in long sword ${final ? 'was' : 'is'} limited by being unskilled with two weapons.`,
            `  Your skill in short sword ${final ? 'was' : 'is'} also limited by being unskilled with two weapons`,
        ];
    }
    if (!game.uwep) {
        return game.urole?.key === 'monk'
            ? [`  You ${are} empty handed.`, `  You ${have} basic skill with martial arts.`]
            : [`  You ${are} bare handed.`, `  You ${are} unskilled in bare handed combat.`];
    }
    if (game.uwep.oclass !== 2 && game.uwep.oclass !== 6) {
        const what = OBJECT_CLASS_NOUN[game.uwep.oclass] || 'object';
        const quantity = game.uwep.quan ?? game.uwep.quantity ?? 1;
        return [`  You ${are} wielding ${quantity === 1
                ? withIndefiniteArticle(what) : `${quantity} ${plural(quantity, what)}`}.`];
    }
    // weapon.c:weapon_descr() normally projects the P_* skill name rather
    // than the object's material/base name: silver saber is simply "saber",
    // and katana is "long sword". OBJECT_SUBTYPE supplies the special
    // mattock, hook, and aklys labels.
    const weaponType = requireObjectData(OBJECT_SUBTYPE, game.uwep.otyp);
    const weaponSkill = SKILL_NAMES[weaponType]
        || wieldedWeaponName(game.uwep).replace(/^(?:orcish|elven|dwarvish|silver) /, '');
    const lines = [
        `  You ${are} wielding ${withIndefiniteArticle(weaponSkill)}.`,
    ];
    const skillLevel = ensureHeroSkills(game)?.[weaponType]?.skill;
    if (skillLevel === undefined || !Number.isInteger(skillLevel))
        return lines;
    const skillName = SKILL_LEVEL_NAMES[skillLevel];
    if (skillName === undefined)
        throw new RangeError(`Unknown weapon proficiency ${skillLevel}`);
    const levelName = skillLevel === 0 ? 'no' : skillName.toLowerCase();
    const usesHave = skillLevel !== 1 && skillLevel !== 3;
    lines.push(usesHave
        ? `  You ${have} ${levelName} skill with ${weaponSkill}.`
        : `  You ${are} ${levelName} in ${weaponSkill}.`);
    return lines;
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
function wieldedWeaponName(object) {
    if (object.name === undefined)
        throw new Error(`Wielded object ${object.o_id} has no presentation name`);
    return object.name;
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
    lines.push('', ' Miscellaneous:');
    if (basic && (game.flags?.debug || game.flags?.explore)) {
        lines.push(`  You are running in ${game.flags?.debug
            ? 'debug' : 'explore'} mode.`);
        lines.push("  You haven't encountered any bones levels.");
    }
    lines.push('  Total elapsed playing time is none.');
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
function finalAttributePages(final) {
    const lines = [
        ` ${game.displayName || game.plname} the ${enlightenmentRoleName()}'s attributes:`,
        ...backgroundEnlightenmentLines(final),
        ...basicsEnlightenmentLines(final),
        ...characteristicEnlightenmentLines(true, final),
        '', ' Final Status:', ...statusEnlightenmentLines(true, final),
        ...statusEquipmentLines(final),
    ];
    lines.push(...attributeEnlightenmentLines(final), '', ' Miscellaneous:');
    if (game.flags.debug || game.flags.explore)
        lines.push(`  You were running in ${game.flags.debug ? 'debug' : 'explore'} mode.`);
    lines.push(game._bonesEncountered ? '  You encountered a bones level.' : "  You didn't encounter any bones levels.", '  Total elapsed playing time was none.');
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
export async function showFinalAttributes(survived = false) {
    return showTextPages(finalAttributePages(survived ? 1 : 2), {
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