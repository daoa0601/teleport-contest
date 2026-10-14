// C artifact.c:is_magic_key()/has_magic_key(), for monster carriers.
import { artifactById } from './artifacts.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
const PM_ROGUE = MONSTER_NAME.indexOf('rogue');
export function isMonsterMagicKey(monster, object, state = game) {
    if (artifactById(object.oartifact, state)?.name !== 'The Master Key of Thievery')
        return false;
    return monster.mnum === PM_ROGUE ? !object.cursed : !!object.blessed;
}
export function heroHasMagicKey(state = game) {
    return state.inventory.some(object => artifactById(object.oartifact, state)?.name === 'The Master Key of Thievery'
        && (state.urole?.key === 'rogue' ? !object.cursed : object.blessed));
}
export function monsterHasMagicKey(monster, state = game) {
    return (monster.minvent || []).some(object => isMonsterMagicKey(monster, object, state));
}
//# sourceMappingURL=monster_key.js.map