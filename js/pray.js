// pray.js — Prayer occupation completion and divine anger.
// C refs: pray.c prayer_done()/gods_upset()/angrygods(),
//          end.c savelife(), hack.c unmul().

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flush_screen, pline, plineWithContinuation } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { promptYesNo } from './query.js';
import { rn2, rnd, rnz } from './rng.js';
import { deityName } from './alignment.js';
import { godsUpset, godVoice } from './divine_wrath.js';
import { A_WIS, Amask2align } from './const.js';
import { adjustAttribute, attributeChangeMessage } from './attrib.js';

const STRIDENT = 4;
export async function altarWrath(x, y, state = game) {
    const altarAlignment = Amask2align(state.level?.at(x, y)?.flags ?? 0);
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const deity = deityName(altarAlignment, state);

    if (heroAlignment === altarAlignment && alignmentRecord > -rn2(4)) {
        await godVoice(altarAlignment, 'How darest thou desecrate my altar!', state);
        const change = adjustAttribute(A_WIS, -1, state);
        const message = attributeChangeMessage(A_WIS, change);
        if (message) await pline(message);
        state.u.ualign.record = alignmentRecord - 1;
        return;
    }

    await pline(state.deaf || state.u?.deaf
        ? `Despite your deafness, you seem to hear ${deity} say:`
        : `A voice (could it be ${deity}?) whispers:`);
    await pline('"Thou shalt pay, infidel!"');
    const luck = state.u?.uluck ?? 0;
    if (luck > -5 && rn2(luck + 6))
        state.u.uluck = luck - (rn2(20) ? 1 : 2);
}

export async function dopray() {
    const answer = await promptYesNo('Are you sure you want to pray? [yn] (n) ');
    if (answer !== 'y') {
        game.context.move = 0;
        return;
    }

    if (!game.u.uconduct) game.u.uconduct = {};
    const firstPrayer = !(game.u.uconduct.gnostic || 0);
    game.u.uconduct.gnostic = (game.u.uconduct.gnostic || 0) + 1;
    if (firstPrayer)
        recordGameLogEvent('rejected atheism with a prayer');

    const deity = deityName(game.u.ualign.type);
    const beginMessage = `You begin praying to ${deity}.`;
    const openingLine = game.flags?.debug
        ? `${beginMessage}--More--` : beginMessage;
    await pline(openingLine);

    if (game.flags?.debug) {
        // Wizard mode asks whether to force a favorable result after showing
        // the ordinary prayer message.
        await flush_screen(1);
        game.nhDisplay?.setCursor(openingLine.length, 0);
        let key;
        do key = await nhgetch();
        while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
        const force = await promptYesNo('Force the gods to be pleased? [yn] (n) ');
        game._prayerForced = force === 'y';
        if (game._prayerForced && game.u) {
            game.u.ublesscnt = 0;
            if ((game.u.uluck ?? 0) < 0) game.u.uluck = 0;
            if ((game.u.ualign?.record ?? 0) <= 0)
                game.u.ualign.record = 1;
            game.u.ugangr = 0;
            game.u.invulnerable = true;
            if (!game.blind) {
                game._prayerOpeningMessage
                    = 'You are surrounded by a shimmering light.';
                await pline(game._prayerOpeningMessage);
            }
        }
    }
    game._prayerDeity = deity;
    game._prayerAlignment = game.u?.ualign?.type ?? 0;
    game._prayerCompletionMessage = 'You finish your prayer.';
    game._prayerTurnsRemaining = 3;
    game._prayerLastTickMove = game.moves || 1;
    game.context.move = 1;
}

// end.c:savelife() replaces any negative multi value with -1 but leaves
// ga.afternmv installed.  The port stores prayer_done as an explicit pending
// callback, so reduce its remaining duration to the corresponding one global
// turn and preserve savelife's replacement nomovemsg.
export function rebasePrayerAfterLifeSaving(state = game) {
    if ((state._prayerTurnsRemaining || 0) <= 0) return false;
    state._prayerTurnsRemaining = 1;
    state._prayerCompletionMessage
        = 'You survived that attempt on your life.';
    return true;
}

