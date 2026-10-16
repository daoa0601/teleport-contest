import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import { requirePlayingGame } from './gstate.js';
// Camera traversal and light striking a monster.
// C zap.c:bhit(FLASHED_LIGHT), uhitm.c:flash_hits_mon(), light.c.
import { COLNO, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, isok } from './const.js';
import { CLR_WHITE } from './terminal.js';
import { monsterHasArtifactDefense } from './artifacts.js';
import { monsterResistsBlindingLight } from './blinding_attack.js';
import {
    canSeeMonster, canSpotMonster, flushPendingTopline, flush_screen, glyphAt,
    map_invisible, newsym, plineWithContinuation as pline, shieldeff,
    show_glyph_cell, unmap_invisible,
} from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { lightHitsGremlin } from './light.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { angerMonster, wakeMonster } from './monster_anger.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName } from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { seeMonsterCloseup } from './monster_observation.js';
import { EXPENSIVE_CAMERA, WAN_LIGHT } from './object_data.js';
import { rayPositionIsOpen } from './ray.js';
import { visibleRegionAt } from './regions.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { cansee } from './vision.js';
import { cleanupTransientLight, showTransientLight } from './transient_light.js';

const GREMLIN = MONSTER_NAME.indexOf('gremlin');
const M1_NOEYES = 0x1000;
const S_LIGHT = 25;

export async function doBlindingRay(object: GameObject, { dx, dy }: { dx: number; dy: number }, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    object.ox = state.u.ux;
    object.oy = state.u.uy;
    const cells: Position[] = [];
    let heroDied = false;
    let x = state.u.ux, y = state.u.uy;
    try {
        for (let range = 0; range < COLNO; range++) {
            x += dx;
            y += dy;
            if (!isok(x, y)) break;
            if (!heroIsBlind(state)) await showTransientLight(null, x, y, state);
            const monster = monsterAtPosition(state.level, x, y);
            if (monster && M_AP_TYPE(monster) !== M_AP_OBJECT) {
                object.ox = state.u.ux;
                object.oy = state.u.uy;
                const onHead = x === monster.mx && y === monster.my;
                if (!monster.minvis) {
                    for (const cell of cells) newsym(cell.x, cell.y);
                    heroDied = (await flashHitsMonster(monster, object, { state, onHead })).heroDied;
                    if (!heroDied && object.otyp === EXPENSIVE_CAMERA)
                        await seeMonsterCloseup(monster, { state, photo: true, onHead });
                    break;
                }
                heroDied = (await flashHitsMonster(monster, object, { state, onHead })).heroDied;
                if (heroDied) break;
            }
            if (!rayPositionIsOpen(x, y, state)) break;
            if (cansee(x, y)) {
                if (!monster) unmap_invisible(x, y);
                cells.push({ x, y });
                show_glyph_cell(x, y, '!', CLR_WHITE);
                await flush_screen(0);
                await state.animationFrame?.();
            }
        }
    } finally {
        for (const cell of cells) newsym(cell.x, cell.y);
        await cleanupTransientLight(state);
    }
    return heroDied;
}

export async function flashHitsMonster(monster: Monster, object: GameObject, { state = game, onHead = true }: { state?: GameState; onHead?: boolean } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const result = { observed: false, heroDied: false };
    if (!onHead) return result;
    const visible = canSeeMonster(monster);
    const name = () => monsterName(monster, { state, capitalized: true });
    if (M_AP_TYPE(monster)) {
        const before = glyphAt(monster.mx, monster.my);
        const description = flashDisguiseDescription(monster, state);
        await wakeMonster(monster);
        const after = glyphAt(monster.mx, monster.my);
        if (before?.kind !== after?.kind || (before?.kind === 'monster' ? before.mnum : undefined) !== (after?.kind === 'monster' ? after.mnum : undefined)) {
            await pline(`That ${description} is really ${monsterName(monster, {
                state, article: monster.mtame ? 'your' : 'a',
            })}${monster.mtame ? '.' : '!'}`);
            result.observed = true;
        }
    }
    if (monster.msleeping && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)) {
        monster.msleeping = 0;
        if (visible) {
            await pline(`The flash awakens ${monsterName(monster, { state })}.`);
            result.observed = true;
        }
    } else if (MONSTER_SYMBOL[monster.mnum] !== S_LIGHT) {
        if (!monsterResistsBlindingLight(monster, state)) {
            const distance = (object.ox - monster.mx) ** 2 + (object.oy - monster.my) ** 2;
            if (visible) {
                await pline(`${name()} is blinded by the flash!`);
                result.observed = true;
            }
            if (monster.mnum === GREMLIN) {
                const damage = object.otyp === WAN_LIGHT ? d(1 + object.spe, 4)
                    : rnd(Math.min(monster.mhp, 4));
                const outcome = await lightHitsGremlin(monster, damage);
                result.heroDied = !!outcome?.heroDied;
            }
            if (monster.mhp > 0 && !result.heroDied) {
                if (!state.context.mon_moving) await angerMonster(monster, { attacked: true });
                if (distance < 9 && !monster.isshk && rn2(4)) {
                    const fleeing = await makeMonsterFlee(monster, {
                        state, turns: rn2(4) ? rnd(100) : 0,
                    });
                    result.heroDied = fleeing.heroDied;
                }
                monster.mcansee = 0;
                monster.mblinded = distance < 3 ? 0 : rnd(1 + Math.trunc(50 / distance));
            }
        } else if (visible) {
            if (monsterHasArtifactDefense(monster, 'blindness', state))
                await shieldeff(monster.mx, monster.my, state);
            if (state.flags.verbose) {
                await pline(state.level.requireAt(monster.mx, monster.my).lit
                    ? `The flash of light shines on ${monsterName(monster, { state })}.`
                    : `${name()} is illuminated.`);
                if (!state.level.requireAt(monster.mx, monster.my).lit) await flushPendingTopline();
            }
        }
    }
    if (result.observed && !state.level.requireAt(monster.mx, monster.my).lit)
        await flushPendingTopline();
    return result;
}

// Object disguises are skipped by the beam; the remaining descriptions use
// the actual disguise, even when the hero is hallucinating.
function flashDisguiseDescription(monster: Monster, state: GameState) {
    let description = M_AP_TYPE(monster) === M_AP_FURNITURE
        ? MAP_SYMBOLS[monster.mappearance ?? -1]?.name ?? 'thing'
        : monsterTypeName(monster.mappearance ?? -1, !!monster.female);
    const region = visibleRegionAt(state, monster.mx, monster.my);
    const range = Math.max(state.u.xray_range || 0, 1);
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (region && distance <= range * (range + 1))
        description += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    return description;
}
