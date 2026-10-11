// Properties granted or blocked by monster armor. C worn.c:update_mon_extrinsics().

import { DISMOUNT_FELL } from './const.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    ALCHEMY_SMOCK, MUMMY_WRAPPING, OBJECT_PROPERTY, SADDLE, requireObjectData,
} from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { dismountHero } from './steed.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { PropertyName } from './property_types.js';

const RESISTANCE_BITS: Partial<Record<PropertyName, number>> = {
    fireResistance: 0x01,
    coldResistance: 0x02,
    sleepResistance: 0x04,
    disintegrationResistance: 0x08,
    shockResistance: 0x10,
    poisonResistance: 0x20,
    acidResistance: 0x40,
    stoneResistance: 0x80,
};

function equipmentProperties(object: GameObject): PropertyName[] {
    const primary = requireObjectData(OBJECT_PROPERTY, object.otyp);
    if (!primary) return [];
    if (object.otyp !== ALCHEMY_SMOCK) return [primary];
    return [primary, primary === 'poisonResistance' ? 'acidResistance' : 'poisonResistance'];
}

// Also used when constructing already-equipped monsters without game messages.
export function applyMonsterEquipmentProperties(
    monster: Monster, object: GameObject, on: boolean,
) {
    let speed: ReturnType<typeof adjustMonsterSpeed> | null = null;
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

interface EquipmentOptions {
    silently?: boolean;
    publish?: MessagePublisher;
}

export async function updateMonsterEquipment(
    monster: Monster,
    object: GameObject,
    on: boolean,
    state: GameState = game,
    { silently = false, publish = plineWithContinuation }: EquipmentOptions = {},
): Promise<void> {
    const wasVisible = canSeeMonster(monster);
    const speed = applyMonsterEquipmentProperties(monster, object, on);
    if (!silently && !state.in_mklev && speed && canSeeMonster(monster)) {
        const message = monsterSpeedMessage(speed, monsterSentenceSubject(monster));
        if (message) {
            await publish(message);
            object.dknown = true;
            learnObjectType(object.otyp, state);
        }
    }
    if (!on && state.u.usteed === monster && object.otyp === SADDLE)
        await dismountHero(DISMOUNT_FELL, { state, announce: publish });
    if (!silently && wasVisible !== canSeeMonster(monster))
        newsym(monster.mx, monster.my);
}
