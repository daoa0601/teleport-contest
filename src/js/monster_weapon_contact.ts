// C uhitm.c:mhitm_ad_phys(): damage precedes pudding division.
import { exerciseAttribute } from './attrib.js';
import { A_STR } from './const.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { cloneHeroMonsterForm } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { objectMaterial } from './object_material.js';
import type { GameObject } from './object_types.js';
import type { rnd } from './rng.js';

const IRON = 11, METAL = 12;
const PUDDINGS = new Set(['black pudding', 'brown pudding'].map(name => MONSTER_NAME.indexOf(name)));

export async function divideHeroFromWeaponHit(
    monster: Monster, weapon: GameObject, damage: number, state: PlayingGameState,
    publish: MessagePublisher, rollOne: typeof rnd,
): Promise<number> {
    // Native calculates this trial reduction for every armed physical hit.
    // The shared hitmu() tail rolls its own reduction if division did not occur.
    let reducedDamage = damage;
    if (state.u.uac < 0) reducedDamage -= rollOne(-state.u.uac);
    reducedDamage = Math.max(1, reducedDamage);
    if (state.u.halfPhysicalDamage) reducedDamage = Math.trunc((reducedDamage + 1) / 2);
    if (state.u.mh - reducedDamage <= 1 || !PUDDINGS.has(state.u.umonnum)
        || ![IRON, METAL].includes(objectMaterial(weapon, state))) return damage;

    if (reducedDamage > 1) await exerciseAttribute(A_STR, false, state);
    state.u.mh -= reducedDamage;
    state.context.botl = true;
    if (await cloneHeroMonsterForm(state))
        await publish(`You divide as ${monsterName(monster, { state })} hits you!`);
    return 0;
}
