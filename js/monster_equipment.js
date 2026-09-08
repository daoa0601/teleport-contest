// Properties granted or blocked by monster armor. C worn.c:update_mon_extrinsics().

import { DISMOUNT_FELL } from './const.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { ALCHEMY_SMOCK, MUMMY_WRAPPING, OBJECT_PROPERTY, SADDLE } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { dismountHero } from './steed.js';

const RESISTANCE_BITS = {
    fireResistance: 0x01,
    coldResistance: 0x02,
    sleepResistance: 0x04,
    disintegrationResistance: 0x08,
    shockResistance: 0x10,
    poisonResistance: 0x20,
    acidResistance: 0x40,
    stoneResistance: 0x80,
};

function equipmentProperties(object) {
    const primary = OBJECT_PROPERTY[object.otyp];
    if (object.otyp !== ALCHEMY_SMOCK) return [primary];
    return [primary, primary === 'poisonResistance' ? 'acidResistance' : 'poisonResistance'];
}

// Also used when constructing already-equipped monsters without game messages.
export function applyMonsterEquipmentProperties(monster, object, on) {
    let speed = null;
    for (const property of equipmentProperties(object)) {
        if (property === 'invisible') {
            monster.minvis = on ? !monster.invis_blkd : !!monster.perminvis;
        } else if (property === 'fast') {
            speed = adjustMonsterSpeed(monster, 0);
        } else {
            const bit = RESISTANCE_BITS[property];
            if (!bit) continue;
            if (on) {
                monster.mextrinsics = (monster.mextrinsics || 0) | bit;
            } else {
                const anotherSource = (monster.minvent || []).some(other =>
                    other !== object && other.owornmask
                    && equipmentProperties(other).includes(property));
                if (!anotherSource)
                    monster.mextrinsics = (monster.mextrinsics || 0) & ~bit;
            }
        }
    }
    if (object.otyp === MUMMY_WRAPPING) {
        monster.invis_blkd = on ? 1 : 0;
        monster.minvis = on ? false : !!monster.perminvis;
    }
    return speed;
}

export async function updateMonsterEquipment(monster, object, on, state = game, {
    silently = false,
    publish = plineWithContinuation,
} = {}) {
    const wasVisible = canSeeMonster(monster, monster.mx, monster.my);
    const speed = applyMonsterEquipmentProperties(monster, object, on);
    if (!silently && !state.in_mklev && speed && canSeeMonster(monster, monster.mx, monster.my)) {
        const message = monsterSpeedMessage(speed, monsterSentenceSubject(monster));
        if (message) {
            await publish(message);
            object.dknown = true;
            learnObjectType(object.otyp, state);
        }
    }
    if (!on && state.u.usteed === monster && object.otyp === SADDLE)
        await dismountHero(DISMOUNT_FELL, { state, announce: publish });
    if (!silently && wasVisible !== canSeeMonster(monster, monster.mx, monster.my))
        newsym(monster.mx, monster.my);
}
