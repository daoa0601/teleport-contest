// C insight.c:background_enlightenment(), basics_enlightenment(),
// characteristics_enlightenment(), one_characteristic(), attrval().
import { game, requireInitializedGame } from './gstate.js';
import { currentAttribute, maximumAttribute, ATTRIBUTE_DISPLAY_ORDER } from './attrib.js';
import type { AttributeIndex } from './attrib.js';
import type { EnlightenmentFinal } from './enlightenment_attributes.js';
import { heroHandedName } from './body_parts.js';
import { artifactById } from './artifacts.js';
import { recorderLocalHour } from './calendar.js';
import { ringRemovalObstacle } from './accessory.js';
import { heroIsBlind } from './senses.js';
import { costlySpot } from './shk.js';
import { depth, endgameLevelName } from './hacklib.js';
import { findArmorClass } from './armor.js';
import { heroGoldAmount } from './hero_gold.js';
import { hiddenGold } from './gold.js';
import { currency } from './currency.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { deityName } from './alignment.js';
import { newExperienceThreshold, experienceRankIndex } from './exper.js';
import { MONSTER_FLAGS2, MONSTER_LEVEL, monsterTypeName } from './monster_data.js';
import { DUNCE_CAP, GAUNTLETS_OF_POWER, OBJECT_NAMES } from './object_data.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, AC_MAX,
    In_endgame, In_quest, Is_knox_level, Is_rogue_level, Upolyd } from './const.js';

export function enlightenmentRoleName(): string {
    const female = Upolyd(game.u) ? game.u.mfemale : game.flags.female;
    return female && game.urole?.name.f ? game.urole.name.f : game.urole?.name.m ?? 'Adventurer';
}

export function backgroundEnlightenmentLines(final: EnlightenmentFinal = 0): string[] {
    const { u, urole, urace } = requireInitializedGame();
    const female = Upolyd(u) ? u.mfemale : game.flags.female;
    const role = enlightenmentRoleName();
    const rankNames = urole.title[experienceRankIndex(u.ulevel)] ?? urole.name;
    const rank = female && rankNames.f ? rankNames.f : rankNames.m;
    const gender = female ? 'female' : 'male';
    const genderedRole = urole.name.f && urole.name.f !== urole.name.m;
    const changedGender = game.flags.initgend !== undefined && Number(!!female) !== game.flags.initgend;
    const genderPrefix = !genderedRole && (urole.key !== 'valkyrie' || changedGender) ? `${gender} ` : '';
    const lines = ['', ' Background:'];
    if (Upolyd(u)) {
        const species = monsterTypeName(u.umonnum, !!game.flags.female);
        const formGender = (MONSTER_FLAGS2[u.umonnum] ?? 0) & 0x70000 ? '' : `${game.flags.female ? 'female' : 'male'} `;
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

export function characteristicEnlightenmentLines(magic: boolean, final: EnlightenmentFinal = 0): string[] {
    return ['', ` ${final ? 'Final ' : ''}Characteristics:`,
        ...ATTRIBUTE_DISPLAY_ORDER.map(attribute => characteristicLine(attribute, magic, final))];
}

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
    return `${heroHandedName() === 'handed' ? '' : 'normally '}${game.u.rightHanded ? 'right' : 'left'}-handed`;
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
