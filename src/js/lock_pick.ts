// Applying keys, picks and cards. C lock.c:pick_lock(), picklock(), autokey().
import { artifactById } from './artifacts.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroFingerName } from './body_parts.js';
import { triggerChestTrap } from './chest_trap.js';
import {
    A_DEX, A_WIS, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP,
    AUTOUNLOCK_FORCE, DBWALL, DOOR, D_NODOOR, D_ISOPEN, D_BROKEN, D_LOCKED, D_CLOSED,
    D_TRAPPED, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, SHOPBASE, TT_PIT, isok, SHOP_DOOR_COST,
} from './const.js';
import { recordMappedOverviewState } from './dungeon.js';
import { findDrawbridgeAt } from './dbridge.js';
import {
    canSeeMonster, displayLiquidName, feel_location, glyphAt, newsym,
    plineWithContinuation as pline,
} from './display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import { resetPick } from './lock_context.js';
import { hasDoorAppearance, stumbleOntoMimic } from './mimic.js';
import { monsterAtPosition } from './monster_location.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { maybeAbsorbItem } from './monster_item_absorption.js';
import {
    CHEST, CREDIT_CARD, LARGE_BOX, LOCK_PICK, SKELETON_KEY,
} from './object_data.js';
import { inventoryItemDescription } from './invent.js';
import {
    definiteName, observeObjectForNaming, ownedObjectName, simpleObjectNameWithArticle,
    simpleObjectTypeName, objectName,
} from './objnam.js';
import type { GameObject } from './object_types.js';
import type { PickLockOccupation } from './occupation_types.js';
import { heroHasNoHands } from './polyself.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn2 } from './rng.js';
import { roomsAt } from './room.js';
import { heroIsBlind } from './senses.js';
import { addShopDamage } from './shop_damage.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { promptDirection } from './tty_prompts.js';
import { untrap, untrapAbilityProblem } from './untrap.js';
import { cansee, vision_note_blocker_change } from './vision.js';

export function autoUnlockFlags(state: GameState = game): number {
    const setting = state.flags.autounlock;
    if (setting === undefined || setting === true) return AUTOUNLOCK_APPLY_KEY;
    if (typeof setting === 'number') return setting;
    if (!setting) return 0;
    const choices = setting.split(setting.includes('+') ? '+' : /\s+/);
    const unlockTypes = [
        { name: 'untrap', flag: AUTOUNLOCK_UNTRAP },
        { name: 'apply-key', flag: AUTOUNLOCK_APPLY_KEY },
        { name: 'kick', flag: AUTOUNLOCK_KICK },
        { name: 'force', flag: AUTOUNLOCK_FORCE },
    ];
    let flags = 0;
    for (const value of choices) {
        const choice = value.trim().toLowerCase();
        if (!choice) continue;
        if ('none'.startsWith(choice)) return 0;
        const compact = choice.replace(/[ _-]/g, '');
        for (const type of unlockTypes) {
            if (type.name.startsWith(choice) || type.name.replace('-', '') === compact) {
                flags |= type.flag;
                break;
            }
        }
    }
    return flags;
}

export function isHeroMagicKey(tool: GameObject | null, state: GameState = game): boolean {
    if (!tool) return false;
    return artifactById(tool.oartifact, state)?.name === 'The Master Key of Thievery'
        && (state.urole?.key === 'rogue' ? !tool.cursed : !!tool.blessed);
}

export function autokey(opening: boolean, state: GameState = game): GameObject | null {
    let key: GameObject | null = null, pick: GameObject | null = null, card: GameObject | null = null;
    let foreignKey: GameObject | null = null, foreignPick: GameObject | null = null, foreignCard: GameObject | null = null;
    for (const tool of state.inventory) {
        const artifact = artifactById(tool.oartifact, state);
        const foreign = artifact?.questArtifact && artifact.name.toLowerCase() !== state.urole?.artifactName.toLowerCase();
        if (foreign) {
            if (tool.otyp === SKELETON_KEY && !foreignKey) foreignKey = tool;
            else if (tool.otyp === LOCK_PICK && !foreignPick) foreignPick = tool;
            else if (tool.otyp === CREDIT_CARD && !foreignCard) foreignCard = tool;
        } else {
            if (tool.otyp === SKELETON_KEY && (!key || isHeroMagicKey(tool, state))) key = tool;
            else if (tool.otyp === LOCK_PICK && !pick) pick = tool;
            else if (tool.otyp === CREDIT_CARD && !card) card = tool;
        }
    }
    if (!opening) card = foreignCard = null;
    if (!key && !pick && !card) key = foreignKey;
    if (!pick && !card) pick = foreignPick;
    if (!card) card = foreignCard;
    return key || pick || card;
}

