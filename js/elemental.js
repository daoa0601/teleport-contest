// elemental.js — Plane of Air cloud and Plane of Water bubble lifecycle.
// C ref: mkmaze.c setup_waterlevel(), mk_bubble(), movebubbles(), mv_bubble().
//
// Level construction owns the bubble list. goto_level() and the ordinary
// movement loop share movement of that same persistent list.
import { monsterAtPosition } from './monster_location.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { AIR, CLOUD, COLNO, MON_BUBBLEMOVE, RLOC_NOMSG, ROWNO, STONE, WATER, Is_airlevel, Is_waterlevel, } from './const.js';
import { rn2 } from './rng.js';
import { CLR_BRIGHT_BLUE, CLR_GRAY } from './terminal.js';
import { newsym } from './display.js';
import { placeObjectSynchronously, remove_object, stack_object } from './floor_object.js';
import { placeHeroOnLevel } from './hero_location.js';
import { clearMonsterWormFromMap } from './monster_worm.js';
import { mnearto } from './shop_damage.js';
import { dealWithMonsterOvercrowding, moveMonsterNextToHero } from './teleport.js';
import { vision_recalc, vision_reset } from './vision.js';
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
    if (!loc)
        return;
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
    // movebubbles() resets old air clouds to an Air cell remembered as Cloud,
    // and old water bubbles to a Water cell remembered as Water.
    const water = typ === WATER;
    loc.remembered_glyph = {
        ch: water ? '}' : '#',
        color: water ? CLR_BRIGHT_BLUE : CLR_GRAY,
        decgfx: false, kind: 'terrain', terrainName: water ? 'water' : 'cloud',
    };
}
function bubbleCells(bubble) {
    const cells = [];
    for (let dx = 0; dx < bubble.width; dx++) {
        for (let dy = 0; dy < bubble.height; dy++) {
            if ((bubble.rows[dy] ?? 0) & (1 << dx))
                cells.push({ x: bubble.x + dx, y: bubble.y + dy });
        }
    }
    return cells;
}
async function restoreBubbleContents(bubble, dx, dy) {
    requirePlayingGame(game);
    const level = requireGameLevel();
    for (const content of bubble.contents || []) {
        const x = content.x + dx, y = content.y + dy;
        if (content.kind === 'objects') {
            for (const object of content.items) {
                placeObjectSynchronously(object, x, y);
                await stack_object(object);
            }
        }
        else if (content.kind === 'monster') {
            if (!await mnearto(content.monster, x, y, game, { moveOther: true, flags: RLOC_NOMSG }))
                await dealWithMonsterOvercrowding(content.monster);
        }
        else if (content.kind === 'hero') {
            const occupant = monsterAtPosition(level, x, y);
            const oldx = game.u.ux, oldy = game.u.uy;
            await placeHeroOnLevel(x, y);
            newsym(oldx, oldy);
            if (occupant)
                await moveMonsterNextToHero(occupant, game, { flags: RLOC_NOMSG });
        }
        else if (content.kind === 'trap') {
            content.trap.tx = x;
            content.trap.ty = y;
        }
    }
    bubble.contents = [];
}
function collectWaterBubbleContents(bubble) {
    const level = requireGameLevel();
    bubble.contents = [];
    for (const { x, y } of bubbleCells(bubble)) {
        const pile = level.objects[x]?.[y];
        if (pile?.length) {
            const items = [];
            for (const object of [...pile]) {
                remove_object(object);
                object.ox = 0;
                object.oy = 0;
                items.unshift(object);
            }
            bubble.contents.unshift({ kind: 'objects', x, y, items });
        }
        const monster = monsterAtPosition(level, x, y);
        if (monster) {
            bubble.contents.unshift({ kind: 'monster', x, y, monster });
            if (monster.wormno)
                clearMonsterWormFromMap(monster);
            monster.mx = 0;
            monster.my = 0;
            monster.mstate = (monster.mstate ?? 0) | MON_BUBBLEMOVE;
            newsym(x, y);
        }
        if (!game.u?.uswallow && game.u?.ux === x && game.u?.uy === y) {
            bubble.contents.unshift({ kind: 'hero', x, y });
            game._heroBubble = bubble;
        }
        const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (trap)
            bubble.contents.unshift({ kind: 'trap', x, y, trap });
        setElementalCell(level.at(x, y), WATER, false);
    }
}
function drawBubble(bubble) {
    const isAir = Is_airlevel(game.u?.uz);
    for (let dx = 0; dx < bubble.width; dx++) {
        for (let dy = 0; dy < bubble.height; dy++) {
            if (!((bubble.rows[dy] ?? 0) & (1 << dx)))
                continue;
            const loc = game.level?.at?.(bubble.x + dx, bubble.y + dy);
            if (isAir) {
                if (loc) {
                    loc.typ = CLOUD;
                    loc.lit = true;
                }
            }
            else if (Is_waterlevel(game.u?.uz) && loc) {
                loc.typ = AIR;
                loc.lit = true;
            }
        }
    }
    vision_reset();
}
async function moveBubble(bubble, requestedDx, requestedDy, initial) {
    const motion = moveBubblePosition(bubble, requestedDx, requestedDy);
    drawBubble(bubble);
    if (Is_waterlevel(game.u?.uz) && !initial)
        await restoreBubbleContents(bubble, motion.dx, motion.dy);
    changeBubbleDirection(bubble, motion.collision, initial);
}
function moveBubblePosition(bubble, requestedDx, requestedDy) {
    let dx = requestedDx;
    let dy = requestedDy;
    let collision = 0;
    // Air clouds move only one time in six. The probe belongs even to the
    // initial zero-distance draw which paints a newly allocated cloud.
    if (!Is_airlevel(game.u?.uz) || rn2(6) === 0) {
        if (dx < -1 || dx > 1)
            dx = Math.sign(dx);
        if (dy < -1 || dy > 1)
            dy = Math.sign(dy);
        if (bubble.x <= BOUNDS.bubbleXMin)
            collision |= 2;
        if (bubble.y <= BOUNDS.bubbleYMin)
            collision |= 1;
        if (bubble.x + bubble.width - 1 >= BOUNDS.bubbleXMax)
            collision |= 2;
        if (bubble.y + bubble.height - 1 >= BOUNDS.bubbleYMax)
            collision |= 1;
        bubble.x = Math.max(BOUNDS.bubbleXMin, Math.min(BOUNDS.bubbleXMax - bubble.width + 1, bubble.x));
        bubble.y = Math.max(BOUNDS.bubbleYMin, Math.min(BOUNDS.bubbleYMax - bubble.height + 1, bubble.y));
        if (bubble.x === BOUNDS.bubbleXMin && dx < 0)
            dx = -dx;
        if (bubble.x + bubble.width - 1 === BOUNDS.bubbleXMax && dx > 0)
            dx = -dx;
        if (bubble.y === BOUNDS.bubbleYMin && dy < 0)
            dy = -dy;
        if (bubble.y + bubble.height - 1 === BOUNDS.bubbleYMax && dy > 0)
            dy = -dy;
        bubble.x += dx;
        bubble.y += dy;
    }
    return { dx, dy, collision };
}
function changeBubbleDirection(bubble, collision, initial) {
    if (collision & 1)
        bubble.dy = -bubble.dy;
    if (collision & 2)
        bubble.dx = -bubble.dx;
    if (!collision && !initial
        && rn2(bubble.dx || bubble.dy ? 20 : 5) === 0) {
        bubble.dx = 1 - rn2(3);
        bubble.dy = 1 - rn2(3);
    }
}
// C restore_waterlevel() redraws each saved bubble through mv_bubble(...,
// TRUE), including its Air-plane movement roll and border-direction bounce.
export function restoreElementalBubbles() {
    if (!Is_airlevel(game.u.uz) && !Is_waterlevel(game.u.uz))
        return;
    game._heroBubble = null;
    for (const bubble of game.level?.elementalBubbles ?? []) {
        const motion = moveBubblePosition(bubble, 0, 0);
        drawBubble(bubble);
        changeBubbleDirection(bubble, motion.collision, true);
    }
}
async function makeBubble(x, y, maskIndex) {
    if (x >= BOUNDS.bubbleXMax || y >= BOUNDS.bubbleYMax)
        return;
    const mask = BUBBLE_MASKS[Math.min(maskIndex, BUBBLE_MASKS.length - 1)];
    if (!mask)
        throw new Error(`Elemental bubble has invalid shape ${maskIndex}`);
    const bubble = {
        x: Math.min(x, BOUNDS.bubbleXMax - mask.width + 1),
        y: Math.min(y, BOUNDS.bubbleYMax - mask.height + 1),
        dx: 1 - rn2(3),
        dy: 1 - rn2(3),
        width: mask.width,
        height: mask.height,
        rows: [...mask.rows],
    };
    const bubbles = requireGameLevel().elementalBubbles;
    if (!bubbles)
        throw new Error('Elemental bubble construction has no initialized bubble list');
    bubbles.push(bubble);
    await moveBubble(bubble, 0, 0, true);
}
export async function setupElementalBubbles() {
    if (!Is_airlevel(game.u?.uz) && !Is_waterlevel(game.u?.uz))
        return;
    const level = requireGameLevel();
    level.flags.hero_memory = false;
    level.elementalBounds = { ...BOUNDS };
    level.elementalBubbles = [];
    const baseTerrain = Is_waterlevel(game.u?.uz) ? WATER : AIR;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = level.at(x, y);
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
            await makeBubble(x, y, rn2(7));
}
export async function moveElementalBubbles() {
    const bubbles = game.level?.elementalBubbles;
    if (!Array.isArray(bubbles) || !bubbles.length)
        return;
    const level = requireGameLevel();
    vision_recalc(2);
    game._heroBubble = null;
    const traversalUp = !!game._bubbleTraversalUp;
    if (Is_waterlevel(game.u?.uz)) {
        const collectionOrder = traversalUp
            ? bubbles : [...bubbles].reverse();
        for (const bubble of collectionOrder)
            collectWaterBubbleContents(bubble);
    }
    else if (Is_airlevel(game.u?.uz)) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = level.requireAt(x, y);
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
    game._bubbleTraversalUp = !traversalUp;
    const ordered = game._bubbleTraversalUp
        ? bubbles : [...bubbles].reverse();
    for (const bubble of ordered) {
        const rx = rn2(3);
        const ry = rn2(3);
        const dx = bubble.dx + 1
            - (!bubble.dx ? rx : (rx ? 1 : 0));
        const dy = bubble.dy + 1
            - (!bubble.dy ? ry : (ry ? 1 : 0));
        await moveBubble(bubble, dx, dy, false);
    }
    game.vision_full_recalc = 1;
}
// C mkmaze.c:maybe_adjust_hero_bubble(). The bubble last carrying the hero
// remains sticky for subsequent steps until movebubbles() collects again.
export function maybeAdjustHeroBubble() {
    const hero = game.u;
    if (!Is_waterlevel(hero.uz) || (!hero.dx && !hero.dy))
        return;
    const bubble = game._heroBubble;
    if (bubble && game.level?.elementalBubbles?.includes(bubble) && !rn2(2)) {
        bubble.dx = hero.dx ?? 0;
        bubble.dy = hero.dy ?? 0;
    }
}
//# sourceMappingURL=elemental.js.map