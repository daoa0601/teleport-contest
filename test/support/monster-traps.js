import { addTrap } from './level-state.js';
import { addMonster } from './monsters.js';
import { freshObjectRoom } from './object-room.js';

export function freshMonsterTrapRoom(trapType, {
    x = 11,
    y = 10,
    gameplaySeed,
    room = {},
    monster = {},
    trap = {},
} = {}) {
    const level = freshObjectRoom({ ...room, gameplaySeed });
    const actor = addMonster({
        species: 'giant',
        hitPoints: 20,
        ...monster,
        x,
        y,
    });
    const placedTrap = addTrap(level, trapType, x, y, trap);
    return { level, monster: actor, trap: placedTrap };
}
