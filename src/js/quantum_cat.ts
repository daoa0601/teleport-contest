// C pickup.c:observe_quantum_cat(), shared by opening and final disclosure.

import { monsterHasMapPosition } from './monster_location.js';
import { heroFootName } from './body_parts.js';
import { MM_ADJACENTOK, MM_NOMSG, NO_MINVENT } from './const.js';
import {
    canSpotMonster, plineWithContinuation as pline,
    randomDisplayMonsterName, randomDisplayMonsterSubject,
} from './display.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { game, requireGameLevel } from './gstate.js';
import { getObjectLocation } from './object_location.js';
import { makemonAt, makemonNear, set_corpsenm } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_NAME } from './monster_data.js';
import { LARGE_BOX } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { objectWeight } from './weight.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

interface QuantumCatOptions { makeCat?: boolean; showMessage?: boolean; state?: GameState }

const HOUSECAT = MONSTER_NAME.indexOf('housecat');
const CAT_NAME = "Schroedinger's Cat";

export function isQuantumBox(object: Pick<GameObject, 'otyp' | 'spe'>): boolean {
    return object.otyp === LARGE_BOX && object.spe === 1;
}

export async function observeQuantumCat(box: GameObject, {
    makeCat = true, showMessage = true, state = game,
}: QuantumCatOptions = {}): Promise<boolean> {
    if (!isQuantumBox(box)) return false;
    const alive = rn2(2) === 0;
    if (box.where === 'inventory') {
        box.ox = state.u.ux;
        box.oy = state.u.uy;
    } else if (box.where === 'minvent') {
        const location = getObjectLocation(box, state);
        if (!location) throw new Error('A carried quantum box requires its monster location');
        box.ox = location.x;
        box.oy = location.y;
    }
    const corpse = box.contents?.[0];
    if (alive) {
        // Final disclosure leaves a living cat in the box for the summary.
        if (!makeCat) return true;
        const besideHero = !state.in_mklev
            && box.ox === state.u.ux && box.oy === state.u.uy;
        const occupied = requireGameLevel(state).monsters.some(monster => monsterHasMapPosition(monster, state) &&
            !monster.dead && monster.mx === box.ox && monster.my === box.oy);
        const create = besideHero || occupied ? makemonNear : makemonAt;
        const cat = await create(HOUSECAT, box.ox, box.oy,
            NO_MINVENT | MM_ADJACENTOK | MM_NOMSG);
        if (!cat) return true;
        cat.mpeaceful = 1;
        setMonsterMalign(cat, state);
        if (showMessage) {
            if (!canSpotMonster(cat)) {
                await pline(`You think something brushed your ${heroFootName()}.`);
            } else {
                const subject = heroIsHallucinating(state)
                    ? randomDisplayMonsterSubject() : 'The housecat';
                await pline(`${subject} inside the box is still alive!`);
            }
        }
        cat.name = CAT_NAME;
        if (corpse) await deleteObject(corpse, state);
        box.owt = objectWeight(box);
        box.spe = 0;
        if (!state.context.mon_moving) {
            addExperience(10, 20, state);
            await checkExperienceLevel();
        }
    } else {
        box.spe = 0;
        if (showMessage) {
            const subject = heroIsHallucinating(state)
                ? randomDisplayMonsterName() : 'housecat';
            await pline(`The ${subject} inside the box is dead!`);
        }
        if (corpse) {
            corpse.age = state.moves;
            set_corpsenm(corpse, HOUSECAT);
            (corpse.oextra ||= {}).oname = CAT_NAME;
            if (!state.context.mon_moving) {
                addExperience(20, 10, state);
                await checkExperienceLevel();
            }
        }
    }
    return true;
}
