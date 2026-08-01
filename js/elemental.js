// elemental.js — Plane of Air cloud and Plane of Water bubble lifecycle.
// C ref: mkmaze.c setup_waterlevel(), mk_bubble(), movebubbles(), mv_bubble().
//
// Level construction owns the bubble list. goto_level() and the ordinary
// movement loop share movement of that same persistent list.

import { game } from './gstate.js';
import {
    AIR, CLOUD, COLNO, ROWNO, STONE, Is_airlevel, Is_waterlevel,
} from './const.js';
import { rn2 } from './rng.js';
import { CLR_GRAY } from './terminal.js';

const BUBBLE_MASKS = [
    { width: 2, height: 1, rows: [0x3] },
    { width: 3, height: 2, rows: [0x7, 0x7] },
    { width: 4, height: 3, rows: [0x6, 0xf, 0x6] },
    { width: 5, height: 3, rows: [0xe, 0x1f, 0xe] },
    { width: 6, height: 4, rows: [0x1e, 0x3f, 0x3f, 0x1e] },
    { width: 7, height: 4, rows: [0x3e, 0x7f, 0x7f, 0x3e] },
    { width: 8, height: 4, rows: [0x7e, 0xff, 0xff, 0x7e] },
];

const BOUNDS = {
    xmin: 3, ymin: 1, xmax: 78, ymax: 20,
    bubbleXMin: 4, bubbleYMin: 2, bubbleXMax: 77, bubbleYMax: 19,
};

function setElementalCell(loc, typ, lit) {
    if (!loc) return;
    loc.typ = typ;
    loc.roomno = 0;
    loc.lit = lit;
    loc.waslit = false;
    loc.flags = 0;
    loc.doormask = 0;
    loc.seenv = 0;
    loc.horizontal = false;
    loc.edge = false;
    loc.wall_info = 0;
    // mkmaze.c's `air_pos` assigns S_cloud to the persistent glyph field
    // even though the live terrain is AIR. With hero_memory disabled this
    // prepainted glyph, rather than ordinary exploration memory, fills the
    // out-of-sight Plane of Air during docrt().
    loc.remembered_glyph = {
        ch: '#', color: CLR_GRAY, decgfx: false, kind: 'terrain',
    };
}

function drawBubble(bubble) {
    const isAir = Is_airlevel(game.u?.uz);
    for (let dx = 0; dx < bubble.width; dx++) {
        for (let dy = 0; dy < bubble.height; dy++) {
            if (!(bubble.rows[dy] & (1 << dx))) continue;
            const loc = game.level?.at?.(bubble.x + dx, bubble.y + dy);
            if (isAir) {
                if (loc) {
                    loc.typ = CLOUD;
                    loc.lit = true;
                }
            } else if (Is_waterlevel(game.u?.uz) && loc) {
                loc.typ = AIR;
                loc.lit = true;
            }
        }
    }
}

function moveBubble(bubble, requestedDx, requestedDy, initial) {
    let dx = requestedDx;
    let dy = requestedDy;
    let collision = 0;

    // Air clouds move only one time in six. The probe belongs even to the
    // initial zero-distance draw which paints a newly allocated cloud.
    if (!Is_airlevel(game.u?.uz) || rn2(6) === 0) {
        if (dx < -1 || dx > 1) dx = Math.sign(dx);
        if (dy < -1 || dy > 1) dy = Math.sign(dy);

        if (bubble.x <= BOUNDS.bubbleXMin) collision |= 2;
        if (bubble.y <= BOUNDS.bubbleYMin) collision |= 1;
        if (bubble.x + bubble.width - 1 >= BOUNDS.bubbleXMax)
            collision |= 2;
        if (bubble.y + bubble.height - 1 >= BOUNDS.bubbleYMax)
            collision |= 1;

        bubble.x = Math.max(
            BOUNDS.bubbleXMin,
            Math.min(BOUNDS.bubbleXMax - bubble.width + 1, bubble.x),
        );
        bubble.y = Math.max(
            BOUNDS.bubbleYMin,
            Math.min(BOUNDS.bubbleYMax - bubble.height + 1, bubble.y),
        );

        if (bubble.x === BOUNDS.bubbleXMin && dx < 0) dx = -dx;
        if (bubble.x + bubble.width - 1 === BOUNDS.bubbleXMax && dx > 0)
            dx = -dx;
        if (bubble.y === BOUNDS.bubbleYMin && dy < 0) dy = -dy;
        if (bubble.y + bubble.height - 1 === BOUNDS.bubbleYMax && dy > 0)
            dy = -dy;

        bubble.x += dx;
        bubble.y += dy;
    }

    drawBubble(bubble);

    if (collision & 1) bubble.dy = -bubble.dy;
    if (collision & 2) bubble.dx = -bubble.dx;
    if (!collision && !initial
        && rn2(bubble.dx || bubble.dy ? 20 : 5) === 0) {
        bubble.dx = 1 - rn2(3);
        bubble.dy = 1 - rn2(3);
    }
}

