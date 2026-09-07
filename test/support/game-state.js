import { COLNO, COULD_SEE, IN_SIGHT, ROWNO } from '../../js/const.js';
import { GameMap } from '../../js/game.js';
import { game, resetGame } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';
import { roles } from '../../js/roles.js';
import { initializeHeroSpecies } from '../../js/u_init.js';

function visibleGrid() {
    return Array.from(
        { length: ROWNO },
        () => new Uint8Array(COLNO).fill(COULD_SEE | IN_SIGHT),
    );
}

export function freshGame({
    level = new GameMap(),
    role = roles[0],
    heroX = 10,
    heroY = 10,
    hero = {},
    flags = { verbose: true, autoopen: true, pickup: false },
    context = { move: 0, forcefight: false, nopick: false },
    moves = 1,
    inventory = [],
} = {}) {
    resetGame();
    const attributes = Array(6).fill(10);
    Object.assign(game, {
        level,
        flags,
        context,
        moves,
        viz_array: visibleGrid(),
        inventory,
        uwep: null,
        uswapwep: null,
        uquiver: null,
        animationFrame: async () => {},
    });
    const roleKey = typeof role === 'string' ? role : role.key;
    const roleData = roles.find(candidate => candidate.key === roleKey);
    if (!roleData) throw new Error(`Unknown hero role: ${roleKey}`);
    game.urole = typeof role === 'string' ? roleData : { ...roleData, ...role };
    game.u = {
        ux: heroX,
        uy: heroY,
        ux0: heroX,
        uy0: heroY,
        uhp: 12,
        uhpmax: 12,
        ulevel: 1,
        uhunger: 900,
        acurr: { a: attributes.slice() },
        amax: { a: attributes.slice() },
        ualign: { type: 1, record: 10 },
        uconduct: {},
    };
    initializeHeroSpecies(game);
    Object.assign(game.u, hero);
    resetInputState();
    return game;
}
