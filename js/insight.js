// insight.js — Basic enlightenment / attributes command.
// C ref: insight.c — doattributes(), enlightenment().

import { game } from './gstate.js';
import { bot, docrtRecalc, flush_screen, formatStrength } from './display.js';
import { showDisclosureOverlay, showTextPages } from './windows.js';
import { In_endgame } from './const.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { currentAttribute } from './attrib.js';
import { heroIsDisplaced, magicNegation } from './armor.js';
import { invWeight, nearCapacity } from './weight.js';
import {
    ACH_HELL, ACH_MINE, ACH_RNK1, ACH_RNK8, ACH_TOWN,
    achievementEntries,
} from './achievements.js';
import { artifactById } from './artifacts.js';
import { OBJECT_NAMES, OBJECT_SUBTYPE } from './object_data.js';
import {
    ensureHeroSkills, SKILL_LEVEL_NAMES, SKILL_NAMES,
} from './skills.js';
import { hiddenGold } from './gold.js';
import { heroGoldAmount } from './hero_gold.js';
import {
    blindfolded, heroIsBlind, heroIsDeaf, permanentBlind,
} from './senses.js';

function alignmentName(value) {
    return value > 0 ? 'lawful' : value < 0 ? 'chaotic' : 'neutral';
}

function plural(n, singular, pluralForm = `${singular}s`) {
    return n === 1 ? singular : pluralForm;
}

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function nextExperienceLevel(level) {
    if (level < 1) return 0;
    if (level < 10) return 10 * (2 ** level);
    if (level < 20) return 10000 * (2 ** (level - 10));
    return 10000000 * (level - 19);
}

export function goldInsightLines(final, indent = '  ') {
    const purse = heroGoldAmount(game);
    const stashed = hiddenGold(game, final);
    let wallet = purse
        ? `Your wallet ${final ? 'contained' : 'contains'} ${purse} zorkmid${
            purse === 1 ? '' : 's'}`
        : `Your wallet ${final ? 'was' : 'is'} empty`;
    wallet += stashed ? purse ? ', and' : ', but' : '.';
    const lines = [`${indent}${wallet}`];
    if (stashed) {
        lines.push(`${indent}you ${final ? 'had' : 'have'} ${stashed} ${
            purse ? 'more' : `zorkmid${stashed === 1 ? '' : 's'}`
        } stashed away in your pack.`);
    }
    return lines;
}

function piousness(record) {
    return record >= 20 ? 'piously' : record > 13 ? 'devoutly'
        : record > 8 ? 'fervently' : record > 3 ? 'stridently'
        : record === 3 ? '' : record > 0 ? 'haltingly'
        : record === 0 ? 'nominally' : record >= -3 ? 'strayed'
        : record >= -8 ? 'sinned' : 'transgressed';
}

