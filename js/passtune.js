// The Stronghold passtune and its drawbridge hints.
// C ref: music.c do_play_instrument().

import { recordAchievement } from './achievements.js';
import { exerciseAttribute } from './attrib.js';
import {
    ACH_TUNE, A_WIS, Is_stronghold, isok,
} from './const.js';
import {
    findDrawbridgeAt, toggleDrawbridge,
} from './dbridge.js';
import {
    pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { OBJECT_NAMES } from './object_data.js';
import { getLine, promptYesNoQuit } from './query.js';

function instrumentName(instrument) {
    return instrument.name || OBJECT_NAMES[instrument.otyp] || 'instrument';
}

function heroIsDeaf() {
    return !!(game.deaf || (game.u?.deafTurns ?? 0) > 0);
}

function nearbyDrawbridge() {
    for (let y = (game.u?.uy || 0) - 1;
        y <= (game.u?.uy || 0) + 1;
        y++) {
        for (let x = (game.u?.ux || 0) - 1;
            x <= (game.u?.ux || 0) + 1;
            x++) {
            if (!isok(x, y)) continue;
            const bridge = findDrawbridgeAt(x, y, game);
            if (bridge) return bridge;
        }
    }
    return null;
}

function normalizeTune(tune) {
    return tune.trim().replace(/\s+/gu, ' ').toUpperCase()
        .replaceAll('H', 'B');
}

export async function askForTune() {
    if (game.u?.uevent?.uheard_tune === 2) {
        const answer = await promptYesNoQuit(
            'Play the passtune? [ynq] (q) ', 'q',
        );
        if (answer === 'q') return null;
        if (answer === 'y') return game.castleTune || '';
    }
    const tune = await getLine(
        'What tune are you playing? [5 notes, A-G]',
        (_ch, key) => key >= 32 && key < 127,
    );
    return tune === null ? null : normalizeTune(tune);
}

function tuneHint(played, expected) {
    const matched = Array(5).fill(false);
    let tumblers = 0;
    let gears = 0;
    for (let playedIndex = 0;
        playedIndex < played.length && playedIndex < 5;
        playedIndex++) {
        if (played[playedIndex] === expected[playedIndex]) {
            gears++;
            matched[playedIndex] = true;
            continue;
        }
        for (let expectedIndex = 0; expectedIndex < 5; expectedIndex++) {
            if (!matched[expectedIndex]
                && played[playedIndex] === expected[expectedIndex]
                && played[expectedIndex] !== expected[expectedIndex]) {
                tumblers++;
                matched[expectedIndex] = true;
                break;
            }
        }
    }
    return { tumblers, gears };
}

async function announceTuneHint({ tumblers, gears }) {
    if (tumblers && gears) {
        await plineWithContinuation(
            `You hear ${tumblers} tumbler${tumblers === 1 ? '' : 's'} click `
            + `and ${gears} gear${gears === 1 ? '' : 's'} turn.`,
        );
    } else if (tumblers) {
        await plineWithContinuation(
            `You hear ${tumblers} tumbler${tumblers === 1 ? '' : 's'} click.`,
        );
    } else if (gears) {
        await plineWithContinuation(
            `You hear ${gears} gear${gears === 1 ? '' : 's'} turn.`,
        );
    }
}

function recordKnownPasstune() {
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.uheard_tune = 2;
    recordAchievement(game, ACH_TUNE);
}

export async function playTune(instrument, tune) {
    await pline(heroIsDeaf()
        ? `You can feel your ${instrumentName(instrument)} emitting vibrations.`
        : `You extract a strange sound from your ${instrumentName(instrument)}!`);

    if (!Is_stronghold(game.u?.uz)) {
        game.context.move = 1;
        return;
    }
    exerciseAttribute(A_WIS, true);
    const expected = game.castleTune || '';
    const bridge = nearbyDrawbridge();
    if (tune === expected && bridge) {
        recordKnownPasstune();
        await toggleDrawbridge(bridge.x, bridge.y, game);
        game.context.move = 1;
        return;
    }
    if (heroIsDeaf()) {
        game.context.move = 1;
        return;
    }
    if (!game.u.uevent) game.u.uevent = {};
    if ((game.u.uevent.uheard_tune || 0) < 1)
        game.u.uevent.uheard_tune = 1;
    if (bridge) {
        const hint = tuneHint(tune, expected);
        await announceTuneHint(hint);
        if (hint.gears === 5) recordKnownPasstune();
    }
    game.context.move = 1;
}