export function lockToolName(tool: GameObject, state: GameState = game): string {
    observeObjectForNaming(tool);
    return ownedObjectName(tool, state, { capitalized: false });
}

// True includes the native "learned something" result, which takes a turn.
export async function pickLock(tool: GameObject | null, {
    state = game, target = null, container = null,
}: { state?: GameState; target?: Position | null; container?: GameObject | null } = {}): Promise<boolean> {
    requirePlayingGame(state);
    const previous = state._lockAttempt;
    // Native uses picktyp 0 for both a missing tool and blunt forcing.
    const samePickType = previous?.key === 'pick-lock'
        ? previous.tool?.otyp === tool?.otyp
        : previous?.key === 'force-lock' && !previous.picktyp && !tool;
    if (previous?.usedtime && samePickType) {
        if (heroHasNoHands(state)) {
            const noun = tool?.otyp === LOCK_PICK ? 'pick' : tool?.otyp === CREDIT_CARD ? 'card' : 'key';
            await pline(`Unfortunately, you can no longer hold the ${noun}.`);
            resetPick(state);
        } else if (state.u.uswallow || previous.container && !heroCanReachFloor(state, { checkPit: true })) {
            await pline('Unfortunately, you can no longer reach the lock.');
            resetPick(state);
        } else {
            const attempt: PickLockOccupation = previous.key === 'pick-lock' ? previous : {
                key: 'pick-lock', text: '', remaining: 51, tool,
                container: previous.container,
                x: previous.container.ox, y: previous.container.oy,
                chance: previous.chance, usedtime: previous.usedtime,
            };
            attempt.text = lockAction(attempt);
            attempt.magicKey = isHeroMagicKey(tool, state);
            await pline(`You resume your attempt at ${attempt.text}.`);
            state._lockAttempt = state._occupation = attempt;
        }
        return true;
    }
    if (heroHasNoHands(state)) {
        await pline(`You can't hold ${tool ? await inventoryItemDescription(tool) : 'that'} -- you have no hands!`);
        return false;
    }
    if (state.u.uswallow) {
        await pline(`You can't ${tool?.otyp === CREDIT_CARD ? '' : 'lock or '}unlock ${state.u.ustuck ? monsterName(state.u.ustuck) : 'the monster'}.`);
        return false;
    }
    const automatic = target !== null || container !== null;
    let position = target;
    if (!position) {
        const direction = await promptDirection();
        if (!direction) {
            await pline('Never mind.');
            return false;
        }
        position = { x: state.u.ux + direction.dx, y: state.u.uy + direction.dy };
        if (!isok(position.x, position.y)) {
            await pline('Invalid location!');
            return false;
        }
    }
    const { x, y } = position;
    if (x === state.u.ux && y === state.u.uy)
        return pickBoxLock(tool, container, automatic, state);
    return pickDoorLock(tool, x, y, automatic, state);
}

async function pickBoxLock(tool: GameObject | null, container: GameObject | null, automatic: boolean, state: GameState): Promise<boolean> {
    const { ux: x, uy: y } = state.u;
    if ((state.u.dz ?? 0) < 0 && !automatic) {
        await pline(`There isn't any sort of lock up ${state.u.levitating || state.levitating ? 'here' : 'there'}.`);
        return true;
    }
    if (isLavaAt(x, y, state)) {
        await pline(`Doing that would probably melt ${tool ? lockToolName(tool, state) : 'your tool'}.`);
        return true;
    }
    if (isPoolAt(x, y, state) && !(state.underwater || state.u.uinwater)) {
        await pline(`The ${displayLiquidName('water', state)} has no lock.`);
        return true;
    }
    const boxes = (state.level?.objects[x]?.[y] ?? []).filter(box =>
        (box.otyp === CHEST || box.otyp === LARGE_BOX) && (!automatic || box === container));
    for (const box of boxes) {
        if (!heroCanReachFloor(state, { checkPit: true })) {
            await pline(`You can't reach ${definiteName(objectName(box), state)} from up here.`);
            return true;
        }
        const flags = autoUnlockFlags(state);
        if (automatic && flags & AUTOUNLOCK_UNTRAP && !untrapAbilityProblem(state, { checkFloor: true })) {
            const answer = box.tknown ? box.otrapped ? 'y' : 'n'
                : await promptYesNoQuit(`Check ${ownedObjectName(box, state, { capitalized: false })} for a trap?`);
            if (answer === 'q') return false;
            if (answer === 'y') {
                await untrap({ state, container: box });
                return true;
            }
        }
        if (automatic && flags & AUTOUNLOCK_APPLY_KEY) {
            if (!tool || await promptYesNoQuit(`Unlock it with ${lockToolName(tool, state)}?`) !== 'y') return false;
        } else {
            const verb = box.obroken ? 'fix its lock' : !box.olocked ? 'lock it'
                : tool?.otyp === LOCK_PICK ? 'pick its lock' : 'unlock it';
            observeObjectForNaming(box, { state });
            const description = await inventoryItemDescription(box);
            box.lknown = true;
            const answer = await promptYesNoQuit(`There is ${description} here; ${verb}?`);
            if (answer === 'q') return false;
            if (answer === 'n') continue;
        }
        if (box.obroken) {
            await pline(`You can't fix its broken lock with ${tool ? simpleObjectNameWithArticle(tool, state) : 'that'}.`);
            return true;
        }
        if (tool?.otyp === CREDIT_CARD && !box.olocked) {
            await pline(`You can't do that with a ${simpleObjectTypeName(tool.otyp, state)}.`);
            return true;
        }
        if (automatic && tool) {
            const touch = await touchArtifactByHero(tool, artifactById(tool.oartifact, state), { state });
            if (!touch.allowed || touch.died) return true;
        }
        startPicking(tool, { container: box }, state);
        return true;
    }
    if (!boxes.length) await pline("There doesn't seem to be any sort of lock here.");
    return true;
}

