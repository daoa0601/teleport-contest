// Native mondata.c:defended() and artifact.c:defends(). This is the
// wielded-weapon/dragon-body check; innate and carried resistances are separate.
import { dragonFormForArmor } from './armor.js';
import { artifactById } from './artifacts.js';
import { W_ARM } from './const.js';
import { game } from './gstate.js';
import {
    AD_ACID, AD_BLND, AD_COLD, AD_DISE, AD_DISN, AD_DRLI, AD_DRST, AD_ELEC,
    AD_FIRE, AD_HALU, AD_MAGM, AD_PHYS, AD_PLYS, AD_SLEE, AD_SLOW, AD_STON, AD_WERE,
} from './monster_attack_types.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import type { ArtifactDefense } from './data_types.js';
import type { GameState } from './game_state.js';
import type { DamageType } from './monster_attack_types.js';
import type { Monster } from './monster_types.js';

const ARTIFACT_DEFENSE: Partial<Record<DamageType, ArtifactDefense | null>> = {
    [AD_PHYS]: null, [AD_DRLI]: 'life-drain', [AD_DRST]: 'poison',
    [AD_MAGM]: 'magic', [AD_COLD]: 'cold', [AD_FIRE]: 'fire',
    [AD_WERE]: 'lycanthropy', [AD_BLND]: 'blindness',
};
const DRAGON_DEFENSE: Partial<Record<DamageType, number>> = {
    [AD_MAGM]: MONSTER_NAME.indexOf('gray dragon'),
    [AD_HALU]: MONSTER_NAME.indexOf('gold dragon'),
    [AD_FIRE]: MONSTER_NAME.indexOf('red dragon'),
    [AD_COLD]: MONSTER_NAME.indexOf('white dragon'),
    [AD_DRST]: MONSTER_NAME.indexOf('green dragon'),
    [AD_DISE]: MONSTER_NAME.indexOf('green dragon'),
    [AD_SLEE]: MONSTER_NAME.indexOf('orange dragon'),
    [AD_PLYS]: MONSTER_NAME.indexOf('orange dragon'),
    [AD_DISN]: MONSTER_NAME.indexOf('black dragon'),
    [AD_DRLI]: MONSTER_NAME.indexOf('black dragon'),
    [AD_ELEC]: MONSTER_NAME.indexOf('blue dragon'),
    [AD_SLOW]: MONSTER_NAME.indexOf('blue dragon'),
    [AD_ACID]: MONSTER_NAME.indexOf('yellow dragon'),
    [AD_STON]: MONSTER_NAME.indexOf('yellow dragon'),
};
const FIRST_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const LAST_DRAGON = MONSTER_NAME.indexOf('yellow dragon');

export function monsterCombatDefense(
    monster: Monster, damageType: DamageType, state: GameState = game,
): boolean {
    const artifact = artifactById(monsterWieldedWeapon(monster)?.oartifact, state);
    const defense = ARTIFACT_DEFENSE[damageType];
    if (artifact && defense !== undefined && (artifact.defense ?? null) === defense) return true;
    const armor = (monster.minvent ?? monster.inventory ?? [])
        .find(object => (object.owornmask ?? 0) & W_ARM);
    const dragon = monster.mnum >= FIRST_DRAGON && monster.mnum <= LAST_DRAGON
        ? monster.mnum : dragonFormForArmor(armor);
    return dragon !== null && dragon === DRAGON_DEFENSE[damageType];
}
