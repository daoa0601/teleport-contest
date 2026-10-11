import { requirePlayingGame } from './gstate.js';
// C lock.c:doorlock()/obstructed(). Traversal owns wand discovery, billable
// shop damage, drawbridge effects, and the decision to target a door.
import { game, requireLiveGame } from './gstate.js';
import { DOOR, SDOOR, D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, SHOPBASE, Is_rogue_level, } from './const.js';
import { WAN_OPENING, WAN_LOCKING, WAN_STRIKING, SPE_KNOCK, SPE_WIZARD_LOCK, SPE_FORCE_BOLT, } from './object_data.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym, plineWithContinuation } from './display.js';
import { cansee, vision_note_blocker_change, vision_recalc } from './vision.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, possessiveName } from './monster_name.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroIsDeaf } from './senses.js';
import { formatHeardMessage } from './hero_speech.js';
import { triggerMonsterDoorTrap } from './monster_door_trap.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { stopHeroOccupation } from './occupation.js';
import { impossible } from './diagnostics.js';
const WAND_CLASS = 11;
export async function changeDoorByMagic(source, x, y, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const door = state.level.at(x, y);
    if (!door || ![DOOR, SDOOR].includes(door.typ))
        return false;
    const opening = [WAN_OPENING, SPE_KNOCK].includes(source.otyp);
    const locking = [WAN_LOCKING, SPE_WIZARD_LOCK].includes(source.otyp);
    const striking = [WAN_STRIKING, SPE_FORCE_BOLT].includes(source.otyp);
    if (door.typ === SDOOR) {
        if (!opening && !striking)
            return false;
        // Magic exposes a closed door; it does not preserve a secret lock.
        door.typ = DOOR;
        door.doormask = D_CLOSED | (door.doormask & D_TRAPPED);
        newsym(x, y);
        if (cansee(x, y))
            await plineWithContinuation('A door appears in the wall!');
        if (opening)
            return true;
    }
    let changed = true, message = null, loudness = 0;
    if (locking) {
        const quietly = source.oclass === WAND_CLASS && !source.dknown;
        if (Is_rogue_level(state.u.uz)) {
            const visible = cansee(x, y);
            if (visible)
                await plineWithContinuation('A cloud of dust springs up in the older, more primitive doorway.');
            else
                await publishHeard('a swoosh.', state);
            if (await obstructed(x, y, quietly, state)) {
                if (visible)
                    await plineWithContinuation('The cloud quickly dissipates.');
                return false;
            }
            door.typ = SDOOR;
            door.doormask = D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible)
                await plineWithContinuation('The doorway vanishes!');
            newsym(x, y);
            return true;
        }
        if (await obstructed(x, y, quietly, state))
            return false;
        if (state.level.traps.some(trap => trap.tx === x && trap.ty === y)) {
            await plineWithContinuation('A cloud of dust springs up in the doorway, but quickly dissipates.');
            return false;
        }
        switch (door.doormask & ~D_TRAPPED) {
            case D_CLOSED:
                message = 'The door locks!';
                break;
            case D_ISOPEN:
                message = 'The door swings shut, and locks!';
                break;
            case D_BROKEN:
                message = 'The broken door reassembles and locks!';
                break;
            case D_NODOOR:
                message = 'A cloud of dust springs up and assembles itself into a door!';
                break;
            default:
                changed = false;
                break;
        }
        door.doormask = D_LOCKED | (door.doormask & D_TRAPPED);
        vision_note_blocker_change(x, y);
        newsym(x, y);
    }
    else if (opening) {
        if (door.doormask & D_LOCKED) {
            message = 'The door unlocks!';
            door.doormask = D_CLOSED | (door.doormask & D_TRAPPED);
        }
        else
            changed = false;
    }
    else if (striking) {
        if (!(door.doormask & (D_LOCKED | D_CLOSED)))
            changed = false;
        else if (door.doormask & D_TRAPPED) {
            const occupant = monsterAtPosition(state.level, x, y);
            const saw = occupant ? canSeeMonster(occupant) : cansee(x, y);
            door.doormask = D_NODOOR;
            vision_note_blocker_change(x, y);
            newsym(x, y);
            const sees = occupant ? canSeeMonster(occupant) : cansee(x, y);
            if (occupant)
                await triggerMonsterDoorTrap(occupant, saw || sees, { state });
            else {
                loudness = 40;
                if (state.flags.verbose) {
                    if ((saw || sees) && !heroIsUnaware(state))
                        await plineWithContinuation('KABOOM!!  You see a door explode.');
                    else if (!heroIsDeaf(state)) {
                        const dx = x - state.u.ux, dy = y - state.u.uy;
                        await publishHeard(`a ${dx * dx + dy * dy > 49 ? 'distant' : 'nearby'} explosion.`, state);
                    }
                }
            }
        }
        else {
            const saw = cansee(x, y);
            door.doormask = D_BROKEN;
            vision_note_blocker_change(x, y);
            const sees = cansee(x, y);
            newsym(x, y);
            if (state.flags.verbose) {
                if ((saw || sees) && !heroIsUnaware(state))
                    await plineWithContinuation('The door crashes open!');
                else if (!heroIsDeaf(state))
                    await publishHeard('a crashing sound.', state);
            }
            if (state.vision_full_recalc)
                vision_recalc(0);
            loudness = 20;
        }
    }
    else
        await impossible(`magic (${source.otyp}) attempted on door.`);
    if (message && cansee(x, y))
        await plineWithContinuation(message);
    if (loudness) {
        await wakeMonstersNearWithMessages(x, y, loudness, state);
        if (roomsAt(state.level, x, y, SHOPBASE).length)
            addShopDamage(x, y, 0, state);
    }
    if (changed && state._occupation?.key === 'pick-lock' && state._occupation.door === door)
        await stopHeroOccupation(state);
    return changed;
}
async function obstructed(x, y, quietly, state) {
    const occupant = monsterAtPosition(state.level, x, y);
    if (occupant && M_AP_TYPE(occupant) !== M_AP_FURNITURE) {
        if (M_AP_TYPE(occupant) === M_AP_OBJECT) {
            if (!quietly)
                await plineWithContinuation("Something's in the way.");
            return true;
        }
        if (!quietly) {
            let name = monsterName(occupant, { capitalized: true, augmentIt: true, state });
            if ((occupant.mx !== x || occupant.my !== y) && canSpotMonster(occupant))
                name = `${possessiveName(name)} tail`;
            await plineWithContinuation(`${name} blocks the way!`);
        }
        if (!canSpotMonster(occupant))
            map_invisible(x, y);
        return true;
    }
    if (state.level.objects?.[x]?.[y]?.length) {
        if (!quietly)
            await plineWithContinuation("Something's in the way.");
        return true;
    }
    return false;
}
async function publishHeard(text, state) {
    const message = formatHeardMessage(text, state);
    if (message)
        await plineWithContinuation(message);
}
//# sourceMappingURL=door_magic.js.map