// C ref: insight.c status_enlightenment().  These rows are a projection of
// live trouble/nutrition/load state; their optional length determines every
// section that follows on the second attributes page.
function statusEnlightenmentLines() {
    const u = game.u;
    const lines = [];
    if (u.hallucinating || (u.hallucinationTurns ?? 0) > 0)
        lines.push('  You are hallucinating.');
    if (heroIsBlind(game)) {
        const kind = permanentBlind(game) ? 'permanently'
            : blindfolded(game) ? 'deliberately' : 'temporarily';
        lines.push(`  You are ${kind} blind.`);
    }
    if (game._statusDeafOverride ?? heroIsDeaf(game))
        lines.push('  You are deaf.');
    if (u.punished || (game.uball && game.uchain))
        lines.push('  You are chained to a heavy iron ball.');
    if ((u._woundedLegTurns ?? 0) > 0 && u._woundedLegSide) {
        const side = u._woundedLegSide;
        lines.push(side === 'both'
            ? '  You have wounded legs.'
            : `  You have a wounded ${side} leg.`);
    }

    const hunger = u.uhunger ?? 900;
    const rawHunger = game.flags?.debug ? ` <${hunger}>` : '';
    if (hunger > 150 && hunger <= 1000)
        lines.push(`  You aren't hungry${rawHunger}.`);
    else {
        const hungerText = hunger > 1000 ? 'satiated'
            : hunger > 50 ? 'hungry'
                : hunger > 0 ? 'weak from severe hunger'
                    : 'fainting due to starvation';
        lines.push(`  You are ${hungerText}${rawHunger}.`);
    }

    const capacity = nearCapacity(game);
    const encumbrance = [
        'unencumbered',
        'burdened; movement is slightly slowed',
        'stressed; movement is moderately slowed',
        'strained; movement is very slowed',
        'overtaxed; movement is extremely slowed',
        'overloaded; movement is not possible',
    ][capacity] || 'unencumbered';
    const rawWeight = game.flags?.debug
        ? ` <${invWeight(game)}>` : '';
    const separator = capacity > 0 ? encumbrance.indexOf(';') : encumbrance.length;
    lines.push(`  You are ${encumbrance.slice(0, separator)}${rawWeight}${
        encumbrance.slice(separator)}.`);
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
function weaponInsightLines() {
    if (game.u?.twoweap) {
        return [
            '  You are wielding two weapons at once.',
            '  Your skill in long sword is limited by being unskilled with two weapons.',
            '  Your skill in short sword is also limited by being unskilled with two weapons',
        ];
    }
    if (!game.uwep) {
        return game.urole?.key === 'monk'
            ? ['  You are empty handed.', '  You have basic skill with martial arts.']
            : ['  You are bare handed.', '  You are unskilled in bare handed combat.'];
    }

    if (game.uwep.oclass !== 2 && game.uwep.oclass !== 6) {
        const what = OBJECT_CLASS_NOUN[game.uwep.oclass] || 'object';
        const quantity = game.uwep.quan ?? game.uwep.quantity ?? 1;
        return [`  You are wielding ${quantity === 1
            ? `${indefiniteArticle(what)} ${what}` : `${quantity} ${plural(quantity, what)}`}.`];
    }

    // weapon.c:weapon_descr() normally projects the P_* skill name rather
    // than the object's material/base name: silver saber is simply "saber",
    // and katana is "long sword".  The special mattock/hook/aklys labels are
    // retained by OBJECT_SUBTYPE as their witnessed slices are ported.
    const weaponType = OBJECT_SUBTYPE[game.uwep.otyp];
    const weaponSkill = SKILL_NAMES[weaponType]
        || game.uwep.name.replace(/^(?:orcish|elven|dwarvish|silver) /, '');
    const lines = [
        `  You are wielding ${indefiniteArticle(weaponSkill)} ${weaponSkill}.`,
    ];
    const skillLevel = ensureHeroSkills(game)?.[weaponType]?.skill;
    if (!Number.isInteger(skillLevel)) return lines;
    const levelName = skillLevel === 0
        ? 'no' : SKILL_LEVEL_NAMES[skillLevel].toLowerCase();
    const usesHave = skillLevel !== 1 && skillLevel !== 3;
    lines.push(usesHave
        ? `  You have ${levelName} skill with ${weaponSkill}.`
        : `  You are ${levelName} in ${weaponSkill}.`);
    return lines;
}

function wornItemName(object, fallback) {
    return object?.name || fallback;
}

function dragonItemProtectionName(object) {
    const name = object?.name || '';
    if (name.includes('dragon scale mail')) return 'dragon mail';
    if (name.includes('dragon scales')) return 'dragon scales';
    return name || 'worn equipment';
}

// Supported slice of insight.c:attributes_enlightenment(), kept in source
// order.  Effective properties and their provenance come from adjabil(),
// worn armor, and worn accessories rather than from report-specific flags.
function liveAttributePropertyLines() {
    const u = game.u;
    const lines = [];
    const sources = u._propertySources || {};

    if (u.antimagic || u.magicProtection) {
        const source = sources.antimagic;
        const object = source?.kind === 'worn'
            ? game[source.slot] || game.uarm : null;
        const suffix = object
            ? ` because of your ${wornItemName(object, 'worn equipment')}` : '';
        lines.push(`  You are magic-protected${suffix}.`);
    }

    if (u.fire_resistance || u.fireResistance) {
        const suffix = sources.fire_resistance === 'experience'
            ? ' because of your experience' : '';
        lines.push(`  You are fire resistant${suffix}.`);
    }

    const shockArmor = (u.shockResistanceFromArmor
        || u.shock_resistanceFromArmor) ? game.uarm : null;
    if (u.shockResistance || u.shock_resistance) {
        const suffix = shockArmor
            ? ` because of your ${wornItemName(shockArmor, 'worn equipment')}`
            : sources.shock_resistance === 'experience'
                ? ' because of your experience' : '';
        lines.push(`  You are shock resistant${suffix}.`);
    }
    if (shockArmor) {
        lines.push(`  Your items are protected from electric shocks by your ${
            dragonItemProtectionName(shockArmor)}.`);
    }
    if (u.poisonResistance || u.poison_resistance) {
        const source = sources.poison_resistance;
        const suffix = source === 'experience'
            ? ' because of your experience'
            : source?.kind === 'worn'
                ? ` because of your ${
                    wornItemName(game[source.slot], 'worn equipment')
                }`
                : ' innately';
        lines.push(`  You are poison resistant${suffix}.`);
    }

    const wieldedArtifact = artifactById(game.uwep?.oartifact);
    if (wieldedArtifact?.wieldedProperties
        ?.includes('hallucinationResistance')) {
        lines.push(`  You resist hallucinations because of ${
            wieldedArtifact.name}.`);
    }

    if (game.uamul?.otyp === 201) {
        lines.push(`  You are telepathic because of your ${
            wornItemName(game.uamul, 'amulet')}.`);
    }
    if (u.warning) {
        const suffix = sources.warning === 'experience'
            ? ' because of your experience' : '';
        lines.push(`  You are warned${suffix}.`);
    }
    if (heroIsDisplaced(game)) {
        const cloak = game.uarmc || u.uarmc;
        const suffix = cloak
            ? ` because of your ${
                OBJECT_NAMES[cloak.otyp]
                    || wornItemName(cloak, 'cloak of displacement')
            }` : '';
        lines.push(`  You are displaced${suffix}.`);
    }
    if (u.searching) {
        const suffix = sources.searching === 'experience'
            ? ' because of your experience'
            : sources.searching?.kind === 'worn'
                ? ` because of your ${
                    wornItemName(game[sources.searching.slot], 'worn equipment')
                }`
                : ' innately';
        lines.push(`  You have automatic searching${suffix}.`);
    }
    if (u.stealth) {
        const suffix = sources.stealth === 'experience'
            ? ' because of your experience'
            : sources.stealth?.kind === 'worn'
                ? ` because of your ${
                    wornItemName(game[sources.stealth.slot], 'worn equipment')
                }`
                : ' innately';
        lines.push(`  You are stealthy${suffix}.`);
    }
    if (u.jumping) {
        const suffix = sources.jumping === 'experience'
            ? ' because of your experience'
            : u.extrinsicJumping ? ''
                : ' intrinsically';
        lines.push(`  You can jump${suffix}.`);
    }
    const teleportRing = game.uright || u.uright;
    if (u.teleport_control || u.teleportControl
        || teleportRing?.otyp === 195) {
        const suffix = sources.teleport_control === 'experience'
            ? ' because of your experience'
            : teleportRing?.otyp === 195
                ? ` because of your ${teleportRing.name}` : '';
        lines.push(`  You have teleport control${suffix}.`);
    }
    const armorCancellation = magicNegation(game);
    if (armorCancellation) {
        lines.push(`  You are ${['', 'warded', 'guarded', 'protected'][
            Math.min(3, armorCancellation)]}.`);
    }
    if (u.fast || u.veryFast) {
        const speed = u.veryFast ? 'very fast' : 'fast';
        const speedBoots = game.uarmf || u.uarmf;
        const nameKnown = game._knownObjectTypes?.has(speedBoots?.otyp);
        const namedSpeedBoots = speedBoots?._grantsVeryFastFromArmor
            && speedBoots.dknown && nameKnown
            ? speedBoots : null;
        const suffix = namedSpeedBoots
            ? ` because of your ${
                OBJECT_NAMES[namedSpeedBoots.otyp]
                    || wornItemName(namedSpeedBoots, 'worn equipment')
            }`
            : u.veryFastFromArmor || u.fastFromArmor
                ? ' because of worn equipment'
            : sources.fast === 'experience'
                ? ' because of your experience' : '';
        lines.push(`  You are ${speed}${suffix}.`);
    }
    if (u.reflection) {
        const source = sources.reflection;
        const object = source?.kind === 'worn'
            ? game[source.slot] || game.uarm : null;
        const suffix = object
            ? ` because of your ${wornItemName(object, 'worn equipment')}`
            : source === 'experience' ? ' because of your experience' : '';
        lines.push(`  You have reflection${suffix}.`);
    }
    if (game.uamul?.otyp === 202 || u.lifeSaving || u.lifesaved)
        lines.push('  Your life will be saved.');
    const luck = u.uluck ?? u.luck ?? 0;
    if (luck) {
        const amount = Math.abs(luck);
        const degree = amount >= 10 ? 'extremely '
            : amount >= 5 ? 'very ' : '';
        lines.push(`  You are ${degree}${luck < 0 ? 'un' : ''}lucky${
            game.flags?.debug ? ` (${luck})` : ''}.`);
    } else if (game.flags?.debug) {
        lines.push('  Your luck is zero.');
    }
    return lines;
}

function characteristicLine(index) {
    const u = game.u;
    const names = [
        'strength', 'dexterity', 'constitution',
        'intelligence', 'wisdom', 'charisma',
    ];
    const rawCurrent = u.acurr?.a?.[index] ?? 0;
    const current = currentAttribute(index, game);
    // ABASE is still implicit in older saves.  Wounded legs are the current
    // temporary ACURR-only mutation exercised here; permanent exercise and
    // poison changes already leave current equal to their live base.
    const woundedDexterity = index === 1
        && (u._woundedLegTurns ?? 0) > 0 && u._woundedLegSide;
    const base = u.abase?.a?.[index]
        ?? (woundedDexterity ? rawCurrent + 1 : rawCurrent);
    const peak = u.amax?.a?.[index] ?? base;
    const internalIndex = [0, 3, 4, 1, 2, 5][index];
    const limit = game.urace?.attrmax?.[internalIndex];
    const humanLimit = [118, 18, 18, 18, 18, 18][internalIndex];
    const showLimit = limit != null && limit !== humanLimit;
    const format = value => index === 0 ? formatStrength(value) : value;
    const details = [];
    if (current !== base) details.push(`base:${format(base)}`);
    if (base !== peak) details.push(`peak:${format(peak)}`);
    if (showLimit) details.push(`limit:${format(limit)}`);
    const annotation = details.length
        ? ` (current; ${details.join(', ')})` : '';
    return `  Your ${names[index]} is ${format(current)}${annotation}.`;
}

function killedCountPhrase(count) {
    if (count === 1) return 'once';
    if (count === 2) return 'twice';
    if (count === 3) return 'thrice';
    return `${count} times`;
}

function rerollConductLine() {
    const roleplay = game.u?.uroleplay || {};
    if (!roleplay.reroll)
        return ' Character rerolling was not enabled.';
    if (!(roleplay.numrerolls || 0))
        return ' Your character was not rerolled.';
    return ` Your character was rerolled ${
        killedCountPhrase(roleplay.numrerolls)}.`;
}

function paginateAttributeLines(lines) {
    const contentRows = 23;
    const count = Math.ceil(lines.length / contentRows);
    const pages = [];
    for (let index = 0; index < count; index++) {
        const pageLines = lines.slice(
            index * contentRows, (index + 1) * contentRows,
        );
        pageLines.push(` (${index + 1} of ${count})`);
        pages.push({
            lines: pageLines,
            cursor: [9, pageLines.length - 1],
        });
    }
    return pages;
}

// C insight.c:enlightenment() emits one ordered text stream.  tty, rather
// than the calendar flags or individual sections, owns pagination.  Keeping
// the stream intact makes optional status/property rows move every following
// boundary exactly as they do in the original.
function attributePages() {
    const u = game.u;
    const roleName = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const rank = (game.flags?.female && game.urole?.rank?.f)
        || game.urole?.rank?.m || roleName;
    const gender = game.flags?.female ? 'female' : 'male';
    const race = game.urace?.adj || game.urace?.noun || 'human';
    const raceNoun = game.urace?.noun || race;
    const align = alignmentName(u.ualign?.type || 0);
    const gods = game.urole?.gods || {
        lawful: 'a lawful god',
        neutral: 'a neutral god',
        chaotic: 'a chaotic god',
    };
    const currentGod = gods[align];
    const opponents = Object.entries(gods)
        .filter(([key]) => key !== align)
        .map(([key, name]) => `${name} (${key})`);
    const dungeonName = game.dungeons?.[u.uz?.dnum || 0]?.dname
        || 'the dungeon';
    const displayedDungeonName = dungeonName.replace(/^The\b/, 'the');
    const displayedDepth = /\bQuest\b/i.test(dungeonName)
        ? u.uz?.dlevel : dungeonDepth(u.uz);
    const elapsedTurns = game.moves || 1;
    const entered = elapsedTurns === 1
        ? '  You have just started your adventure.'
        : `  You entered the dungeon ${elapsedTurns} ${
            plural(elapsedTurns, 'turn')} ago.`;
    const lines = [
        ` ${game.displayName || game.plname} the ${roleName}'s attributes:`,
        '',
        ' Background:',
    ];

    const rankMatchesRole = rank.localeCompare(
        roleName, undefined, { sensitivity: 'accent' },
    ) === 0;
    if (rankMatchesRole) {
        const roleHasGenderedName = !!game.urole?.name?.f
            && game.urole.name.f !== game.urole.name.m;
        const genderPrefix = roleHasGenderedName ? '' : `${gender} `;
        lines.push(`  You are ${indefiniteArticle(rank)} ${rank}, level ${
            u.ulevel} ${genderPrefix}${raceNoun}.`);
    } else {
        const identity = ['caveman', 'priest', 'valkyrie']
            .includes(game.urole?.key)
            ? `${race} ${roleName}` : `${gender} ${race} ${roleName}`;
        lines.push(`  You are ${indefiniteArticle(rank)} ${rank}, a level ${
            u.ulevel} ${identity}.`);
    }
    const location = In_endgame(u.uz)
        ? `  You are in the endgame, on the ${
            endgameLevelName(u.uz).startsWith('Plane')
                ? 'Elemental ' : ''
        }${endgameLevelName(u.uz)}.`
        : `  You are in ${displayedDungeonName}, on level ${
            displayedDepth}.`;
    lines.push(
        `  You are ${align}, on a mission for ${currentGod}`,
        `  who is opposed by ${opponents[0]} and ${opponents[1]}.`,
        `  You are ${u.rightHanded ? 'right' : 'left'}-handed.`,
        location,
        entered,
    );
    if (game.flags?.moonphase === 4)
        lines.push('  There is a full moon in effect.');
    else if (game.flags?.moonphase === 0)
        lines.push('  There is a new moon in effect.');
    if (game.flags?.friday13)
        lines.push('  Bad things can happen on Friday the 13th.');

    const experience = u.uexp || 0;
    const needed = nextExperienceLevel(u.ulevel) - experience;
    const experienceDetail = game.flags?.debug && u.ulevel < 30
        ? `, ${needed}${experience > 0 ? ' more' : ''} needed ${
            u.ulevel < 18 ? 'to attain' : 'for'} level ${u.ulevel + 1}`
        : '';
    lines.push(
        `  You have ${experience} experience ${
            plural(experience, 'point')}${experienceDetail}.`,
        '',
        ' Basics:',
        u.uhp === u.uhpmax && u.uhpmax > 1
            ? `  You have all ${u.uhp} hit points.`
            : `  You have ${u.uhp} out of ${u.uhpmax} hit points.`,
        u.uenmax === 0
            ? '  You have no energy points (spell power).'
            : u.uen === u.uenmax
                ? `  You have ${u.uen === 2 ? 'both' : `all ${u.uen}`
                } energy points (spell power).`
                : `  You have ${u.uen} out of ${u.uenmax
                } energy points (spell power).`,
        `  Your armor class is ${u.uac}.`,
        ...goldInsightLines(false),
        game.flags?.pickup && game.flags?.pickup_types
            ? `  Autopickup is on for '${game.flags.pickup_types}' plus thrown.`
            : `  Autopickup is ${game.flags?.pickup ? 'on' : 'off'}.`,
        '',
        ' Characteristics:',
    );
    for (let index = 0; index < 6; index++)
        lines.push(characteristicLine(index));

    lines.push('', ' Status:', ...statusEnlightenmentLines());
    lines.push(...weaponInsightLines());
    const armorSlots = [
        game.uarm, game.uarmu, game.uarmc, game.uarms,
        game.uarmg, game.uarmf, game.uarmh,
    ];
    if (!armorSlots.some(Boolean))
        lines.push("  You aren't wearing any armor.");

    if (game.flags?.debug || game.flags?.explore) {
        lines.push('', ' Attributes:');
        const record = u.ualign?.record || 0;
        const piety = piousness(record);
        lines.push(record >= 0
            ? `  You are ${piety ? `${piety} ` : ''}aligned.`
            : `  You have ${piety}.`);
        if (game.flags?.debug)
            lines.push(`  Your alignment is ${record}.`);
        lines.push(...liveAttributePropertyLines());
        if (game.uarmc?.otyp === 148)
            lines.push('  You are magic-protected because of your cloak of magic resistance.');
        lines.push(`  You can't safely pray${game.flags?.debug
            ? ` (${u.ublesscnt || 0})` : ''}.`);
        if ((u.umortality ?? 0) > 0) {
            lines.push(`  You have been killed ${
                killedCountPhrase(u.umortality)}.`);
        }
    }

    lines.push('', ' Miscellaneous:');
    if (game.flags?.debug || game.flags?.explore) {
        lines.push(`  You are running in ${game.flags?.debug
            ? 'debug' : 'explore'} mode.`);
        lines.push("  You haven't encountered any bones levels.");
    }
    lines.push('  Total elapsed playing time is none.');
    return paginateAttributeLines(lines);
}

export async function doattributes() {
    await showTextPages(attributePages(), { validKeys: [27, 32, 10, 13] });
    // Full-screen NHW_TEXT destruction restores memory, sight, and fmon.
    await docrtRecalc();
    await bot();
    await flush_screen(1);
    game.context.move = 0;
}

function finalAttributeLimit(displayIndex) {
    const internalIndex = [0, 3, 4, 1, 2, 5][displayIndex];
    const limit = game.urace?.attrmax?.[internalIndex]
        ?? [118, 18, 18, 18, 18, 18][internalIndex];
    return displayIndex === 0 ? formatStrength(limit) : limit;
}

function finalAttributePages() {
    const u = game.u;
    const roleName = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const rank = game.urole?.rank?.m || roleName;
    const gender = game.flags?.female ? 'female' : 'male';
    const race = game.urace?.adj || game.urace?.noun || 'human';
    const align = alignmentName(u.ualign?.type || 0);
    const gods = game.urole?.gods || {
        lawful: 'a lawful god', neutral: 'a neutral god', chaotic: 'a chaotic god',
    };
    const opponents = Object.entries(gods)
        .filter(([key]) => key !== align)
        .map(([key, name]) => `${name} (${key})`);
    const dungeonName = (game.dungeons?.[u.uz?.dnum || 0]?.dname
        || 'The Dungeons of Doom').replace(/^The\b/, 'the');
    const sourceTurn = game._statusTurnOverride ?? game._maintenanceMove
        ?? game.moves ?? 1;
    const stats = u.acurr?.a || [];
    const hour = Number(String(game.datetime || '').slice(8, 10));
    const nighttime = Number.isFinite(hour) && (hour < 6 || hour >= 22);
    const weaponName = game.uwep?.name || 'weapon';
    const weaponSkill = weaponName === 'scalpel' ? 'knife'
        : weaponName.replace(/^(?:orcish|elven|dwarvish) /, '');

    // Existing ordinary-death witnesses use the fixed two-page tty layout
    // below.  Tutorial disclosure has a shorter source stream (no calendar
    // records) and is compacted by tty, so it takes the dense path afterward.
    if (!game._tutorialActive) {
        const page1 = Array(24).fill('');
        page1[0] = `${game.displayName || game.plname} the ${roleName}'s attributes:`;
        page1[2] = 'Background:';
        page1[3] = ` You were ${indefiniteArticle(rank)} ${rank}, a level ${u.ulevel} ${gender} ${race} ${roleName}.`;
        page1[4] = ` You were ${align}, on a mission for ${gods[align]}`;
        page1[5] = ` who was opposed by ${opponents[0]} and ${opponents[1]}.`;
        page1[6] = ` You were ${u.rightHanded ? 'right' : 'left'}-handed.`;
        page1[7] = ` You were in ${dungeonName}, on level ${dungeonDepth(u.uz)}.`;
        page1[8] = ` You entered the dungeon ${sourceTurn} ${plural(sourceTurn, 'turn')} ago.`;
        if (nighttime) page1[9] = ' It was nighttime.';
        if (game.flags?.moonphase === 4)
            page1[10] = ' There was a full moon in effect when your adventure ended.';
        else if (game.flags?.moonphase === 0)
            page1[10] = ' There was a new moon in effect when your adventure ended.';
        const experience = u.uexp || 0;
        const needed = nextExperienceLevel(u.ulevel) - experience;
        page1[11] = ` You had ${experience} experience ${plural(experience, 'point')}, ${needed} more were needed to attain level ${u.ulevel + 1}.`;
        page1[13] = 'Basics:';
        page1[14] = ` You had ${Math.max(0, u.uhp || 0)} out of ${u.uhpmax} hit points.`;
        page1[15] = u.uen === u.uenmax && u.uenmax === 2
            ? ' You had both energy points (spell power).'
            : u.uen === u.uenmax && u.uenmax > 2
                ? ` You had all ${u.uenmax} energy points (spell power).`
                : ` You had ${u.uen || 0} out of ${u.uenmax || 0} energy points (spell power).`;
        page1[16] = ` Your armor class was ${u.uac}.`;
        const goldLines = goldInsightLines(true, ' ');
        page1[17] = goldLines[0];
        const autopickupRow = goldLines.length > 1 ? 19 : 18;
        if (goldLines.length > 1) page1[18] = goldLines[1];
        page1[autopickupRow] = game.flags?.pickup && game.flags?.pickup_types
            ? ` Autopickup was on for '${game.flags.pickup_types}' plus thrown.`
            : ` Autopickup was ${game.flags?.pickup ? 'on' : 'off'}.`;
        page1[20] = 'Final Characteristics:';
        page1[21] = ` Your strength was ${formatStrength(stats[0])} (limit:${finalAttributeLimit(0)}).`;
        page1[22] = ` Your dexterity was ${stats[1]} (limit:${finalAttributeLimit(1)}).`;
        page1[23] = ' --More--';

        const page2 = Array(24).fill('');
        page2[0] = ` Your constitution was ${stats[2]} (limit:${finalAttributeLimit(2)}).`;
        page2[1] = ` Your intelligence was ${stats[3]} (limit:${finalAttributeLimit(3)}).`;
        page2[2] = ` Your wisdom was ${stats[4]} (limit:${finalAttributeLimit(4)}).`;
        page2[3] = ` Your charisma was ${stats[5]} (limit:${finalAttributeLimit(5)}).`;
        page2[5] = 'Final Status:';
        if ((u._sleepyTimeout || 0) > 0) {
            page2[6] = ' You fell asleep uncontrollably.';
            page2[7] = " You weren't hungry.";
            page2[8] = ' You were unencumbered.';
            if (game.uwep) {
                page2[9] = ` You were wielding ${indefiniteArticle(weaponSkill)} ${weaponSkill}.`;
                page2[10] = ` You had basic skill with ${weaponSkill}.`;
            } else {
                page2[9] = ' You were bare handed.';
                page2[10] = ' You were unskilled in bare handed combat.';
            }
            page2[12] = 'Final Attributes:';
            page2[13] = ` You were ${piousness(u.ualign?.record || 0) || 'nominally'} aligned.`;
            let row = 14;
            if (game.uarmc?.otyp === 148)
                page2[row++] = ' You were magic-protected.';
            if (u.poisonResistance)
                page2[row++] = ' You were poison resistant.';
            if (u.infravision) page2[row++] = ' You had infravision.';
            if (u.stealth) page2[row++] = ' You were stealthy.';
            const sleepyCancellation = magicNegation(game);
            if (sleepyCancellation)
                page2[row++] = ` You were ${['', 'warded', 'guarded', 'protected'][Math.min(3, sleepyCancellation)]}.`;
            if ((u.uluck || 0) > 0) page2[row++] = ' You were lucky.';
            else if ((u.uluck || 0) < 0) page2[row++] = ' You were unlucky.';
            page2[row++] = ' You are dead.';
            page2[row++] = '';
            page2[row++] = 'Miscellaneous:';
            page2[row++] = game._bonesEncountered
                ? ' You encountered a bones level.'
                : " You didn't encounter any bones levels.";
            page2[23] = ' --More--';

            const page3 = Array(24).fill('');
            page3[0] = ' Total elapsed playing time was none.';
            page3[1] = ' --More--';
            return [
                { lines: page1, cursor: [9, 23] },
                { lines: page2, cursor: [9, 23] },
                { lines: page3, cursor: [9, 1] },
            ];
        }
        page2[6] = " You weren't hungry.";
        page2[7] = ' You were unencumbered.';
        if (game.uwep) {
            page2[8] = ` You were wielding ${indefiniteArticle(weaponSkill)} ${weaponSkill}.`;
            page2[9] = ` You had basic skill with ${weaponSkill}.`;
        } else {
            page2[8] = ' You were bare handed.';
            page2[9] = ' You were unskilled in bare handed combat.';
        }
        page2[11] = 'Final Attributes:';
        page2[12] = ` You were ${piousness(u.ualign?.record || 0) || 'nominally'} aligned.`;
        let attributeRow = 13;
        if (game.uarmc?.otyp === 148)
            page2[attributeRow++] = ' You were magic-protected.';
        if (u.infravision) page2[attributeRow++] = ' You had infravision.';
        const magicCancellation = magicNegation(game);
        if (magicCancellation)
            page2[attributeRow++] = ` You were ${['', 'warded', 'guarded', 'protected'][Math.min(3, magicCancellation)]}.`;
        if ((u.uluck || 0) > 0) page2[attributeRow++] = ' You were lucky.';
        else if ((u.uluck || 0) < 0) page2[attributeRow++] = ' You were unlucky.';
        page2[attributeRow++] = ' You are dead.';
        page2[19] = 'Miscellaneous:';
        page2[20] = game._bonesEncountered
            ? ' You encountered a bones level.'
            : " You didn't encounter any bones levels.";
        page2[21] = ' Total elapsed playing time was none.';
        page2[22] = ' --More--';
        return [
            { lines: page1, cursor: [9, 23] },
            { lines: page2, cursor: [9, 22] },
        ];
    }

    // C insight.c emits a stream of putstr() records and lets the tty window
    // paginate them.  Build that stream densely; fixed row reservations for
    // absent moon/time conditions shift every later disclosure boundary.
    const lines = [
        `${game.displayName || game.plname} the ${roleName}'s attributes:`,
        '',
        'Background:',
        ` You were ${indefiniteArticle(rank)} ${rank}, a level ${u.ulevel} ${gender} ${race} ${roleName}.`,
        ` You were ${align}, on a mission for ${gods[align]}`,
        ` who was opposed by ${opponents[0]} and ${opponents[1]}.`,
        ` You were ${u.rightHanded ? 'right' : 'left'}-handed.`,
        ` You were in ${dungeonName}, on level ${dungeonDepth(u.uz)}.`,
        ` You entered the dungeon ${sourceTurn} ${plural(sourceTurn, 'turn')} ago.`,
    ];
    if (nighttime) lines.push(' It was nighttime.');
    if (game.flags?.moonphase === 4)
        lines.push(' There was a full moon in effect when your adventure ended.');
    else if (game.flags?.moonphase === 0)
        lines.push(' There was a new moon in effect when your adventure ended.');
    const experience = u.uexp || 0;
    const needed = nextExperienceLevel(u.ulevel) - experience;
    lines.push(
        ` You had ${experience} experience ${plural(experience, 'point')}, ${needed} were needed to attain level ${u.ulevel + 1}.`,
        '',
        'Basics:',
        ` You had ${Math.max(0, u.uhp || 0)} out of ${u.uhpmax} hit points.`,
    );
    lines.push(u.uen === u.uenmax && u.uenmax > 2
        ? ` You had all ${u.uenmax} energy points (spell power).`
        : ` You had ${u.uen || 0} out of ${u.uenmax || 0} energy points (spell power).`);
    lines.push(` Your armor class was ${u.uac}.`);
    lines.push(...goldInsightLines(true, ' '));
    lines.push(game.flags?.pickup && game.flags?.pickup_types
        ? ` Autopickup was on for '${game.flags.pickup_types}' plus thrown.`
        : ` Autopickup was ${game.flags?.pickup ? 'on' : 'off'}.`);
    lines.push(
        '',
        'Final Characteristics:',
        ` Your strength was ${formatStrength(stats[0])} (limit:${finalAttributeLimit(0)}).`,
        ` Your dexterity was ${stats[1]} (limit:${finalAttributeLimit(1)}).`,
        ` Your constitution was ${stats[2]} (limit:${finalAttributeLimit(2)}).`,
        ` Your intelligence was ${stats[3]} (limit:${finalAttributeLimit(3)}).`,
        ` Your wisdom was ${stats[4]} (limit:${finalAttributeLimit(4)}).`,
        ` Your charisma was ${stats[5]} (limit:${finalAttributeLimit(5)}).`,
        '',
        'Final Status:',
        " You weren't hungry.",
        ' You were unencumbered.',
    );
    if (game.uwep) {
        lines.push(` You were wielding ${indefiniteArticle(weaponName)} ${weaponName}.`);
        lines.push(` You had basic skill with ${weaponName}.`);
    } else {
        lines.push(' You were bare handed.');
        lines.push(' You were unskilled in bare handed combat.');
    }
    const armorSlots = [game.uarm, game.uarmu, game.uarmc, game.uarms,
        game.uarmg, game.uarmf, game.uarmh];
    if (!armorSlots.some(Boolean)) lines.push(" You weren't wearing any armor.");
    lines.push(
        '',
        'Final Attributes:',
        ` You were ${piousness(u.ualign?.record || 0) || 'nominally'} aligned.`,
    );
    if (game.uarmc?.otyp === 148)
        lines.push(' You were magic-protected.');
    if (u.searching || game.urole?.key === 'ranger')
        lines.push(' You had automatic searching.');
    if (u.infravision) lines.push(' You had infravision.');
    const magicCancellation = Math.max(0, ...armorSlots
        .filter(Boolean).map(armor => OBJECT_SPELL_LEVEL[armor.otyp] || 0));
    if (magicCancellation)
        lines.push(` You were ${['', 'warded', 'guarded', 'protected'][Math.min(3, magicCancellation)]}.`);
    if ((u.uluck || 0) > 0) lines.push(' You were lucky.');
    else if ((u.uluck || 0) < 0) lines.push(' You were unlucky.');
    lines.push(
        ' You are dead.',
        '',
        'Miscellaneous:',
        game._bonesEncountered
        ? ' You encountered a bones level.'
        : " You didn't encounter any bones levels.",
        ' Total elapsed playing time was none.',
    );

    const pages = [];
    for (let offset = 0; offset < lines.length; offset += 23) {
        const pageLines = lines.slice(offset, offset + 23);
        pageLines.push(' --More--');
        pages.push({ lines: pageLines, cursor: [9, pageLines.length - 1] });
    }
    return pages;
}

export async function showFinalAttributes() {
    return showTextPages(finalAttributePages(), {
        validKeys: [27, 32, 10, 13],
    });
}

function currentAchievementLines() {
    if (!game.flags?.debug) return [];
    const achievements = achievementEntries(game);
    if (!achievements.length) return [];
    const lines = [
        '',
        `Achievement${achievements.length === 1 ? '' : 's'}:`,
    ];
    for (const achievement of achievements) {
        const identity = Math.abs(achievement);
        if (identity === ACH_HELL) {
            lines.push(' You have entered Gehennom.');
        } else if (identity === ACH_MINE) {
            lines.push(' You have entered the Gnomish Mines.');
        } else if (identity === ACH_TOWN) {
            lines.push(' You have entered Minetown.');
        } else if (identity >= ACH_RNK1 && identity <= ACH_RNK8) {
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
    if (!(conduct.genocides || 0))
        lines.push(' You have never genocided any monsters.');
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
    if (!(conduct.wishes || 0)) {
        lines.push(' You have used no wishes.');
    } else {
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
    if (!(conduct.food || 0)) lines.push(' You went without food.');
    else if (!(conduct.unvegan || 0)) lines.push(' You followed a strict vegan diet.');
    else if (!(conduct.unvegetarian || 0)) lines.push(' You were vegetarian.');
    if (!(conduct.gnostic || 0)) lines.push(' You were an atheist.');
    if (!(conduct.weaphit || 0)) lines.push(' You never hit with a wielded weapon.');
    if (!(conduct.killer || 0)) lines.push(' You were a pacifist.');
    if (!(conduct.literate || 0)) lines.push(' You were illiterate.');
    if (!(conduct.pets || 0) && !game.startingPet)
        lines.push(' You never had a pet.');
    if (!(conduct.genocides || 0))
        lines.push(' You never genocided any monsters.');
    if (!(conduct.polypiles || 0))
        lines.push(' You never polymorphed an object.');
    if (!(conduct.polyselfs || 0)) lines.push(' You never changed form.');
    if (!(conduct.wishes || 0)) lines.push(' You used no wishes.');
    return lines;
}
