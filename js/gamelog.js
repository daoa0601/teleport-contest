// gamelog.js — Chronicle of source-owned in-game events.
// C refs: livelog.c:livelog_printf(), insight.c:do_gamelog().

import { game } from './gstate.js';

export function recordGameLogEvent(text, {
    state = game, turn = state.moves || 1,
} = {}) {
    if (!text) return null;
    if (!Array.isArray(state.gamelog)) state.gamelog = [];
    const entry = { turn: Math.max(1, Math.trunc(turn)), text: String(text) };
    state.gamelog.push(entry);
    return entry;
}

export function gameLogEvents(state = game) {
    return Array.isArray(state.gamelog) ? state.gamelog : [];
}

export function initialDungeonEntryText(state = game) {
    const alignment = state.initAlignment?.name || 'unaligned';
    const race = state.urace?.adj || state.urace?.noun || 'human';
    const female = !!state.flags?.female;
    const roleName = female
        ? state.urole?.name?.f || state.urole?.name?.m
        : state.urole?.name?.m || state.urole?.name?.f;
    const role = roleName || state.urole?.key || 'Adventurer';
    const player = state.displayName || state.plname || 'Player';
    return `${player} the ${alignment} ${race} ${role} entered the dungeon`;
}
