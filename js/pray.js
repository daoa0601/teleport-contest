// pray.js — Prayer occupation completion and divine anger.
// C refs: pray.c prayer_done()/gods_upset()/angrygods(),
//          end.c savelife(), hack.c unmul().

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flush_screen, pline, plineWithContinuation } from './display.js';
import { rn2, rnd, rnz } from './rng.js';
import { loseExperienceLevel } from './exper.js';

const STRIDENT = 4;

// pray.c:angrygods().  This is deliberately a pure projection so every
// outcome branch shares the same live alignment/anger/Luck calculation.
export function angryGodMaximum({
    responseAlignment,
    heroAlignment,
    alignmentRecord = 0,
    anger = 0,
    luck = 0,
}) {
    let maximum;
    if (responseAlignment !== heroAlignment) {
        maximum = Math.trunc(alignmentRecord / 2)
            + (luck > 0 ? Math.trunc(-luck / 3) : -luck);
    } else {
        maximum = 3 * anger
            + ((luck > 0 || alignmentRecord >= STRIDENT)
                ? Math.trunc(-luck / 3) : -luck);
    }
    return Math.max(1, Math.min(15, maximum));
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

function samePrayerAlignment(state) {
    return state._prayerAlignment ?? state.u?.ualign?.type ?? 0;
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

// prayer_done() is invoked by allmain's after-move scheduler boundary.  The
// favorable and too-soon paths currently exercised by the engine live here;
// unported high-anger punish/curse/zap outcomes remain explicitly identified
// in state instead of being misrepresented as a level-drain result.
export async function finishPrayerOccupation(state = game) {
    const deity = state._prayerDeity || 'your god';
    const completion = state._prayerCompletionMessage
        || 'You finish your prayer.';
    if (state._prayerForced) {
        // unmul() emits nomovemsg through ordinary tty topline continuation.
        // Usually the pending clause is the shimmering-light opening, but a
        // monster message can replace it while prayer time elapses (seed4500
        // reaches hideunder()).  Preserve whichever source line is current.
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
        // Off-altar pleased() chooses action rn1(Luck + 2, 1), capped at
        // action three.  Every positive action repairs the current major
        // trouble; this witness reaches TROUBLE_HIT.
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

    const responseAlignment = state.u?.ualign?.type ?? 0;
    const prayerAlignment = samePrayerAlignment(state);
    if (responseAlignment === prayerAlignment) {
        state.u.ugangr = (state.u.ugangr || 0) + 1;
    } else if ((state.u.ugangr || 0) > 0) {
        state.u.ugangr--;
    }
    const maximum = angryGodMaximum({
        responseAlignment,
        heroAlignment: state.u?.ualign?.type ?? 0,
        alignmentRecord: state.u?.ualign?.record ?? 0,
        anger: state.u?.ugangr ?? 0,
        luck: state.u?.uluck ?? 0,
    });
    const outcome = rn2(maximum);

    if (outcome <= 1) {
        await prayerContinuationLine(
            `You feel that ${deity} is displeased.`, state,
        );
    } else if (outcome <= 3) {
        rn2(4); // pray.c:godvoice() voice selector
        await prayerContinuationLine(
            `The voice of ${deity} thunders:`, state,
        );
        await prayerContinuationLine('"Thou art arrogant, mortal."', state);
        await prayerContinuationLine(
            '"Thou must relearn thy lessons!"', state,
        );
        if (state.u?.acurr?.a) state.u.acurr.a[4]--;
        const loss = loseExperienceLevel(state);
        await prayerContinuationLine('You feel foolish!', state);
        if (loss.oldLevel > 1)
            await prayerContinuationLine(
                `Goodbye level ${loss.oldLevel}.`, state,
            );
    } else {
        // Cases 4+ delegate to curse, punishment, minion, and divine-zap
        // subsystems.  Preserve the exact selected boundary for the next
        // source port instead of silently applying the wrong case 2/3 state.
        state._pendingAngryGodOutcome = {
            outcome, maximum, responseAlignment,
        };
    }

    const nextBlessCount = rnz(300);
    if (nextBlessCount > (state.u.ublesscnt || 0))
        state.u.ublesscnt = nextBlessCount;
    state._prayerDeity = null;
    state._prayerAlignment = null;
    state._prayerCompletionMessage = null;
    state._prayerOpeningMessage = null;
    state._prayerLastTickMove = null;
    return { outcome, maximum };
}
