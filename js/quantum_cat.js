// C pickup.c:observe_quantum_cat(), shared by opening and final disclosure.

import { heroFootName } from './body_parts.js';
import { MM_ADJACENTOK, MM_NOMSG, NO_MINVENT } from './const.js';
import {
    canSpotMonster, plineWithContinuation as pline,
    randomDisplayMonsterName, randomDisplayMonsterSubject,
} from './display.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { game } from './gstate.js';
import { makemonAt, makemonNear, set_corpsenm } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_NAME } from './monster_data.js';
import { LARGE_BOX } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { objectWeight } from './weight.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';

const HOUSECAT = MONSTER_NAME.indexOf('housecat');
const CAT_NAME = "Schroedinger's Cat";

export function isQuantumBox(object) {
    return object.otyp === LARGE_BOX && object.spe === 1;
}

export async function observeQuantumCat(box, {
    makeCat = true, showMessage = true, state = game,
} = {}) {
    if (!isQuantumBox(box)) return false;
    const alive = rn2(2) === 0;
    if (box.where === 'inventory') {
        box.ox = state.u.ux;
        box.oy = state.u.uy;
    } else if (box.where === 'minvent') {
        box.ox = box.ocarry.mx;
        box.oy = box.ocarry.my;
    }
    const corpse = box.contents?.[0];
    if (alive) {
        // Final disclosure leaves a living cat in the box for the summary.
        if (!makeCat) return true;
        const besideHero = !state.in_mklev
            && box.ox === state.u.ux && box.oy === state.u.uy;
        const occupied = state.level.monsters.some(monster =>
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
        if (corpse) deleteObject(corpse, state);
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