async function prayerMore(message, state = game) {
    // tty WIN_STOP suppresses ordinary plines but not their state changes.
    // Returning without reading input is essential: a stopped prayer callback
    // completes inside the current scheduler turn.
    if (state._suppressMessagesUntilInput) return null;
    await pline(message);
    await flush_screen(1);
    state.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    return key;
}

async function prayerLine(message, state = game) {
    if (state._suppressMessagesUntilInput) return;
    await pline(message);
}

async function prayerContinuationLine(message, state = game) {
    if (state._suppressMessagesUntilInput) return;
    await plineWithContinuation(message);
}

// C pray.c:critically_low_hp().  The prayer trouble threshold becomes less
// generous as the hero advances through the role-rank bands.
function criticallyLowPrayerHp(state) {
    const level = state.u?.ulevel ?? 1;
    const hp = state.u?.uhp ?? 1;
    const hpmax = Math.min(state.u?.uhpmax ?? hp, 15 * level);
    const divisor = level <= 5 ? 5
        : level <= 13 ? 6
            : level <= 21 ? 7
                : level <= 29 ? 8 : 9;
    return hp <= 5 || hp * divisor <= hpmax;
}

async function fixCriticalPrayerHp(state) {
    if (!criticallyLowPrayerHp(state)) return false;
    let hpmax = state.u?.uhpmax ?? 1;
    const growthLimit = (state.u?.ulevel ?? 1) * 5 + 11;
    if (hpmax < growthLimit) hpmax += rnd(5);
    state.u.uhpmax = Math.max(hpmax, 6);
    state.u.uhp = state.u.uhpmax;
    await prayerContinuationLine('You feel much better.', state);
    return true;
}

// C prayer_done(), called after the prayer occupation ends.
export async function finishPrayerOccupation(state = game) {
    const deity = state._prayerDeity || 'your god';
    const completion = state._prayerCompletionMessage
        || 'You finish your prayer.';
    if (state._prayerForced) {
        // unmul() emits nomovemsg through ordinary tty topline continuation.
        // A monster message can replace the shimmering-light opening while
        // prayer time elapses. Preserve whichever source line is current.
        const opening = state._pending_message
            ? `${state._pending_message}  ` : '';
        await prayerMore(
            `${opening}${completion}--More--`,
            state,
        );
        // pray.c:pleased() still resolves the ordinary favorable action and
        // installs the next prayer timeout after a wizard-forced success.
        if ((state.u?.ualign?.record ?? 0) < 2)
            state.u.ualign.record++;
        const alignmentRecord = state.u?.ualign?.record ?? 0;
        const disposition = alignmentRecord >= 14 ? 'well-pleased'
            : alignmentRecord >= STRIDENT ? 'pleased' : 'satisfied';
        await prayerLine(
            `You feel that ${deity} is ${disposition}.`,
            state,
        );
        // Off-altar pleased() chooses an action from Luck, capped at three.
        // Every positive action repairs the current major trouble.
        rn2(Math.max(1, (state.u?.uluck ?? 0) + 2));
        await fixCriticalPrayerHp(state);
        if (state.u) state.u.ublesscnt = rnz(350);
        state._prayerForced = false;
        if (state.u) state.u.invulnerable = false;
        state._prayerDeity = null;
        state._prayerAlignment = null;
        state._prayerCompletionMessage = null;
        state._prayerOpeningMessage = null;
        state._prayerLastTickMove = null;
        return { outcome: 'pleased' };
    }

    // C unmul() emits nomovemsg before invoking prayer_done().  Keep the
    // completion as its own pline: tty can append it to can_pray()'s opening
    // line, then a later divine response decides whether that combined
    // topline needs acknowledgement.
    await prayerContinuationLine(completion, state);

    state.u.ublesscnt = (state.u.ublesscnt || 0) + rnz(250);
    state.u.uluck = Math.max(-13, (state.u.uluck || 0) - 3);

    await godsUpset(state.u.ualign.type, state);
    state._prayerDeity = null;
    state._prayerAlignment = null;
    state._prayerCompletionMessage = null;
    state._prayerOpeningMessage = null;
    state._prayerLastTickMove = null;
    return { outcome: 'angry' };
}
