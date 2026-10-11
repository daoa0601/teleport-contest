// C artifact.c:is_magic_key()/has_magic_key(), for monster carriers.
import { artifactById } from './artifacts.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { MONSTER_NAME } from './monster_data.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

const PM_ROGUE = MONSTER_NAME.indexOf('rogue');

export function isMonsterMagicKey(monster: Monster, object: GameObject, state: GameState = game): boolean {
    if (artifactById(object.oartifact, state)?.name !== 'The Master Key of Thievery') return false;
    return monster.mnum === PM_ROGUE ? !object.cursed : !!object.blessed;
}

export function monsterHasMagicKey(monster: Monster, state: GameState = game): boolean {
    return (monster.minvent || []).some(object => isMonsterMagicKey(monster, object, state));
}
