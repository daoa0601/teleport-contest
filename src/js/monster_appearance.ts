// Reveal a monster that is imitating another monster, furniture, or an object.
// C ref: mon.c seemimic().

import {
    DOOR, IS_WALL, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, SDOOR, TREE,
} from './const.js';
import { newsym } from './display.js';
import { BOULDER } from './object_data.js';
import { vision_note_blocker_change } from './vision.js';
import type { Monster } from './monster_types.js';

function appearanceBlocksLight(type: number, appearance: number): boolean {
    if (type === M_AP_OBJECT) return appearance === BOULDER;
    if (type !== M_AP_FURNITURE) return false;
    return (appearance >= 0 && appearance < 12)
        || appearance === 15 || appearance === 16 || appearance === 18
        || appearance === TREE || appearance === SDOOR
        || appearance === DOOR || IS_WALL(appearance);
}

export function revealMonsterAppearance(monster: Monster, {
    includeMonsterDisguise = true,
} = {}) {
    const type = M_AP_TYPE(monster);
    const appearance = monster?.mappearance ?? 0;
    if (type === 0 || type === M_AP_MONSTER && !includeMonsterDisguise) {
        return {
            revealed: false, type, appearance, lightBlocker: false,
        };
    }

    const lightBlocker = appearanceBlocksLight(type, appearance);
    const corpsenm = monster.mcorpsenm
        ?? monster.mextra?.mcorpsenm ?? null;
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    delete monster.mcorpsenm;
    if (monster.mextra) delete monster.mextra.mcorpsenm;
    if (lightBlocker)
        vision_note_blocker_change(monster.mx, monster.my);
    newsym(monster.mx, monster.my);
    return {
        revealed: true, type, appearance, corpsenm, lightBlocker,
    };
}
