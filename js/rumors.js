// C rumors.c: rumor delivery and Oracle consultations.
import { setMulti } from './cmd.js';
import { ACH_ORCL, BY_COOKIE, BY_ORACLE, BY_OTHER, BY_PAPER, FAINTED, MD_PAD_BOGONS, MD_PAD_RUMORS } from './const.js';
import { plineWithContinuation as pline } from './pline.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroIsBlind } from './senses.js';
import { moneyToMonster, says } from './shk.js';
import { currency } from './invent.js';
import { monsterName, monsterTypeName } from './do_name.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn2, rnd } from './rng.js';
import { exerciseWisdom } from './attrib.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { recordAchievement } from './insight.js';
import { BOGUS_MONSTERS, FALSE_RUMORS, RANDOM_ENGRAVINGS, RANDOM_EPITAPHS, TRUE_RUMORS } from './random_text_data.js';
import { showTextWindow } from './wintty.js';
import { flushPendingTopline } from './topl.js';
import { ORACLE_TEXT } from './oracle_data.js';
import { heroGoldAmount } from './hack.js';
import { MONSTER_GENO, MONSTER_NAME } from './monster_data.js';
import { monsterHasProperName } from './mondata.js';
// C rumors.c:doconsult(). Refusals are free; payment commits a turn even
// when the hero can afford only the deliberately unhelpful major oracle.
export async function consultOracle(oracle, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    setMulti(0, state);
    const money = heroGoldAmount(state);
    if (!oracle) {
        await pline('There is no one here to consult.');
        return false;
    }
    if (!oracle.mpeaceful) {
        await pline(`${monsterName(oracle, { capitalized: true, state })} is in no mood for consultations.`);
        return false;
    }
    if (!money) {
        await pline('You have no gold.');
        return false;
    }
    const minorCost = 50;
    const majorCost = 500 + 50 * state.u.ulevel;
    const answer = await promptYesNoQuit(`"Wilt thou settle for a minor consultation?" (${minorCost} ${currency(minorCost, { state })})`);
    if (answer === 'q')
        return false;
    let payment;
    if (answer === 'y') {
        if (money < minorCost) {
            await pline("You don't even have enough gold for that!");
            return false;
        }
        payment = minorCost;
    }
    else {
        if (money <= minorCost || state.oracleRemaining?.length === 1)
            return false;
        if (await promptYesNo(`"Then dost thou desire a major one?" (${majorCost} ${currency(majorCost, { state })})`) !== 'y')
            return false;
        payment = Math.min(money, majorCost);
    }
    await moneyToMonster(oracle, payment, state);
    state.context.botl = true;
    const events = state.u.uevent ??= {};
    if (!events.major_oracle && !events.minor_oracle)
        recordAchievement(state, ACH_ORCL);
    let experience = 0;
    if (payment === minorCost) {
        await outRumor(1, BY_ORACLE, state);
        if (!events.minor_oracle)
            experience = Math.trunc(payment / (events.major_oracle ? 25 : 10));
        events.minor_oracle = true;
    }
    else {
        const underpaid = payment < majorCost;
        await outOracle(underpaid, true, state);
        if (!underpaid && !events.major_oracle)
            experience = Math.trunc(payment / (events.minor_oracle ? 25 : 10));
        events.major_oracle = true;
        exerciseWisdom(!underpaid, state);
    }
    if (experience) {
        addExperience(experience, Math.trunc(payment / 50), state);
        await checkExperienceLevel();
    }
    return true;
}
// C rumors.c:outoracle()
// Also C rumors.c:init_oracles(): record indices initialize from the imported table here
// Normal records are drawn without replacement by replacing
// the selected slot with the final slot. The special record remains at zero.
export async function outOracle(special, delphi, state = game) {
    const remaining = state.oracleRemaining ??= ORACLE_TEXT.map((_text, index) => index);
    if (!remaining.length || !special && remaining.length <= 1)
        return;
    const slot = special ? 0 : rnd(remaining.length - 1);
    const record = remaining[slot];
    const lines = record === undefined ? undefined : ORACLE_TEXT[record];
    if (!lines)
        throw new RangeError(`Oracle record ${String(record)} is unavailable`);
    if (!special) {
        const last = remaining.pop();
        if (last === undefined)
            throw new Error('Oracle selection exhausted its records');
        if (slot < remaining.length)
            remaining[slot] = last;
    }
    const opening = !delphi ? 'The message reads:' : special
        ? 'The Oracle scornfully takes all your gold and says:'
        : 'The Oracle meditates for a moment and then intones:';
    await flushPendingTopline();
    state._pending_message = '';
    state._retained_message = '';
    await showTextWindow([opening, '', ...lines]);
    state._pending_message = '';
    state._retained_message = '';
}
// Part of C eat.c:fpostfx(), read.c:doread(): the bcs-sign rumor draw for a
// fortune cookie.
export async function readCookieFortune(cookie, { state = game } = {}) {
    await outRumor(cookie.blessed ? 1 : cookie.cursed ? -1 : 0, BY_COOKIE, state);
}
// C rumors.c:get_rnd_line(): load one randomly chosen line from a padded
// section of compiled data. 'rng' is the caller's draw — rn2 for rumors and
// epitaphs, rn2Display for bogus monster names (do_name.c:bogusmon()).
// makedefs pads each source line to padlength-1 text bytes plus its
// newline; selection seeks into one line and returns the following line,
// and a long line is retried unless the offset falls within its final
// padlength+1 characters.
export function getRndLine(lines, padlength, rng) {
    if (!lines.length)
        throw new Error('Random text needs at least one source line');
    const sizes = lines.map(line => Math.max(line.length, padlength - 1) + 1);
    const fileSize = sizes.reduce((sum, size) => sum + size, 0);
    let picked = 0;
    for (let tries = 10; tries > 0; tries--) {
        let offset = rng(fileSize);
        picked = 0;
        let size = sizes[picked];
        if (size === undefined)
            throw new Error('Random text is missing its first line size');
        while (offset >= size) {
            offset -= size;
            size = sizes[++picked];
            if (size === undefined)
                throw new Error('Random text offset exceeds its source text');
        }
        const remainder = size - offset;
        if (remainder <= padlength + 1)
            break;
    }
    const line = lines[(picked + 1) % lines.length];
    if (line === undefined)
        throw new Error('Random text selection is missing its source line');
    return line;
}
// C rumors.c:getrumor(). Reading via a cookie excludes the fortune lines
// that mention them; graffiti in mklev does not exercise wisdom.
export function getRumor(excludeCookie, truth = 0) {
    let rumor = '';
    let count = 0;
    let trueRumor = false;
    do {
        trueRumor = truth + rn2(2) > 0;
        rumor = getRndLine(trueRumor
            ? TRUE_RUMORS : FALSE_RUMORS, MD_PAD_RUMORS, rn2);
    } while (count++ < 50 && excludeCookie && rumor.startsWith('[cookie] '));
    if (count < 50 && !game.in_mklev)
        exerciseWisdom(trueRumor);
    if (!excludeCookie && rumor.startsWith('[cookie] '))
        rumor = rumor.slice('[cookie] '.length);
    return rumor;
}
// C rumors.c:outrumor(). Reading permits cookie-specific fortunes; spoken
// and other rumors exclude them. Callers own literacy and consumed objects.
export async function outRumor(truth, mechanism, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const reading = mechanism === BY_COOKIE || mechanism === BY_PAPER;
    if (mechanism === BY_COOKIE && state.u.uhs === FAINTED)
        return;
    if (reading && heroIsBlind(state)) {
        if (mechanism === BY_COOKIE)
            await pline('This cookie has a scrap of paper inside.');
        await pline('What a pity that you cannot read it!');
        return;
    }
    const rumor = getRumor(!reading, truth)
        || 'NetHack rumors file closed for renovation.';
    if (mechanism === BY_ORACLE) {
        const manner = !rn2(4) ? 'offhandedly ' : !rn2(3) ? 'casually '
            : rn2(2) ? 'nonchalantly ' : '';
        await pline(`True to her word, the Oracle ${manner}${says(state)}: `);
        await pline(`"${rumor}"`);
        return;
    }
    if (mechanism === BY_COOKIE)
        await pline('This cookie has a scrap of paper inside.');
    if (reading)
        await pline('It reads:');
    await pline(rumor);
}
// C rumors.c:rumor_check(), with others_check() inlined. makedefs.c:do_rumors()
// writes the header comment and a fixed-width index before the padded text;
// derive offsets from that compiled layout.
export async function rumorCheck() {
    const trueSize = rumorSectionSize(TRUE_RUMORS);
    const falseSize = rumorSectionSize(FALSE_RUMORS);
    const comment = "#\tThis data file is generated by 'makedefs'.  Do not edit. \n";
    const index = `${String(TRUE_RUMORS.length).padStart(4, '0')},${decimal(trueSize)},000000;`
        + `${String(FALSE_RUMORS.length).padStart(4, '0')},${decimal(falseSize)},000000;0,0,000000\n`;
    const trueStart = comment.length + index.length;
    const falseStart = trueStart + trueSize;
    const end = falseStart + falseSize;
    const lines = [
        rumorBoundary('T', trueStart, falseStart, trueSize),
        rumorBoundary('F', falseStart, end, falseSize),
        ...rumorEndpoints('T', trueStart, TRUE_RUMORS),
        ...rumorEndpoints('F', falseStart, FALSE_RUMORS),
        ...supportingText('Engravings:', RANDOM_ENGRAVINGS, MD_PAD_RUMORS),
        ...supportingText('Epitaphs:', RANDOM_EPITAPHS, MD_PAD_RUMORS),
        ...supportingText('Bogus monsters:', BOGUS_MONSTERS, MD_PAD_BOGONS),
    ];
    await showTextWindow(lines);
}
// C makedefs.c:do_rumors(): a section's compiled byte size, re-derived
// from the padded lines that makedefs wrote into the index.
function rumorSectionSize(lines) {
    return lines.reduce((size, line) => size + paddedLine(line, MD_PAD_RUMORS).length + 1, 0);
}
// Part of C rumors.c:rumor_check(): the "T start=%06ld (%06lx), end=…,
// size=…" reveal lines.
function rumorBoundary(label, start, end, size) {
    const field = (value) => `${decimal(value)} (${value.toString(16).padStart(6, '0')})`;
    return `${label} start=${field(start)}, end=${field(end)}, size=${field(size)}`;
}
// Part of C rumors.c:rumor_check(): the first and last padded rumors bounding
// a section ("T %06ld %s" and the "  %6s %s" continuation).
function rumorEndpoints(label, start, lines) {
    const first = lines[0];
    const last = lines.at(-1);
    if (first === undefined || last === undefined)
        throw new Error(`${label} rumors have no entries`);
    return [`${label} ${decimal(start)} ${paddedLine(first, MD_PAD_RUMORS)}`,
        `         ${paddedLine(last, MD_PAD_RUMORS)}`];
}
// C rumors.c:others_check(): one supporting-text file's window lines —
// the blank line, the header, the first two entries, the ellipsis, and the
// last entry. rumor_check() owns the shared window, as C's winptr does;
// the port compiles the file contents in, so the missing-file and
// malformed-comment error paths cannot occur.
function supportingText(title, entries, padding) {
    const first = entries[0];
    if (first === undefined)
        throw new Error(`${title} has no default entry`);
    const lines = ['', title, paddedLine(first, padding)];
    const second = entries[1];
    if (second === undefined)
        return [...lines, '(no second entry)'];
    lines.push(paddedLine(second, padding));
    if (entries.length === 2)
        return [...lines, '(only two entries)'];
    if (entries.length > 3)
        lines.push(' ...');
    const last = entries.at(-1);
    if (last === undefined)
        throw new Error(`${title} has no last entry`);
    return [...lines, paddedLine(last, padding)];
}
// C makedefs.c:padline(): pad a short line with '_' so random seeks land
// in it as often as in long lines.
function paddedLine(line, lengthWithNewline) {
    return line.padEnd(lengthWithNewline - 1, '_');
}
// Part of C rumors.c:rumor_check(): the %06ld field format.
function decimal(value) {
    return String(value).padStart(6, '0');
}
// C rumors.c:init_CapMons()
// Native rumors.c:CapitalMon() includes capitalized species names and titles,
// but excludes individual names in both the real and hallucinatory tables.
// Read trait owners after module initialization; their module also uses
// objnam, which calls back into this table through CapitalMon() below.
export function capitalizedMonsterTitles() {
    return [
        ...MONSTER_NAME.flatMap((name, species) => {
            const unique = !!((MONSTER_GENO[species] ?? 0) & 0x1000);
            const personal = monsterHasProperName(species);
            if (unique && (personal || name === 'high cleric' || name === 'long worm tail'))
                return [];
            return [name, monsterTypeName(species), monsterTypeName(species, true)];
        }),
        ...BOGUS_MONSTERS.flatMap(name => {
            const code = name.charAt(0);
            if (code && '-+='.includes(code))
                return [];
            return ['_', '|'].includes(code) ? [name.slice(1)] : [name];
        }),
    ].filter(name => /^[A-Z]/u.test(name));
}
// C rumors.c:CapitalMon().
export function capitalizedMonsterTitle(name) {
    return capitalizedMonsterTitles().some(title => name.startsWith(title)
        && (name.length === title.length || [' ', "'"].includes(name.charAt(title.length))));
}
//# sourceMappingURL=rumors.js.map