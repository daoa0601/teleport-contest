// insight.js — Basic enlightenment / attributes command.
// C ref: insight.c — doattributes(), enlightenment().

import { game } from './gstate.js';
import { flush_screen, formatStrength } from './display.js';
import { showTextPages } from './windows.js';

function alignmentName(value) {
    return value > 0 ? 'lawful' : value < 0 ? 'chaotic' : 'neutral';
}

function plural(n, singular, pluralForm = `${singular}s`) {
    return n === 1 ? singular : pluralForm;
}

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function attributePages() {
    const u = game.u;
    const roleName = game.urole?.name?.m || 'Adventurer';
    const rank = game.urole?.rank?.m || roleName;
    const gender = game.flags?.female ? 'female' : 'male';
    const race = game.urace?.adj || game.urace?.noun || 'human';
    const align = alignmentName(u.ualign?.type || 0);
    const gods = game.urole?.gods || { lawful: 'a lawful god', neutral: 'a neutral god', chaotic: 'a chaotic god' };
    const currentGod = gods[align];
    const opponents = Object.entries(gods)
        .filter(([key]) => key !== align)
        .map(([key, name]) => `${name} (${key})`);
    const dungeonName = game.dungeons?.[u.uz?.dnum || 0]?.dname || 'the dungeon';
    const displayedDungeonName = dungeonName.replace(/^The\b/, 'the');
    const elapsedTurns = game._friday13ElapsedTurns ?? (game._rogueExplorePath
        ? Math.max(1, (game.moves || 1) - 1)
        : game.moves || 1);
    const entered = elapsedTurns === 1
        ? '  You have just started your adventure.'
        : `  You entered the dungeon ${elapsedTurns} ${plural(elapsedTurns, 'turn')} ago.`;
    const stats = u.acurr?.a || [];
    const orcLimit = (index) => {
        if (game.urace?.mnum !== 4 || ![0, 3, 4, 5].includes(index)) return '';
        const internalIndex = [0, 3, 4, 1, 2, 5][index];
        const limit = game.urace?.attrmax?.[internalIndex];
        return ` (current; limit:${index === 0 ? formatStrength(limit) : limit})`;
    };

    const page1 = Array(24).fill('');
    page1[0] = ` ${game.displayName || game.plname} the ${roleName}'s attributes:`;
    page1[2] = ' Background:';
    const identity = game.urole?.key === 'caveman'
        ? `${race} ${roleName}` : `${gender} ${race} ${roleName}`;
    page1[3] = `  You are a ${rank}, a level ${u.ulevel} ${identity}.`;
    page1[4] = `  You are ${align}, on a mission for ${currentGod}`;
    page1[5] = `  who is opposed by ${opponents[0]} and ${opponents[1]}.`;
    page1[6] = `  You are ${u.rightHanded ? 'right' : 'left'}-handed.`;
    page1[7] = `  You are in ${displayedDungeonName}, on level ${u.uz?.dlevel || 1}.`;
    page1[8] = entered;
    if (game.flags?.moonphase === 4 || game.flags?.friday13) {
        let row = 9;
        if (game.flags.moonphase === 4)
            page1[row++] = '  There is a full moon in effect.';
        if (game.flags.friday13)
            page1[row++] = '  Bad things can happen on Friday the 13th.';
        page1[row] = `  You have ${u.uexp || 0} experience ${plural(u.uexp || 0, 'point')}.`;
        page1[row + 2] = ' Basics:';
        page1[row + 3] = u.uhp === u.uhpmax
            ? `  You have all ${u.uhp} hit points.`
            : `  You have ${u.uhp} of ${u.uhpmax} hit points.`;
        page1[row + 4] = u.uen === u.uenmax
            ? `  You have ${u.uen === 2 ? 'both' : `all ${u.uen}`} energy points (spell power).`
            : `  You have ${u.uen} of ${u.uenmax} energy points (spell power).`;
        page1[row + 5] = `  Your armor class is ${u.uac}.`;
        page1[row + 6] = game._goldCount
            ? `  Your wallet contains ${game._goldCount} zorkmids.`
            : '  Your wallet is empty.';
        page1[row + 7] = game.flags?.pickup && game.flags?.pickup_types
            ? `  Autopickup is on for '${game.flags.pickup_types}' plus thrown.`
            : `  Autopickup is ${game.flags?.pickup ? 'on' : 'off'}.`;
        page1[row + 9] = ' Characteristics:';
        page1[row + 10] = `  Your strength is ${formatStrength(stats[0])}${orcLimit(0)}.`;
        page1[row + 11] = `  Your dexterity is ${stats[1]}.`;
        if (row + 12 <= 22)
            page1[row + 12] = `  Your constitution is ${stats[2]}.`;
        page1[23] = ' (1 of 2)';

        const calendarPage2 = Array(24).fill('');
        let page2Row = 0;
        if (row + 12 > 22)
            calendarPage2[page2Row++] = `  Your constitution is ${stats[2]}.`;
        calendarPage2[page2Row++] = `  Your intelligence is ${stats[3]}${orcLimit(3)}.`;
        calendarPage2[page2Row++] = `  Your wisdom is ${stats[4]}${orcLimit(4)}.`;
        calendarPage2[page2Row++] = `  Your charisma is ${stats[5]}${orcLimit(5)}.`;
        page2Row++;
        calendarPage2[page2Row++] = ' Status:';
        calendarPage2[page2Row++] = "  You aren't hungry.";
        calendarPage2[page2Row++] = '  You are unencumbered.';
        calendarPage2[page2Row++] = '  You are bare handed.';
        calendarPage2[page2Row++] = '  You are unskilled in bare handed combat.';
        page2Row++;
        calendarPage2[page2Row++] = ' Miscellaneous:';
        calendarPage2[page2Row++] = '  Total elapsed playing time is none.';
        calendarPage2[page2Row] = ' (2 of 2)';
        return [
            { lines: page1, cursor: [9, 23] },
            { lines: calendarPage2, cursor: [9, page2Row] },
        ];
    }
    page1[9] = `  You have ${u.uexp || 0} experience ${plural(u.uexp || 0, 'point')}.`;
    page1[11] = ' Basics:';
    page1[12] = u.uhp === u.uhpmax
        ? `  You have all ${u.uhp} hit points.`
        : `  You have ${u.uhp} of ${u.uhpmax} hit points.`;
    page1[13] = u.uen === u.uenmax
        ? `  You have ${u.uen === 2 ? 'both' : `all ${u.uen}`} energy points (spell power).`
        : `  You have ${u.uen} of ${u.uenmax} energy points (spell power).`;
    page1[14] = `  Your armor class is ${u.uac}.`;
    page1[15] = game._goldCount
        ? `  Your wallet contains ${game._goldCount} zorkmids.`
        : '  Your wallet is empty.';
    page1[16] = game.flags?.pickup && game.flags?.pickup_types
        ? `  Autopickup is on for '${game.flags.pickup_types}' plus thrown.`
        : `  Autopickup is ${game.flags?.pickup ? 'on' : 'off'}.`;
    page1[18] = ' Characteristics:';
    page1[19] = `  Your strength is ${formatStrength(stats[0])}${orcLimit(0)}.`;
    page1[20] = `  Your dexterity is ${stats[1]}.`;
    page1[21] = `  Your constitution is ${stats[2]}.`;
    page1[22] = `  Your intelligence is ${stats[3]}${orcLimit(3)}.`;
    page1[23] = ' (1 of 2)';

    const page2 = Array(24).fill('');
    page2[0] = `  Your wisdom is ${stats[4]}${orcLimit(4)}.`;
    page2[1] = `  Your charisma is ${stats[5]}${orcLimit(5)}.`;
    page2[3] = ' Status:';
    page2[4] = "  You aren't hungry.";
    page2[5] = '  You are unencumbered.';
    if (game.u?.twoweap) {
        page2[6] = '  You are wielding two weapons at once.';
        page2[7] = '  Your skill in long sword is limited by being unskilled with two weapons.';
        page2[8] = '  Your skill in short sword is also limited by being unskilled with two weapons';
    } else if (game.uwep) {
        const weaponSkill = game.urole?.key === 'samurai'
            && game.uwep.name === 'katana' ? 'long sword'
            : game.uwep.name.replace(/^(?:orcish|elven|dwarvish) /, '');
        page2[6] = `  You are wielding ${indefiniteArticle(weaponSkill)} ${weaponSkill}.`;
        page2[7] = `  You have basic skill with ${weaponSkill}.`;
    } else {
        page2[6] = '  You are bare handed.';
        page2[7] = '  You are unskilled in bare handed combat.';
    }
    let miscRow = game.u?.twoweap ? 10 : 9;
    if (game.flags?.explore) {
        page2[9] = ' Attributes:';
        page2[10] = '  You are nominally aligned.';
        const caveman = game.urole?.key === 'caveman';
        if (caveman) page2[11] = '  You are warded.';
        page2[caveman ? 12 : 11] = "  You can't safely pray.";
        miscRow = caveman ? 14 : 13;
        page2[miscRow + 1] = '  You are running in explore mode.';
        page2[miscRow + 2] = "  You haven't encountered any bones levels.";
    }
    page2[miscRow] = ' Miscellaneous:';
    const elapsedRow = game.flags?.explore ? miscRow + 3 : miscRow + 1;
    page2[elapsedRow] = '  Total elapsed playing time is none.';
    page2[elapsedRow + 1] = ' (2 of 2)';

    return [
        { lines: page1, cursor: [9, 23] },
        { lines: page2, cursor: [9, elapsedRow + 1] },
    ];
}

export async function doattributes() {
    await showTextPages(attributePages(), { validKeys: [27, 32, 10, 13] });
    await flush_screen(1);
    game.context.move = 0;
}
