// state-digest.mts — canonical game-state digest at an input boundary.
//
// Mirrors nethack-c/probe/state-digest.patch field for field. Both sides
// sort each list, so the digest does not depend on chain or array order.
// One line per input boundary; "-" outside normal play.

import type { GameState } from '../../js/game_state.js';
import type { GameObject } from '../../js/object_types.js';
import { requireInitializedHero } from '../../js/hero_types.js';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const sortedList = (items: string[]): string => items.sort().join(';');

function bucState(object: GameObject): string {
    return object.blessed ? 'b' : object.cursed ? 'c' : 'u';
}

export function stateDigest(state: GameState): string {
    if (!state._moveloopStarted || state.program_state.gameover) return '-';
    const u = state.u;
    requireInitializedHero(u);
    const hero = [u.ux, u.uy, `${u.uhp}/${u.uhpmax}`, `${u.uen}/${u.uenmax}`, u.ulevel, u.uexp,
        u.uhunger, u.uac, u.ualign.record, u.uluck ?? 0].join(',');
    const inventory = state.inventory.map(o =>
        `${o.invlet || '?'}:${o.otyp}:${o.quan}:${o.spe}:${bucState(o)}`);
    const level = state.level;
    const monsters: string[] = [];
    const objects: string[] = [];
    if (level) {
        for (const m of level.monsters) {
            if (m.dead || m.mhp < 1) continue;
            monsters.push(`${pad2(m.mx)},${pad2(m.my)}:${m.mnum}:${m.mhp}/${m.mhpmax}:`
                + `${m.mtame ? 'T' : '-'}${m.mpeaceful ? 'P' : '-'}${m.msleeping ? 'S' : '-'}${m.mcanmove ? '-' : 'F'}`);
        }
        for (const column of level.objects) {
            for (const pile of column ?? []) {
                for (const o of pile ?? []) objects.push(`${pad2(o.ox)},${pad2(o.oy)}:${o.otyp}:${o.quan}`);
            }
        }
    }
    return [`T=${state.moves}`, `L=${u.uz.dnum}.${u.uz.dlevel}`, `U=${hero}`, `A=${u.acurr.a.join(',')}`,
        `I=${sortedList(inventory)}`, `M=${sortedList(monsters)}`, `O=${sortedList(objects)}`].join('\t');
}

export const DIGEST_FIELDS = ['T', 'L', 'U', 'A', 'I', 'M', 'O'] as const;
export type DigestField = typeof DIGEST_FIELDS[number];

// First differing field between two digests and a bounded view of it.
// Returns null when equal or when either side is outside normal play.
export function digestDifference(c: string, js: string): { field: DigestField | 'phase'; c: string; js: string } | null {
    if (c === js) return null;
    if (c === '-' || js === '-') return { field: 'phase', c: c.slice(0, 40), js: js.slice(0, 40) };
    const cFields = new Map(c.split('\t').map(part => [part.slice(0, 1), part.slice(2)]));
    const jsFields = new Map(js.split('\t').map(part => [part.slice(0, 1), part.slice(2)]));
    for (const field of DIGEST_FIELDS) {
        const a = cFields.get(field) ?? '', b = jsFields.get(field) ?? '';
        if (a !== b) return { field, ...boundedListDifference(a, b) };
    }
    return null;
}

// For ';' lists, show only the entries that differ (at most three each).
function boundedListDifference(a: string, b: string): { c: string; js: string } {
    const left = a.split(';'), right = b.split(';');
    if (left.length === 1 && right.length === 1) return { c: a.slice(0, 120), js: b.slice(0, 120) };
    const rightSet = new Set(right), leftSet = new Set(left);
    return {
        c: left.filter(entry => !rightSet.has(entry)).slice(0, 3).join(';').slice(0, 200),
        js: right.filter(entry => !leftSet.has(entry)).slice(0, 3).join(';').slice(0, 200),
    };
}