function makeBubble(x, y, maskIndex) {
    if (x >= BOUNDS.bubbleXMax || y >= BOUNDS.bubbleYMax) return;
    const mask = BUBBLE_MASKS[Math.min(maskIndex, BUBBLE_MASKS.length - 1)];
    const bubble = {
        x: Math.min(x, BOUNDS.bubbleXMax - mask.width + 1),
        y: Math.min(y, BOUNDS.bubbleYMax - mask.height + 1),
        dx: 1 - rn2(3),
        dy: 1 - rn2(3),
        width: mask.width,
        height: mask.height,
        rows: [...mask.rows],
    };
    game.level.elementalBubbles.push(bubble);
    moveBubble(bubble, 0, 0, true);
}

export function setupElementalBubbles() {
    if (!Is_airlevel(game.u?.uz) && !Is_waterlevel(game.u?.uz)) return;

    game.level.flags.hero_memory = false;
    game.level.elementalBounds = { ...BOUNDS };
    game.level.elementalBubbles = [];

    const baseTerrain = Is_waterlevel(game.u?.uz) ? null : AIR;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level.at(x, y);
            if (loc?.typ === STONE && baseTerrain != null)
                loc.typ = baseTerrain;
        }
    }

    const xskip = Is_waterlevel(game.u?.uz)
        ? 10 + rn2(10) : 6 + rn2(4);
    const yskip = Is_waterlevel(game.u?.uz)
        ? 4 + rn2(4) : 3 + rn2(3);
    for (let x = BOUNDS.bubbleXMin; x <= BOUNDS.bubbleXMax; x += xskip)
        for (let y = BOUNDS.bubbleYMin; y <= BOUNDS.bubbleYMax; y += yskip)
            makeBubble(x, y, rn2(7));
}

export function moveElementalBubbles() {
    const bubbles = game.level?.elementalBubbles;
    if (!Array.isArray(bubbles) || !bubbles.length) return;

    if (Is_airlevel(game.u?.uz)) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = game.level.at(x, y);
                setElementalCell(loc, AIR, true);
                const xedge = x < BOUNDS.bubbleXMin
                    || x > BOUNDS.bubbleXMax;
                const yedge = y < BOUNDS.bubbleYMin
                    || y > BOUNDS.bubbleYMax;
                if ((xedge || yedge) && rn2(xedge ? 3 : 5) === 0)
                    loc.typ = CLOUD;
            }
        }
    }

    game._bubbleTraversalUp = !game._bubbleTraversalUp;
    const ordered = game._bubbleTraversalUp
        ? bubbles : [...bubbles].reverse();
    for (const bubble of ordered) {
        const rx = rn2(3);
        const ry = rn2(3);
        const dx = bubble.dx + 1
            - (!bubble.dx ? rx : (rx ? 1 : 0));
        const dy = bubble.dy + 1
            - (!bubble.dy ? ry : (ry ? 1 : 0));
        moveBubble(bubble, dx, dy, false);
    }
    game.vision_full_recalc = 1;
}
