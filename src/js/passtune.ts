// The Stronghold passtune and its drawbridge hints.
// C ref: music.c do_play_instrument().

import { publishHeardMessage } from './hero_speech.js';
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
import type { GameObject } from './object_types.js';
import { definiteName, objectCombatName } from './objnam.js';
import { getLine, promptYesNoQuit } from './query.js';

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

function normalizeTune(tune: string): string {
    return tune.trim().replace(/\s+/gu, ' ').toUpperCase()
        .replaceAll('H', 'B');
}

export async function askForTune() {
    if (game.u?.uevent?.uheard_tune === 2) {
        const answer = await promptYesNoQuit(
            'Play the passtune?', 'q',
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

function tuneHint(played: string, expected: string): { tumblers: number; gears: number } {
    const matched = Array<boolean>(5).fill(false);
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

async function announceTuneHint({ tumblers, gears }: { tumblers: number; gears: number }): Promise<void> {
    if (tumblers && gears) {
        await publishHeardMessage(
            `${tumblers} tumbler${tumblers === 1 ? '' : 's'} click `
            + `and ${gears} gear${gears === 1 ? '' : 's'} turn.`, plineWithContinuation,
        );
    } else if (tumblers) {
        await publishHeardMessage(`${tumblers} tumbler${tumblers === 1 ? '' : 's'} click.`, plineWithContinuation);
    } else if (gears) {
        await publishHeardMessage(`${gears} gear${gears === 1 ? '' : 's'} turn.`, plineWithContinuation);
    }
}

function recordKnownPasstune() {
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.uheard_tune = 2;
    recordAchievement(game, ACH_TUNE);
}

export async function playTune(instrument: GameObject, tune: string, options: Parameters<typeof toggleDrawbridge>[3] = {}): Promise<void> {
    const name = definiteName(objectCombatName(instrument));
    await pline(heroIsDeaf()
        ? `You can feel ${name} emitting vibrations.`
        : `You extract a strange sound from ${name}!`);

    if (!Is_stronghold(game.u?.uz)) {
        game.context.move = 1;
        return;
    }
    await exerciseAttribute(A_WIS, true);
    const expected = game.castleTune || '';
    const bridge = nearbyDrawbridge();
    if (tune === expected && bridge) {
        recordKnownPasstune();
        await toggleDrawbridge(bridge.x, bridge.y, game, options);
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
