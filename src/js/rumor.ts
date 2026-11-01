// C rumors.c: rumor delivery and Oracle consultations.
import { setMulti } from './cmd.js';
import { ACH_ORCL, BY_COOKIE, BY_ORACLE, BY_OTHER, BY_PAPER, FAINTED, MD_PAD_BOGONS, MD_PAD_RUMORS } from './const.js';
import { plineWithContinuation as pline } from './pline.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { getRumor } from './mklev.js';
import { heroIsBlind } from './senses.js';
import type { Monster } from './monster_types.js';
import { heroGoldAmount } from './hero_gold.js';
import { moneyToMonster } from './shk.js';
import { currency } from './currency.js';
import { monsterName } from './do_name.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn2, rnd } from './rng.js';
import { exerciseWisdom } from './attrib.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { recordAchievement } from './achievements.js';
import { BOGUS_MONSTERS, FALSE_RUMORS, RANDOM_ENGRAVINGS, RANDOM_EPITAPHS, TRUE_RUMORS } from './random_text_data.js';
import { showTextWindow } from './windows.js';
import { flushPendingTopline } from './tty_topline.js';
import { ORACLE_TEXT } from './oracle_data.js';

// C rumors.c:doconsult(). Refusals are free; payment commits a turn even
// when the hero can afford only the deliberately unhelpful major oracle.
export async function consultOracle(oracle: Monster | null, state: GameState = game): Promise<boolean> {
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
    if (answer === 'q') return false;
    let payment: number;
    if (answer === 'y') {
        if (money < minorCost) {
            await pline("You don't even have enough gold for that!");
            return false;
        }
        payment = minorCost;
    } else {
        if (money <= minorCost || state.oracleRemaining?.length === 1) return false;
        if (await promptYesNo(`"Then dost thou desire a major one?" (${majorCost} ${currency(majorCost, { state })})`) !== 'y')
            return false;
        payment = Math.min(money, majorCost);
    }
    await moneyToMonster(oracle, payment, state);
    state.context.botl = true;
    const events = state.u.uevent ??= {};
    if (!events.major_oracle && !events.minor_oracle) recordAchievement(state, ACH_ORCL);
    let experience = 0;
    if (payment === minorCost) {
        await outRumor(1, BY_ORACLE, state);
        if (!events.minor_oracle) experience = Math.trunc(payment / (events.major_oracle ? 25 : 10));
        events.minor_oracle = true;
    } else {
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

// C outoracle(): normal records are drawn without replacement by replacing
// the selected slot with the final slot. The special record remains at zero.
export async function outOracle(special: boolean, delphi: boolean, state: GameState = game): Promise<void> {
    const remaining = state.oracleRemaining ??= ORACLE_TEXT.map((_text, index) => index);
    if (!remaining.length || !special && remaining.length <= 1) return;
    const slot = special ? 0 : rnd(remaining.length - 1);
    const record = remaining[slot];
    const lines = record === undefined ? undefined : ORACLE_TEXT[record];
    if (!lines) throw new RangeError(`Oracle record ${String(record)} is unavailable`);
    if (!special) {
        const last = remaining.pop();
        if (last === undefined) throw new Error('Oracle selection exhausted its records');
        if (slot < remaining.length) remaining[slot] = last;
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

export async function readCookieFortune(
    cookie: GameObject, { state = game }: { state?: GameState } = {},
): Promise<void> {
    await outRumor(cookie.blessed ? 1 : cookie.cursed ? -1 : 0, BY_COOKIE, state);
}

type RumorMechanism = typeof BY_COOKIE | typeof BY_PAPER | typeof BY_ORACLE | typeof BY_OTHER;

// C rumors.c:outrumor(). Reading permits cookie-specific fortunes; spoken
// and other rumors exclude them. Callers own literacy and consumed objects.
export async function outRumor(truth: -1 | 0 | 1, mechanism: RumorMechanism, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const reading = mechanism === BY_COOKIE || mechanism === BY_PAPER;
    if (mechanism === BY_COOKIE && state.u.uhs === FAINTED) return;
    if (reading && heroIsBlind(state)) {
        if (mechanism === BY_COOKIE) await pline('This cookie has a scrap of paper inside.');
        await pline('What a pity that you cannot read it!');
        return;
    }
    const rumor = getRumor(!reading, truth)
        || 'NetHack rumors file closed for renovation.';
    if (mechanism === BY_ORACLE) {
        const manner = !rn2(4) ? 'offhandedly ' : !rn2(3) ? 'casually '
            : rn2(2) ? 'nonchalantly ' : '';
        await pline(`True to her word, the Oracle ${manner}says: `);
        await pline(`"${rumor}"`);
        return;
    }
    if (mechanism === BY_COOKIE) await pline('This cookie has a scrap of paper inside.');
    if (reading) await pline('It reads:');
    await pline(rumor);
}

// C rumors.c:rumor_check(), with others_check() inlined. makedefs.c:do_rumors()
// writes the header comment and a fixed-width index before the padded text;
// derive offsets from that compiled layout.
export async function rumorCheck(): Promise<void> {
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

function rumorSectionSize(lines: readonly string[]): number {
    return lines.reduce((size, line) => size + paddedLine(line, MD_PAD_RUMORS).length + 1, 0);
}

function rumorBoundary(label: string, start: number, end: number, size: number): string {
    const field = (value: number) => `${decimal(value)} (${value.toString(16).padStart(6, '0')})`;
    return `${label} start=${field(start)}, end=${field(end)}, size=${field(size)}`;
}

function rumorEndpoints(label: string, start: number, lines: readonly string[]): string[] {
    const first = lines[0];
    const last = lines.at(-1);
    if (first === undefined || last === undefined) throw new Error(`${label} rumors have no entries`);
    return [`${label} ${decimal(start)} ${paddedLine(first, MD_PAD_RUMORS)}`,
        `         ${paddedLine(last, MD_PAD_RUMORS)}`];
}

function supportingText(title: string, entries: readonly string[], padding: number): string[] {
    const first = entries[0];
    if (first === undefined) throw new Error(`${title} has no default entry`);
    const lines = ['', title, paddedLine(first, padding)];
    const second = entries[1];
    if (second === undefined) return [...lines, '(no second entry)'];
    lines.push(paddedLine(second, padding));
    if (entries.length === 2) return [...lines, '(only two entries)'];
    if (entries.length > 3) lines.push(' ...');
    const last = entries.at(-1);
    if (last === undefined) throw new Error(`${title} has no last entry`);
    return [...lines, paddedLine(last, padding)];
}

function paddedLine(line: string, lengthWithNewline: number): string {
    return line.padEnd(lengthWithNewline - 1, '_');
}

function decimal(value: number): string {
    return String(value).padStart(6, '0');
}
