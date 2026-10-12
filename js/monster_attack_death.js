// Monster-attributed hero death and its terminal continuations.
// C refs: end.c done_in_by()/done()/savelife(), tty message windows.
import { game } from './gstate.js';
import { M_AP_MONSTER, M_AP_TYPE, Upolyd, ismnum } from './const.js';
import { flush_screen, pline, plineWithContinuation } from './display.js';
import { beginHeroLifeSaving, completeHeroLifeSaving, finishOrdinaryDeath, restoreHeroAfterDeath, } from './end.js';
import { setHeroRemainsFromMonster } from './death_remains.js';
import { nhgetch } from './input.js';
import { MONSTER_NAME } from './monster_data.js';
import { quietMonsterName } from './monster_name.js';
import { promptYesNo } from './query.js';
import { heroIsBlind } from './senses.js';
import { shopkeeperKillerName } from './shk.js';
async function waitForMonsterMore(message) {
    // urgent_pline() still traverses tty's ordinary topline continuation.
    // If an older line is pending, it may own a pager before this urgent line
    // is installed.  display_nhwindow(WIN_MESSAGE, TRUE) then forces the new
    // current line to own a second acknowledgement even when it fits.
    const continuationDismissal = await plineWithContinuation(message);
    if (continuationDismissal === 27)
        return continuationDismissal;
    return waitForCurrentMonsterMore(message);
}
export async function finishMonsterAttackDeath(monster, { damage, pagerOwned = false, messageAfterPager = false, earlierActorPager = false, attribution = { kind: 'done-in-by' }, deathType = null, } = {}) {
    const customCause = attribution.kind === 'death-inflicted-by';
    const announcesDeath = !customCause || attribution.announcesDeath;
    const projectedFatalLine = !!game._pending_message
        && !game._suppressMessagesUntilInput;
    const rawHpAfter = damage ? damage.hpBefore - damage.damage : 0;
    const hpSaveSentinel = damage?.hpKey === 'uhp' && rawHpAfter === -1;
    // bot() reserves raw HP -1 as a save sentinel. A real pager can retain
    // the old status row there; exact zero and deeper overkill repaint it.
    if (projectedFatalLine && damage && rawHpAfter !== 0 && rawHpAfter >= -1
        && (hpSaveSentinel || earlierActorPager
            || (pagerOwned && !messageAfterPager))) {
        game._statusHpOverride = damage.hpBefore;
    }
    const retainStatus = game._statusHpOverride !== undefined && hpSaveSentinel;
    if (projectedFatalLine && announcesDeath)
        await waitForCurrentMonsterMore();
    if (!retainStatus)
        delete game._statusHpOverride;
    const shopkeeperKiller = !customCause && monster.isshk
        && M_AP_TYPE(monster) !== M_AP_MONSTER
        && !(ismnum(monster.cham) && monster.cham !== monster.mnum)
        && monster.mnum !== MONSTER_NAME.indexOf('ghost');
    const fatalKiller = customCause ? attribution.killer : shopkeeperKiller
        ? shopkeeperKillerName(monster) : quietMonsterName(monster);
    const fatalDeathCause = customCause
        ? attribution.deathCause ?? `killed by ${fatalKiller}`
        : shopkeeperKiller ? `killed by ${fatalKiller}` : null;
    if (!customCause)
        setHeroRemainsFromMonster(monster, game);
    // done_in_by() announces the death while HP still holds the lethal
    // (often negative) value; done() commits zero afterwards. The
    // life-saving transaction performs done()'s commit itself.
    const lifeSaving = beginHeroLifeSaving();
    if (lifeSaving) {
        // done() normalizes HP before it emits the life-saving
        // branch; unlike a plain debug-death pager, that combined
        // line always projects committed zero.
        delete game._statusHpOverride;
        // done_in_by() writes the fatal line before done(); the
        // latter appends both life-saving lines until the next
        // message would overflow tty's top line.  Identification
        // (and its Wisdom exercise draw) precedes that pager.
        const medallionEffect = heroIsBlind(game) ? 'feels warm' : 'begins to glow';
        const dismissal = await waitForMonsterMore(`${announcesDeath ? 'You die...  ' : ''}But wait...  Your medallion ${medallionEffect}!`);
        delete game._statusHpOverride;
        await pline('You feel much better!');
        // ESC at tty --More-- sets WIN_STOP: the new overflow
        // message is still installed, but later messages in this
        // input transaction (starting with the crumble line) are
        // suppressed.  Other dismissal keys retain the source
        // follow-up.
        if (dismissal !== 27) {
            await plineWithContinuation('The medallion crumbles to dust!');
        }
        else {
            game._suppressMessagesUntilInput = true;
        }
        await completeHeroLifeSaving(lifeSaving);
        return !!game.program_state.gameover;
    }
    // C end.c:done() records every fatal event and forces HP to zero
    // before it tests LifeSaved or offers the debug/explore "Die?"
    // escape. done_in_by() has already announced the death by then, so
    // its pager still shows the lethal HP; done()'s own message flush
    // does not. The amulet branch commits in beginHeroLifeSaving().
    const commitFatalEvent = () => {
        game.u.umortality = (game.u.umortality || 0) + 1;
        if (game.u.uhp !== 0 || (Upolyd(game.u) && game.u.mh !== 0)) {
            game.u.uhp = 0;
            game.u.mh = 0;
        }
    };
    if (announcesDeath && game._suppressMessagesUntilInput) {
        // tty update_topl() treats "You die" specially: it
        // replaces the logically stopped topline and clears
        // WIN_STOP rather than appending to the pline which
        // triggered Escape.  In debug/explore mode an earlier
        // actor's stopped pager yields directly to yn_function();
        // a pager owned by this same fatal contact still reaches
        // done()'s explicit message-window flush.
        await pline('You die...');
        game._suppressMessagesUntilInput = false;
        commitFatalEvent();
        if (pagerOwned)
            await waitForCurrentMonsterMore('You die...');
    }
    else if (announcesDeath) {
        await plineWithContinuation('You die...');
        commitFatalEvent();
        if (game.flags?.debug || game.flags?.explore)
            await waitForCurrentMonsterMore('You die...');
    }
    else {
        commitFatalEvent();
    }
    if (game.flags?.debug || game.flags?.explore) {
        delete game._statusHpOverride;
        const die = await promptYesNo('Die?');
        if (die !== 'y') {
            await plineWithContinuation("OK, so you don't die.");
            await restoreHeroAfterDeath();
            if (game.program_state.gameover)
                return true;
            // end.c leaves a one-turn nomovemsg.  It is emitted
            // only after the interrupted movemon() scan finishes;
            // if combat has appended to this recovery line, the
            // attempted third pline is what forces tty --More--.
            game._deathSurvivedMessagePending = true;
            game._deathSurvivalRunmodeDelayPending = true;
            return false;
        }
    }
    await finishOrdinaryDeath({
        killer: fatalKiller, deathCause: fatalDeathCause, deathType,
    });
    game.context.move = 0;
    return true;
}
export async function waitForCurrentMonsterMore(fallbackMessage = '') {
    const current = game._pending_message || fallbackMessage;
    const more = `${current}--More--`;
    await pline(more);
    await flush_screen(1);
    game.nhDisplay?.setCursor(more.length, 0);
    let key;
    do
        key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    game._pending_message = '';
    game._retained_message = '';
    if (key === 27)
        game._suppressMessagesUntilInput = true;
    return key;
}
//# sourceMappingURL=monster_attack_death.js.map