// C mondata.c:on_fire(). The affected body determines what heat looks like.
import { AT_HUGS } from './monster_attack_types.js';
import { MONSTER_NAME, requireMonsterData } from './monster_data.js';
export function monsterFireDescription(monster, method) {
    const species = requireMonsterData(MONSTER_NAME, monster.mnum);
    switch (species) {
        case 'flaming sphere':
        case 'fire vortex':
        case 'fire elemental':
        case 'salamander':
            return 'already on fire';
        case 'water elemental':
        case 'fog cloud':
        case 'steam vortex':
            return 'boiling';
        case 'ice vortex':
        case 'glass golem':
            return 'melting';
        case 'stone golem':
        case 'clay golem':
        case 'gold golem':
        case 'air elemental':
        case 'earth elemental':
        case 'dust vortex':
        case 'energy vortex':
            return 'heating up';
        default:
            return method === AT_HUGS ? 'being roasted' : 'on fire';
    }
}
//# sourceMappingURL=monster_fire_description.js.map