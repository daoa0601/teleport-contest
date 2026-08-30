import { COLNO, IN_SIGHT, ROWNO } from '../../js/const.js';
import { game } from '../../js/gstate.js';

function visibleGrid() {
    return Array.from(
        { length: ROWNO }, () => new Uint8Array(COLNO).fill(IN_SIGHT),
    );
}

export function installLiveCommandHero({ role, level, x, y }) {
    Object.assign(game, {
        level,
        urole: { key: role },
        flags: { verbose: true, autoopen: true, pickup: false },
        context: { move: 0, forcefight: false, nopick: false },
        moves: 1,
        viz_array: visibleGrid(),
    });
    game.u = {
        ux: x, uy: y, ux0: x, uy0: y,
        uhp: 12, uhpmax: 12, ulevel: 1, uhunger: 900,
        acurr: { a: [10, 10, 10, 10, 10, 10] },
        amax: { a: [10, 10, 10, 10, 10, 10] },
        ualign: { type: 1, record: 10 },
        uconduct: {},
        _weaponSkills: { 4: 1 },
    };
}
