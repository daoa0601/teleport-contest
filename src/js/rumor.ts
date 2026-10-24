// C rumors.c: rumor delivery and Oracle consultations.
import { setMulti } from './command_state.js';
import { ACH_ORCL, BY_COOKIE, BY_ORACLE, BY_OTHER, BY_PAPER, FAINTED } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { getRumor } from './mklev.js';
import { heroIsBlind } from './senses.js';
import type { Monster } from './monster_types.js';
import { heroGoldAmount } from './hero_gold.js';
import { moneyToMonster } from './shop_damage.js';
import { currency } from './currency.js';
import { monsterName } from './monster_name.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn2, rnd } from './rng.js';
import { exerciseWisdom } from './attrib.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { recordAchievement } from './achievements.js';
import { showTextWindow } from './windows.js';
import { flushPendingTopline } from './display.js';
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
