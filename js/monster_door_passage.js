// C monmove.c:postmov(). Fog shifting precedes mintrap(); door and bars
// effects follow it and complete their own messages before movement resumes.
import { DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, IRONBARS, SHOPBASE, W_NONDIGGABLE, } from './const.js';
import { canSeeMonster, canSpotMonster, displayMessageWindow, newsym, plineWithContinuation, } from './display.js';
import { requireLiveGame } from './gstate.js';
import { formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL, monsterHasNoLimbs, monsterIsAmorphous, monsterIsSlithy, } from './monster_data.js';
import { triggerMonsterDoorTrap } from './monster_door_trap.js';
import { monsterHasMagicKey } from './monster_key.js';
import { placeMonsterAt } from './monster_location.js';
import { monsterCorrodesBars } from './monster_movement_traits.js';
import { monsterName } from './monster_name.js';
import { monsterCanFog } from './monster_perception.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { makePlural } from './object_grammar.js';
import { dissolveBars } from './projectile_bars.js';
import { roomsAt } from './room.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { addShopDamage } from './shop_damage.js';
import { cansee, vision_note_blocker_change, vision_recalc } from './vision.js';
const M1_FLY = 0x00000001;
const M1_WALLWALK = 0x00000008;
const M1_METALLIVORE = 0x80000000;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
export async function shiftMonsterForDoor(monster, state, { previousPosition, wasSeen, wasSpotted, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const destination = { x: monster.mx, y: monster.my };
    const door = state.level.requireAt(destination.x, destination.y);
    if (monsterIsAmorphous(monster) || door.typ !== DOOR
        || !(door.doormask & (D_CLOSED | D_LOCKED)) || !monsterCanFog(monster, state))
        return { died: false, heroDied: false };
    if (wasSeen || wasSpotted) {
        placeMonsterAt(monster, previousPosition.x, previousPosition.y);
        newsym(destination.x, destination.y);
        newsym(previousPosition.x, previousPosition.y);
    }
    const change = await changeMonsterForm(monster, PM_FOG_CLOUD, state, {
        showMessage: wasSeen, publish, creditHero: false,
    });
    await displayMessageWindow();
    const died = !!monster.dead || monster.mhp <= 0;
    const heroDied = !!change?.heroDied || !!state.program_state.gameover;
    if (!died && (wasSeen || wasSpotted)) {
        placeMonsterAt(monster, destination.x, destination.y);
        newsym(previousPosition.x, previousPosition.y);
        newsym(destination.x, destination.y);
    }
    return { died, heroDied };
}
export async function resolveMonsterDoorPassage(monster, state, { canOpen, canUnlock, canTunnel, wasDoorVisible, random = rn2, rollOne = rnd, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const { mx: x, my: y } = monster;
    const location = state.level.requireAt(x, y);
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (location.typ === IRONBARS) {
        if (!(location.wall_info & W_NONDIGGABLE)
            && (monsterCorrodesBars(monster) || body & M1_METALLIVORE)) {
            if (canSeeMonster(monster))
                await publish(`${monsterName(monster, { state, capitalized: true })} eats through the iron bars.`);
            await dissolveBars(x, y, state);
            return { status: 'done', heroDied: !!state.program_state.gameover };
        }
        if (state.flags.verbose && canSeeMonster(monster)) {
            const verb = makePlural(passageLocomotion(monster));
            const passage = body & M1_WALLWALK ? 'through' : 'between';
            await publish(`${monsterName(monster, { state, capitalized: true })} ${verb} ${passage} the iron bars.`, { noRepeat: true });
        }
        return { status: 'continue', heroDied: false };
    }
    if (location.typ !== DOOR || body & M1_WALLWALK || canTunnel)
        return { status: 'continue', heroDied: false };
    let trapped = !!(location.doormask & D_TRAPPED);
    if (trapped && monsterHasMagicKey(monster, state)) {
        location.doormask &= ~D_TRAPPED;
        trapped = false;
    }
    const closed = !!(location.doormask & (D_LOCKED | D_CLOSED));
    if (closed && monsterIsAmorphous(monster)) {
        if (state.flags.verbose && canSeeMonster(monster)) {
            const verb = monster.mnum === PM_FOG_CLOUD || MONSTER_SYMBOL[monster.mnum] === S_LIGHT
                ? 'flows' : 'oozes';
            await publish(`${monsterName(monster, { state, capitalized: true, article: 'your' })} ${verb} under the door.`);
        }
        return { status: 'continue', heroDied: false };
    }
    let action;
    let mask;
    if (location.doormask & D_LOCKED && canUnlock) {
        action = 'unlock';
        mask = trapped ? D_NODOOR : D_ISOPEN;
    }
    else if (location.doormask === D_CLOSED && canOpen) {
        action = 'open';
        mask = D_ISOPEN;
    }
    else if (closed) {
        action = 'break';
        mask = trapped || (location.doormask & D_LOCKED && random(2) === 0)
            ? D_NODOOR : D_BROKEN;
    }
    else
        return { status: 'continue', heroDied: false };
    location.doormask = mask;
    newsym(x, y);
    vision_note_blocker_change(x, y);
    vision_recalc(0);
    const seesDoor = wasDoorVisible || cansee(x, y);
    if (trapped) {
        const trap = await triggerMonsterDoorTrap(monster, seesDoor, { state, random, rollOne, publish });
        if (trap.killed || trap.heroDied)
            return { status: trap.killed ? 'died' : 'continue', heroDied: trap.heroDied };
    }
    else if (state.flags.verbose) {
        const actorAction = action === 'unlock' ? 'unlocks and opens'
            : action === 'open' ? 'opens' : 'smashes down';
        const doorAction = action === 'unlock' ? 'unlock and open'
            : action === 'open' ? 'open' : 'crash open';
        const message = seesDoor && canSpotMonster(monster)
            ? `${monsterName(monster, { state, capitalized: true })} ${actorAction} a door.`
            : seesDoor ? formatSeenMessage(`a door ${doorAction}.`, state)
                : !heroIsDeaf(state) ? formatHeardMessage(`a door ${doorAction}.`, state) : null;
        if (message)
            await publish(message);
    }
    if (action === 'break' && roomsAt(state.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0, state);
    return { status: 'continue', heroDied: false };
}
// C mondata.c:locomotion(ptr, "pass"). makeplural supplies the third-person
// verb expected by the native iron-bars message.
function passageLocomotion(monster) {
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if ([S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[monster.mnum] ?? -1))
        return 'float';
    if (body & M1_FLY)
        return 'fly';
    if (monsterIsSlithy(monster.mnum))
        return 'slither';
    if (monsterIsAmorphous(monster))
        return 'ooze';
    if (!MONSTER_MOVE[monster.mnum])
        return 'wiggle';
    return monsterHasNoLimbs(monster.mnum) ? 'crawl' : 'pass';
}
//# sourceMappingURL=monster_door_passage.js.map