async function pickDoorLock(tool: GameObject | null, x: number, y: number, automatic: boolean, state: GameState): Promise<boolean> {
    requirePlayingGame(state);
    if (state.u.utrap && state.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        return false;
    }
    const door = state.level.requireAt(x, y);
    const monster = monsterAtPosition(state.level, x, y);
    if (monster && canSeeMonster(monster) && M_AP_TYPE(monster) !== M_AP_FURNITURE && M_AP_TYPE(monster) !== M_AP_OBJECT) {
        await pline(tool?.otyp === CREDIT_CARD && (monster.isshk || monster.mnum === MONSTER_NAME.indexOf('Oracle'))
            ? '"No checks, no credit, no problem."'
            : `I don't think ${monsterName(monster)} would appreciate that.`);
        return true;
    }
    if (hasDoorAppearance(monster)) {
        await stumbleOntoMimic(monster, state);
        if (tool) await maybeAbsorbItem(monster, tool, state);
        return true;
    }
    if (door.typ !== DOOR) {
        const previousGlyph = glyphAt(x, y)?.glyph;
        recordMappedOverviewState();
        const previousTerrain = door.lastseentyp;
        feel_location(x, y);
        const learned = glyphAt(x, y)?.glyph !== previousGlyph || door.lastseentyp !== previousTerrain;
        const portcullis = door.typ === DBWALL && findDrawbridgeAt(x, y, state) !== null;
        await pline(`You ${heroIsBlind(state) ? 'feel' : 'see'} no ${portcullis ? 'lock on the drawbridge' : 'door there'}.`);
        return learned;
    }
    if (door.doormask === D_NODOOR || door.doormask === D_ISOPEN || door.doormask === D_BROKEN) {
        await pline(door.doormask === D_NODOOR ? 'This doorway has no door.'
            : door.doormask === D_ISOPEN ? 'You cannot lock an open door.' : 'This door is broken.');
        return true;
    }
    if (autoUnlockFlags(state) & AUTOUNLOCK_UNTRAP && !untrapAbilityProblem(state)) {
        const answer = await promptYesNoQuit('Check this door for a trap?');
        if (answer === 'q') return false;
        if (answer === 'y') {
            await untrap({ state, door: { x, y } });
            return true;
        }
    }
    if (tool?.otyp === CREDIT_CARD && !(door.doormask & D_LOCKED)) {
        await pline("You can't lock a door with a credit card.");
        return true;
    }
    const action = door.doormask & D_LOCKED ? 'Unlock' : 'Lock';
    const answer = await promptYesNoQuit(`${action} it${automatic && tool ? ` with ${lockToolName(tool, state)}` : ''}?`);
    if (answer !== 'y' || !tool) return false;
    if (automatic) {
        const touch = await touchArtifactByHero(tool, artifactById(tool.oartifact, state), { state });
        if (!touch.allowed || touch.died) return true;
    }
    startPicking(tool, { door, x, y }, state);
    return true;
}

function startPicking(tool: GameObject | null, target: Pick<PickLockOccupation, 'door' | 'container'> & Partial<Position>, state: GameState): void {
    const attempt: PickLockOccupation = {
        key: 'pick-lock', text: '', remaining: 51, usedtime: 0, tool,
        x: target.x ?? state.u.ux, y: target.y ?? state.u.uy,
        ...target, chance: lockPickChance(tool, target.container, state), magicKey: isHeroMagicKey(tool, state),
    };
    attempt.text = lockAction(attempt);
    state._lockAttempt = state._occupation = attempt;
}

