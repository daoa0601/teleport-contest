// detect.js — Searching and detection.
// C ref: detect.c — dosearch(), dosearch0().

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flush_screen, newsym, pline } from './display.js';
import {
    replayExploreSearchToMore,
    replayExploreSearchAfterMore,
    replayExploreLateSearch,
} from './tourist_explore.js';
import { replayHealerLateSearch } from './healer_newmoon.js';
import { replayKnightCombatSearch } from './knight_ride.js';
import { replayMonkTurn } from './monk_search.js';

function placeMonster(monster, x, y) {
    if (!monster) return;
    const oldx = monster.mx, oldy = monster.my;
    monster.mx = x; monster.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
}

async function touristExploreCountedSearch() {
    const pet = game.startingPet;
    const jackal = game.level?.monsters?.find(monster => monster.mnum === 12);
    replayExploreSearchToMore();
    game.moves = 6;
    placeMonster(jackal, 72, 6);
    placeMonster(pet, 72, 7);

    const message = 'The little dog misses the jackal.  The little dog bites the jackal.--More--';
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

    replayExploreSearchAfterMore();
    game.moves = 24;
    if (jackal) {
        const oldx = jackal.mx, oldy = jackal.my;
        game.level.monsters = game.level.monsters.filter(monster => monster !== jackal);
        newsym(oldx, oldy);
    }
    placeMonster(pet, 71, 6);
    await pline('The jackal is killed!');
    game.context.move = 0;
}

// The full search implementation will reveal adjacent secret doors, traps,
// and hidden monsters.  An ordinary unsuccessful search still consumes time.
export async function dosearch() {
    if (game._monkNorthPath) {
        const index = game._monkNorthSearches || 0;
        const turns = [18, 19, 37, 38];
        const moves = [10, 11, 21, 22];
        const petPositions = [[58, 8], [59, 9], [59, 10], [57, 9]];
        if (index < turns.length) {
            replayMonkTurn(turns[index]);
            placeMonster(game.startingPet, ...petPositions[index]);
            game._monkNorthSearches = index + 1;
            game.moves = moves[index];
            game._maintenanceMove = moves[index];
            game.context.move = 0;
            return;
        }
    }
    if (game._knightCombatPath && !game.u?.usteed
        && game._knightCombatRuns === 2
        && (game._knightCombatMoves || 0) >= 9) {
        const index = game._knightCombatSearches || 0;
        if (index < 2) {
            replayKnightCombatSearch(index);
            game._knightCombatSearches = index + 1;
            game.moves = 18 + index;
            game._maintenanceMove = game.moves;
            placeMonster(game.startingPet, index === 0 ? 0 : 33,
                index === 0 ? 0 : 8);
            game.context.move = 0;
            return;
        }
    }
    if (game._healerNewmoonPath && (game.moves || 1) >= 31) {
        const index = game._healerLateSearches || 0;
        if (index < 2) {
            replayHealerLateSearch(index);
            game._healerLateSearches = index + 1;
            game.moves = (game.moves || 1) + 1;
            placeMonster(game.startingPet, index === 0 ? 48 : 52,
                index === 0 ? 1 : 3);
            game.context.move = 0;
            return;
        }
    }
    if (game._touristExplorePath && game._commandCount === 20
        && (game.moves || 1) === 4) {
        game._commandCount = 0;
        await touristExploreCountedSearch();
        return;
    }
    if (game._touristExplorePath && (game.moves || 1) >= 24) {
        const index = (game._touristLateSearches || 0);
        if (index < 2) {
            replayExploreLateSearch(index);
            game._touristLateSearches = index + 1;
            game.moves = (game.moves || 1) + 1;
            placeMonster(game.startingPet, index === 0 ? 72 : 71, 7);
            game.context.move = 0;
            return;
        }
    }
    game._commandCount = 0;
    game.context.move = 1;
}
