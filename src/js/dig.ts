// C dig.c:mdig_tunnel(). The movement owner admits a
// tunneling species with may_dig() before entering this action.
import {
    CORR, DOOR, D_BROKEN,
    D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, IS_OBSTRUCTED, IS_TREE,
    IS_WALL, ROOM, SCORR, SDOOR, SHOPBASE, W_NONDIGGABLE, isok,
} from './const.js';
import { convertSecretDoor } from './detect.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { formatDraftMessage } from './draft_message.js';
import { placeCreatedObject } from './floor_object.js';
import type { PlayingGameState } from './game_state.js';
import { requireLiveGame, game, requirePlayingGame } from './gstate.js';
import { placeTreeFruit } from './hero_digging.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { mksobj } from './mkobj.js';
import { triggerMonsterDoorTrap } from './monmove.js';
import type { Monster } from './monster_types.js';
import { BOULDER, ROCK } from './object_data.js';
import { inTown, roomsAt } from './room.js';
import { rn2, rnd } from './rng.js';
import { addShopDamage } from './shk.js';
import { vision_note_blocker_change } from './vision.js';

interface MonsterTunnelOptions {
    random?: typeof rn2;
    rollOne?: typeof rnd;
    publish?: MessagePublisher;
}

export interface MonsterTunnelResult { died: boolean; heroDied: boolean }

export async function digMonsterTunnel(monster: Monster, state: PlayingGameState, {
    random = rn2, rollOne = rnd, publish = plineWithContinuation,
}: MonsterTunnelOptions = {}): Promise<MonsterTunnelResult> {
    requireLiveGame(state);
    const pile = rollOne(12);
    const { mx: x, my: y } = monster;
    const level = state.level;
    const location = level.requireAt(x, y);
    if (location.typ === SDOOR) convertSecretDoor(location, state);

    if (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))) {
        if (roomsAt(level, x, y, SHOPBASE).length) addShopDamage(x, y, 0, state);
        const sawMonster = canSeeMonster(monster);
        const trapped = !!(location.doormask & D_TRAPPED);
        location.doormask = trapped ? D_NODOOR : D_BROKEN;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (trapped) {
            const trap = await triggerMonsterDoorTrap(monster, sawMonster || canSeeMonster(monster), {
                state, random, rollOne, publish,
            });
            if (trap.killed) await newsym(x, y);
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
        await newsym(x, y);
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
            if (message) await publish(message);
        }
        if (roomsAt(level, x, y, SHOPBASE).length) addShopDamage(x, y, 0, state);
        location.typ = level.flags.is_maze_lev ? ROOM
            : level.flags.is_cavernous_lev && !inTown(level, x, y) ? CORR : DOOR;
    } else {
        location.typ = tree ? ROOM : CORR;
    }
    location.flags = location.wall_info = location.doormask = 0;
    if (!wall && pile > 0 && pile < 5) {
        if (tree) await placeTreeFruit(x, y, state, random);
        else placeCreatedObject(await mksobj(pile === 1 ? BOULDER : ROCK, true, false), x, y, state);
    }
    await newsym(x, y);
    if (!level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        vision_note_blocker_change(x, y);
    return { died: false, heroDied: false };
}

// C dig.c:wiz_debug_cmd_bury(). Counts floor objects, including rocks which
// disappear into the ground rather than joining the buried-object list.
export async function wizBury(): Promise<void> {
    requirePlayingGame(game);
    const level = game.level;
    let before = 0, after = 0;
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (!isok(x, y)) continue;
            before += level.objects[x]?.[y]?.length ?? 0;
            await buryFloorObjectsAt(x, y);
            after += level.objects[x]?.[y]?.length ?? 0;
        }
    }
    const buried = before - after;
    await plineWithContinuation(before === 0 ? 'No objects here or adjacent to bury.'
        : buried === 0 ? 'No objects buried.'
            : `${buried} object${buried === 1 ? '' : 's'} buried.`);
    game.context.move = 0;
}
