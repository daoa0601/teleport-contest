// Monster-attributed hero death and its terminal continuations.
// C refs: end.c done_in_by()/done()/savelife(), tty message windows.
import { game } from './gstate.js';
import { MGIVENNAME, M_AP_MONSTER, M_AP_TYPE, STONING, Upolyd, ismnum } from './const.js';
import { canSpotMonster, flushPendingTopline, flush_screen, pline, plineWithContinuation } from './display.js';
import { beginHeroLifeSaving, completeHeroLifeSaving, finishOrdinaryDeath, identifyLifeSavingAmulet, restoreHeroAfterDeath, } from './end.js';
import { setHeroRemainsFromMonster } from './death_remains.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { promptYesNo } from './query.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { shopkeeperKillerName } from './shk.js';
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
// C end.c:done_in_by(). Fatal attribution describes the real killer even
// when its appearance, given name, or the hero's hallucination differs.
function fatalMonsterDescription(monster) {
    const current = monster.mnum;
    const champion = ismnum(monster.cham) ? monster.cham : current;
    const mimicker = M_AP_TYPE(monster) === M_AP_MONSTER;
    const imitator = current !== champion || mimicker;
    const givenName = MGIVENNAME(monster) || monster.name;
    const ghost = current === MONSTER_NAME.indexOf('ghost');
    const personal = (species) => !!((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME);
    const unique = (species) => !!((MONSTER_GENO[species] ?? 0) & G_UNIQ);
    const uniqueKiller = unique(current) && !(imitator && !mimicker)
        && (current !== MONSTER_NAME.indexOf('high cleric') || monster.ispriest);
    let article = uniqueKiller ? personal(current) ? '' : 'the ' : null;
    if (ghost && givenName)
        article = 'the ';
    let name = monster.minvis ? 'invisible ' : '';
    if (heroIsHallucinating(game) && canSpotMonster(monster))
        name += 'hallucinogen-distorted ';
    if (imitator) {
        const vampire = ['vampire', 'vampire leader', 'Vlad the Impaler']
            .some(species => champion === MONSTER_NAME.indexOf(species));
        const apparentSpecies = mimicker ? monster.mappearance : current;
        if (apparentSpecies === undefined || !ismnum(apparentSpecies))
            throw new Error('A monster killer has an invalid monster disguise.');
        const real = monsterTypeName(champion, monster.female);
        const apparent = !mimicker && vampire && real.toLowerCase().includes('vampire')
            && current === MONSTER_NAME.indexOf('vampire bat')
            ? 'bat' : monsterTypeName(apparentSpecies, monster.female);
        const shape = vampire || personal(apparentSpecies) ? apparent
            : unique(apparentSpecies) && apparentSpecies !== MONSTER_NAME.indexOf('high cleric')
                ? `the ${apparent}` : withIndefiniteArticle(apparent);
        name += vampire ? `${real} in ${shape} form`
            : `${real} ${mimicker ? 'disguised as' : 'imitating'} ${shape}`;
    }
    else if (ghost) {
        name += `ghost${givenName ? ` of ${givenName}` : ''}`;
    }
    else if (monster.isshk) {
        name += shopkeeperKillerName(monster);
        article = '';
    }
    else if (monster.ispriest || monster.isminion) {
        name += monsterName(monster, { article: 'none', exact: true, suppressSaddle: true });
    }
    else {
        name += monsterTypeName(current, monster.female);
        if (givenName)
            name += ` ${monster.mextra?.ebones ? 'of' : 'called'} ${givenName}`;
    }
    return article === null ? withIndefiniteArticle(name) : article + name;
}
export async function finishMonsterAttackDeath(monster, { pagerOwned = false, attribution = { kind: 'done-in-by' }, deathType = null, } = {}) {
    const customCause = attribution.kind === 'death-inflicted-by';
    const announcesDeath = !customCause || attribution.announcesDeath;
    const fatalLine = deathType === STONING ? 'You turn to stone...' : 'You die...';
    const hpSaveSentinel = game.u.uhp === -1;
    const projectedFatalLine = !!game._pending_message
        && !game._suppressMessagesUntilInput;
    if (projectedFatalLine && announcesDeath && deathType !== STONING) {
        // You("die...") flushes the raw injury before tty pages older prose.
        await flush_screen(1);
        await waitForCurrentMonsterMore();
    }
    // Petrification can append to a short hit or page a longer one. Both
    // happen in done_in_by(), before done() records zero HP for life saving.
    const petrificationAnnounced = announcesDeath && deathType === STONING;
    if (petrificationAnnounced)
        await plineWithContinuation(fatalLine);
    const fatalKiller = customCause ? attribution.killer : fatalMonsterDescription(monster);
    const fatalDeathCause = customCause
        ? attribution.deathCause ?? `killed by ${fatalKiller}`
        : `${deathType === STONING ? 'petrified' : 'killed'} by ${fatalKiller}`;
    if (!customCause) {
        // done_in_by() removes redundant attribution only for the causing monster.
        const reason = game._helplessReason;
        if (reason && typeof reason !== 'string' && reason.monsterId === monster.m_id) {
            const firstSpace = reason.text.indexOf(' ');
            if (firstSpace >= 0)
                game._helplessReason = { ...reason, text: reason.text.slice(0, firstSpace) };
        }
        setHeroRemainsFromMonster(monster, game);
    }
    // done_in_by() announces the death while HP still holds the lethal
    // (often negative) value; done() commits zero afterwards. The
    // life-saving transaction performs done()'s commit itself.
    const lifeSaving = beginHeroLifeSaving();
    if (lifeSaving) {
        // "But wait..." can page the fatal line. Native makeknown()
        // and its Wisdom exercise draw wait for that acknowledgement.
        const medallionEffect = heroIsBlind(game) ? 'feels warm' : 'begins to glow';
        if (announcesDeath && !petrificationAnnounced)
            await plineWithContinuation(fatalLine);
        await plineWithContinuation('But wait...');
        identifyLifeSavingAmulet();
        await plineWithContinuation(`Your medallion ${medallionEffect}!`);
        const dismissal = await plineWithContinuation('You feel much better!');
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
            game.context.botl = true;
        }
    };
    const previousStatusDisabled = game._statusUpdatesDisabled;
    if (hpSaveSentinel)
        game._statusUpdatesDisabled = true;
    try {
        if (announcesDeath && game._suppressMessagesUntilInput && deathType !== STONING) {
            // tty update_topl() treats "You die" specially: it
            // replaces the logically stopped topline and clears
            // WIN_STOP rather than appending to the pline which
            // triggered Escape.  In debug/explore mode an earlier
            // actor's stopped pager yields directly to yn_function();
            // a pager owned by this same fatal contact still reaches
            // done()'s explicit message-window flush.
            await pline(fatalLine);
            game._suppressMessagesUntilInput = false;
            commitFatalEvent();
            if (pagerOwned)
                await waitForCurrentMonsterMore(fatalLine);
        }
        else if (announcesDeath) {
            if (!petrificationAnnounced)
                await plineWithContinuation(fatalLine);
            commitFatalEvent();
            if (game.flags?.debug || game.flags?.explore)
                await waitForCurrentMonsterMore(fatalLine);
        }
        else {
            commitFatalEvent();
        }
    }
    finally {
        if (previousStatusDisabled === undefined)
            delete game._statusUpdatesDisabled;
        else
            game._statusUpdatesDisabled = previousStatusDisabled;
    }
    if (game.flags?.debug || game.flags?.explore) {
        const die = await promptYesNo('Die?');
        if (die !== 'y') {
            await plineWithContinuation("OK, so you don't die.");
            await restoreHeroAfterDeath();
            if (game.program_state.gameover)
                return true;
            return false;
        }
    }
    await finishOrdinaryDeath({
        killer: fatalKiller, deathCause: fatalDeathCause, deathType,
        deathVerb: deathType === STONING ? 'were petrified' : 'died',
    });
    game.context.move = 0;
    return true;
}
export async function waitForCurrentMonsterMore(fallbackMessage = '') {
    if (!game._pending_message)
        game._pending_message = fallbackMessage;
    return flushPendingTopline();
}
//# sourceMappingURL=monster_attack_death.js.map