export async function continuePicking(occupation: PickLockOccupation, state: GameState = game): Promise<boolean> {
    requirePlayingGame(state);
    const box = occupation.container;
    const door = occupation.door;
    if (box) {
        if (box.where !== 'floor' || box.ox !== state.u.ux || box.oy !== state.u.uy) {
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
    } else if (door) {
        if (state.level.at(state.u.ux + (state.u.dx ?? 0), state.u.uy + (state.u.dy ?? 0)) !== door) {
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
        if (door.doormask === D_NODOOR || door.doormask === D_ISOPEN || door.doormask === D_BROKEN) {
            await pline(door.doormask === D_NODOOR ? 'This doorway has no door.'
                : door.doormask === D_ISOPEN ? 'You cannot lock an open door.' : 'This door is broken.');
            occupation.usedtime = 0;
            state._occupation = null;
            return false;
        }
    }
    const usedtime = occupation.usedtime++;
    const action = lockAction(occupation);
    if (usedtime >= 50 || heroHasNoHands(state)) {
        await pline(`You give up your attempt at ${action}.`);
        await exerciseAttribute(A_DEX, true, state);
    } else if (rn2(100) >= occupation.chance) return true;
    else if ((box?.otrapped || door && door.doormask & D_TRAPPED) && occupation.magicKey) {
        occupation.chance += 20;
        if (box) {
            if (!box.tknown) await pline('You find a trap!');
            box.tknown = true;
        }
        if (await promptYesNo('Do you want to try to disarm it?') === 'y') {
            const locked = door ? !!(door.doormask & D_LOCKED) : !!box?.olocked;
            if (door) door.doormask &= ~D_TRAPPED;
            else if (box) { box.otrapped = false; box.tknown = false; }
            await pline(`You succeed in disarming the trap.  The ${door ? 'door' : box?.otyp === CHEST ? 'chest' : 'box'} is still ${locked ? '' : 'un'}locked.`);
            await exerciseAttribute(A_WIS, true, state);
        } else {
            await pline(`You stop ${action}.`);
            await exerciseAttribute(A_WIS, false, state);
        }
    } else {
        await pline(`You succeed in ${action}.`);
        if (door) {
            if (door.doormask & D_TRAPPED) {
                if (await triggerBoobyTrap('door', { bodypart: true, state })) return false;
                door.doormask = D_NODOOR;
                vision_note_blocker_change(occupation.x, occupation.y);
                if (roomsAt(state.level, occupation.x, occupation.y, SHOPBASE).length)
                    addShopDamage(occupation.x, occupation.y, SHOP_DOOR_COST, state);
                newsym(occupation.x, occupation.y);
            } else door.doormask = door.doormask & D_LOCKED ? D_CLOSED : D_LOCKED;
        } else if (box) {
            box.olocked = !box.olocked;
            box.lknown = true;
            if (box.otrapped) {
                const trap = await triggerChestTrap(box, { state, bodyPart: heroFingerName(state) });
                if (trap?.died) return false;
            }
        }
        await exerciseAttribute(A_DEX, true, state);
    }
    occupation.usedtime = 0;
    state._occupation = null;
    return false;
}

function lockAction(attempt: PickLockOccupation): string {
    if (attempt.door && !(attempt.door.doormask & D_LOCKED)) return 'locking the door';
    if (attempt.container && !attempt.container.olocked)
        return `locking the ${attempt.container.otyp === CHEST ? 'chest' : 'box'}`;
    if (attempt.tool?.otyp === LOCK_PICK || attempt.tool?.otyp === CREDIT_CARD) return 'picking the lock';
    return `unlocking the ${attempt.door ? 'door' : attempt.container?.otyp === CHEST ? 'chest' : 'box'}`;
}

function lockPickChance(tool: GameObject | null, box: GameObject | undefined, state: GameState): number {
    if (!tool) return 0;
    const dexterity = currentAttribute(A_DEX, state);
    const rogue = state.urole?.key === 'rogue';
    let chance;
    switch (tool.otyp) {
    case CREDIT_CARD:
        chance = (box ? dexterity : 2 * dexterity) + (rogue ? 20 : 0);
        break;
    case LOCK_PICK:
        chance = (box ? 4 : 3) * dexterity + (rogue ? (box ? 25 : 30) : 0);
        break;
    default:
        chance = (box ? 75 : 70) + dexterity;
        break;
    }
    if (box?.cursed) chance = Math.trunc(chance / 2);
    return chance;
}

