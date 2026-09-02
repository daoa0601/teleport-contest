// Long-worm body ownership.
// C refs: makemon.c:initworm(), worm.c:place_worm_tail_randomly(), wormgone().

import { xdir, ydir } from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { rn2 } from './rng.js';
import { monsterGoodPosition } from './teleport_rules.js';

const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

function nextWormNumber(state) {
    const used = new Set((state.level?.monsters || [])
        .map(monster => monster.wormno)
        .filter(Boolean));
    let wormno = 1;
    while (wormno < 32 && used.has(wormno)) wormno++;
    return wormno < 32 ? wormno : 0;
}

export function removeMonsterWormBody(monster) {
    if (!monster) return;
    monster.wormno = 0;
    monster.wormSegments = [];
}

export function initializeMonsterWormBody(
    monster,
    {
        allowTail = true,
        state = game,
        random = rn2,
    } = {},
) {
    const wormno = nextWormNumber(state);
    if (!wormno) return false;

    monster.wormno = wormno;
    monster.wormSegments = [];
    const requestedSegments = allowTail ? random(5) : 0;
    let oldX = monster.mx;
    let oldY = monster.my;
    for (let segment = 0; segment < requestedSegments; segment++) {
        const directions = Array.from({ length: 8 }, (_, index) => index);
        for (let remaining = 8; remaining > 0; remaining--) {
            const selected = random(remaining);
            [directions[selected], directions[remaining - 1]]
                = [directions[remaining - 1], directions[selected]];
        }

        let next = null;
        for (const direction of directions) {
            const x = oldX + xdir[direction];
            const y = oldY + ydir[direction];
            if (monsterGoodPosition(
                PM_LONG_WORM, x, y, false, false, false, state,
            )) {
                next = { x, y };
                break;
            }
        }
        if (!next) break;
        monster.wormSegments.push(next);
        oldX = next.x;
        oldY = next.y;
    }
    return true;
}
