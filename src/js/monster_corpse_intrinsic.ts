// Properties conveyed to monsters by corpses. C mon.c:mon_givit(), mon_give_prop().

import { chooseCorpseIntrinsic, shouldGiveIntrinsic } from './corpse_intrinsics.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { MONSTER_NAME, MONSTER_RESISTS, requireMonsterData } from './monster_data.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { monsterName } from './monster_name.js';
import { redrawMonsterWormSegments } from './monster_worm.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { PropertyName } from './property_types.js';

const STALKER = MONSTER_NAME.indexOf('stalker');

export async function grantMonsterCorpseIntrinsic(
    monster: Monster, species: number, state: GameState = game,
): Promise<void> {
    requireLiveGame(state);
    const property = chooseCorpseIntrinsic(species);
    const visible = canSeeMonster(monster);
    if (monster.mhp <= 0) return;

    if (species === STALKER) {
        if (!monster.perminvis || monster.invis_blkd) {
            const name = monsterName(monster, { state, capitalized: true });
            setMonsterPermanentInvisibility(monster);
            if (!monster.invis_blkd) {
                newsym(monster.mx, monster.my);
                if (monster.wormno) redrawMonsterWormSegments(monster);
            }
            if (visible) {
                const change = !canSpotMonster(monster) ? 'vanishes'
                    : monster.invis_blkd ? 'seems to flicker' : 'becomes invisible';
                await plineWithContinuation(`${name} ${change}.`);
            }
        }
        monster.mstun = 1;
        return;
    }

    // Native still makes the chance roll for properties that monsters cannot
    // retain, such as strength, telepathy, teleportation, acid, or petrification.
    if (!property || !shouldGiveIntrinsic(property, species)) return;
    await grantMonsterIntrinsic(monster, property, state);
}

// C mon.c:mon_give_prop(). Monsters retain only the six resistance bits.
export async function grantMonsterIntrinsic(
    monster: Monster, property: PropertyName | 'strength' | null,
    state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    const effect = monsterIntrinsic(property);
    if (!effect) return;
    const alreadyInnate = !!((requireMonsterData(MONSTER_RESISTS, monster.mnum)
        | (monster.mintrinsics ?? 0)) & effect.bit);
    monster.mintrinsics = (monster.mintrinsics ?? 0) | effect.bit;
    if (canSeeMonster(monster) && !alreadyInnate)
        await publish(`${monsterName(monster, { state, capitalized: true })} ${effect.message}`);
}

function monsterIntrinsic(property: PropertyName | 'strength' | null) {
    if (property !== 'fireResistance' && property !== 'coldResistance'
        && property !== 'sleepResistance' && property !== 'disintegrationResistance'
        && property !== 'shockResistance' && property !== 'poisonResistance') return null;
    switch (property) {
    case 'fireResistance': return { bit: 0x01, message: 'shivers slightly.' };
    case 'coldResistance': return { bit: 0x02, message: 'looks quite warm.' };
    case 'sleepResistance': return { bit: 0x04, message: 'looks wide awake.' };
    case 'disintegrationResistance': return { bit: 0x08, message: 'looks very firm.' };
    case 'shockResistance': return { bit: 0x10, message: 'crackles with static electricity.' };
    case 'poisonResistance': return { bit: 0x20, message: 'looks healthy.' };
    }
}
