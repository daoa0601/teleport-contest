// C dig.c:mdig_tunnel(). The movement owner admits a
// tunneling species with may_dig() before entering this action.
import { CORR, DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, IS_OBSTRUCTED, IS_TREE, IS_WALL, ROOM, SCORR, SDOOR, SHOPBASE, W_NONDIGGABLE, } from './const.js';
import { convertSecretDoor } from './detect.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { formatDraftMessage } from './draft_message.js';
import { placeCreatedObject } from './floor_object.js';
import { requireLiveGame } from './gstate.js';
import { placeTreeFruit } from './hero_digging.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { mksobj } from './mklev.js';
import { triggerMonsterDoorTrap } from './monster_door_trap.js';
import { BOULDER, ROCK } from './object_data.js';
import { inTown, roomsAt } from './room.js';
import { rn2, rnd } from './rng.js';
import { addShopDamage } from './shop_damage.js';
import { vision_note_blocker_change } from './vision.js';
export async function digMonsterTunnel(monster, state, { random = rn2, rollOne = rnd, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const pile = rollOne(12);
    const { mx: x, my: y } = monster;
    const level = state.level;
    const location = level.requireAt(x, y);
    if (location.typ === SDOOR)
        convertSecretDoor(location, state);
    if (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))) {
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
        const sawMonster = canSeeMonster(monster);
        const trapped = !!(location.doormask & D_TRAPPED);
        location.doormask = trapped ? D_NODOOR : D_BROKEN;
        vision_note_blocker_change(x, y);
        newsym(x, y);
        if (trapped) {
            const trap = await triggerMonsterDoorTrap(monster, sawMonster || canSeeMonster(monster), {
                state, random, rollOne, publish,
            });
            if (trap.killed)
                newsym(x, y);
            return { died: trap.killed, heroDied: trap.heroDied };
        }
        if (state.flags.verbose && !heroIsUnaware(state) && random(3) === 0)
            await publish(formatDraftMessage(true, state, random));
        return { died: false, heroDied: false };
    }
    if (location.typ === SCORR) {
        location.typ = CORR;
        location.flags = location.wall_info = 0;
        vision_note_blocker_change(x, y);
        newsym(x, y);
        await publish(formatDraftMessage(false, state, random));
        return { died: false, heroDied: false };
    }
    if (!IS_OBSTRUCTED(location.typ) && !IS_TREE(location.typ))
        return { died: false, heroDied: false };
    if (location.wall_info & W_NONDIGGABLE) {
        const terrain = IS_WALL(location.typ) ? 'wall' : IS_TREE(location.typ) ? 'tree' : 'stone';
        await impossible(`mdig_tunnel:  ${terrain} at (${x},${y}) is undiggable`, { state });
        return { died: false, heroDied: false };
    }
    const wall = IS_WALL(location.typ);
    const tree = IS_TREE(location.typ);
    if (wall) {
        if (state.flags.verbose && random(5) === 0) {
            const message = formatHeardMessage('crashing rock.', state);
            if (message)
                await publish(message);
        }
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
        location.typ = level.flags.is_maze_lev ? ROOM
            : level.flags.is_cavernous_lev && !inTown(level, x, y) ? CORR : DOOR;
    }
    else {
        location.typ = tree ? ROOM : CORR;
    }
    location.flags = location.wall_info = location.doormask = 0;
    if (!wall && pile > 0 && pile < 5) {
        if (tree)
            await placeTreeFruit(x, y, state, random);
        else
            placeCreatedObject(await mksobj(pile === 1 ? BOULDER : ROCK, true, false), x, y, state);
    }
    newsym(x, y);
    if (!level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        vision_note_blocker_change(x, y);
    return { died: false, heroDied: false };
}
//# sourceMappingURL=monster_tunnel.js.map